import { redirect } from "next/navigation";
import { and, asc, eq, gt, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/hall";
import { uuid } from "@/lib/ids";
import { priceShow } from "@/lib/pricing";

export default async function PricingAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const { ok } = await searchParams;
  const [screens, rules] = await Promise.all([db.query.screens.findMany({ orderBy: asc(schema.screens.sortOrder) }), db.query.pricingRules.findMany({ orderBy: asc(schema.pricingRules.sortOrder) })]);

  async function saveBase(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    for (const s of await db.query.screens.findMany()) {
      const bp = { ...s.layout.basePrices };
      for (const c of Object.keys(bp)) { const v = Number(fd.get(`${s.id}_${c}`)); if (Number.isFinite(v) && v > 0) bp[c] = Math.round(v); }
      await db.update(schema.screens).set({ layout: { ...s.layout, basePrices: bp } }).where(eq(schema.screens.id, s.id));
    }
    redirect("/admin/pricing?ok=Base+prices+saved");
  }
  async function addRule(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    const name = String(fd.get("name") ?? "").trim();
    const mult = Number(fd.get("multiplier"));
    if (!name || !Number.isFinite(mult) || mult <= 0) return;
    const n = await db.query.pricingRules.findMany();
    await db.insert(schema.pricingRules).values({ id: uuid(), name, dayType: String(fd.get("dayType") ?? "any"), fromHour: Math.max(0, Math.min(24, Number(fd.get("fromHour")) || 0)), toHour: Math.max(0, Math.min(24, Number(fd.get("toHour")) || 24)), multiplier: mult, screenId: String(fd.get("screenId") ?? "") || null, active: true, sortOrder: n.length + 1 });
    redirect("/admin/pricing?ok=Rule+added");
  }
  async function toggleRule(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    const id = String(fd.get("id"));
    const r = await db.query.pricingRules.findFirst({ where: eq(schema.pricingRules.id, id) });
    if (r) await db.update(schema.pricingRules).set({ active: !r.active }).where(eq(schema.pricingRules.id, id));
    redirect("/admin/pricing");
  }
  async function deleteRule(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    await db.delete(schema.pricingRules).where(eq(schema.pricingRules.id, String(fd.get("id"))));
    redirect("/admin/pricing");
  }
  async function reprice() {
    "use server";
    await requireStaff(["admin", "manager"]);
    const sold = db.select({ id: schema.tickets.showId }).from(schema.tickets).where(eq(schema.tickets.active, true));
    const list = await db.query.shows.findMany({ where: and(gt(schema.shows.startsAt, Date.now()), eq(schema.shows.status, "scheduled"), notInArray(schema.shows.id, sold)), with: { screen: true } });
    const rs = await db.query.pricingRules.findMany();
    for (const s of list) await db.update(schema.shows).set({ prices: priceShow(s.screen.layout.basePrices, rs, s.startsAt, s.screenId) }).where(eq(schema.shows.id, s.id));
    redirect(`/admin/pricing?ok=${list.length}+upcoming+shows+repriced`);
  }
  const sample = Date.parse(`${new Date().toISOString().slice(0, 10)}T19:00:00+05:30`);
  void sql;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Pricing</h1><div className="text-sm text-muted">Base price per hall and tier, then rules multiply it by time of day and day of week. Prices are stamped on each show when it is scheduled.</div></div>
      {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{ok}</div>}
      <form action={saveBase} className="card p-4">
        <h2 className="font-semibold">Base prices</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Hall</th>{CATEGORY_ORDER.map((c) => <th key={c} style={{ color: CATEGORIES[c].css }}>{CATEGORIES[c].name}</th>)}<th>Example: 7 pm weekday</th></tr></thead>
            <tbody>
              {screens.map((s) => { const ex = priceShow(s.layout.basePrices, rules, sample, s.id); return (
                <tr key={s.id}><td className="font-medium">{s.name}</td>{CATEGORY_ORDER.map((c) => <td key={c}>{c in s.layout.basePrices ? <input name={`${s.id}_${c}`} type="number" defaultValue={s.layout.basePrices[c]} className="input h-9 w-24 px-2 num" /> : <span className="text-muted">—</span>}</td>)}<td className="num text-muted">{CATEGORY_ORDER.filter((c) => c in ex).map((c) => `₹${ex[c]}`).join(" / ")}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2"><button className="btn btn-primary btn-sm">Save base prices</button><button formAction={reprice} className="btn btn-ghost btn-sm" title="Recomputes prices for upcoming shows that have no sales yet">Reprice unsold upcoming shows</button></div>
      </form>

      <section className="card p-4">
        <h2 className="font-semibold">Rules</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Days</th><th>Hours</th><th>Hall</th><th>Multiplier</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}><td className="font-medium">{r.name}</td><td className="capitalize">{r.dayType}</td><td className="num">{r.fromHour}:00 – {r.toHour}:00</td><td>{r.screenId ?? "All"}</td><td className="num">× {r.multiplier}</td><td>{r.active ? <span className="text-ok">active</span> : "off"}</td>
                  <td className="flex justify-end gap-1"><form action={toggleRule}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm">{r.active ? "Disable" : "Enable"}</button></form><form action={deleteRule}><input type="hidden" name="id" value={r.id} /><button className="btn btn-danger btn-sm">Delete</button></form></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addRule} className="mt-4 grid gap-2 rounded-xl border border-line bg-bg-2 p-3 text-sm sm:grid-cols-6">
          <input name="name" placeholder="Rule name" className="input h-9 sm:col-span-2" required />
          <select name="dayType" className="input h-9"><option value="any">Any day</option><option value="weekday">Weekdays</option><option value="weekend">Weekends</option></select>
          <div className="flex items-center gap-1"><input name="fromHour" type="number" min={0} max={24} defaultValue={18} className="input h-9 px-2 num" /><span className="text-muted">–</span><input name="toHour" type="number" min={0} max={24} defaultValue={23} className="input h-9 px-2 num" /></div>
          <select name="screenId" className="input h-9"><option value="">All halls</option>{screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="flex gap-1"><input name="multiplier" type="number" step="0.05" defaultValue={1.1} className="input h-9 px-2 num" /><button className="btn btn-primary btn-sm h-9">Add</button></div>
        </form>
      </section>
    </div>
  );
}
