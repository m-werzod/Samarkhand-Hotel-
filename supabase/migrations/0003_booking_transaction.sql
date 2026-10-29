-- =============================================================================
-- Samarkhand Hotel — booking creation and transition as atomic operations
--
-- Two races matter here:
--
--  1. Two guests submitting the last unit of a room at the same moment. The
--     check and the insert must happen inside one transaction with the room
--     row locked, or both succeed and the hotel is oversold.
--
--  2. Two admins changing the same booking's status at the same moment. The
--     transition must fail for the second one rather than silently overwrite.
--
-- Both are solved with SECURITY DEFINER functions so the logic cannot be
-- bypassed by writing to the table directly through PostgREST.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_booking_inquiry
--
-- Returns the created row. Raises:
--   * 'room_unavailable'  — not enough units free for the whole stay
--   * 'room_not_bookable' — the room is not published
-- -----------------------------------------------------------------------------

create or replace function create_booking_inquiry(
  p_reference        text,
  p_guest_name       text,
  p_guest_email      text,
  p_guest_phone      text,
  p_room_id          text,
  p_check_in         date,
  p_check_out        date,
  p_adults           integer,
  p_children         integer,
  p_rooms_count      integer,
  p_price_minor      bigint,
  p_currency         text,
  p_breakdown        jsonb,
  p_special_requests text
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room      rooms%rowtype;
  v_peak      integer;
  v_booking   bookings%rowtype;
begin
  -- Lock the room row for the duration of the transaction. Concurrent
  -- inquiries for the same room serialise here rather than racing.
  select * into v_room from rooms where id = p_room_id for update;

  if not found or v_room.status <> 'published' then
    raise exception 'room_not_bookable' using errcode = 'P0001';
  end if;

  -- Only enforce capacity when the hotel has told us how many units exist.
  if v_room.inventory_count > 0 then
    -- Peak concurrent occupancy across every night boundary in the range.
    select coalesce(max(taken), 0) into v_peak
    from (
      select sum(b.rooms_count) as taken
      from bookings b
      join generate_series(p_check_in, p_check_out - 1, interval '1 day') as night
        on b.check_in <= night::date and b.check_out > night::date
      where b.room_id = p_room_id
        and b.status in ('pending', 'confirmed')
      group by night
    ) nightly;

    if v_peak + p_rooms_count > v_room.inventory_count then
      raise exception 'room_unavailable' using errcode = 'P0001';
    end if;
  end if;

  insert into bookings (
    reference, guest_name, guest_email, guest_phone, room_id,
    check_in, check_out, adults, children, rooms_count,
    price_estimate_minor, currency, price_breakdown, status, special_requests
  ) values (
    p_reference, p_guest_name, p_guest_email, p_guest_phone, p_room_id,
    p_check_in, p_check_out, p_adults, p_children, p_rooms_count,
    p_price_minor, p_currency, p_breakdown, 'pending', p_special_requests
  )
  returning * into v_booking;

  insert into booking_status_history (booking_id, from_status, to_status, actor)
  values (v_booking.id, null, 'pending', 'guest');

  return v_booking;
end;
$$;

-- The public needs to call this, but only this — the underlying table stays
-- governed by the RLS policies in 0002.
grant execute on function create_booking_inquiry(
  text, text, text, text, text, date, date, integer, integer, integer,
  bigint, text, jsonb, text
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- transition_booking
--
-- Compare-and-set on status, plus the history row, in one transaction.
-- Raises 'status_conflict' when the booking has already moved, and
-- 'illegal_transition' when the requested move is not allowed.
-- -----------------------------------------------------------------------------

create or replace function transition_booking(
  p_booking_id      uuid,
  p_expected_status booking_status,
  p_next_status     booking_status,
  p_actor           text,
  p_reason          text
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_allowed boolean;
begin
  if not is_staff() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_booking.status <> p_expected_status then
    raise exception 'status_conflict' using errcode = 'P0001';
  end if;

  -- Mirrors BOOKING_TRANSITIONS in src/lib/domain/booking.ts. Cancelled and
  -- completed are terminal.
  v_allowed := case p_expected_status
    when 'pending'   then p_next_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_next_status in ('completed', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'illegal_transition' using errcode = 'P0001';
  end if;

  update bookings
     set status = p_next_status
   where id = p_booking_id
  returning * into v_booking;

  insert into booking_status_history (booking_id, from_status, to_status, actor, reason)
  values (p_booking_id, p_expected_status, p_next_status, p_actor, p_reason);

  return v_booking;
end;
$$;

grant execute on function transition_booking(uuid, booking_status, booking_status, text, text)
  to authenticated;

revoke execute on function transition_booking(uuid, booking_status, booking_status, text, text)
  from anon;
