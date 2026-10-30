"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HallLayout } from "@/db/schema";
import { SeatMap, type SeatLite } from "./SeatMap";
import { CATEGORIES, simulatorLink } from "@/lib/hall";
import { inr } from "@/lib/format";

type Status = { sold: string[]; held: string[]; mine: string[]; myExpiresAt: number | null };

export function SeatPicker({ showId, hallId, layout, seats, prices, initial, maxSeats, mode = "online", onProceed }: { showId: string; hallId: string; layout: HallLayout; seats: SeatLite[]; prices: Record<string, number>; initial: Status; maxSeats: number; mode?: "online" | "counter"; onProceed?: (labels: string[]) => Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.mine));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catOf = useMemo(() => new Map(seats.map((s) => [s.label, s.category])), [seats]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/shows/${showId}/seats`, { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, [showId]);
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    const vis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [refresh]);

  // If someone else grabbed a seat I had selected (but not yet held), drop it.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((l) => !status.sold.includes(l) && !status.held.includes(l)));
      return next.size === prev.size ? prev : next;
    });
  }, [status]);

  const toggle = (label: string) => {
    setError(null);
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else if (n.size >= maxSeats) { setError(`You can book up to ${maxSeats} seats at a time.`); return prev; }
      else n.add(label);
      return n;
    });
  };

  const labels = useMemo(() => [...selected].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [selected]);
  const subtotal = labels.reduce((s, l) => s + (prices[catOf.get(l) ?? ""] ?? 0), 0);
  const fee = mode === "online" ? 30 * labels.length : 0;

  const proceed = async () => {
    setBusy(true); setError(null);
    try {
      if (onProceed) { await onProceed(labels); return; }
      const r = await fetch(`/api/shows/${showId}/hold`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seats: labels }) });
      const j = await r.json();
      if (!r.ok) {
        setError(j.seats?.length ? `${j.seats.join(", ")} just got taken. Pick other seats.` : j.error ?? "Could not hold seats");
        await refresh();
        return;
      }
      router.push(`/checkout/${showId}`);
    } finally { setBusy(false); }
  };

  const sheet = useRef<HTMLDivElement>(null);
  return (
    <div className="pb-40">
      <SeatMap layout={layout} seats={seats} sold={new Set(status.sold)} held={new Set(status.held)} selected={selected} prices={prices} onToggle={toggle} />

      <div ref={sheet} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="container-x py-3">
          {labels.length > 0 && (
            <div className="scroll-x mb-2 flex gap-2 pb-1">
              {labels.map((l) => {
                const c = catOf.get(l) ?? "prime";
                return (
                  <a key={l} href={simulatorLink(hallId, l)} target="_blank" rel="noreferrer" className="flex flex-none items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 text-sm hover:border-brand" title={`Open the 3D view from seat ${l}`}>
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[c]?.css }} />
                    <span className="font-semibold">{l}</span>
                    <span className="text-xs text-muted">{inr(prices[c] ?? 0)}</span>
                    <span className="flex items-center gap-1 text-xs text-brand"><EyeIcon /> View</span>
                  </a>
                );
              })}
            </div>
          )}
          {error && <div className="mb-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {labels.length === 0 ? (
                <div className="text-sm text-muted">Tap seats to select. Tap <span className="text-brand">View</span> to see the screen from that seat.</div>
              ) : (
                <>
                  <div className="num text-lg font-bold">{inr(subtotal + fee)}</div>
                  <div className="truncate text-xs text-muted">{labels.length} seat{labels.length > 1 ? "s" : ""}{fee ? ` · incl. ${inr(fee)} convenience fee` : ""}</div>
                </>
              )}
            </div>
            <div className="flex flex-none items-center gap-2">
              <a href={simulatorLink(hallId, labels[0] ?? "G7", labels.length ? "seat" : "overview")} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm hidden sm:inline-flex"><EyeIcon /> 3D hall</a>
              <button className="btn btn-primary" disabled={labels.length === 0 || busy} onClick={proceed}>{busy ? "Holding…" : mode === "counter" ? "Book at counter" : "Proceed"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EyeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}
