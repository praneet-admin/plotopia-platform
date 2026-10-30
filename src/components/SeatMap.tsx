"use client";
import { useMemo } from "react";
import type { HallLayout } from "@/db/schema";
import { CATEGORIES } from "@/lib/hall";

export type SeatLite = { label: string; row: string; rowIndex: number; num: number; category: string; aisleAfter: boolean };

export function SeatMap({ layout, seats, sold, held, selected, prices, onToggle, compact }: { layout: HallLayout; seats: SeatLite[]; sold: Set<string>; held: Set<string>; selected: Set<string>; prices: Record<string, number>; onToggle?: (label: string) => void; compact?: boolean }) {
  const rows = useMemo(() => {
    const m = new Map<string, SeatLite[]>();
    for (const s of seats) m.set(s.row, [...(m.get(s.row) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[1][0].rowIndex - b[1][0].rowIndex);
  }, [seats]);
  const maxPerRow = Math.max(...rows.map(([, r]) => r.length));
  const seatPx = compact ? 22 : 26;
  const gap = 5;
  const minW = maxPerRow * (seatPx + gap) + 60 + 40;

  let lastCat = "";
  return (
    <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0" style={{ ["--seat" as string]: `${seatPx}px` }}>
      <div className="mx-auto" style={{ minWidth: minW, width: "fit-content" }}>
        <div className="mb-6 px-10">
          <div className="screen-glow" />
          <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[.3em] text-muted">Screen this way</div>
        </div>
        <div className="flex flex-col gap-[5px]">
          {rows.map(([row, list]) => {
            const cat = list[0].category;
            const header = cat !== lastCat;
            lastCat = cat;
            const css = CATEGORIES[cat]?.css ?? "#fff";
            return (
              <div key={row}>
                {header && (
                  <div className="mb-1.5 mt-3 flex items-center gap-2 text-[11px] font-semibold" style={{ color: css }}>
                    <span className="h-px flex-1 opacity-30" style={{ background: css }} />
                    {CATEGORIES[cat]?.name ?? cat} · ₹{prices[cat] ?? "-"}
                    <span className="h-px flex-1 opacity-30" style={{ background: css }} />
                  </div>
                )}
                <div className="flex items-center justify-center" style={{ gap }}>
                  <span className="w-5 text-right text-[11px] text-muted">{row}</span>
                  <div className="flex items-center" style={{ gap }}>
                    {list.map((s) => {
                      const isSold = sold.has(s.label), isHeld = held.has(s.label), isMine = selected.has(s.label);
                      const cls = ["seat", cat === "recliner" ? "recl" : "", isSold ? "sold" : isHeld ? "held" : "", isMine ? "mine" : ""].join(" ");
                      return (
                        <span key={s.label} className="flex items-center" style={{ gap }}>
                          <button type="button" className={cls} style={{ ["--c" as string]: css }} disabled={isSold || isHeld || !onToggle} onClick={() => onToggle?.(s.label)} aria-label={`Seat ${s.label}${isSold ? ", sold" : isHeld ? ", held by another customer" : ""}`} aria-pressed={isMine} title={s.label}>
                            {s.num}
                          </button>
                          {s.aisleAfter && <span style={{ width: seatPx * 0.9 }} />}
                        </span>
                      );
                    })}
                  </div>
                  <span className="w-5 text-[11px] text-muted">{row}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted">
          <Legend cls="" label="Available" />
          <Legend cls="mine" label="Selected" />
          <Legend cls="held" label="Being booked" />
          <Legend cls="sold" label="Sold" />
        </div>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`seat ${cls} pointer-events-none`} style={{ ["--seat" as string]: "14px", ["--c" as string]: "#9fb3c8" }} />
      {label}
    </span>
  );
}
