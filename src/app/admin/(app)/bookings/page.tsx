import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { BookingError, cancelBooking } from "@/lib/booking";
import { fmtDateTime, inr } from "@/lib/format";
import { sendCancellation } from "@/lib/notify";
import { bookingFull } from "@/lib/queries";

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string }> }) {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const { q = "", msg } = await searchParams;
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const where = !term ? undefined : /[a-z]/i.test(term)
    ? like(schema.bookings.id, `%${term.toUpperCase()}%`)
    : or(like(schema.bookings.id, `%${term}%`), inArray(schema.bookings.customerId, db.select({ id: schema.customers.id }).from(schema.customers).where(like(schema.customers.phone, `%${digits || "~"}%`))));
  const list = await db.query.bookings.findMany({ where, orderBy: desc(schema.bookings.createdAt), limit: 50, with: { show: { with: { movie: true, screen: true } }, customer: true } });

  async function forceCancel(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    const id = String(fd.get("id"));
    try {
      const r = await cancelBooking(id, { force: true });
      const full = await bookingFull(id);
      if (full) await sendCancellation(full, r.amount);
      redirect(`/admin/bookings?q=${id}&msg=${encodeURIComponent(`${id} cancelled, ${inr(r.amount)} refunded.`)}`);
    } catch (e) {
      if (e instanceof BookingError) redirect(`/admin/bookings?q=${id}&msg=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Bookings</h1><div className="text-sm text-muted">Search by booking id or mobile number.</div></div>
        <form className="flex gap-2"><input name="q" defaultValue={q} className="input h-10 w-56" placeholder="SHW-… or 98400…" /><button className="btn btn-ghost btn-sm h-10">Search</button></form></div>
      {msg && <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">{msg}</div>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Booking</th><th>Show</th><th>Customer</th><th>Seats</th><th>Channel</th><th>Status</th><th className="text-right">Total</th><th></th></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/tickets/${b.id}`} className="font-mono text-brand hover:underline">{b.id}</Link><div className="text-[11px] text-muted">{fmtDateTime(b.createdAt)}</div></td>
                <td>{b.show.movie.title}<div className="text-[11px] text-muted">{fmtDateTime(b.show.startsAt)} · {b.show.screen.name.split(" ·")[0]}</div></td>
                <td>{b.customer?.name ?? "Walk-in"}<div className="text-[11px] text-muted">{b.customer?.phone}</div></td>
                <td>{b.seatLabels.join(", ")}</td><td className="capitalize text-muted">{b.channel}</td>
                <td><span className={b.status === "confirmed" ? "text-ok" : b.status === "pending" ? "text-warn" : "text-muted"}>{b.status}</span>{b.refundAmount > 0 && <div className="text-[11px] text-muted">refund {inr(b.refundAmount)}</div>}</td>
                <td className="num text-right">{inr(b.total)}</td>
                <td>{b.status === "confirmed" && <form action={forceCancel}><input type="hidden" name="id" value={b.id} /><button className="btn btn-danger btn-sm" title="Cancel with a full refund, regardless of policy">Cancel + refund</button></form>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">No bookings match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
