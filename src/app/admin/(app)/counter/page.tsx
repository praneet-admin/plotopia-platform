import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { dayKey, dayStart, fmtTime } from "@/lib/format";
import { showsOnDay } from "@/lib/reports";

export default async function Counter({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const { day: d } = await searchParams;
  const today = dayKey(Date.now());
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const shows = (await showsOnDay(day)).filter((s) => s.status === "scheduled" && s.startsAt > Date.now() - 20 * 60_000);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Counter sale</h1><div className="text-sm text-muted">Pick a show, then seats. No convenience fee at the counter.</div></div>
        <div className="flex gap-1">{[0, 1, 2].map((i) => { const k = dayKey(dayStart(today) + i * 86_400_000); return <Link key={k} href={`?day=${k}`} className={`rounded-lg border px-3 py-1.5 text-xs ${k === day ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted"}`}>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(dayStart(k)).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</Link>; })}</div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shows.map((s) => (
          <Link key={s.id} href={`/admin/counter/${s.id}`} className="card p-4 hover:border-brand/60">
            <div className="flex items-baseline justify-between"><div className="num text-lg font-bold">{fmtTime(s.startsAt)}</div><span className="text-xs text-muted">{s.screen.name.split(" ·")[0]}</span></div>
            <div className="mt-1 font-medium">{s.movie.title}</div>
            <div className="mt-1 text-xs text-muted">{s.capacity - s.sold} seats left · {s.format}</div>
          </Link>
        ))}
        {shows.length === 0 && <div className="card p-8 text-center text-sm text-muted sm:col-span-2 xl:col-span-3">No open shows on this day.</div>}
      </div>
    </div>
  );
}
