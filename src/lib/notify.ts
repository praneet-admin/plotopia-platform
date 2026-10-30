import { db, schema } from "@/db";
import { uuid } from "./ids";
import { fmtDateTime, inr } from "./format";

type B = { id: string; seatLabels: string[]; total: number; qrToken: string; customer?: { name: string; phone: string; email?: string | null } | null; show: { startsAt: number; movie: { title: string }; screen: { name: string } } };

/** In production this would call an email/SMS/WhatsApp provider. The demo logs the message so staff can see it. */
export async function sendBookingConfirmation(b: B, origin: string) {
  if (!b.customer) return;
  const link = `${origin}/tickets/${b.id}?t=${b.qrToken}`;
  const body = `Hi ${b.customer.name.split(" ")[0]}, your tickets are confirmed!\n${b.show.movie.title} · ${b.show.screen.name}\n${fmtDateTime(b.show.startsAt)}\nSeats ${b.seatLabels.join(", ")} · Paid ${inr(b.total)}\nBooking ${b.id}. Show this QR at the gate: ${link}`;
  const now = Date.now();
  const rows = [
    { id: uuid(), channel: "whatsapp", to: `+91 ${b.customer.phone}`, subject: `Tickets confirmed · ${b.id}`, body, bookingId: b.id, createdAt: now },
    { id: uuid(), channel: "sms", to: `+91 ${b.customer.phone}`, subject: `Show ${b.id}`, body: `Show: ${b.show.movie.title}, ${fmtDateTime(b.show.startsAt)}, seats ${b.seatLabels.join(",")}. Ticket: ${link}`, bookingId: b.id, createdAt: now },
  ];
  if (b.customer.email) rows.push({ id: uuid(), channel: "email", to: b.customer.email, subject: `Your tickets for ${b.show.movie.title} · ${b.id}`, body, bookingId: b.id, createdAt: now });
  await db.insert(schema.notifications).values(rows);
}

export async function sendCancellation(b: B, refund: number) {
  if (!b.customer) return;
  await db.insert(schema.notifications).values({ id: uuid(), channel: "whatsapp", to: `+91 ${b.customer.phone}`, subject: `Booking ${b.id} cancelled`, body: `Your booking ${b.id} for ${b.show.movie.title} (${fmtDateTime(b.show.startsAt)}) is cancelled. ${refund > 0 ? `Refund of ${inr(refund)} will reach your original payment method in 5-7 days.` : "No refund applies under the cancellation policy."}`, bookingId: b.id, createdAt: Date.now() });
}
