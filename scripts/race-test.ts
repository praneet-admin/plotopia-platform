/* Concurrency tests. Run with the dev server up on BASE (default http://localhost:3100):
     npm run test:race
   1. 25 carts race for one seat over HTTP  -> exactly one hold succeeds
   2. 10 replays of one payment             -> one payment row, one confirmed booking
   3. two carts race in-process             -> exactly one wins
   4. the DB index itself                   -> a second active ticket for a seat is rejected
   Everything the test creates is cancelled/deleted afterwards. */
import { and, eq, gt, notInArray } from "drizzle-orm";
import { db, isUniqueViolation, schema } from "../src/db";
import { cancelBooking, createPendingBooking, holdSeats, settlePayment } from "../src/lib/booking";
import { uuid } from "../src/lib/ids";

const BASE = process.env.BASE ?? "http://localhost:3100";
let failures = 0;
const check = (cond: boolean, msg: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

async function pickShowAndSeats(n: number) {
  const show = (await db.query.shows.findMany({ where: and(gt(schema.shows.startsAt, Date.now() + 3 * 86_400_000), eq(schema.shows.status, "scheduled")), limit: 1 }))[0];
  if (!show) throw new Error("No future show to test with; run db:seed");
  const sold = db.select({ id: schema.tickets.seatId }).from(schema.tickets).where(and(eq(schema.tickets.showId, show.id), eq(schema.tickets.active, true)));
  const free = await db.query.seats.findMany({ where: and(eq(schema.seats.screenId, show.screenId), notInArray(schema.seats.id, sold)), limit: n });
  return { show, seats: free };
}

async function main() {
  const { show, seats } = await pickShowAndSeats(3);
  const label = (id: string) => id.slice(id.indexOf(":") + 1);
  console.log(`Show ${show.id}, test seats ${seats.map((s) => s.label).join(", ")}\n`);

  // 1. HTTP race: 25 independent carts (no cookie => new hold group each) for the same seat.
  const N = 25;
  const res = await Promise.all(Array.from({ length: N }, () => fetch(`${BASE}/api/shows/${show.id}/hold`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seats: [seats[0].label] }) })));
  const okCount = res.filter((r) => r.status === 200).length, conflict = res.filter((r) => r.status === 409).length;
  check(okCount === 1 && conflict === N - 1, `${N} concurrent holds for ${seats[0].label}: ${okCount} succeeded, ${conflict} rejected`);
  const holdsNow = await db.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.showId, show.id), eq(schema.seatHolds.seatId, seats[0].id)) });
  check(holdsNow.length === 1, `exactly one hold row exists for ${seats[0].label}`);
  await db.delete(schema.seatHolds).where(eq(schema.seatHolds.seatId, seats[0].id));

  // 2. Payment idempotency: one pending booking, 10 concurrent settles with the same key.
  const group = `race-${uuid()}`;
  await holdSeats(show.id, [seats[1].id], group);
  const booking = await createPendingBooking({ showId: show.id, holdGroup: group, customerId: null });
  const key = `test:${booking.id}:${uuid()}`;
  const settles = await Promise.allSettled(Array.from({ length: 10 }, () => settlePayment({ bookingId: booking.id, idempotencyKey: key, method: "upi", outcome: "succeeded" })));
  const fulfilled = settles.filter((s) => s.status === "fulfilled");
  const pays = await db.query.payments.findMany({ where: eq(schema.payments.bookingId, booking.id) });
  const after = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
  const tix = await db.query.tickets.findMany({ where: and(eq(schema.tickets.bookingId, booking.id), eq(schema.tickets.active, true)) });
  check(fulfilled.length === 10, `10 replayed payments all returned a result (${fulfilled.length}/10; rejects: ${settles.filter((s) => s.status === "rejected").map((s) => String((s as PromiseRejectedResult).reason)).join(" | ") || "none"})`);
  check(pays.length === 1, `exactly one payment row recorded (${pays.length})`);
  check(after?.status === "confirmed" && tix.length === 1, `booking confirmed once with one ticket`);

  // 3. In-process race for one seat between two carts.
  const seat = seats[2].id;
  const r3 = await Promise.allSettled([holdSeats(show.id, [seat], `a-${uuid()}`), holdSeats(show.id, [seat], `b-${uuid()}`)]);
  const wins = r3.filter((r) => r.status === "fulfilled").length;
  check(wins === 1, `two in-process carts racing for ${label(seat)}: ${wins} won`);
  await db.delete(schema.seatHolds).where(eq(schema.seatHolds.seatId, seat));

  // 4. The partial unique index on tickets rejects a second active ticket for the same seat.
  let indexHeld = false;
  try {
    await db.insert(schema.tickets).values({ id: uuid(), bookingId: booking.id, showId: show.id, seatId: seats[1].id, seatLabel: seats[1].label, category: seats[1].category, price: 1 });
  } catch (e) { indexHeld = isUniqueViolation(e); }
  check(indexHeld, `tickets_show_seat_active index rejects a duplicate active ticket`);

  // Cleanup: cancel the test booking (frees the seat) and remove its rows.
  await cancelBooking(booking.id, { force: true });
  await db.delete(schema.payments).where(eq(schema.payments.bookingId, booking.id));
  await db.delete(schema.tickets).where(eq(schema.tickets.bookingId, booking.id));
  await db.delete(schema.bookings).where(eq(schema.bookings.id, booking.id));

  console.log(`\n${failures === 0 ? "All concurrency checks passed." : failures + " check(s) failed."}`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
