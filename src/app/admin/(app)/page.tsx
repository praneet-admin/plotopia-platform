import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Bar, Stat } from "@/components/ui";
import { dayKey, dayStart, fmtTime, inr } from "@/lib/format";
import { requireStaff } from "@/lib/admin";
import { dailyCollections, showsOnDay } from "@/lib/reports";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const { denied } = await searchParams;
  const now = Date.now();
  const today = dayKey(now);
  const weekAgo = dayKey(dayStart(today) - 6 * 86_400_000);
  const [shows, week, recent] = await Promise.all([
    showsOnDay(today),
    dailyCollections(weekAgo, today),
    db.query.bookings.findMany({ orderBy: desc(schema.bookings.createdAt), limit: 8, with: { show: { with: { movie: true } }, customer: true } }),
  ]);
  const todayRow = week[week.length - 1];
  const cap = shows.reduce((a, s) => a + s.capacity, 0), sold = shows.reduce((a, s) => a + s.sold, 0);
  const max = Math.max(1, ...week.map((d) => d.net));
  const next = shows.filter((s) => s.endsAt > now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Today</h1><div className="text-sm text-muted">{new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</div></div>
        <Link href="/admin/counter" className="btn btn-primary btn-sm">New counter sale</Link>
      </div>
      {denied && <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">You don&apos;t have access to that page.</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collections today" value={inr(todayRow?.net ?? 0)} sub={`${inr(todayRow?.online ?? 0)} online · ${inr(todayRow?.counter ?? 0)} counter`} />
        <Stat label="Tickets sold today" value={String(todayRow?.tickets ?? 0)} sub={`${todayRow?.bookings ?? 0} bookings`} />
        <Stat label="Occupancy today" value={`${cap ? Math.round((sold / cap) * 100) : 0}%`} sub={`${sold} of ${cap} seats across ${shows.length} shows`} tone={cap && sold / cap > 0.6 ? "ok" : undefined} />
        <Stat label="Refunds today" value={inr(todayRow?.refunds ?? 0)} tone={todayRow?.refunds ? "warn" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card p-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Today&apos;s shows</h2><Link href="/admin/shows" className="text-xs text-muted hover:text-text">Schedule →</Link></div>
          <div className="mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Film</th><th>Screen</th><th className="w-48">Sold</th><th className="text-right">Revenue</th><th className="text-right">In</th></tr></thead>
              <tbody>
                {shows.map((s) => {
                  const pct = (s.sold / s.capacity) * 100;
                  const live = s.startsAt <= now && s.endsAt > now;
                  return (
                    <tr key={s.id} className={s.endsAt < now ? "opacity-50" : ""}>
                      <td className="num font-semibold">{fmtTime(s.startsAt)} {live && <span className="pill ml-1 text-[10px] text-ok">LIVE</span>}{s.status === "cancelled" && <span className="pill ml-1 text-[10px] text-bad">CANCELLED</span>}</td>
                      <td>{s.movie.title}</td>
                      <td className="text-muted">{s.screen.name.split(" ·")[0]}</td>
                      <td><div className="flex items-center gap-2"><Bar pct={pct} color={pct > 85 ? "var(--bad)" : pct > 50 ? "var(--warn)" : "var(--ok)"} /><span className="num w-16 text-right text-xs text-muted">{s.sold}/{s.capacity}</span></div></td>
                      <td className="num text-right">{inr(s.revenue)}</td>
                      <td className="num text-right text-muted">{s.checkedIn}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Last 7 days</h2>
          <div className="mt-4 flex h-32 items-end gap-2">
            {week.map((d) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${inr(d.net)}`}>
                <div className="w-full rounded-t-md bg-gradient-to-t from-brand/60 to-brand" style={{ height: `${(d.net / max) * 100}%`, minHeight: 2 }} />
                <span className="text-[10px] text-muted">{new Date(dayStart(d.day)).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "Asia/Kolkata" })}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted"><span>Week net</span><span className="num text-text">{inr(week.reduce((a, d) => a + d.net, 0))}</span></div>
          <h2 className="mt-6 font-semibold">Up next</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {next.slice(0, 4).map((s) => <li key={s.id} className="flex justify-between"><span>{fmtTime(s.startsAt)} · {s.movie.title}</span><span className="text-muted">{s.capacity - s.sold} left</span></li>)}
            {next.length === 0 && <li className="text-muted">No more shows today.</li>}
          </ul>
        </section>
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Recent bookings</h2><Link href="/admin/bookings" className="text-xs text-muted hover:text-text">All bookings →</Link></div>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Booking</th><th>Customer</th><th>Film</th><th>Seats</th><th>Channel</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}><td><Link href={`/tickets/${b.id}`} className="font-mono text-brand hover:underline">{b.id}</Link></td><td>{b.customer?.name ?? "—"}</td><td>{b.show.movie.title}</td><td>{b.seatLabels.join(", ")}</td><td className="capitalize text-muted">{b.channel}</td><td><span className={b.status === "confirmed" ? "text-ok" : "text-muted"}>{b.status}</span></td><td className="num text-right">{inr(b.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
