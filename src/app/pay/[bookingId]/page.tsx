import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { BookingError, settlePayment } from "@/lib/booking";
import { token } from "@/lib/ids";
import { fmtDateTime, inr } from "@/lib/format";
import { sendBookingConfirmation } from "@/lib/notify";
import { bookingFull } from "@/lib/queries";
import { ExpiryRedirect } from "../../checkout/[showId]/expiry";
import QRCode from "qrcode";
import { getSettings } from "@/lib/settings";
import { PayForm } from "./pay-form";

/** UPI handle and payee name come from /admin/settings → Payment. */
function upiLink(pay: { upiId: string; payeeName: string }, scheme: string, amount: number, note: string, ref: string) {
  const q = new URLSearchParams({ pa: pay.upiId, pn: pay.payeeName, am: amount.toFixed(2), cu: "INR", tn: note, tr: ref });
  return `${scheme}?${q}`;
}

export const dynamic = "force-dynamic";

export default async function PayPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { bookingId } = await params;
  const { error } = await searchParams;
  const booking = await bookingFull(bookingId);
  if (!booking) notFound();
  const { payment: pay } = await getSettings();
  if (booking.status === "confirmed") redirect(`/tickets/${booking.id}?t=${booking.qrToken}`);
  if (booking.status !== "pending") redirect(`/tickets/${booking.id}?t=${booking.qrToken}`);
  const holds = await db.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.holdGroup, booking.holdGroup!), gt(schema.seatHolds.expiresAt, Date.now())) });
  if (holds.length !== booking.seatLabels.length) redirect(`/book/${booking.showId}?expired=1`);
  const expiresAt = Math.min(...holds.map((h) => h.expiresAt));
  const idem = token(12);
  const failed = booking.payments.filter((p) => p.status === "failed").length;
  const note = `${booking.show.movie.title} ${booking.seatLabels.join(",")}`.slice(0, 40);
  const link = upiLink(pay, "upi://pay", booking.total, note, booking.id);
  const gpay = upiLink(pay, "tez://upi/pay", booking.total, note, booking.id);
  const qrSvg = await QRCode.toString(link, { type: "svg", margin: 0, color: { dark: "#1a1400", light: "#ffffff" }, errorCorrectionLevel: "M" });

  async function settle(formData: FormData) {
    "use server";
    const key = String(formData.get("idem") ?? "");
    const method = String(formData.get("method") ?? "upi");
    const outcome = formData.get("outcome") === "fail" ? "failed" : "succeeded";
    if (!/^[A-Za-z0-9_-]{8,}$/.test(key)) redirect(`/pay/${bookingId}?error=bad_request`);
    try {
      const r = await settlePayment({ bookingId, idempotencyKey: `pay:${bookingId}:${key}`, method, outcome });
      if (r.booking.status === "confirmed") {
        if (!r.replayed) {
          const full = await bookingFull(bookingId);
          const h = await headers();
          const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
          if (full) await sendBookingConfirmation(full, origin);
        }
        redirect(`/tickets/${bookingId}?t=${r.booking.qrToken}&new=1`);
      }
      redirect(`/pay/${bookingId}?error=${encodeURIComponent("Payment not confirmed. Your seats are still held: scan the QR again or tap Google Pay.")}`);
    } catch (e) {
      if (e instanceof BookingError) {
        if (e.code === "expired") redirect(`/book/${booking!.showId}?expired=1`);
        redirect(`/pay/${bookingId}?error=${encodeURIComponent(e.message)}`);
      }
      throw e;
    }
  }

  return (
    <>
      <Header />
      <ExpiryRedirect until={expiresAt} to={`/book/${booking.showId}?expired=1`} />
      <main className="container-x flex-1 pb-10">
        <div className="mt-5 flex items-center justify-between">
          <Link href={`/book/${booking.showId}`} className="text-sm text-muted hover:text-text">Back to seats</Link>
          <div className="pill">Complete payment in <Countdown until={expiresAt} /></div>
        </div>
        <div className="mx-auto mt-5 max-w-lg">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-panel-2 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">{pay.title} {pay.testMode && <span className="pill text-[10px]">TEST MODE</span>}</div>
              <div className="text-xs text-muted">Ref {booking.id}</div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <div><div className="text-xs text-muted">Paying {pay.payeeName} for</div><div className="font-semibold">{booking.show.movie.title}</div><div className="text-xs text-muted">{fmtDateTime(booking.show.startsAt)} · {booking.seatLabels.join(", ")}</div></div>
                <div className="num text-2xl font-bold">{inr(booking.total)}</div>
              </div>
              {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
              {failed > 0 && !error && <div className="mt-3 text-xs text-muted">{failed} failed attempt{failed > 1 ? "s" : ""} so far. Your seats are still held.</div>}
              {pay.instructions && <p className="mt-3 text-xs text-muted">{pay.instructions}</p>}
              <PayForm action={settle} idem={idem} total={booking.total} upiId={pay.upiId} upiLink={link} gpayLink={gpay} qrSvg={qrSvg} apps={pay.apps} testMode={pay.testMode} />
            </div>
          </div>
          {pay.testMode && pay.testModeNote && <p className="mt-3 text-center text-[11px] text-muted">{pay.testModeNote}</p>}
        </div>
      </main>
    </>
  );
}
