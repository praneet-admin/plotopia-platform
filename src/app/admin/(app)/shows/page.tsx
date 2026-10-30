import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Bar } from "@/components/ui";
import { requireStaff } from "@/lib/admin";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/hall";
import { dayKey, dayStart, fmtTime, inr } from "@/lib/format";
import { showsOnDay } from "@/lib/reports";
import { cancelShow, createShow, updatePrices } from "./actions";
import { NewShowForm } from "./new-show";

export default async function ShowsAdmin({ searchParams }: { searchParams: Promise<{ day?: string; error?: string; ok?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const sp = await searchParams;
  const today = dayKey(Date.now());
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const [shows, movies, screens, rules] = await Promise.all([
    showsOnDay(day),
    db.query.movies.findMany({ where: eq(schema.movies.status, "now_showing"), orderBy: asc(schema.movies.title) }),
    db.query.screens.findMany({ orderBy: asc(schema.screens.sortOrder) }),
    db.query.pricingRules.findMany(),
  ]);
  const now = Date.now();
  const days = Array.from({ length: 9 }, (_, i) => dayKey(dayStart(today) + (i - 1) * 86_400_000));
  const byScreen = screens.map((sc) => ({ sc, list: shows.filter((s) => s.screenId === sc.id) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Shows</h1><div className="text-sm text-muted">Schedule, prices and cancellations per screen.</div></div>
        <form className="flex items-center gap-2"><input type="date" name="day" defaultValue={day} className="input h-9 w-40 text-sm" /><button className="btn btn-ghost btn-sm">Go</button></form>
      </div>
      <div className="scroll-x flex gap-1 pb-1">
        {days.map((d) => <Link key={d} href={`?day=${d}`} className={`flex-none rounded-lg border px-3 py-1.5 text-xs ${d === day ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted hover:text-text"}`}>{d === today ? "Today" : new Date(dayStart(d)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "Asia/Kolkata" })}</Link>)}
      </div>
      {sp.error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{sp.error}</div>}
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {byScreen.map(({ sc, list }) => (
            <section key={sc.id} className="card p-4">
              <div className="flex items-baseline justify-between"><h2 className="font-semibold">{sc.name}</h2><span className="text-xs text-muted">{sc.seatCount} seats · {list.filter((s) => s.status === "scheduled").length} shows</span></div>
              {list.length === 0 && <div className="mt-3 text-sm text-muted">Nothing scheduled.</div>}
              <div className="mt-3 divide-y divide-line">
                {list.map((s) => {
                  const pct = (s.sold / s.capacity) * 100;
                  const over = s.endsAt < now, cancelled = s.status === "cancelled";
                  return (
                    <div key={s.id} className={`py-3 ${over || cancelled ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="num w-20 font-semibold">{fmtTime(s.startsAt)}</div>
                        <div className="min-w-0 flex-1"><div className="font-medium">{s.movie.title} <span className="text-xs text-muted">{s.format}</span>{cancelled && <span className="pill ml-2 text-[10px] text-bad">CANCELLED</span>}</div>
                          <div className="mt-1 flex items-center gap-2"><Bar pct={pct} color={pct > 85 ? "var(--bad)" : pct > 50 ? "var(--warn)" : "var(--ok)"} /><span className="num w-20 text-right text-xs text-muted">{s.sold}/{s.capacity}</span></div></div>
                        <div className="num text-sm">{inr(s.revenue)}</div>
                        <div className="flex gap-1">
                          <Link href={`/book/${s.id}`} className="btn btn-ghost btn-sm" target="_blank">Seat map</Link>
                          {!cancelled && !over && <form action={cancelShow}><input type="hidden" name="id" value={s.id} /><button className="btn btn-danger btn-sm" title="Cancels the show and refunds every booking in full">Cancel show</button></form>}
                        </div>
                      </div>
                      {!cancelled && !over && (
                        <form action={updatePrices} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <input type="hidden" name="id" value={s.id} />
                          {CATEGORY_ORDER.filter((c) => c in s.prices).map((c) => (
                            <label key={c} className="flex items-center gap-1" style={{ color: CATEGORIES[c].css }}>{CATEGORIES[c].name}<input name={`price_${c}`} type="number" defaultValue={s.prices[c]} className="input h-7 w-20 px-2 text-xs" /></label>
                          ))}
                          <button className="btn btn-ghost btn-sm h-7">Save prices</button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <NewShowForm action={createShow} movies={movies.map((m) => ({ id: m.id, title: m.title, runtimeMin: m.runtimeMin }))} screens={screens.map((s) => ({ id: s.id, name: s.name, basePrices: s.layout.basePrices }))} rules={rules} day={day} />
      </div>
    </div>
  );
}
