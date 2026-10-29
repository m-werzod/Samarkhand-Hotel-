# Deployment

How to take this from a demo-mode checkout to a production deployment.

---

## 1. Create the Supabase project

Demo mode exists so the application is usable without a database. It is not a
production configuration: state lives in the Node process, resets on restart,
and is not shared between serverless instances. Configuring Supabase is a
launch requirement.

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the migrations in order. Order matters: the
   policies in `0002` reference tables and functions created in `0001`.

   ```
   supabase/migrations/0001_initial_schema.sql
   supabase/migrations/0002_row_level_security.sql
   supabase/migrations/0003_booking_transaction.sql
   ```

   With the Supabase CLI instead:

   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

3. Confirm `0002` created the `hotel-media` storage bucket under
   **Storage → Buckets**.

### What the migrations set up

- 17 tables with foreign keys, indexes and check constraints. Several rules
  the application enforces are also enforced in SQL, so a direct database
  write cannot violate them — including `campaigns_cta_complete`, which makes
  a CTA button with no destination unrepresentable.
- Row Level Security on every table. The anon key ships to every browser and
  is assumed public; RLS, not secrecy, is what stops it reading guest data.
- `create_booking_inquiry` and `transition_booking`: `SECURITY DEFINER`
  functions that do the capacity check and the status change under a row lock,
  so two guests cannot take the last room at once and two administrators
  cannot both "win" a status change.

---

## 2. Seed the database

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npm run db:seed
```

This loads the same content demo mode serves: four room types, twelve
amenities, three offers, three campaigns, settings, site copy and sample
testimonials. Everything is flagged as demo data and marked as such on the
public site until you clear the flags in **Admin → Settings**.

The script is idempotent — safe to re-run.

### Upload the artwork

Generated SVGs live in `public/media/` and are served from the app itself, so
nothing needs uploading to get started. Once you have real photography, upload
it through **Admin → Media** and set each asset's kind to `photograph`.

---

## 3. Provision the first administrator

There is no default account. Two routes:

### With Supabase Auth (recommended for production)

1. **Authentication → Users → Add user**. Set a strong password and mark the
   email confirmed.
2. Grant staff rights by inserting a profile row. The role lives in this
   table, never in a JWT claim the browser holds, so this insert is the only
   thing that makes an account staff:

   ```sql
   insert into profiles (id, email, display_name, role)
   values (
     '<the-new-user-uuid>',
     'you@example.com',
     'Your Name',
     'admin'
   );
   ```

A Supabase user without a profile row can authenticate but is refused at the
admin door, and signed straight back out.

### Without Supabase (demo mode)

```bash
npm run admin:hash
```

Reads the password from stdin — never argv, which would put it in shell
history and the process list — and prints `ADMIN_EMAIL`,
`ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` ready to paste. The password
itself is never written anywhere.

### Roles

| Role | Can do |
| --- | --- |
| `viewer` | Read the dashboard, bookings, inquiries and analytics |
| `editor` | Everything above, plus rooms, offers, campaigns, media and site copy |
| `admin` | Everything above, plus settings, deletions, and the audit log |

---

## 4. Configure environment variables

Copy `.env.example` and fill it in. Every variable is documented there.

Minimum for a production deployment:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. Server-side only, never
prefixed `NEXT_PUBLIC_`, never in source control. Without it, media uploads
are disabled and the admin says so rather than failing at the point of use.

---

## 5. Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

Or connect the repository in the Vercel dashboard and add the variables under
**Settings → Environment Variables**. No `vercel.json` is required; the
defaults for a Next.js project are correct.

After the first deploy, set `NEXT_PUBLIC_SITE_URL` to the real domain and
redeploy, so canonical URLs, the sitemap and Open Graph tags point at it.

---

## 6. Notifications

Both are optional and both degrade honestly: with neither configured, messages
go to the server log and the guest is told to expect a phone call rather than
an email that is never coming.

**Email (Resend):** set `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`. The
from-address must be on a domain verified with the provider.

**Telegram:** create a bot with [@BotFather](https://t.me/BotFather), then set
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Get the chat id by messaging the
bot and reading `https://api.telegram.org/bot<TOKEN>/getUpdates`.

**Admin → Settings** shows which integrations are live, read from the
environment at request time.

---

## 7. Caching

Both route trees render per request (`force-dynamic`). That is deliberate: an
administrator publishing a room expects it on the site immediately, and in
demo mode a build-time snapshot would freeze the seed data forever.

With Supabase configured and content that changes a few times a week, you can
switch the public tree to ISR — every mutation already calls `revalidatePath`
for the pages it affects:

```ts
// src/app/(site)/layout.tsx
export const revalidate = 300;   // replaces: export const dynamic = 'force-dynamic'
```

Leave the admin tree dynamic. A cached admin page is one operator's data
served to the next.

---

## 8. Backup and recovery

**Automatic.** Supabase takes daily backups on paid plans. Confirm the
retention window under **Database → Backups** matches what the business can
actually tolerate losing.

**Manual, before anything risky:**

```bash
supabase db dump -f backup-$(date +%F).sql
```

**What matters most.** `bookings`, `booking_status_history` and
`contact_inquiries` hold data that cannot be reconstructed — they are guest
records. Rooms, offers, campaigns and copy can be re-seeded from source.

**Restore:**

```bash
psql "$DATABASE_URL" < backup-2026-01-15.sql
```

**Storage** is backed up separately from the database. Keep the original
photography somewhere outside Supabase too.

**Test the restore.** A backup nobody has restored is a hypothesis. Restore
into a scratch project at least once before launch.

---

## Production launch checklist

### Data honesty

- [ ] Replace the seeded address, phone and email in **Admin → Settings**
- [ ] Set a WhatsApp number only if that number is actually on WhatsApp
- [ ] Add social links — unset ones are not rendered at all
- [ ] Set real prices on every room and clear its "demo data" flag
- [ ] Clear the global demo flag in **Settings** once everything is verified
- [ ] Replace the sample testimonials with genuine approved reviews
- [ ] Upload real photography and set each asset's kind to `photograph`
- [ ] Set inventory counts if you want availability checked at all

### Legal

- [ ] Have a lawyer review the privacy policy and booking terms
- [ ] Confirm the booking terms match how the hotel actually operates
- [ ] Check the cancellation policy on every room type

### Security

- [ ] Rotate `ADMIN_SESSION_SECRET` away from any value used in development
- [ ] Confirm the service-role key is server-side only
- [ ] Verify RLS is enabled on every table (Supabase flags tables without it)
- [ ] Sign out and confirm `/admin` redirects
- [ ] Put a WAF or edge rate limit in front of the booking and login endpoints
- [ ] Review `docs/SECURITY.md`

### Technical

- [ ] `npm run verify` passes
- [ ] `npm run test:e2e` passes against the deployed URL
- [ ] `NEXT_PUBLIC_SITE_URL` is the real domain
- [ ] `/sitemap.xml` and `/robots.txt` are correct
- [ ] Open Graph card renders — test with a sharing debugger
- [ ] Lighthouse on mobile against the deployed site
- [ ] Submit a real booking inquiry and confirm it reaches the dashboard
- [ ] Confirm a notification actually arrives, if configured

### Operations

- [ ] At least two administrator accounts, so nobody is locked out
- [ ] Someone owns the booking inbox and knows the confirmation workflow
- [ ] Backup retention confirmed and a restore tested
