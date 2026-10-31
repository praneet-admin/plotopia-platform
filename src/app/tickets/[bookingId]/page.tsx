import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Footer, Header } from "@/components/Header";
import { currentCustomer, currentStaff } from "@/lib/auth";
import { BookingError, cancelBooking } from "@/lib/booking";
import { CATEGORIES, simulatorLink } from "@/lib/hall";
import { fmtDate, fmtTime, inr, runtime } from "@/lib/format";
import { sendCancellation } from "@/lib/notify";
import { refundFor } from "@/lib/pricing";
import { bookingFull } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PrintButton } from "./print";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ t?: string; new?: string; error?: string; cancelled?: string }> }) {
  const { bookingId } = await params;
  const sp = await searchParams;
  const b = await bookingFull(bookingId);
  if (!b) notFound();
  const [customer, staff] = await Promise.all([currentCustomer(), currentStaff()]);
  const owner = (customer && b.customerId === customer.id) || sp.t === b.qrToken || !!staff;
  if (!owner) redirect(`/my?next=/tickets/${bookingId}`);
  if (b.status === "pending") redirect(`/pay/${b.id}`);

  const qr = await QRCode.toString(`PLOTOPIA:${b.qrToken}`, { type: "svg", margin: 1, color: { dark: "#0b0d12", light: "#ffffff" }, errorCorrectionLevel: "M" });
  const now = Date.now();
  const refund = refundFor(b.total, b.show.startsAt, now);
  const checkedIn = b.tickets.some((t) => t.checkedInAt);
  const canCancel = b.status === "confirmed" && !checkedIn && b.show.startsAt > now;
  const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.bookingId, b.id) });
  const waText = encodeURIComponent(`🎬 ${b.show.movie.title}\n${fmtDate(b.show.startsAt)}, ${fmtTime(b.show.startsAt)} · ${b.show.screen.name}\nSeats ${b.seatLabels.join(", ")}\nBooking ${b.id}`);

  async function cancel() {
    "use server";
    try {
      const r = await cancelBooking(bookingId);
      const full = await bookingFull(bookingId);
      if (full) await sendCancellation(full, r.amount);
      redirect(`/tickets/${bookingId}?t=${b!.qrToken}&cancelled=${r.amount}`);
    } catch (e) {
      if (e instanceof BookingError) redirect(`/tickets/${bookingId}?t=${b!.qrToken}&error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <>
      <Header />
      <main className="container-x flex-1">
        {sp.new && (
          <div className="fade-up mx-auto mt-6 max-w-md rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-green-100">
            <div className="font-semibold">Booking confirmed 🎉</div>
            <div className="mt-0.5 text-xs opacity-90">{b.customer ? `Sent to +91 ${b.customer.phone} on WhatsApp and SMS${b.customer.email ? ` and to ${b.customer.email}` : ""}.` : "Walk-in sale: print the ticket for the customer."}</div>
          </div>
        )}
        {sp.cancelled !== undefined && <div className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-panel px-4 py-3 text-sm">Booking cancelled. {Number(sp.cancelled) > 0 ? `Refund of ${inr(Number(sp.cancelled))} is on its way (5-7 days).` : "No refund applies this close to the show."}</div>}
        {sp.error && <div className="mx-auto mt-6 max-w-md rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-red-200">{sp.error}</div>}

        <div className="fade-up mx-auto mt-6 max-w-md">
          <div className="overflow-hidden rounded-2xl bg-white text-[#0b0d12] shadow-2xl">
            <div className="p-5" style={{ background: `linear-gradient(135deg, ${b.show.movie.accent}, ${b.show.movie.accent2})` }}>
              <div className="flex items-start justify-between text-white">
                <div><div className="text-xs font-semibold opacity-80">Plotopia e-ticket</div><div className="mt-1 text-2xl font-black leading-tight">{b.show.movie.title}</div><div className="text-sm opacity-90">{b.show.movie.language} · {b.show.movie.certificate} · {runtime(b.show.movie.runtimeMin)}</div></div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${b.status === "confirmed" ? "bg-white/20" : "bg-black/40"}`}>{b.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 px-5 py-4 text-sm">
              <div><div className="text-[10px] font-bold uppercase text-gray-500">Date</div><div className="font-semibold">{fmtDate(b.show.startsAt)}</div></div>
              <div><div className="text-[10px] font-bold uppercase text-gray-500">Time</div><div className="font-semibold">{fmtTime(b.show.startsAt)}</div></div>
              <div><div className="text-[10px] font-bold uppercase text-gray-500">Screen</div><div className="font-semibold">{b.show.screen.name.split(" ·")[0]}</div></div>
              <div className="col-span-3"><div className="text-[10px] font-bold uppercase text-gray-500">Seats</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {b.tickets.map((t) => (
                    <a key={t.id} href={simulatorLink(b.show.screen.layout.simId ?? b.show.screen.id, t.seatLabel)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold hover:border-gray-400" title="See the view from this seat">
                      <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORIES[t.category]?.css }} />{t.seatLabel}{t.checkedInAt && <span className="text-[10px] text-green-600">✓ in</span>}
                    </a>
                  ))}
                </div>
              </div>
              <div className="col-span-3 text-xs text-gray-500">{b.show.screen.cinema.name}, {b.show.screen.cinema.address}</div>
            </div>
            <div className="relative border-t-2 border-dashed border-gray-200">
              <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bg" /><span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bg" />
            </div>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className={`w-28 flex-none rounded-lg border border-gray-200 p-1 ${b.status !== "confirmed" ? "opacity-30 grayscale" : ""}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="min-w-0 text-sm">
                <div className="text-[10px] font-bold uppercase text-gray-500">Booking ID</div>
                <div className="font-mono text-lg font-bold tracking-wider">{b.id}</div>
                <div className="mt-1 text-xs text-gray-500">{b.customer?.name}{b.customer ? ` · +91 ${b.customer.phone}` : ""}</div>
                <div className="mt-2 text-xs text-gray-500">Paid <span className="font-semibold text-[#0b0d12]">{inr(b.total)}</span> {b.channel === "counter" ? "at the counter" : "online"}{b.refundAmount > 0 ? ` · refunded ${inr(b.refundAmount)}` : ""}</div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 text-[11px] text-gray-500">Show this QR at the gate. Gates open 3 hours before the show. Carry a valid ID for A-rated films.</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <a className="btn btn-ghost btn-sm" href={`/tickets/${b.id}/calendar.ics?t=${b.qrToken}`}>Add to calendar</a>
            <Link className="btn btn-ghost btn-sm" href="/my">My bookings</Link>
            <PrintButton />
          </div>

          {canCancel && (
            <form action={cancel} className="panel mt-5 p-4">
              <div className="text-sm font-semibold">Can&apos;t make it?</div>
              <p className="mt-1 text-xs text-muted">Cancelling now refunds <span className="text-text">{inr(refund.amount)}</span> ({refund.pct}% of {inr(b.total)}). Full refund up to 24h before, 50% up to 2h before, none after.</p>
              <button className="btn btn-danger btn-sm mt-3">Cancel booking</button>
            </form>
          )}
          {notes.length > 0 && (
            <details className="panel mt-5 p-4 text-sm">
              <summary className="cursor-pointer font-semibold">Messages sent ({notes.length})</summary>
              <ul className="mt-3 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-bg-2 p-3"><div className="text-xs text-muted"><span className="uppercase">{n.channel}</span> → {n.to}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-xs">{n.body}</pre></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
