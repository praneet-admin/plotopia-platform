import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Countdown } from "@/components/Countdown";
import { requireStaff } from "@/lib/admin";
import { BookingError, createPendingBooking, settlePayment } from "@/lib/booking";
import { getCartGroup } from "@/lib/cart";
import { CATEGORIES } from "@/lib/hall";
import { token, uuid } from "@/lib/ids";
import { fmtDateTime, inr } from "@/lib/format";
import { sendBookingConfirmation } from "@/lib/notify";
import { bookingFull } from "@/lib/queries";

export default async function CounterConfirm({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const { showId } = await params;
  const { error } = await searchParams;
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, showId), with: { movie: true, screen: true } });
  if (!show) notFound();
  const group = await getCartGroup(showId);
  const holds = group ? await db.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.holdGroup, group), eq(schema.seatHolds.showId, showId), gt(schema.seatHolds.expiresAt, Date.now())) }) : [];
  if (!holds.length) redirect(`/admin/counter/${showId}`);
  const seats = (await db.query.seats.findMany({ where: inArray(schema.seats.id, holds.map((h) => h.seatId)) })).sort((a, b) => a.rowIndex - b.rowIndex || a.num - b.num);
  const total = seats.reduce((s, r) => s + (show.prices[r.category] ?? 0), 0);
  const expiresAt = Math.min(...holds.map((h) => h.expiresAt));
  const idem = token(12);

  async function sell(fd: FormData) {
    "use server";
    const staff = await requireStaff(["admin", "manager", "boxoffice"]);
    const name = String(fd.get("name") ?? "").trim() || "Walk-in";
    const phone = String(fd.get("phone") ?? "").replace(/\D/g, "").slice(-10);
    const method = String(fd.get("method") ?? "cash");
    const key = String(fd.get("idem") ?? "");
    const g = await getCartGroup(showId);
    if (!g) redirect(`/admin/counter/${showId}`);
    let customerId: string | null = null;
    if (phone.length === 10) {
      const c = await db.query.customers.findFirst({ where: eq(schema.customers.phone, phone) });
      if (c) customerId = c.id;
      else { customerId = uuid(); await db.insert(schema.customers).values({ id: customerId, phone, name, createdAt: Date.now() }); }
    }
    try {
      const b = await createPendingBooking({ showId, holdGroup: g, customerId, channel: "counter", createdBy: staff.id });
      const r = await settlePayment({ bookingId: b.id, idempotencyKey: `counter:${b.id}:${key}`, method, outcome: "succeeded" });
      if (r.booking.status === "confirmed" && !r.replayed && customerId) {
        const full = await bookingFull(b.id);
        const h = await headers();
        if (full) await sendBookingConfirmation(full, `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);
      }
      redirect(`/tickets/${b.id}?t=${r.booking.qrToken}&new=1`);
    } catch (e) {
      if (e instanceof BookingError) redirect(`/admin/counter/${showId}/confirm?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between"><Link href={`/admin/counter/${showId}`} className="text-xs text-muted hover:text-text">← Change seats</Link><span className="pill">Held for <Countdown until={expiresAt} /></span></div>
      <h1 className="text-xl font-bold">Confirm counter sale</h1>
      {error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <div className="card p-4 text-sm">
        <div className="font-semibold">{show.movie.title} · {show.screen.name}</div><div className="text-muted">{fmtDateTime(show.startsAt)}</div>
        <ul className="mt-3 divide-y divide-line">{seats.map((s) => <li key={s.id} className="flex justify-between py-1.5"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[s.category]?.css }} />{s.label} <span className="text-muted">{CATEGORIES[s.category]?.name}</span></span><span className="num">{inr(show.prices[s.category] ?? 0)}</span></li>)}
          <li className="flex justify-between py-2 text-base font-bold"><span>Total (no fee)</span><span className="num">{inr(total)}</span></li></ul>
      </div>
      <form action={sell} className="card grid gap-3 p-4 sm:grid-cols-2">
        <input type="hidden" name="idem" value={idem} />
        <div><label className="label">Customer name <span className="font-normal normal-case">(optional)</span></label><input name="name" className="input" /></div>
        <div><label className="label">Mobile <span className="font-normal normal-case">(optional, for WhatsApp ticket)</span></label><input name="phone" className="input" inputMode="numeric" /></div>
        <div className="sm:col-span-2"><label className="label">Payment</label><div className="flex gap-2">{["cash", "card", "upi"].map((m) => <label key={m} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg-2 px-4 py-2 capitalize has-[:checked]:border-brand has-[:checked]:bg-brand/10"><input type="radio" name="method" value={m} defaultChecked={m === "cash"} className="accent-brand" />{m}</label>)}</div></div>
        <div className="sm:col-span-2"><button className="btn btn-primary">Collect {inr(total)} &amp; print ticket</button> <span className="ml-2 text-xs text-muted">Sold by {me.name}</span></div>
      </form>
    </div>
  );
}
