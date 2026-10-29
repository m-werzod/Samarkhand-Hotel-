-- =============================================================================
-- Samarkhand Hotel — initial schema
--
-- Conventions used throughout:
--   * snake_case columns; the application maps them to camelCase at the edge.
--   * money is stored as BIGINT minor units plus an explicit currency column,
--     never as NUMERIC or float — see src/lib/domain/money.ts.
--   * every table carries created_at; mutable tables also carry updated_at,
--     maintained by the shared trigger below.
--   * guest-facing identifiers (booking references) are separate from primary
--     keys so a UUID is never exposed in a URL or read down a phone line.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type publication_status as enum ('draft', 'published', 'archived');
create type booking_status     as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type inquiry_status     as enum ('new', 'in_progress', 'resolved', 'spam');
create type user_role          as enum ('admin', 'editor', 'viewer');
create type discount_type      as enum ('percentage', 'fixed');
create type media_type         as enum ('image', 'video');
create type media_kind         as enum ('photograph', 'illustration');
create type slide_text_align   as enum ('left', 'center', 'right');
create type slide_overlay      as enum ('none', 'light', 'medium', 'strong');

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — one row per authenticated staff member
--
-- Roles live here, never in JWT claims the client could tamper with. Every
-- policy below resolves authority through is_staff()/is_admin(), which read
-- this table.
-- -----------------------------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  role         user_role not null default 'viewer',
  created_at   timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);

-- Security definer so the function can read profiles while RLS is active on
-- it; search_path is pinned so it cannot be hijacked by a shadowing schema.
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'editor')
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- hotel_settings — a single row, enforced
-- -----------------------------------------------------------------------------

create table hotel_settings (
  id                text primary key default 'settings',
  brand_name        text not null,
  tagline           text not null default '',
  phone             text not null,
  email             text not null,
  whatsapp_number   text,
  address           jsonb not null default '{}'::jsonb,
  social            jsonb not null default '{}'::jsonb,
  currency          text not null default 'UZS',
  time_zone         text not null default 'Asia/Samarkand',
  locale            text not null default 'uz',
  tax_rate_percent  numeric(5, 2) not null default 0 check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  service_fee_minor bigint not null default 0 check (service_fee_minor >= 0),
  check_in_time     text not null default '14:00',
  check_out_time    text not null default '12:00',
  seo_title         text not null default '',
  seo_description   text not null default '',
  is_demo_data      boolean not null default true,
  updated_at        timestamptz not null default now(),
  -- Exactly one settings row can ever exist.
  constraint hotel_settings_singleton check (id = 'settings')
);

create trigger hotel_settings_updated_at
  before update on hotel_settings
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- site_content — editable marketing copy, also a singleton
-- -----------------------------------------------------------------------------

create table site_content (
  id                 text primary key default 'content',
  hero_headline      text not null default '',
  hero_subheadline   text not null default '',
  hero_media_id      text,
  hero_video_url     text,
  about_title        text not null default '',
  about_body         text not null default '',
  benefits           jsonb not null default '[]'::jsonb,
  footer_blurb       text not null default '',
  privacy_policy     text not null default '',
  booking_terms      text not null default '',
  gallery_categories jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  constraint site_content_singleton check (id = 'content')
);

create trigger site_content_updated_at
  before update on site_content
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- media_assets
-- -----------------------------------------------------------------------------

create table media_assets (
  id           text primary key,
  storage_path text not null,
  type         media_type not null default 'image',
  kind         media_kind not null default 'illustration',
  category     text not null,
  alt_text     text not null check (length(alt_text) between 4 and 300),
  caption      text,
  mime_type    text not null,
  bytes        bigint check (bytes is null or bytes >= 0),
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  created_at   timestamptz not null default now()
);

create index media_assets_category_idx on media_assets (category);
create index media_assets_created_idx  on media_assets (created_at desc);

-- -----------------------------------------------------------------------------
-- amenities
-- -----------------------------------------------------------------------------

create table amenities (
  id          text primary key,
  icon_key    text not null,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create index amenities_active_idx on amenities (is_active, sort_order);

-- -----------------------------------------------------------------------------
-- rooms
-- -----------------------------------------------------------------------------

create table rooms (
  id                  text primary key,
  slug                text not null unique,
  name                text not null,
  short_description   text not null default '',
  description         text not null default '',
  max_occupancy       integer not null check (max_occupancy between 1 and 20),
  max_adults          integer not null check (max_adults between 1 and 12),
  max_children        integer not null check (max_children between 0 and 12),
  bed_configuration   text not null default '',
  size_sqm            integer check (size_sqm is null or size_sqm > 0),
  base_price_minor    bigint not null check (base_price_minor >= 0),
  currency            text not null default 'UZS',
  status              publication_status not null default 'draft',
  sort_order          integer not null default 0,
  inventory_count     integer not null default 0 check (inventory_count >= 0),
  cancellation_policy text,
  is_demo_data        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Total capacity must be reachable by the adult/child split.
  constraint rooms_capacity_coherent
    check (max_occupancy >= max_adults and max_occupancy <= max_adults + max_children)
);

create index rooms_status_idx on rooms (status, sort_order);
create index rooms_slug_idx   on rooms (slug);

create trigger rooms_updated_at
  before update on rooms
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- room_amenities / room_media — join tables
-- -----------------------------------------------------------------------------

create table room_amenities (
  room_id    text not null references rooms (id) on delete cascade,
  amenity_id text not null references amenities (id) on delete cascade,
  primary key (room_id, amenity_id)
);

create index room_amenities_amenity_idx on room_amenities (amenity_id);

create table room_media (
  room_id    text not null references rooms (id) on delete cascade,
  media_id   text not null references media_assets (id) on delete restrict,
  sort_order integer not null default 0,
  primary key (room_id, media_id)
);

create index room_media_media_idx on room_media (media_id);

-- -----------------------------------------------------------------------------
-- offers
-- -----------------------------------------------------------------------------

create table offers (
  id             text primary key,
  name           text not null,
  description    text not null default '',
  discount_type  discount_type not null,
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  starts_at      timestamptz,
  ends_at        timestamptz,
  minimum_nights integer not null default 1 check (minimum_nights between 1 and 30),
  conditions     text,
  status         publication_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint offers_window_ordered check (ends_at is null or starts_at is null or ends_at > starts_at),
  -- A percentage discount above 90% is almost always a typo.
  constraint offers_percentage_bounded
    check (discount_type <> 'percentage' or discount_value between 0 and 90)
);

create index offers_status_idx on offers (status, starts_at, ends_at);

create trigger offers_updated_at
  before update on offers
  for each row execute function set_updated_at();

create table offer_rooms (
  offer_id text not null references offers (id) on delete cascade,
  room_id  text not null references rooms (id) on delete cascade,
  primary key (offer_id, room_id)
);

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------

create table campaigns (
  id              text primary key,
  title           text,
  subtitle        text,
  badge           text,
  media_id        text references media_assets (id) on delete set null,
  mobile_media_id text references media_assets (id) on delete set null,
  cta_label       text,
  cta_href        text,
  offer_id        text references offers (id) on delete set null,
  room_id         text references rooms (id) on delete set null,
  status          publication_status not null default 'draft',
  priority        integer not null default 0,
  starts_at       timestamptz,
  ends_at         timestamptz,
  text_align      slide_text_align not null default 'left',
  overlay         slide_overlay not null default 'medium',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint campaigns_window_ordered check (ends_at is null or starts_at is null or ends_at > starts_at),
  -- A slide needs something to show.
  constraint campaigns_has_content check (media_id is not null or title is not null),
  -- A CTA label with nowhere to go is a dead button.
  constraint campaigns_cta_complete check (cta_label is null or cta_href is not null)
);

create index campaigns_live_idx on campaigns (status, priority desc, starts_at, ends_at);

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  guest_name       text not null,
  guest_email      text not null,
  guest_phone      text not null,
  room_id          text not null references rooms (id) on delete restrict,
  check_in         date not null,
  check_out        date not null,
  adults           integer not null check (adults between 1 and 16),
  children         integer not null default 0 check (children between 0 and 12),
  rooms_count      integer not null default 1 check (rooms_count between 1 and 8),
  price_estimate_minor bigint not null check (price_estimate_minor >= 0),
  currency         text not null default 'UZS',
  price_breakdown  jsonb not null default '{}'::jsonb,
  status           booking_status not null default 'pending',
  special_requests text,
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bookings_dates_ordered check (check_out > check_in),
  constraint bookings_stay_bounded  check (check_out - check_in <= 30),
  constraint bookings_rooms_staffed check (rooms_count <= adults)
);

create index bookings_status_idx    on bookings (status, created_at desc);
create index bookings_created_idx   on bookings (created_at desc);
create index bookings_reference_idx on bookings (reference);
create index bookings_room_stay_idx on bookings (room_id, check_in, check_out);
-- Trigram-free search support for the admin table's guest lookup.
create index bookings_guest_email_idx on bookings (lower(guest_email));

create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- booking_status_history
-- -----------------------------------------------------------------------------

create table booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings (id) on delete cascade,
  from_status booking_status,
  to_status   booking_status not null,
  actor       text not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index booking_history_booking_idx on booking_status_history (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- contact_inquiries
-- -----------------------------------------------------------------------------

create table contact_inquiries (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  subject        text not null,
  message        text not null,
  status         inquiry_status not null default 'new',
  internal_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index contact_inquiries_status_idx on contact_inquiries (status, created_at desc);

create trigger contact_inquiries_updated_at
  before update on contact_inquiries
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- testimonials
-- -----------------------------------------------------------------------------

create table testimonials (
  id           text primary key,
  author_label text not null,
  body         text not null,
  rating       integer check (rating is null or rating between 1 and 5),
  -- Sample content must be distinguishable from a genuine approved review.
  is_sample    boolean not null default true,
  is_published boolean not null default false,
  sort_order   integer not null default 0
);

-- -----------------------------------------------------------------------------
-- analytics_events
--
-- Deliberately narrow. There is no IP address, no user agent and no user id —
-- only a rotating anonymous session id and a small bag of scalar metadata.
-- -----------------------------------------------------------------------------

create table analytics_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  session_id  text not null,
  room_id     text references rooms (id) on delete set null,
  campaign_id text references campaigns (id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index analytics_events_type_time_idx on analytics_events (type, created_at desc);
create index analytics_events_time_idx      on analytics_events (created_at desc);
create index analytics_events_campaign_idx  on analytics_events (campaign_id, type);
create index analytics_events_room_idx      on analytics_events (room_id, type);

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_time_idx   on audit_logs (created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
