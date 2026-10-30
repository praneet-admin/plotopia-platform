"use client";
import { useMemo, useState, useTransition } from "react";
import type { HallLayout } from "@/db/schema";
import { SeatMap } from "@/components/SeatMap";
import { CATEGORIES, CATEGORY_ORDER, SIMULATOR_URL, layoutSeats, toSimulatorJson, validateLayout } from "@/lib/hall";

const NUM_FIELDS: [keyof HallLayout, string, number][] = [["screenW", "Screen width", 0.5], ["screenBottom", "Screen bottom height", 0.1], ["aspect", "Screen aspect", 0.01], ["firstRowZ", "First row distance", 0.5], ["rowPitch", "Row pitch", 0.05], ["riser", "Riser per row", 0.02], ["flatRows", "Flat rows at front", 1], ["hallW", "Hall width", 0.5], ["hallH", "Hall height", 0.5], ["aisle", "Centre aisle", 0.1], ["perSide", "Seats per side", 1]];

export function HallEditor({ initial, isNew, save }: { initial: HallLayout; isNew: boolean; save: (json: string) => Promise<{ error: string } | void> }) {
  const [h, setH] = useState<HallLayout>(initial);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const errs = useMemo(() => validateLayout(h), [h]);
  const seats = useMemo(() => (errs.length ? [] : layoutSeats(h)), [h, errs]);
  const set = <K extends keyof HallLayout>(k: K, v: HallLayout[K]) => setH((p) => ({ ...p, [k]: v }));
  const json = useMemo(() => JSON.stringify(toSimulatorJson(h), null, 2), [h]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const s of seats) c[s.cat] = (c[s.cat] ?? 0) + 1; return c; }, [seats]);

  const doSave = () => start(async () => { setError(null); const r = await save(JSON.stringify(h)); if (r?.error) setError(r.error); });
  const copy = async () => { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = `${h.id || "hall"}.json`; a.click(); };

  return (
    <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
      <div className="space-y-4">
        <div className="card space-y-3 p-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Hall id</label><input className="input font-mono" value={h.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.toLowerCase())} placeholder="audi4" /></div>
            <div><label className="label">Venue</label><input className="input" value={h.venue} onChange={(e) => set("venue", e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Name</label><input className="input" value={h.name} onChange={(e) => set("name", e.target.value)} placeholder="Audi 4 · Standard" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NUM_FIELDS.map(([k, label, step]) => (
              <div key={k}><label className="label">{label}</label><input type="number" step={step} className="input h-9 px-2 num" value={Number((h[k] as number).toFixed(3))} onChange={(e) => set(k, Number(e.target.value) as never)} /></div>
            ))}
          </div>
          <div><label className="label">Rows (front → back)</label><input className="input font-mono uppercase" value={h.rows} onChange={(e) => set("rows", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></div>
          <div>
            <label className="label">Bands and base prices</label>
            <div className="space-y-2">
              {h.bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input h-9 w-28 px-2 font-mono uppercase" value={b[0]} onChange={(e) => set("bands", h.bands.map((x, j): [string, string] => (j === i ? [e.target.value.toUpperCase().replace(/[^A-Z]/g, ""), x[1]] : x)))} />
                  <select className="input h-9 flex-1 px-2" value={b[1]} onChange={(e) => set("bands", h.bands.map((x, j): [string, string] => (j === i ? [x[0], e.target.value] : x)))}>{CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].name}</option>)}</select>
                  <span className="text-muted">₹</span><input type="number" className="input h-9 w-20 px-2 num" value={h.basePrices[b[1]] ?? 0} onChange={(e) => set("basePrices", { ...h.basePrices, [b[1]]: Number(e.target.value) })} />
                  <button type="button" className="btn btn-ghost btn-sm h-9 px-2" onClick={() => set("bands", h.bands.filter((_, j) => j !== i))} aria-label="Remove band">×</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("bands", [...h.bands, ["", "prime"]])}>+ Add band</button>
            </div>
          </div>
          {errs.length > 0 && <ul className="list-disc rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 pl-6 text-xs">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
          {error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-red-200">{error}</div>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn btn-primary" disabled={errs.length > 0 || pending} onClick={doSave}>{pending ? "Saving…" : isNew ? "Create hall" : "Save hall"}</button>
            <button type="button" className="btn btn-ghost" onClick={copy}>{copied ? "Copied!" : "Copy simulator JSON"}</button>
            <button type="button" className="btn btn-ghost" onClick={download}>Download .json</button>
          </div>
        </div>
        <details className="card p-4 text-xs">
          <summary className="cursor-pointer font-semibold">Simulator JSON</summary>
          <p className="mt-2 text-muted">Paste this object into <span className="font-mono">src/halls.js</span> of the simulator as <span className="font-mono">HALLS.{h.id || "id"}</span> (add an <span className="font-mono">occupancy</span> function if you want a demo sold pattern) and it will render in 3D at <a className="underline" href={SIMULATOR_URL} target="_blank" rel="noreferrer">{SIMULATOR_URL}</a>.</p>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-bg-2 p-3 font-mono">{json}</pre>
        </details>
      </div>
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Live preview · {seats.length} seats</h2>
          <div className="flex gap-2 text-xs">{CATEGORY_ORDER.filter((c) => counts[c]).map((c) => <span key={c} style={{ color: CATEGORIES[c].css }}>{CATEGORIES[c].name} {counts[c]}</span>)}</div>
        </div>
        <div className="mt-4">
          {seats.length ? <SeatMap layout={h} seats={seats.map((s) => ({ label: s.id, row: s.row, rowIndex: s.r, num: s.num, category: s.cat, aisleAfter: s.aisleAfter }))} sold={new Set()} held={new Set()} selected={new Set()} prices={h.basePrices} compact /> : <div className="py-10 text-center text-sm text-muted">Fix the errors to preview.</div>}
        </div>
      </div>
    </div>
  );
}
