import Link from "next/link";
import { desc, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { fmtDateTime, inr } from "@/lib/format";
import { getSettings, refundPolicy } from "@/lib/settings";
import { cancel, markRefunded, remind, resend, reseat } from "./actions";

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string }> }) {
  const me = await requireStaff(["admin", "manager", "boxoffice"]);
  const { q = "", msg } = await searchParams;
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const where = !term ? undefined : /[a-z]/i.test(term)
    ? like(schema.bookings.id, `%${term.toUpperCase()}%`)
    : or(like(schema.bookings.id, `%${term}%`), inArray(schema.bookings.customerId, db.select({ id: schema.customers.id }).from(schema.customers).where(like(schema.customers.phone, `%${digits || "~"}%`))));
  const [list, { booking: rules }] = await Promise.all([db.query.bookings.findMany({ where, orderBy: desc(schema.bookings.createdAt), limit: 50, with: { show: { with: { movie: true, screen: true } }, customer: true, tickets: true } }), getSettings()]);
  const manager = ["admin", "manager"].includes(me.role);
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Bookings</h1><div className="text-sm text-muted">Search by booking id or mobile number. Open a row for cancel, refund, reseat and resend.</div></div>
        <form className="flex gap-2"><input name="q" defaultValue={q} className="input h-10 w-56" placeholder="PLT-… or 98400…" /><button className="btn btn-ghost btn-sm h-10">Search</button></form></div>
      {msg && <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">{msg}</div>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Booking</th><th>Show</th><th>Customer</th><th>Seats</th><th>Channel</th><th>Status</th><th className="text-right">Total</th><th></th></tr></thead>
          <tbody>
            {list.map((b) => {
              const policy = refundPolicy(rules, b.total, b.show.startsAt, now);
              const checkedIn = b.tickets.some((t) => t.checkedInAt);
              const open = list.length === 1 || q.toUpperCase() === b.id;
              return (
                <tr key={b.id} className="align-top">
                  <td><Link href={`/tickets/${b.id}`} className="font-mono text-brand hover:underline">{b.id}</Link><div className="text-[11px] text-muted">{fmtDateTime(b.createdAt)}</div></td>
                  <td>{b.show.movie.title}<div className="text-[11px] text-muted">{fmtDateTime(b.show.startsAt)} · {b.show.screen.name.split(" ·")[0]}</div></td>
                  <td>{b.customer ? <Link href={`/admin/customers?id=${b.customer.id}`} className="hover:underline">{b.customer.name}</Link> : "Walk-in"}<div className="text-[11px] text-muted">{b.customer?.phone}</div></td>
                  <td>{b.seatLabels.join(", ")}{checkedIn && <div className="text-[11px] text-ok">checked in</div>}</td><td className="capitalize text-muted">{b.channel}</td>
                  <td><span className={b.status === "confirmed" ? "text-ok" : b.status === "pending" ? "text-warn" : "text-muted"}>{b.status}</span>{b.refundAmount > 0 && <div className="text-[11px] text-muted">refund {inr(b.refundAmount)}</div>}</td>
                  <td className="num text-right">{inr(b.total)}</td>
                  <td className="min-w-[200px]">
                    <details open={open}>
                      <summary className="cursor-pointer text-xs text-brand">Actions</summary>
                      <div className="mt-2 space-y-2 text-xs">
                        {b.status === "confirmed" && (
                          <>
                            <form action={cancel} className="flex flex-wrap gap-1"><input type="hidden" name="id" value={b.id} />
                              <button name="mode" value="policy" className="btn btn-ghost btn-sm h-7" title="What the customer would get if they cancelled now">Cancel · refund {policy.pct}% ({inr(policy.amount)})</button>
                              {manager && <button name="mode" value="full" className="btn btn-danger btn-sm h-7">Cancel · full refund</button>}
                              {manager && <button name="mode" value="none" className="btn btn-ghost btn-sm h-7">Cancel · no refund</button>}
                            </form>
                            <div className="flex flex-wrap gap-1">
                              {b.customer && <form action={resend}><input type="hidden" name="id" value={b.id} /><button className="btn btn-ghost btn-sm h-7">Resend ticket</button></form>}
                              {b.customer && b.show.startsAt > now && <form action={remind}><input type="hidden" name="id" value={b.id} /><button className="btn btn-ghost btn-sm h-7">Send reminder</button></form>}
                            </div>
                            {!checkedIn && b.show.endsAt > now && <form action={reseat} className="flex gap-1"><input type="hidden" name="id" value={b.id} /><input name="seats" placeholder={`${b.seatLabels.length} new seat(s), e.g. H4, H5`} className="input h-7 flex-1 px-2 font-mono text-xs" /><button className="btn btn-ghost btn-sm h-7">Reseat</button></form>}
                          </>
                        )}
                        {manager && ["cancelled", "refunded"].includes(b.status) && b.refundAmount < b.total && (
                          <form action={markRefunded} className="flex gap-1"><input type="hidden" name="id" value={b.id} /><input name="amount" type="number" min={1} max={b.total - b.refundAmount} defaultValue={b.total - b.refundAmount} className="input h-7 w-24 px-2 text-xs num" /><button className="btn btn-ghost btn-sm h-7" title="Record a refund paid by hand">Mark refunded</button></form>
                        )}
                        {b.status === "pending" && <span className="text-muted">Awaiting payment; the hold expires on its own.</span>}
                        {["cancelled", "refunded"].includes(b.status) && !(manager && b.refundAmount < b.total) && <span className="text-muted">Closed.</span>}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">No bookings match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
