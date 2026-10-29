# Security

What this application defends against, how, and — equally important — what it
does not cover.

---

## Threat model

The assets worth protecting, in order:

1. **Guest personal data.** Names, emails, phone numbers and stay dates in
   `bookings` and `contact_inquiries`. A leak here is the worst outcome
   available: it is not recoverable and it is the hotel's liability.
2. **Hotel content integrity.** An attacker editing prices, publishing a
   campaign, or defacing the homepage damages the business and its guests.
3. **Availability.** Spam and abuse that bury real inquiries.

The realistic attackers are an opportunistic scanner, a spam bot, and someone
who has read the client bundle and found the Supabase anon key. The last one
matters most, because that key is in every visitor's browser by design.

---

## Authentication

**Supabase mode.** Supabase Auth owns credentials; this codebase never sees a
password. Sessions are the Supabase cookie, refreshed in middleware because
Server Components cannot write cookies.

**Demo mode.** Credentials come from `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`.

- scrypt, N=2¹⁵, r=8, p=1, 64-byte key, 16-byte random salt — roughly 100ms
  per verification on a typical serverless CPU.
- The hash is self-describing (`scrypt$N$r$p$salt$hash`) so the cost can be
  raised later without invalidating existing hashes.
- Comparison is constant time, with a length check first because
  `timingSafeEqual` throws on a mismatch and that throw would itself leak
  length.
- A malformed hash returns `false` rather than throwing, so a corrupted
  environment variable produces a failed sign-in rather than a 500 that
  announces the configuration is broken.
- Hash parameters are bounded on read, so a hostile hash string cannot demand
  absurd memory.

**There is no default account.** With nothing provisioned, the login page
explains how to create one. A default login shipped in source is a back door
that survives into production.

**Sessions** are HS256 JWTs in an `httpOnly`, `SameSite=Lax`, `Secure` cookie,
expiring after eight hours. The token is signed, not encrypted — it carries
only an email, a role and an expiry. Rotating `ADMIN_SESSION_SECRET`
invalidates every session immediately, which is the fastest revocation path.

**No enumeration oracle.** An unknown email, a wrong password and an
authenticated user with no staff profile all produce the same message. The
password hash is verified even when the email does not match, so response time
does not distinguish them either.

---

## Authorisation

**Server actions are the boundary, not middleware.** Middleware keeps
signed-out visitors off admin pages — a convenience, and documented as such in
`src/middleware.ts`. A server action is a POST endpoint any client can invoke
directly, so every admin action starts with `requireRole`.

**Roles come from the database.** Under Supabase the role is read from
`profiles` on every request, never from a JWT claim the browser holds. A user
cannot promote themselves by editing a token, and `profiles` has an admin-only
write policy so they cannot promote themselves through the API either.

**Role gates:**

| Capability | Minimum role |
| --- | --- |
| Read dashboard, bookings, inquiries, analytics | `viewer` |
| Edit rooms, offers, campaigns, media, site copy | `editor` |
| Settings, deletions, audit log, CSV export | `admin` / `editor` as noted |

---

## Row Level Security

The anon key is public. RLS is what makes that safe.

- **Public reads** are limited to published content. A draft room, an
  unpublished campaign and an expired campaign are all invisible — campaign
  scheduling is enforced in SQL as well as in the application, so an expired
  promotion cannot leak through a direct PostgREST query.
- **Public writes** are two inserts: a booking inquiry and a contact message.
  Both are constrained to `status = 'pending'` / `'new'` with
  `internal_notes IS NULL`, so a caller cannot create a pre-confirmed booking
  or inject a staff note.
- **No public read-back.** There is deliberately no `SELECT` policy for the
  public on `bookings` or `contact_inquiries`. Being able to read either table
  would expose every other guest's name, email and phone number.
- **Analytics** accepts inserts constrained to the known event vocabulary with
  a bounded session id and a size-capped metadata column, so the table cannot
  be used as free storage.
- **The audit log** has no `UPDATE` or `DELETE` policy at all. It cannot be
  rewritten through the API by anyone, staff included.

---

## Input validation

Every mutation re-validates server-side with Zod, whether or not the client
ran the same schema. The client copy exists for fast feedback and is never the
authority.

- Free text rejects control characters and markup delimiters.
- Names reject `< > { } \` and control characters.
- Social URLs must be `https` on their expected host — `instagram.com.evil.example`
  is rejected, because the check is on the hostname, not a substring.
- Analytics metadata is capped at eight scalar keys, so personal data cannot
  be swept into a table built to be non-identifying.
- **The price is never trusted.** The figure stored on a booking is recomputed
  from the stored room and offer records; whatever the browser sent is
  discarded. A price that arrives from a client is a price an attacker chose.

---

## Upload safety

- **Type comes from content, not metadata.** The first bytes are checked
  against known magic numbers. The filename and the browser-supplied
  `Content-Type` are both ignored, so a `.jpg` that is really an HTML document
  is rejected before it can be served from our own origin as stored XSS.
- **SVG is refused outright.** A valid SVG can carry script, and sniffing
  cannot tell a safe one from a hostile one. The project's own SVG artwork is
  generated at build time and committed, never uploaded.
- **Size limits** are enforced after reading: 6 MB images, 40 MB video.
- **The stored content type** is the sniffed one, never the client's.
- **Object names are generated**, never taken from the upload, so a crafted
  filename cannot traverse paths or collide.

---

## Injection

- **SQL injection:** all access goes through the Supabase client, which
  parameterises. The two raw functions take typed parameters. Search terms are
  stripped of PostgREST filter metacharacters before interpolation.
- **XSS:** React escapes by default. The one `dangerouslySetInnerHTML` is
  JSON-LD built from values we control, with `<` escaped so the payload cannot
  close the script tag early. CMS long-form text renders through a small
  Markdown subset that emits React elements and never raw HTML, so a `<script>`
  typed into the admin shows as literal characters.
- **Open redirect:** the login `next` parameter is restricted to same-site
  `/admin` paths. Campaign CTA destinations are validated against an allowlist
  that rejects `javascript:`, `data:`, `vbscript:`, plain `http:` and
  protocol-relative `//host`.
- **CSRF:** server actions carry Next's built-in action-id protection, and
  session cookies are `SameSite=Lax`.

---

## Response headers

Set in `next.config.ts` so they apply from the first deployed build:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, scoped `connect-src` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation all denied |

`X-Powered-By` is disabled — a free version hint for an attacker.

CSP keeps `'unsafe-inline'` for styles because Next injects critical CSS
inline. `'unsafe-eval'` is development-only, for React Refresh.

---

## Privacy

- **Analytics is non-identifying by construction.** No cookie, no fingerprint,
  no IP address, no user agent. The only identifier is a random id in
  `sessionStorage` that dies with the tab and never crosses a device.
- **The booking form asks for four things** — name, email, phone, and what the
  guest wants. No address, no date of birth, no card. Data the hotel has no
  use for is both a conversion cost and a liability.
- **No payment data is ever requested or stored.**
- **Internal notes are staff-only.** They are excluded from guest-facing
  responses, from the CSV export, and from audit-log payloads.
- **Error messages do not leak internals.** Database errors are logged in full
  and returned as generic messages; `error.tsx` shows a digest rather than
  `error.message`, which in development can carry table names and values.

---

## Anti-abuse

- Fixed-window rate limits: 5 booking inquiries and 5 contact messages per 10
  minutes, 8 login attempts per 15 minutes, 120 analytics events per minute.
- Honeypot fields on both public forms, checked after parsing so a bot gets
  the same response shape as a human with a typo.

---

## What is NOT covered

Stated plainly, because an undocumented gap is worse than a known one.

1. **Rate limiting does not coordinate across instances.** It is a counter in
   process memory. On serverless, an attacker spread across cold starts gets a
   higher effective limit. Put a WAF or edge rate limit in front of
   `/booking`, `/contact` and `/admin/login` before launch, or move the
   counter into Postgres or Upstash.
2. **No bot detection beyond the honeypot.** No CAPTCHA, no behavioural
   scoring.
3. **No 2FA.** Supabase Auth supports MFA; this application does not enrol or
   enforce it.
4. **No automated dependency scanning.** Run `npm audit` on a schedule and
   enable Dependabot.
5. **No intrusion detection or alerting.** The audit log records what
   happened; nobody is paged when it does.
6. **No account lockout.** Repeated failures are rate limited by IP, not
   locked per account — deliberately, since per-account lockout is itself a
   denial-of-service vector, but it is a trade-off worth knowing about.
7. **`x-forwarded-for` is trusted** for the rate-limit key. That is safe on
   Vercel, which sets it at the edge and strips client-supplied values. On
   another host, re-establish that guarantee first.
8. **No penetration test has been performed.** Commission one before handling
   real guest data at volume.

---

## Reporting

Security issues should go to the hotel's technical contact privately, not to a
public issue tracker.
