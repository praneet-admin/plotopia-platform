import Link from "next/link";

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
      {action && (
        <Link href={action.href} className="btn btn-primary mt-5">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const col = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${col}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Bar({ pct, color = "var(--brand)" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-2">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

export function fillTone(pct: number) {
  if (pct >= 100) return { label: "Sold out", cls: "text-muted" };
  if (pct >= 85) return { label: "Almost full", cls: "text-bad" };
  if (pct >= 50) return { label: "Fast filling", cls: "text-warn" };
  return { label: "Available", cls: "text-ok" };
}
