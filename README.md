# Plotopia Platform

End-to-end theatre ticketing and back office for **Plotopia**. Customers browse films, pick seats on a live map, open the 3D **seat simulator** to see the screen from that exact seat, pay with a UPI QR (test mode, Google Pay, "I've paid" confirmation) and get a QR e-ticket. Staff schedule shows, set prices, design halls, sell at the counter, scan tickets at the gate and read reports.

The seat simulator is a separate app at https://praneet-admin.github.io/plotopia/ (repo praneet-admin/plotopia, local deploy checkout `~/plotopia-repo`). This platform links to it with `#hall=<id>&seat=<id>&view=seat` and stores hall layouts in the same shape as its `halls.js`, so a hall built in the admin editor exports straight into the simulator.

## Run it

```bash
npm install
npm run db:reset      # creates data/show.db and seeds the demo
npm run dev           # http://localhost:3000
```

Demo data: PVR Phoenix MarketCity (Chennai) with the simulator's three halls (`audi3`, `audi1`, `imax`), three films (Meiyazhagan, Amaran, Interstellar IMAX), nine days of shows and a few thousand bookings.

| Role | Login | Password |
|---|---|---|
| Owner (admin) | admin@plotopia.demo | admin123 |
| Manager | manager@plotopia.demo | manager123 |
| Box office | counter@plotopia.demo | counter123 |
| Gate usher | gate@plotopia.demo | gate123 |

Customers sign in with any 10-digit mobile number; the demo OTP is `1234`.

- Customer site: `/` → `/movies/<slug>` → `/book/<showId>` → `/checkout` → `/pay` → `/tickets/<id>` · `/my` for history and cancellations
- Back office: `/admin` (dashboard, counter, gate scan, bookings, shows, movies, halls, pricing, reports, messages, staff)

## How it works

- **Stack**: Next.js 16 (App Router, server actions), TypeScript, Tailwind 4, Drizzle ORM on libSQL. Locally that is a SQLite file; on Vercel it is Turso. Schema in `src/db/schema.ts`.
- **Seat holds**: picking seats and pressing Proceed holds them for 8 minutes (`seat_holds`, unique per show+seat). Holds are checked inside a serialised write transaction and expire automatically; the seat map polls every 4 s so other customers see "being booked".
- **Bookings and payments**: checkout creates a pending booking against the hold group, the UPI test-mode page ("I've paid") settles it. Settlement is idempotent on a key (`payments.idempotency_key`) and turns holds into `tickets`, protected by a partial unique index on `(show_id, seat_id) WHERE active = 1`. A seat can never be sold twice, even if two writers slip past the hold check.
- **Refund policy** (`src/lib/pricing.ts`): 100% more than 24 h before the show, 50% between 24 h and 2 h, nothing after. Staff can force a full refund; cancelling a show refunds every booking.
- **Pricing**: base prices per hall and tier plus multiplier rules (time of day, weekday/weekend, optional per hall). Prices are stamped on each show when scheduled and editable per show.
- **Hall editor**: `/admin/halls/<id>` edits the simulator's geometry fields with a live seat preview and copies/downloads the JSON for `halls.js`. Seat layouts lock while upcoming shows on that hall have sold tickets.
- **Gate scan**: `/admin/scan` reads the ticket QR with the camera (jsQR) or a typed booking id; repeat scans are refused.
- **Notifications**: `src/lib/notify.ts` logs WhatsApp/SMS/email messages to the `notifications` table (visible at `/admin/messages` and on the ticket) instead of calling a provider.

## Concurrency test

With the dev server running:

```bash
npm run test:race
```

It fires 25 simultaneous holds for one seat over HTTP (exactly one wins), replays one payment 10 times (one payment row), races two in-process carts, and proves the ticket index rejects a duplicate. Cleans up after itself.

## Deploy

**Live demo**: https://plotopia-platform.vercel.app (Vercel project `plotopia-platform`) runs on a Turso database (`plotopia-platform`, aws-ap-northeast-1), so bookings and holds are shared and persist. Without `DATABASE_URL` the serverless build instead copies `seed/show.db` to `/tmp` on each cold start, which is per instance and resets when it recycles: fine for a throwaway demo, not for sales.


## Everything is editable in the back office

Sign in at `/admin` (demo logins are on the login page). Nothing the public site shows needs a code change:

- **Settings → Brand**: site name, tagline, logo/wordmark/favicon (upload or URL), accent colour, footer text.
- **Settings → Cinema**: city, support email/phone/WhatsApp, and the theatres list (name, address, phone, map link, hours).
- **Settings → Home page**: heading, subheading, banner, promo strip, featured films and order, show/hide filters, "playing at", Theatres link, Coming soon row.
- **Settings → Booking rules**: hold minutes, max seats, convenience fee, GST, close time, gate hours, refund windows and %, policy wording, online/counter toggles.
- **Settings → Payment**: UPI ID and payee name (the QR encodes them), accepted apps, test mode, instructions.
- **Settings → Messages**: confirmation, SMS, cancellation, refund lines and reminder templates with placeholders.
- **Settings → Simulator**: simulator URL, hall screen image, "view from seat" links, cast in the header, screen → simulator hall mapping.
- **Movies**: all fields incl. poster upload, trailer, formats, now showing / coming soon / hidden, delete and restore.
- **Shows**: single or bulk scheduling (date range × times × weekdays), prices, reprice from rules, change film/format/time while unsold, cancel with refunds, delete/restore.
- **Halls**: geometry, rows, bands, base prices, theatre, blocked seats, delete/restore. **Pricing**: base prices and editable rules.
- **Customers**: search, edit, staff notes, block online booking. **Bookings**: cancel (policy / full / none), reseat, resend ticket, reminder, record a manual refund. **Staff**: roles and access.
- **Activity**: every change above, who made it and the before/after values.

Each settings tab has a live-preview link. Settings are cached for 3 seconds per server instance, so a change is live on the next page load.

Schema changes are SQL migrations in `drizzle/` (`npx drizzle-kit generate`), applied with `npm run db:migrate` locally or with `DATABASE_URL`/`DATABASE_AUTH_TOKEN` set for Turso.

**Vercel + Turso (recommended for a hosted demo)**

1. `turso db create plotopia-platform` then `turso db show plotopia-platform --url` and `turso db tokens create plotopia-platform`.
2. From this folder, push the schema and seed the hosted database:
   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:reset
   ```
3. Import the GitHub repo in Vercel and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (and optionally `NEXT_PUBLIC_SIMULATOR_URL`). Deploy.

**Any Docker host (Render, Fly, Railway, VPS)**: `Dockerfile` runs the app with a SQLite file on a volume at `/app/data`, creating the schema and seeding demo data on first boot.

## Scripts

| Script | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:push` | apply schema (drizzle-kit) |
| `npm run db:seed` | wipe and reseed demo data |
| `npm run db:reset` | both |
| `npm run test:race` | concurrency checks against the running server |
