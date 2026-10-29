# Analytics

Every metric the dashboard shows, with its formula and its source.

The purpose of this document is narrow: to make it impossible to mistake one
kind of number for another.

---

## The five categories

These get conflated constantly, and conflating them is how a hotel ends up
believing it has money it never collected.

| Category | What it means | Where it comes from | Available here |
| --- | --- | --- | --- |
| **Website activity** | Someone looked at a page | `analytics_events` | Yes |
| **Booking inquiry** | Someone submitted the form | `bookings` (any status) | Yes |
| **Confirmed booking** | A staff member confirmed it | `bookings` where status is `confirmed` | Yes |
| **Paid booking** | Money actually changed hands | A payment provider | **No** |
| **Recognised revenue** | Accounting has recognised it | An accounting system | **No** |

This platform captures no payments. The last two categories do not exist in
it and are not estimated, approximated or inferred.

The nearest honest figure is **confirmed booking value**: the sum of the
price estimates attached to confirmed and completed bookings. The dashboard
labels it exactly that, and its description says in so many words that it is
not revenue.

---

## Event collection

### What is recorded

| Event | Fired when |
| --- | --- |
| `home_viewed` | The homepage renders |
| `room_list_viewed` | The rooms listing renders |
| `room_detail_viewed` | A room page renders |
| `booking_search_submitted` | The search widget is submitted |
| `booking_inquiry_started` | The booking form is opened |
| `booking_inquiry_submitted` | An inquiry is accepted |
| `contact_action_clicked` | A phone, email, WhatsApp, Telegram or map link is used |
| `campaign_impression` | A carousel slide becomes the active one |
| `campaign_cta_clicked` | A campaign button is used |

### What is not recorded

No IP address. No user agent. No cookie. No fingerprint. No referrer. No
name, email, phone number or message content. No page URL beyond the event
type itself.

The only identifier is a random id held in `sessionStorage`. It dies when the
tab closes, never crosses a device, and is never joined to a booking record.
If storage is unavailable — a private window, blocked site data — no event is
sent at all rather than falling back to anything identifying.

Metadata is capped at eight scalar keys, and the database policy rejects
anything larger. That cap exists so a future change cannot casually sweep
personal data into a table designed to be non-identifying.

### Reliability

Events are fired with `sendBeacon` where available, so they do not hold a
navigation open. Every failure path is silent: an analytics outage must never
cost the hotel a booking.

Impressions are deduplicated per page view, so a visitor scrolling a carousel
back and forth does not inflate the count.

**Events are best-effort.** Ad blockers, privacy modes and network failures
all lose events, which means website-activity numbers are a **floor, not a
census**. Booking numbers are exact, because they come from the bookings
table rather than from instrumentation.

---

## Metric definitions

### Booking inquiries

```
count(bookings created in range)
```

Source: `bookings.created_at`. Exact.

### Pending / Confirmed / Cancelled

```
count(bookings in range where status = <status>)
```

Source: `bookings.status`. Exact. A booking appears in exactly one bucket —
status is a single column, not a set of flags.

### Form completion rate

```
booking_inquiry_submitted ÷ booking_inquiry_started × 100
```

Source: `analytics_events`. **Returns null when there are no starts** — a
ratio with a zero denominator is undefined, not zero, and the card says
"not enough data" rather than showing 0%.

Affected by event loss, so read it as a lower bound.

### Visit-to-inquiry rate

```
booking_inquiry_submitted ÷ distinct session ids × 100
```

Source: `analytics_events`. Null when there are no sessions in range.

A "session" is one browser tab until it closes. Someone who returns tomorrow
counts twice; someone who opens three tabs counts three times. This is a
coarser measure than a cookie-based one and is deliberately so — the trade is
accuracy for not tracking people across visits.

### Confirmed booking value

```
sum(price_estimate_minor) where status in ('confirmed', 'completed')
```

Source: `bookings`. **This is not revenue.** It is the sum of estimates
computed at submission time, for bookings a staff member has confirmed. It
does not account for cancellations after confirmation, no-shows, upgrades,
discounts applied at the desk, or anything paid.

Null when no bookings were confirmed in range.

### Average booking value

```
confirmed booking value ÷ count(confirmed bookings)
```

Same caveats. Null when the denominator is zero.

### Campaign click-through rate

```
campaign_cta_clicked ÷ campaign_impression × 100
```

Per campaign, from `analytics_events`. **Null when a campaign has no
impressions** — a campaign nobody saw has an undefined CTR, not a 0% one, and
the difference matters when deciding whether to kill a slide.

### Room interest

Two separate numbers, deliberately not combined:

- **Inquiries:** `count(bookings for that room)` — exact.
- **Views:** `count(room_detail_viewed for that room)` — best-effort.

They are shown side by side rather than as a ratio, because dividing an exact
number by a lossy one produces a figure that looks precise and is not.

### Occupancy rate

**Not computed.** The card explains why rather than showing a number.

A correct occupancy rate is:

```
room-nights sold ÷ room-nights available × 100
```

The numerator needs every stay expanded night by night. The denominator needs
an inventory count on every room — which is optional in this schema, and zero
by default, because a hotel that has not told us how many rooms it has should
not be given a number that silently assumes one.

With partial inventory the figure would be confidently wrong, and an operator
would price against it. A blank with an explanation is more useful than a
plausible lie.

To enable it later: make `inventory_count` mandatory, then compute both sides
over an explicit date range.

---

## Date handling

All ranges are resolved in the hotel's configured time zone, not the
viewer's. A booking made at 23:30 in Samarkand belongs to that day even if the
person reading the dashboard is in London.

The dashboard defaults to 30 days; the analytics page offers 7, 30, 90 and
365.

---

## Reading the dashboard honestly

1. **Exact vs best-effort.** Anything from `bookings` is exact. Anything from
   `analytics_events` is a floor.
2. **Null is a real answer.** "Not enough data" means the denominator was
   zero. It is not the same as zero and should not be read as one.
3. **Nothing here is revenue.** The only money figure is an estimate attached
   to confirmed bookings.
4. **Small numbers are noise.** A 50% CTR on two impressions is one click.

---

## Retention

No automatic deletion is implemented. Before launch, decide and apply:

- **Analytics events:** no reason to keep beyond 12–24 months.
- **Contact inquiries:** the seeded privacy policy says 24 months. Make that
  true with a scheduled job, or change the policy.
- **Bookings:** keep as long as accounting requires, and no longer.

A scheduled Postgres job is the simplest implementation:

```sql
delete from analytics_events where created_at < now() - interval '18 months';
delete from contact_inquiries
 where created_at < now() - interval '24 months' and status = 'resolved';
```

Writing a retention period into a privacy policy and not enforcing it is
worse than not writing it, because it is a promise to guests that the hotel
is quietly breaking.
