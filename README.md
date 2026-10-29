# Samarkhand Hotel

A complete hotel platform: a public website, a booking-inquiry workflow, and a
secure admin CMS with business analytics.

Built with Next.js 15 (App Router), React 19, TypeScript in strict mode,
Tailwind CSS v4, and Postgres via Supabase.

---

## What this is, and what it is not

This is a working application, not a template. Rooms, prices, offers,
campaigns, media, site copy, contact details and bookings all live in a
database and are edited through the admin area. The public site reads the same
records. There are no placeholder buttons and no mocked API responses.

Three things it deliberately does **not** do, because doing them dishonestly
is worse than not doing them at all:

| Not implemented | Why | What happens instead |
| --- | --- | --- |
| Instant booking confirmation | There is no payment capture and no channel-manager feed | A submission is an **inquiry**. It enters `pending` and a human confirms it. The UI says so at every step. |
| Revenue reporting | No payments are captured, so there is no revenue to report | The dashboard shows *confirmed booking value* — the sum of estimates on confirmed bookings — and labels it as not being revenue. |
| Occupancy rate | Needs per-room inventory and a nightly expansion of every stay; inventory is optional in the schema | The metric card renders an explained blank rather than a plausible-looking number. |

Seeded content — prices, the address, the phone number, the testimonials — is
flagged in the database and marked in the UI as unverified sample data until
an administrator replaces it and clears the flag.

The imagery is **original vector artwork**, generated from
`scripts/generate-assets.mjs`. It is concept illustration, not photography of
a real property, and the UI labels it that way. The whole set is 174 KB.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The site runs in **demo mode**: a seeded
in-memory store, no database required. Everything works; nothing persists
across a restart, and the admin sidebar says so.

### Getting into the admin area

There is no default administrator account — a login shipped in source is a
back door that survives into production. Create one:

```bash
npm run admin:hash
```

It reads a password from stdin (never from argv, which would land it in shell
history), then prints three values. Put them in `.env.local`:

```
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD_HASH=scrypt$32768$8$1$...
ADMIN_SESSION_SECRET=...
```

Restart the dev server and sign in at <http://localhost:3000/admin/login>.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, against a production build) |
| `npm run verify` | typecheck → lint → test → build |
| `npm run assets:generate` | Regenerate brand and media artwork |
| `npm run admin:hash` | Create admin credentials |
| `npm run db:seed` | Load the seed into a configured Supabase project |

---

## Project layout

```
scripts/              Asset generation, password hashing, database seeding
  lib/                SVG geometry, palette, logo and scene builders
supabase/migrations/  Schema, RLS policies, transactional SQL functions
src/
  app/
    (site)/           Public pages
    admin/            Admin CMS (login outside the auth guard, rest inside)
    api/              Analytics ingestion, media upload
    actions/          Public server actions (booking, contact)
  components/
    ui/               Design-system primitives
    site/             Public components
    admin/            Admin components
  lib/
    domain/           Business rules: money, dates, pricing, bookings, campaigns
    data/             Store contract + Supabase and in-memory adapters
    auth/             Password hashing, sessions, authorisation
    validation/       Zod schemas — the server-side authority on every input
    analytics/        Event tracking and metric definitions
    notifications/    Email / Telegram / console adapters
tests/
  unit/               Domain logic
  integration/        Data layer, validation, auth
  e2e/                Playwright: guest, admin, security, responsive
docs/                 Deployment, security and analytics documentation
```

---

## Architecture notes

**One data contract, two backends.** `src/lib/data/store.ts` defines the
persistence interface. `SupabaseStore` and `DemoStore` both implement it in
full, and the choice is made once from configuration — never from a request.
Nothing above that layer knows which is live.

**Money is integers.** Amounts are stored as integer minor units with an
explicit currency. UZS has no circulating subunit, so one minor unit is one
so'm; USD and EUR are cents. No floating-point value ever reaches a price a
guest is shown. Mixing currencies throws rather than silently adding.

**Dates are the hotel's, not the visitor's.** Nights are counted in the
hotel's configured time zone. A guest in Tokyo booking a Tashkent hotel must
not be told their check-in is in the past because their own device already
rolled over.

**Discounts never stack.** Exactly one offer applies to a stay — the one worth
most to the guest, with a documented tie-break so the result is deterministic.
Stacking is how a hotel accidentally sells a room for nothing.

**The server owns the price.** The browser may compute a preview, but the
figure persisted on a booking is always recomputed server-side from the stored
room and offer records. Whatever the client submits is discarded.

**Server actions are the authorisation boundary.** Middleware keeps signed-out
visitors off admin pages, but it is a convenience: a server action is a POST
endpoint anyone can invoke directly, so every one of them calls `requireRole`
itself.

**Rendering is per request.** Both trees use `force-dynamic`, so an
administrator publishing a room sees it on the site immediately. With Supabase
and a stable content cadence you can switch the public routes to ISR — every
mutation already calls `revalidatePath`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Testing

```bash
npm run test       # 200 unit + integration tests
npm run test:e2e   # Playwright, builds and serves the app first
```

Unit and integration tests cover the domain layer and the data contract.
End-to-end tests run against a **production build** — dev-only behaviour is
exactly the kind of difference that lets a real bug through — and sign in
through the real login form rather than forging a session cookie.

The e2e suite asserts the security properties directly: that every admin route
redirects when signed out, that the price is recomputed server-side, that an
expired campaign is absent from the homepage, that internal notes never appear
in public HTML, and that the security headers are actually served.

Responsive coverage starts at 320px and asserts no horizontal overflow on
every public page and every admin screen.

---

## Internationalisation

Uzbek (Latin) is the shipping language, written by hand rather than machine
translated. `src/lib/i18n/dictionaries.ts` holds the UI strings; Russian and
English are declared and currently fall back to Uzbek.

Adding a locale is a matter of filling in that file and introducing a
`/[locale]` route segment — no component needs to change, because components
read strings from the dictionary rather than inlining them. Long-form
marketing copy lives in the database so the hotel can edit it without a
deploy.

Uzbek month names are a literal table rather than `Intl` output: Node's
bundled ICU has no short-month data for `uz-UZ` and renders `M10` where a
browser renders `okt`, which is a real hydration mismatch. Money formatting is
hand-rolled for the same reason.

---

## Known limitations

These are honest statements about the current build, not a roadmap.

1. **Demo mode does not persist.** State lives in the Node process: it resets
   on restart and is not shared between serverless instances. Configure
   Supabase before a real launch. The admin dashboard says this plainly.
2. **Rate limiting is per instance.** A fixed-window counter in process
   memory. It stops casual abuse and double submits; it does not coordinate
   across serverless instances. See [docs/SECURITY.md](docs/SECURITY.md).
3. **No payment processing.** The platform never requests or stores card
   details. Adding payments means a provider and server-side verified webhooks.
4. **No live channel-manager integration.** Availability is only checked when
   a room has an inventory count configured, and the result is advisory.
5. **Legal text is an unreviewed template.** The privacy policy and booking
   terms are editable starting points that say on their face that a lawyer
   must review them.
6. **Imagery is illustration, not photography.** Replace it with licensed
   photographs of the real property before launch, and set each asset's kind
   to `photograph` in the media library.
7. **Testimonials are samples.** They are labelled as such everywhere they
   appear. Replace them with genuine approved reviews.
8. **Only Uzbek is translated.** See above.
9. **Occupancy and revenue are not computed.** See the table at the top.

---

## Troubleshooting

**`Error: The service was stopped` from esbuild when running tests.**
npm occasionally writes a truncated (~533 KB) `esbuild` binary instead of the
real ~9.9 MB one. Repair it:

```bash
rm -rf node_modules/esbuild node_modules/@esbuild && npm install
```

**`Missing field 'negated' on ScannerOptions.sources`.**
`tailwindcss` and `@tailwindcss/postcss` are on different 4.x builds. Install
them together at the same version.

---

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Supabase setup, first administrator, Vercel, backups, launch checklist
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, controls, what is not covered
- [docs/ANALYTICS.md](docs/ANALYTICS.md) — every metric's formula and source

---

## Licence

Written for the Samarkhand Hotel project. The brand artwork in `public/brand/`
and `public/media/` is original work generated by `scripts/generate-assets.mjs`
and carries no third-party licence obligations.
