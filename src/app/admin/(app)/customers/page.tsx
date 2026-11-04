import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { diffOf, logActivity } from "@/lib/activity";
import { fmtDateTime, inr } from "@/lib/format";

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string; id?: string }> }) {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const { q = "", msg, id } = await searchParams;
  const term = q.trim();
  const where = !term ? undefined : or(like(schema.customers.phone, `%${term.replace(/\D/g, "") || "~"}%`), like(schema.customers.name, `%${term}%`), like(schema.customers.email, `%${term}%`), eq(schema.customers.id, term));
  const list = await db.query.customers.findMany({ where, orderBy: desc(schema.customers.createdAt), limit: 60 });
  const stats = list.length
    ? await db.select({ customerId: schema.bookings.customerId, n: sql<number>`count(*)`, spent: sql<number>`coalesce(sum(case when status in ('confirmed','refunded') then total - refund_amount else 0 end),0)`, last: sql<number>`max(created_at)` }).from(schema.bookings).where(sql`${schema.bookings.customerId} in (${sql.join(list.map((c) => sql`${c.id}`), sql`, `)})`).groupBy(schema.bookings.customerId)
    : [];
  const st = new Map(stats.map((s) => [s.customerId, s]));
  const open = id ? list.find((c) => c.id === id) ?? (await db.query.customers.findFirst({ where: eq(schema.customers.id, id) })) : null;
  const bookings = open ? await db.query.bookings.findMany({ where: eq(schema.bookings.customerId, open.id), orderBy: desc(schema.bookings.createdAt), limit: 30, with: { show: { with: { movie: true } } } }) : [];

  async function save(fd: FormData) {
    "use server";
    const me = await requireStaff(["admin", "manager", "boxoffice"]);
    const cid = String(fd.get("id"));
    const cur = await db.query.customers.findFirst({ where: eq(schema.customers.id, cid) });
    if (!cur) return;
    const row = { name: String(fd.get("name") ?? "").trim() || cur.name, email: String(fd.get("email") ?? "").trim() || null, phone: String(fd.get("phone") ?? "").replace(/\D/g, "").slice(-10) || cur.phone, notes: String(fd.get("notes") ?? "").trim() || null, blocked: fd.get("blocked") === "on" };
    if (row.phone !== cur.phone && (await db.query.customers.findFirst({ where: eq(schema.customers.phone, row.phone) }))) redirect(`/admin/customers?id=${cid}&msg=${encodeURIComponent("Another customer already has that number.")}`);
    await db.update(schema.customers).set(row).where(eq(schema.customers.id, cid));
    const d = diffOf(cur, { ...cur, ...row });
    if (d) await logActivity(me, row.blocked !== cur.blocked ? (row.blocked ? "block" : "unblock") : "update", "customer", cid, `Customer ${row.name} (${row.phone}) ${row.blocked !== cur.blocked ? (row.blocked ? "blocked" : "unblocked") : "updated"}`, d);
    redirect(`/admin/customers?id=${cid}&msg=Saved`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Customers</h1><div className="text-sm text-muted">Everyone who has booked or signed in. Search by name, mobile or email.</div></div>
        <form className="flex gap-2"><input name="q" defaultValue={q} className="input h-10 w-56" placeholder="Name, 98400…, email" /><button className="btn btn-ghost btn-sm h-10">Search</button></form></div>
      {msg && <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">{msg}</div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Customer</th><th>Contact</th><th className="text-right">Bookings</th><th className="text-right">Spent</th><th>Last</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => { const s = st.get(c.id); return (
                <tr key={c.id} className={c.blocked ? "opacity-60" : ""}>
                  <td className="font-medium">{c.name}{c.blocked && <span className="pill ml-2 text-[10px] text-bad">BLOCKED</span>}<div className="text-[11px] text-muted">since {fmtDateTime(c.createdAt)}</div></td>
                  <td className="text-xs">+91 {c.phone}<div className="text-muted">{c.email}</div></td>
                  <td className="num text-right">{s?.n ?? 0}</td><td className="num text-right">{inr(s?.spent ?? 0)}</td>
                  <td className="text-xs text-muted">{s?.last ? fmtDateTime(s.last) : "—"}</td>
                  <td className="text-right"><Link href={`/admin/customers?q=${encodeURIComponent(q)}&id=${c.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ); })}
              {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">No customers match.</td></tr>}
            </tbody>
          </table>
        </div>
        {open && (
          <div className="space-y-3">
            <form action={save} className="card space-y-3 p-4 text-sm">
              <input type="hidden" name="id" value={open.id} />
              <div className="flex items-baseline justify-between"><h2 className="font-semibold">{open.name}</h2><span className="font-mono text-[11px] text-muted">{open.id.slice(0, 8)}</span></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className="label">Name</label><input name="name" defaultValue={open.name} className="input h-9" /></div>
                <div><label className="label">Mobile</label><input name="phone" defaultValue={open.phone} className="input h-9" inputMode="numeric" /></div>
                <div className="sm:col-span-2"><label className="label">Email</label><input name="email" type="email" defaultValue={open.email ?? ""} className="input h-9" /></div>
                <div className="sm:col-span-2"><label className="label">Staff notes</label><textarea name="notes" rows={2} defaultValue={open.notes ?? ""} className="input" placeholder="Only staff see this." /></div>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-line bg-bg-2 px-3 py-2"><input type="checkbox" name="blocked" defaultChecked={open.blocked} className="accent-[var(--brand)]" /><span><span className="font-medium">Block online booking</span><span className="block text-[11px] text-muted">They can still be served at the counter.</span></span></label>
              <button className="btn btn-primary btn-sm">Save customer</button>
            </form>
            <div className="card p-4 text-sm">
              <h3 className="font-semibold">Bookings</h3>
              <ul className="mt-2 divide-y divide-line">
                {bookings.map((b) => <li key={b.id} className="flex items-center justify-between gap-2 py-2"><span><Link href={`/admin/bookings?q=${b.id}`} className="font-mono text-brand hover:underline">{b.id}</Link> <span className="text-muted">{b.show.movie.title} · {b.seatLabels.join(", ")}</span></span><span className={`text-xs ${b.status === "confirmed" ? "text-ok" : "text-muted"}`}>{b.status} · {inr(b.total)}</span></li>)}
                {bookings.length === 0 && <li className="py-2 text-muted">No bookings yet.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
