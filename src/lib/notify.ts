import { db, schema } from "@/db";
import { uuid } from "./ids";
import { fmtDateTime, inr } from "./format";
import { fill, getSettings } from "./settings";

type B = { id: string; seatLabels: string[]; total: number; qrToken: string; customer?: { name: string; phone: string; email?: string | null } | null; show: { startsAt: number; movie: { title: string }; screen: { name: string } } };

async function vars(b: B, origin: string, extra: Record<string, string | number> = {}) {
  const s = await getSettings();
  return {
    s,
    v: {
      name: b.customer?.name.split(" ")[0] ?? "there",
      fullName: b.customer?.name ?? "",
      title: b.show.movie.title,
      screen: b.show.screen.name,
      time: fmtDateTime(b.show.startsAt),
      seats: b.seatLabels.join(", "),
      total: inr(b.total),
      id: b.id,
      link: `${origin}/tickets/${b.id}?t=${b.qrToken}`,
      site: s.brand.siteName,
      gateHours: s.booking.gateOpensHoursBefore,
      ...extra,
    },
  };
}

/** In production this would call an email/SMS/WhatsApp provider. The demo logs the message so staff can see it. Templates: /admin/settings → Messages. */
export async function sendBookingConfirmation(b: B, origin: string) {
  if (!b.customer) return;
  const { s, v } = await vars(b, origin);
  const body = fill(s.messages.confirmation, v);
  const now = Date.now();
  const rows = [
    { id: uuid(), channel: "whatsapp", to: `+91 ${b.customer.phone}`, subject: `Tickets confirmed · ${b.id}`, body, bookingId: b.id, createdAt: now },
    { id: uuid(), channel: "sms", to: `+91 ${b.customer.phone}`, subject: `${s.brand.siteName} ${b.id}`, body: fill(s.messages.confirmationSms, v), bookingId: b.id, createdAt: now },
  ];
  if (b.customer.email) rows.push({ id: uuid(), channel: "email", to: b.customer.email, subject: `Your tickets for ${b.show.movie.title} · ${b.id}`, body, bookingId: b.id, createdAt: now });
  await db.insert(schema.notifications).values(rows);
}

export async function sendCancellation(b: B, refund: number, origin = "") {
  if (!b.customer) return;
  const { s, v } = await vars(b, origin, { refund: inr(refund) });
  const refundLine = fill(refund > 0 ? s.messages.refundLine : s.messages.noRefundLine, v);
  await db.insert(schema.notifications).values({ id: uuid(), channel: "whatsapp", to: `+91 ${b.customer.phone}`, subject: `Booking ${b.id} cancelled`, body: fill(s.messages.cancellation, { ...v, refundLine }), bookingId: b.id, createdAt: Date.now() });
}

export async function sendReminder(b: B, origin: string) {
  if (!b.customer) return;
  const { s, v } = await vars(b, origin);
  await db.insert(schema.notifications).values({ id: uuid(), channel: "whatsapp", to: `+91 ${b.customer.phone}`, subject: `Reminder · ${b.id}`, body: fill(s.messages.reminder, v), bookingId: b.id, createdAt: Date.now() });
}

/** Preview a template with sample values, for the settings page. */
export async function renderSample(template: string) {
  const s = await getSettings();
  return fill(template, { name: "Priya", fullName: "Priya Raman", title: "The Matrix", screen: "Audi 3 · Standard", time: fmtDateTime(Date.now() + 86_400_000), seats: "G7, G8", total: inr(560), id: "PLT-SAMPLE", link: "https://example.com/tickets/PLT-SAMPLE", site: s.brand.siteName, gateHours: s.booking.gateOpensHoursBefore, refund: inr(560), refundLine: fill(s.messages.refundLine, { refund: inr(560) }) });
}
