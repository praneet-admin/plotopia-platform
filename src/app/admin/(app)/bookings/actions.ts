"use server";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, isUniqueViolation, schema, writeTx } from "@/db";
import { requireStaff } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { BookingError, cancelBooking } from "@/lib/booking";
import { inr } from "@/lib/format";
import { token, uuid } from "@/lib/ids";
import { sendBookingConfirmation, sendCancellation, sendReminder } from "@/lib/notify";
import { bookingFull } from "@/lib/queries";
import { siteOrigin } from "@/lib/simulator";

function back(id: string, msg: string): never {
  redirect(`/admin/bookings?q=${id}&msg=${encodeURIComponent(msg)}`);
}

/** Cancel under the refund policy (what the customer would get), or in full. */
export async function cancel(fd: FormData) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const id = String(fd.get("id"));
  const mode = String(fd.get("mode") ?? "policy");
  if (mode !== "policy" && !["admin", "manager"].includes(me.role)) back(id, "Only managers can refund in full.");
  try {
    const r = await cancelBooking(id, mode === "full" ? { force: true } : mode === "none" ? { force: true, pct: 0 } : {});
    const full = await bookingFull(id);
    if (full) await sendCancellation(full, r.amount, await siteOrigin());
    await logActivity(me, "cancel", "booking", id, `Booking ${id} cancelled (${mode}), ${inr(r.amount)} refunded`);
    back(id, `${id} cancelled, ${inr(r.amount)} refunded.`);
  } catch (e) {
    if (e instanceof BookingError) back(id, e.message);
    throw e;
  }
}

/** Record a refund that was paid out by hand (cash at the counter, bank transfer). */
export async function markRefunded(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id"));
  const amount = Math.round(Number(fd.get("amount")));
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!b) back(id, "Not found");
  if (!["cancelled", "refunded"].includes(b.status)) back(id, "Only cancelled bookings can be marked refunded.");
  if (!Number.isFinite(amount) || amount <= 0 || amount + b.refundAmount > b.total) back(id, `Enter an amount up to ${inr(b.total - b.refundAmount)}.`);
  await db.insert(schema.payments).values({ id: uuid(), bookingId: id, idempotencyKey: `manual-refund:${id}:${token(6)}`, amount: -amount, method: "refund", status: "refunded", gatewayRef: `manual_${me.id.slice(0, 6)}`, createdAt: Date.now() });
  await db.update(schema.bookings).set({ status: "refunded", refundAmount: b.refundAmount + amount }).where(eq(schema.bookings.id, id));
  await logActivity(me, "refund", "booking", id, `Manual refund of ${inr(amount)} recorded on ${id}`);
  back(id, `${inr(amount)} refund recorded.`);
}

/** Send the confirmation again (same ticket link). */
export async function resend(fd: FormData) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const id = String(fd.get("id"));
  const full = await bookingFull(id);
  if (!full || full.status !== "confirmed") back(id, "Only confirmed bookings have a ticket to send.");
  if (!full.customer) back(id, "Walk-in sale with no contact details.");
  await sendBookingConfirmation(full, await siteOrigin());
  await logActivity(me, "resend", "booking", id, `Ticket ${id} re-sent to +91 ${full.customer.phone}`);
  back(id, `Ticket sent again to +91 ${full.customer.phone}.`);
}

export async function remind(fd: FormData) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const id = String(fd.get("id"));
  const full = await bookingFull(id);
  if (!full || full.status !== "confirmed" || !full.customer) back(id, "Nothing to remind.");
  await sendReminder(full, await siteOrigin());
  await logActivity(me, "remind", "booking", id, `Reminder for ${id} sent to +91 ${full.customer.phone}`);
  back(id, `Reminder sent to +91 ${full.customer.phone}.`);
}

/**
 * Move a confirmed booking to other seats in the same show (same count, any
 * category: price differences are settled at the counter). Atomic: the old
 * tickets go inactive and the new ones are inserted in one transaction, so the
 * unique index still forbids a double sale.
 */
export async function reseat(fd: FormData) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const id = String(fd.get("id"));
  const labels = String(fd.get("seats") ?? "").toUpperCase().split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id), with: { show: true, tickets: true } });
  if (!b || b.status !== "confirmed") back(id, "Only confirmed bookings can be reseated.");
  if (labels.length !== b.seatLabels.length) back(id, `Give exactly ${b.seatLabels.length} seat label(s).`);
  if (b.tickets.some((t) => t.checkedInAt)) back(id, "Already checked in at the gate.");
  const seats = await db.query.seats.findMany({ where: and(eq(schema.seats.screenId, b.show.screenId), inArray(schema.seats.label, labels)) });
  if (seats.length !== labels.length) back(id, `Unknown seat: ${labels.filter((l) => !seats.some((s) => s.label === l)).join(", ")}`);
  if (seats.some((s) => s.blocked)) back(id, "One of those seats is blocked.");
  try {
    await writeTx(async (tx) => {
      const taken = await tx.query.tickets.findMany({ where: and(eq(schema.tickets.showId, b.showId), eq(schema.tickets.active, true), inArray(schema.tickets.seatId, seats.map((s) => s.id))) });
      const other = taken.filter((t) => t.bookingId !== id);
      if (other.length) throw new BookingError(`${other.map((t) => t.seatLabel).join(", ")} already sold`, "taken");
      await tx.update(schema.tickets).set({ active: false }).where(eq(schema.tickets.bookingId, id));
      await tx.delete(schema.seatHolds).where(and(eq(schema.seatHolds.showId, b.showId), inArray(schema.seatHolds.seatId, seats.map((s) => s.id))));
      await tx.insert(schema.tickets).values(seats.map((s) => ({ id: uuid(), bookingId: id, showId: b.showId, seatId: s.id, seatLabel: s.label, category: s.category, price: b.show.prices[s.category] ?? 0, active: true })));
      await tx.update(schema.bookings).set({ seatLabels: seats.sort((x, y) => x.rowIndex - y.rowIndex || x.num - y.num).map((s) => s.label) }).where(eq(schema.bookings.id, id));
    });
  } catch (e) {
    if (e instanceof BookingError) back(id, e.message);
    if (isUniqueViolation(e)) back(id, "A seat was sold a moment ago. Pick again.");
    throw e;
  }
  const full = await bookingFull(id);
  if (full) await sendBookingConfirmation(full, await siteOrigin());
  await logActivity(me, "reseat", "booking", id, `Booking ${id} moved from ${b.seatLabels.join(", ")} to ${labels.join(", ")}`, { seats: [b.seatLabels, labels] });
  back(id, `${id} moved to ${labels.join(", ")}. Confirmation re-sent.`);
}
