import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { currentCustomer, customerLogin } from "@/lib/auth";
import { BookingError, createPendingBooking } from "@/lib/booking";
import { getCartGroup } from "@/lib/cart";
import { CATEGORIES, simulatorLink } from "@/lib/hall";
import { uuid } from "@/lib/ids";
import { fmtDateTime, inr } from "@/lib/format";
import { CONVENIENCE_FEE_PER_SEAT } from "@/lib/pricing";
import { ExpiryRedirect } from "./expiry";

export const dynamic = "force-dynamic";

async function upsertCustomer(name: string, phone: string, email: string | null) {
  const existing = await db.query.customers.findFirst({ where: eq(schema.customers.phone, phone) });
  if (existing) {
    if (existing.name !== name || (email && existing.email !== email)) await db.update(schema.customers).set({ name, email: email ?? existing.email }).where(eq(schema.customers.id, existing.id));
    return existing.id;
  }
  const id = uuid();
  await db.insert(schema.customers).values({ id, name, phone, email, createdAt: Date.now() });
  return id;
}

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { showId } = await params;
  const { error } = await searchParams;
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, showId), with: { movie: true, screen: true } });
  if (!show) notFound();
  const group = await getCartGroup(showId);
  const now = Date.now();
  const holds = group ? await db.query.seatHolds.findMany({ where: and(eq(schema.seatHolds.holdGroup, group), eq(schema.seatHolds.showId, showId), gt(schema.seatHolds.expiresAt, now)) }) : [];
  if (!holds.length) redirect(`/book/${showId}?expired=1`);
  const seats = (await db.query.seats.findMany({ where: inArray(schema.seats.id, holds.map((h) => h.seatId)) })).sort((a, b) => a.rowIndex - b.rowIndex || a.num - b.num);
  const subtotal = seats.reduce((s, r) => s + (show.prices[r.category] ?? 0), 0);
  const fee = CONVENIENCE_FEE_PER_SEAT * seats.length;
  const expiresAt = Math.min(...holds.map((h) => h.expiresAt));
  const customer = await currentCustomer();

  async function submit(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(-10);
    const email = String(formData.get("email") ?? "").trim() || null;
    if (name.length < 2 || phone.length !== 10) redirect(`/checkout/${showId}?error=${encodeURIComponent("Enter your name and a 10-digit mobile number.")}`);
    const g = await getCartGroup(showId);
    if (!g) redirect(`/book/${showId}?expired=1`);
    const customerId = await upsertCustomer(name, phone, email);
    const cur = await currentCustomer();
    if (!cur || cur.id !== customerId) await customerLogin(customerId);
    let bookingId: string;
    try {
      const b = await createPendingBooking({ showId, holdGroup: g, customerId });
      bookingId = b.id;
    } catch (e) {
      if (e instanceof BookingError && e.code === "expired") redirect(`/book/${showId}?expired=1`);
      throw e;
    }
    redirect(`/pay/${bookingId}`);
  }

  return (
    <>
      <Header />
      <ExpiryRedirect until={expiresAt} to={`/book/${showId}?expired=1`} />
      <main className="container-x flex-1 pb-10">
        <div className="mt-5 flex items-center justify-between">
          <Link href={`/book/${showId}`} className="text-xs text-muted hover:text-text">← Change seats</Link>
          <div className="pill">Seats held for <Countdown until={expiresAt} /></div>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_380px]">
          <form action={submit} className="card order-2 p-5 lg:order-1">
            <h1 className="text-lg font-bold">Who&apos;s watching?</h1>
            <p className="mt-1 text-sm text-muted">Tickets go to this number on WhatsApp and SMS. No account needed.</p>
            {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required minLength={2} defaultValue={customer?.name ?? ""} autoComplete="name" /></div>
              <div><label className="label" htmlFor="phone">Mobile</label><div className="flex"><span className="flex h-11 items-center rounded-l-xl border border-r-0 border-line bg-panel-2 px-3 text-sm text-muted">+91</span><input id="phone" name="phone" className="input rounded-l-none" required inputMode="numeric" pattern="[0-9]{10}" placeholder="10 digits" defaultValue={customer?.phone ?? ""} autoComplete="tel-national" /></div></div>
              <div><label className="label" htmlFor="email">Email <span className="font-normal normal-case text-muted">(optional)</span></label><input id="email" name="email" type="email" className="input" defaultValue={customer?.email ?? ""} autoComplete="email" /></div>
            </div>
            <button className="btn btn-primary mt-5 w-full sm:w-auto">Continue to payment · {inr(subtotal + fee)}</button>
          </form>

          <aside className="card order-1 p-5 lg:order-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Order summary</div>
            <div className="mt-2 font-bold">{show.movie.title}</div>
            <div className="text-sm text-muted">{show.screen.name} · {show.format}</div>
            <div className="text-sm text-muted">{fmtDateTime(show.startsAt)}</div>
            <ul className="mt-4 divide-y divide-line text-sm">
              {seats.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[s.category]?.css }} />{s.label} <span className="text-muted">{CATEGORIES[s.category]?.name}</span>
                    <a className="text-xs text-brand hover:underline" href={simulatorLink(show.screen.layout.simId ?? show.screen.id, s.label)} target="_blank" rel="noreferrer">view</a></span>
                  <span className="num">{inr(show.prices[s.category] ?? 0)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 text-muted"><span>Convenience fee</span><span className="num">{inr(fee)}</span></li>
              <li className="flex justify-between py-2 text-base font-bold"><span>Total</span><span className="num">{inr(subtotal + fee)}</span></li>
            </ul>
            <p className="mt-3 text-[11px] text-muted">Cancellation: full refund up to 24h before the show, 50% up to 2h before, none after that.</p>
          </aside>
        </div>
      </main>
    </>
  );
}
