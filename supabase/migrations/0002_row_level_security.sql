-- =============================================================================
-- Samarkhand Hotel — Row Level Security
--
-- The threat model: the anon key ships to every browser. It must therefore be
-- assumed public, and the database — not the application — is what stops an
-- attacker reading guest data or editing hotel content with it.
--
-- Rules applied here:
--   * anon may READ only published marketing content.
--   * anon may INSERT a booking inquiry and a contact message, and nothing
--     else. It may not read back what it wrote.
--   * anon may INSERT an analytics event, and may never read the table.
--   * every write to hotel content requires a staff profile.
--   * guest PII (bookings, inquiries) is readable by staff only.
-- =============================================================================

alter table profiles              enable row level security;
alter table hotel_settings        enable row level security;
alter table site_content          enable row level security;
alter table media_assets          enable row level security;
alter table amenities             enable row level security;
alter table rooms                 enable row level security;
alter table room_amenities        enable row level security;
alter table room_media            enable row level security;
alter table offers                enable row level security;
alter table offer_rooms           enable row level security;
alter table campaigns             enable row level security;
alter table bookings              enable row level security;
alter table booking_status_history enable row level security;
alter table contact_inquiries     enable row level security;
alter table testimonials          enable row level security;
alter table analytics_events      enable row level security;
alter table audit_logs            enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "own profile is readable"
  on profiles for select
  using (id = auth.uid() or is_admin());

-- Role changes are an admin-only operation and never a self-service one:
-- without this, any staff member could promote themselves.
create policy "admins manage profiles"
  on profiles for all
  using (is_admin())
  with check (is_admin());

-- -----------------------------------------------------------------------------
-- Public marketing content — read published, write as staff
-- -----------------------------------------------------------------------------

create policy "settings are publicly readable"
  on hotel_settings for select using (true);
create policy "staff update settings"
  on hotel_settings for update using (is_staff()) with check (is_staff());

create policy "content is publicly readable"
  on site_content for select using (true);
create policy "staff update content"
  on site_content for update using (is_staff()) with check (is_staff());

create policy "media is publicly readable"
  on media_assets for select using (true);
create policy "staff manage media"
  on media_assets for all using (is_staff()) with check (is_staff());

create policy "active amenities are publicly readable"
  on amenities for select using (is_active or is_staff());
create policy "staff manage amenities"
  on amenities for all using (is_staff()) with check (is_staff());

-- Draft and archived rooms stay invisible to the public.
create policy "published rooms are publicly readable"
  on rooms for select using (status = 'published' or is_staff());
create policy "staff manage rooms"
  on rooms for all using (is_staff()) with check (is_staff());

create policy "room amenities follow the room"
  on room_amenities for select using (
    exists (select 1 from rooms r where r.id = room_id and (r.status = 'published' or is_staff()))
  );
create policy "staff manage room amenities"
  on room_amenities for all using (is_staff()) with check (is_staff());

create policy "room media follow the room"
  on room_media for select using (
    exists (select 1 from rooms r where r.id = room_id and (r.status = 'published' or is_staff()))
  );
create policy "staff manage room media"
  on room_media for all using (is_staff()) with check (is_staff());

create policy "published offers are publicly readable"
  on offers for select using (status = 'published' or is_staff());
create policy "staff manage offers"
  on offers for all using (is_staff()) with check (is_staff());

create policy "offer rooms follow the offer"
  on offer_rooms for select using (
    exists (select 1 from offers o where o.id = offer_id and (o.status = 'published' or is_staff()))
  );
create policy "staff manage offer rooms"
  on offer_rooms for all using (is_staff()) with check (is_staff());

-- Scheduling is enforced in SQL as well as in the application, so an expired
-- campaign cannot leak through a direct PostgREST query.
create policy "live campaigns are publicly readable"
  on campaigns for select using (
    is_staff()
    or (
      status = 'published'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );
create policy "staff manage campaigns"
  on campaigns for all using (is_staff()) with check (is_staff());

create policy "published testimonials are publicly readable"
  on testimonials for select using (is_published or is_staff());
create policy "staff manage testimonials"
  on testimonials for all using (is_staff()) with check (is_staff());

-- -----------------------------------------------------------------------------
-- Guest submissions — insert-only for the public
-- -----------------------------------------------------------------------------

-- A guest may create an inquiry. There is deliberately no public SELECT:
-- being able to read the bookings table back would expose every other guest's
-- name, email and phone number.
create policy "anyone may submit a booking inquiry"
  on bookings for insert
  with check (
    status = 'pending'
    and internal_notes is null
    and check_out > check_in
  );

create policy "staff read bookings"
  on bookings for select using (is_staff());
create policy "staff update bookings"
  on bookings for update using (is_staff()) with check (is_staff());
create policy "admins delete bookings"
  on bookings for delete using (is_admin());

create policy "staff read booking history"
  on booking_status_history for select using (is_staff());
create policy "staff write booking history"
  on booking_status_history for insert with check (is_staff());

create policy "anyone may submit a contact message"
  on contact_inquiries for insert
  with check (status = 'new' and internal_notes is null);

create policy "staff read inquiries"
  on contact_inquiries for select using (is_staff());
create policy "staff update inquiries"
  on contact_inquiries for update using (is_staff()) with check (is_staff());

-- -----------------------------------------------------------------------------
-- Analytics — write-only for the public
-- -----------------------------------------------------------------------------

create policy "anyone may record an analytics event"
  on analytics_events for insert
  with check (
    -- Reject anything outside the known event vocabulary, so the table cannot
    -- be used as free storage by a script with the anon key.
    type in (
      'home_viewed', 'room_list_viewed', 'room_detail_viewed',
      'booking_search_submitted', 'booking_inquiry_started',
      'booking_inquiry_submitted', 'contact_action_clicked',
      'campaign_impression', 'campaign_cta_clicked'
    )
    and length(session_id) between 8 and 64
    and pg_column_size(metadata) < 2048
  );

create policy "staff read analytics"
  on analytics_events for select using (is_staff());

-- -----------------------------------------------------------------------------
-- Audit log — append-only, staff-readable
-- -----------------------------------------------------------------------------

create policy "staff read audit logs"
  on audit_logs for select using (is_staff());
create policy "staff append audit logs"
  on audit_logs for insert with check (is_staff());
-- No update or delete policy exists, so the log cannot be rewritten through
-- the API by anyone, staff included.

-- -----------------------------------------------------------------------------
-- Storage bucket for uploaded media
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('hotel-media', 'hotel-media', true)
on conflict (id) do nothing;

create policy "media bucket is publicly readable"
  on storage.objects for select
  using (bucket_id = 'hotel-media');

create policy "staff upload media"
  on storage.objects for insert
  with check (bucket_id = 'hotel-media' and is_staff());

create policy "staff update media objects"
  on storage.objects for update
  using (bucket_id = 'hotel-media' and is_staff())
  with check (bucket_id = 'hotel-media' and is_staff());

create policy "staff delete media objects"
  on storage.objects for delete
  using (bucket_id = 'hotel-media' and is_staff());
