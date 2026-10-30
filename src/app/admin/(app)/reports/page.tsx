import { requireStaff } from "@/lib/admin";
import { Bar } from "@/components/ui";
import { dayKey, dayStart, fmtTime, inr } from "@/lib/format";
import { dailyCollections, movieTotals, showsOnDay } from "@/lib/reports";

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; day?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const sp = await searchParams;
  const today = dayKey(Date.now());
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const to = ok(sp.to) ?? today, from = ok(sp.from) ?? dayKey(dayStart(to) - 6 * 86_400_000), day = ok(sp.day) ?? today;
  const [days, movies, shows] = await Promise.all([dailyCollections(from, to), movieTotals(from, to), showsOnDay(day)]);
  const tot = days.reduce((a, d) => ({ bookings: a.bookings + d.bookings, tickets: a.tickets + d.tickets, gross: a.gross + d.gross, refunds: a.refunds + d.refunds, online: a.online + d.online, counter: a.counter + d.counter, net: a.net + d.net }), { bookings: 0, tickets: 0, gross: 0, refunds: 0, online: 0, counter: 0, net: 0 });
  const q = `from=${from}&to=${to}&day=${day}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Reports</h1><div className="text-sm text-muted">Collections by day, totals by film, and occupancy by show.</div></div>
        <form className="flex flex-wrap items-center gap-2 text-sm"><input type="date" name="from" defaultValue={from} className="input h-9 w-40" /><span className="text-muted">to</span><input type="date" name="to" defaultValue={to} className="input h-9 w-40" /><input type="hidden" name="day" value={day} /><button className="btn btn-ghost btn-sm">Apply</button><a className="btn btn-ghost btn-sm" href={`/admin/reports/export?${q}`}>Export CSV</a></form></div>

      <section className="card p-4">
        <h2 className="font-semibold">Daily collections · {from} → {to}</h2>
        <div className="mt-3 overflow-x-auto"><table className="table">
          <thead><tr><th>Day</th><th className="text-right">Bookings</th><th className="text-right">Tickets</th><th className="text-right">Online</th><th className="text-right">Counter</th><th className="text-right">Gross</th><th className="text-right">Refunds</th><th className="text-right">Net</th></tr></thead>
          <tbody>
            {days.map((d) => <tr key={d.day}><td>{new Date(dayStart(d.day)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</td><td className="num text-right">{d.bookings}</td><td className="num text-right">{d.tickets}</td><td className="num text-right">{inr(d.online)}</td><td className="num text-right">{inr(d.counter)}</td><td className="num text-right">{inr(d.gross)}</td><td className="num text-right text-muted">{inr(d.refunds)}</td><td className="num text-right font-semibold">{inr(d.net)}</td></tr>)}
            <tr className="font-bold"><td>Total</td><td className="num text-right">{tot.bookings}</td><td className="num text-right">{tot.tickets}</td><td className="num text-right">{inr(tot.online)}</td><td className="num text-right">{inr(tot.counter)}</td><td className="num text-right">{inr(tot.gross)}</td><td className="num text-right">{inr(tot.refunds)}</td><td className="num text-right">{inr(tot.net)}</td></tr>
          </tbody></table></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">By film · shows in range</h2>
          <table className="table mt-3"><thead><tr><th>Film</th><th className="text-right">Shows</th><th className="text-right">Tickets</th><th className="text-right">Ticket revenue</th></tr></thead>
            <tbody>{movies.map((m) => <tr key={m.movieId}><td>{m.title}</td><td className="num text-right">{m.shows}</td><td className="num text-right">{m.sold}</td><td className="num text-right">{inr(m.revenue)}</td></tr>)}</tbody></table>
        </section>
        <section className="card p-4">
          <form className="flex items-center justify-between gap-2"><h2 className="font-semibold">Occupancy by show</h2><div className="flex gap-1"><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /><input type="date" name="day" defaultValue={day} className="input h-8 w-36 text-xs" /><button className="btn btn-ghost btn-sm h-8">Go</button></div></form>
          <ul className="mt-3 space-y-2 text-sm">
            {shows.map((s) => { const pct = Math.round((s.sold / s.capacity) * 100); return <li key={s.id}><div className="flex justify-between"><span>{fmtTime(s.startsAt)} · {s.movie.title} <span className="text-muted">{s.screen.name.split(" ·")[0]}</span></span><span className="num text-muted">{s.sold}/{s.capacity} · {pct}% · {s.checkedIn} in</span></div><Bar pct={pct} color={pct > 85 ? "var(--bad)" : pct > 50 ? "var(--warn)" : "var(--ok)"} /></li>; })}
            {shows.length === 0 && <li className="text-muted">No shows that day.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
