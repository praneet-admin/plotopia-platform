"use client";
import { useMemo, useState } from "react";
import type { PricingRule } from "@/db/schema";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/hall";
import { priceShow } from "@/lib/pricing";

export function NewShowForm({ action, movies, screens, rules, day }: { action: (fd: FormData) => Promise<void>; movies: { id: string; title: string; runtimeMin: number }[]; screens: { id: string; name: string; basePrices: Record<string, number> }[]; rules: PricingRule[]; day: string }) {
  const [screenId, setScreenId] = useState(screens[0]?.id ?? "");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("18:30");
  const [bulk, setBulk] = useState(false);
  const screen = screens.find((s) => s.id === screenId);
  const auto = useMemo(() => {
    if (!screen || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return {};
    return priceShow(screen.basePrices, rules, Date.parse(`${date}T${time}:00+05:30`), screenId);
  }, [screen, date, time, rules, screenId]);
  return (
    <form action={action} className="card h-fit p-4">
      <h2 className="font-semibold">Add a show</h2>
      <div className="mt-3 space-y-3 text-sm">
        <div><label className="label">Film</label><select name="movieId" className="input">{movies.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.runtimeMin} min)</option>)}</select></div>
        <div><label className="label">Screen</label><select name="screenId" className="input" value={screenId} onChange={(e) => setScreenId(e.target.value)}>{screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">{bulk ? "From" : "Date"}</label><input type="date" name="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {bulk ? <div><label className="label">Until</label><input type="date" name="until" className="input" defaultValue={date} /></div>
            : <div><label className="label">Start</label><input type="time" name="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
        </div>
        {bulk && (
          <>
            <div><label className="label">Times (HH:MM, comma separated)</label><input name="times" className="input font-mono" defaultValue="10:30, 14:00, 18:30, 21:45" /></div>
            <div><div className="label">Only on</div><div className="flex flex-wrap gap-1">{["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => <label key={d} className="flex items-center gap-1 rounded-md border border-line bg-bg-2 px-2 py-1 text-xs capitalize"><input type="checkbox" name={`wd_${d}`} className="accent-[var(--brand)]" />{d}</label>)}</div><p className="mt-1 text-[11px] text-muted">None ticked = every day. Slots that clash or are in the past are skipped.</p></div>
          </>
        )}
        <button type="button" onClick={() => setBulk((b) => !b)} className="text-xs text-brand hover:underline">{bulk ? "Schedule a single show instead" : "Schedule a run of shows (date range, several times)"}</button>
        <div><label className="label">Format</label><select name="format" className="input"><option>2D</option><option>3D</option><option>IMAX 2D</option><option>IMAX 3D</option><option>4DX</option></select></div>
        {!bulk && <div>
          <label className="label">Prices <span className="font-normal normal-case">(auto from rules, edit to override)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_ORDER.filter((c) => c in auto).map((c) => (
              <div key={c}><div className="mb-1 text-[11px]" style={{ color: CATEGORIES[c].css }}>{CATEGORIES[c].name}</div><input key={`${c}-${auto[c]}`} name={`price_${c}`} type="number" defaultValue={auto[c]} className="input h-9 px-2" /></div>
            ))}
          </div>
        </div>}
        <button className="btn btn-primary w-full">{bulk ? "Schedule all" : "Schedule"}</button>
      </div>
    </form>
  );
}
