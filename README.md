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

**Vercel + Turso (recommended for a hosted demo)**

1. `turso db create show-platform` then `turso db show show-platform --url` and `turso db tokens create show-platform`.
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
