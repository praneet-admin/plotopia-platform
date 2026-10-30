import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db, errorText, isUniqueViolation, schema, writeTx } from "@/db";
import { bookingCode, token, uuid } from "./ids";
import { CONVENIENCE_FEE_PER_SEAT, refundFor } from "./pricing";

export const HOLD_MINUTES = 8;
export const HOLD_MS = HOLD_MINUTES * 60_000;
export const MAX_SEATS_PER_BOOKING = 10;

export class BookingError extends Error {
  constructor(message: string, public code: string, public seats: string[] = []) {
    super(message);
  }
}

/** Seat availability for a show: sold (active tickets) and held (unexpired holds, excluding `myGroup`). */
export async function seatStatus(showId: string, myGroup?: string) {
  const now = Date.now();
  const [sold, held] = await Promise.all([
    db.select({ seatId: schema.tickets.seatId }).from(schema.tickets).where(and(eq(schema.tickets.showId, showId), eq(schema.tickets.active, true))),
    db.select({ seatId: schema.seatHolds.seatId, holdGroup: schema.seatHolds.holdGroup, expiresAt: schema.seatHolds.expiresAt }).from(schema.seatHolds).where(and(eq(schema.seatHolds.showId, showId), gt(schema.seatHolds.expiresAt, now))),
  ]);
  const mine = held.filter((h) => h.holdGroup === myGroup);
  return {
    sold: sold.map((s) => s.seatId),
    held: held.filter((h) => h.holdGroup !== myGroup).map((h) => h.seatId),
    mine: mine.map((h) => h.seatId),
    myExpiresAt: mine.length ? Math.min(...mine.map((h) => h.expiresAt)) : null,
  };
}

/**
 * Atomically replace the hold group's seats with `seatIds`. Runs in an IMMEDIATE
 * transaction so two carts racing for one seat serialise; the unique index on
 * (show, seat) is the final guard even if a second writer slipped through.
 */
export async function holdSeats(showId: string, seatIds: string[], holdGroup: string) {
  if (seatIds.length > MAX_SEATS_PER_BOOKING) throw new BookingError(`Max ${MAX_SEATS_PER_BOOKING} seats per booking`, "too_many");
  const uniq = [...new Set(seatIds)];
  const now = Date.now();
  try {
    return await writeTx(async (tx) => {
        const show = await tx.query.shows.findFirst({ where: eq(schema.shows.id, showId) });
        if (!show || show.status !== "scheduled") throw new BookingError("Show is not open for booking", "show_closed");
        if (show.startsAt < now - 20 * 60_000) throw new BookingError("Booking for this show has closed", "show_closed");
        // Clear anything stale for this show, and my own previous picks.
        await tx.delete(schema.seatHolds).where(and(eq(schema.seatHolds.showId, showId), lt(schema.seatHolds.expiresAt, now)));
        await tx.delete(schema.seatHolds).where(and(eq(schema.seatHolds.showId, showId), eq(schema.seatHolds.holdGroup, holdGroup)));
        if (uniq.length === 0) return { expiresAt: null as number | null, seats: [] as string[] };
        const valid = await tx.select({ id: schema.seats.id }).from(schema.seats).where(and(eq(schema.seats.screenId, show.screenId), inArray(schema.seats.id, uniq)));
        if (valid.length !== uniq.length) throw new BookingError("Unknown seat", "bad_seat");
        const [sold, held] = await Promise.all([
          tx.select({ seatId: schema.tickets.seatId }).from(schema.tickets).where(and(eq(schema.tickets.showId, showId), eq(schema.tickets.active, true), inArray(schema.tickets.seatId, uniq))),
          tx.select({ seatId: schema.seatHolds.seatId }).from(schema.seatHolds).where(and(eq(schema.seatHolds.showId, showId), inArray(schema.seatHolds.seatId, uniq), ne(schema.seatHolds.holdGroup, holdGroup))),
        ]);
        const taken = [...sold, ...held].map((s) => s.seatId);
        if (taken.length) throw new BookingError("Some seats were just taken", "taken", taken);
        const expiresAt = now + HOLD_MS;
        await tx.insert(schema.seatHolds).values(uniq.map((seatId) => ({ id: uuid(), showId, seatId, holdGroup, expiresAt, createdAt: now })));
        return { expiresAt, seats: uniq };
    });
  } catch (e) {
    if (e instanceof BookingError) throw e;
    if (isUniqueViolation(e)) throw new BookingError("Some seats were just taken", "taken", uniq);
    throw e;
  }
}

export async function releaseHolds(holdGroup: string) {
  await db.delete(schema.seatHolds).where(eq(schema.seatHolds.holdGroup, holdGroup));
}

export async function extendHold(holdGroup: string) {
  const expiresAt = Date.now() + HOLD_MS;
  await db.update(schema.seatHolds).set({ expiresAt }).where(and(eq(schema.seatHolds.holdGroup, holdGroup), gt(schema.seatHolds.expiresAt, Date.now())));
  return expiresAt;
}

/** Create a pending booking from a hold group (seats stay held until paid or expired). */
export async function createPendingBooking(opts: { showId: string; holdGroup: string; customerId: string | null; channel?: "online" | "counter"; createdBy?: string | null }) {
  const now = Date.now();
  const holds = await db.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.holdGroup, opts.holdGroup), eq(schema.seatHolds.showId, opts.showId), gt(schema.seatHolds.expiresAt, now)) });
  if (!holds.length) throw new BookingError("Your seat hold expired. Please pick seats again.", "expired");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, opts.showId) });
  if (!show) throw new BookingError("Show not found", "show_closed");
  const seatRows = await db.query.seats.findMany({ where: inArray(schema.seats.id, holds.map((h) => h.seatId)) });
  const subtotal = seatRows.reduce((s, r) => s + (show.prices[r.category] ?? 0), 0);
  const fee = opts.channel === "counter" ? 0 : CONVENIENCE_FEE_PER_SEAT * seatRows.length;
  // Reuse an existing pending booking for this hold group (idempotent form resubmits).
  const existing = await db.query.bookings.findFirst({ where: and(eq(schema.bookings.holdGroup, opts.holdGroup), eq(schema.bookings.status, "pending")) });
  if (existing) return existing;
  const id = bookingCode();
  const [row] = await db
    .insert(schema.bookings)
    .values({
      id,
      showId: opts.showId,
      customerId: opts.customerId,
      holdGroup: opts.holdGroup,
      status: "pending",
      channel: opts.channel ?? "online",
      seatLabels: seatRows.sort((a, b) => a.rowIndex - b.rowIndex || a.num - b.num).map((s) => s.label),
      subtotal,
      fee,
      total: subtotal + fee,
      qrToken: token(18),
      createdAt: now,
      createdBy: opts.createdBy ?? null,
    })
    .returning();
  return row;
}

/**
 * Record a payment and, on success, convert holds into tickets. Idempotent on
 * `idempotencyKey`: replaying the same key returns the first result.
 */
export async function settlePayment(opts: { bookingId: string; idempotencyKey: string; method: string; outcome: "succeeded" | "failed" }) {
  const now = Date.now();
  const prior = await db.query.payments.findFirst({ where: eq(schema.payments.idempotencyKey, opts.idempotencyKey) });
  if (prior) {
    const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, prior.bookingId) });
    return { payment: prior, booking: b!, replayed: true };
  }
  try {
    return await writeTx(async (tx) => {
        const booking = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, opts.bookingId) });
        if (!booking) throw new BookingError("Booking not found", "not_found");
        if (booking.status === "confirmed") {
          const p = await tx.query.payments.findFirst({ where: eq(schema.payments.bookingId, booking.id) });
          return { payment: p!, booking, replayed: true };
        }
        if (booking.status !== "pending") throw new BookingError("Booking is no longer payable", "not_payable");
        const gatewayRef = `pay_${token(8)}`;
        const [payment] = await tx
          .insert(schema.payments)
          .values({ id: uuid(), bookingId: booking.id, idempotencyKey: opts.idempotencyKey, amount: booking.total, method: opts.method, status: opts.outcome, gatewayRef, createdAt: now })
          .returning();
        if (opts.outcome === "failed") return { payment, booking, replayed: false };
        const holds = await tx.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.holdGroup, booking.holdGroup!), gt(schema.seatHolds.expiresAt, now)) });
        if (holds.length !== booking.seatLabels.length) throw new BookingError("Your seat hold expired before payment completed. Nothing was charged.", "expired");
        const show = (await tx.query.shows.findFirst({ where: eq(schema.shows.id, booking.showId) }))!;
        const seatRows = await tx.query.seats.findMany({ where: inArray(schema.seats.id, holds.map((h) => h.seatId)) });
        await tx.insert(schema.tickets).values(
          seatRows.map((s) => ({ id: uuid(), bookingId: booking.id, showId: booking.showId, seatId: s.id, seatLabel: s.label, category: s.category, price: show.prices[s.category] ?? 0 })),
        );
        await tx.delete(schema.seatHolds).where(eq(schema.seatHolds.holdGroup, booking.holdGroup!));
        const [updated] = await tx.update(schema.bookings).set({ status: "confirmed", confirmedAt: now }).where(eq(schema.bookings.id, booking.id)).returning();
        return { payment, booking: updated, replayed: false };
    });
  } catch (e) {
    if (e instanceof BookingError) throw e;
    if (isUniqueViolation(e) && errorText(e).includes("idempotency")) {
      const prior2 = await db.query.payments.findFirst({ where: eq(schema.payments.idempotencyKey, opts.idempotencyKey) });
      const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, prior2!.bookingId) });
      return { payment: prior2!, booking: b!, replayed: true };
    }
    if (isUniqueViolation(e)) throw new BookingError("A seat in this booking was sold to someone else. Nothing was charged.", "taken");
    throw e;
  }
}

/** Cancel a confirmed booking under the refund policy; frees the seats. */
export async function cancelBooking(bookingId: string, opts: { force?: boolean } = {}) {
  const now = Date.now();
  return writeTx(async (tx) => {
      const booking = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, bookingId) });
      if (!booking) throw new BookingError("Booking not found", "not_found");
      if (booking.status !== "confirmed") throw new BookingError("Only confirmed bookings can be cancelled", "not_cancellable");
      const show = (await tx.query.shows.findFirst({ where: eq(schema.shows.id, booking.showId) }))!;
      const checked = await tx.select({ n: sql<number>`count(*)` }).from(schema.tickets).where(and(eq(schema.tickets.bookingId, bookingId), sql`checked_in_at is not null`));
      if (checked[0].n > 0 && !opts.force) throw new BookingError("Tickets already used at the gate", "checked_in");
      const refund = opts.force ? { pct: 100, amount: booking.total } : refundFor(booking.total, show.startsAt, now);
      await tx.update(schema.tickets).set({ active: false }).where(eq(schema.tickets.bookingId, bookingId));
      await tx.update(schema.bookings).set({ status: refund.amount > 0 ? "refunded" : "cancelled", cancelledAt: now, refundAmount: refund.amount }).where(eq(schema.bookings.id, bookingId));
      if (refund.amount > 0)
        await tx.insert(schema.payments).values({ id: uuid(), bookingId, idempotencyKey: `refund:${bookingId}`, amount: -refund.amount, method: "refund", status: "refunded", gatewayRef: `rf_${token(8)}`, createdAt: now });
      return refund;
  });
}

/** Gate check-in by QR token. */
export async function checkIn(qrToken: string) {
  const now = Date.now();
  const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.qrToken, qrToken) });
  if (!booking) return { ok: false as const, reason: "Unknown ticket" };
  if (booking.status !== "confirmed") return { ok: false as const, reason: `Booking is ${booking.status}`, booking };
  const show = (await db.query.shows.findFirst({ where: eq(schema.shows.id, booking.showId), with: { movie: true, screen: true } }))!;
  if (show.startsAt - now > 3 * 3_600_000) return { ok: false as const, reason: "Too early: gates open 3h before the show", booking, show };
  if (show.endsAt < now) return { ok: false as const, reason: "Show has already ended", booking, show };
  const tix = await db.query.tickets.findMany({ where: and(eq(schema.tickets.bookingId, booking.id), eq(schema.tickets.active, true)) });
  const already = tix.filter((t) => t.checkedInAt);
  if (already.length === tix.length) return { ok: false as const, reason: `Already checked in at ${new Date(already[0].checkedInAt!).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`, booking, show, tickets: tix };
  await db.update(schema.tickets).set({ checkedInAt: now }).where(and(eq(schema.tickets.bookingId, booking.id), eq(schema.tickets.active, true)));
  return { ok: true as const, booking, show, tickets: tix };
}
