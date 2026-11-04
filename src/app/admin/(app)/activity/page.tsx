import Link from "next/link";
import { recentActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/admin";
import { fmtDateTime } from "@/lib/format";

const LINK: Record<string, (id: string) => string | null> = {
  settings: (id) => `/admin/settings/${id}`,
  movie: (id) => `/admin/movies/${id}`,
  hall: (id) => `/admin/halls/${id}`,
  booking: (id) => `/admin/bookings?q=${id}`,
  customer: (id) => `/admin/customers?q=${id}`,
  show: () => `/admin/shows`,
  cinema: () => `/admin/settings/cinema`,
  pricing: () => `/admin/pricing`,
  staff: () => `/admin/staff`,
};

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "string" ? v : JSON.stringify(v));

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const { entity } = await searchParams;
  const all = await recentActivity(300);
  const list = entity ? all.filter((a) => a.entity === entity) : all;
  const kinds = [...new Set(all.map((a) => a.entity))].sort();
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Activity</h1><div className="text-sm text-muted">Who changed what in the back office, newest first.</div></div>
      <div className="scroll-x flex gap-1">
        <Link href="/admin/activity" className={`chip ${!entity ? "on" : ""}`}>All</Link>
        {kinds.map((k) => <Link key={k} href={`/admin/activity?entity=${k}`} className={`chip capitalize ${entity === k ? "on" : ""}`}>{k}</Link>)}
      </div>
      <div className="space-y-2">
        {list.map((a) => {
          const href = a.entityId ? LINK[a.entity]?.(a.entityId) : null;
          return (
            <div key={a.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span><span className="font-medium text-text">{a.staffName}</span> · <span className="pill capitalize">{a.action}</span> <span className="capitalize">{a.entity}</span>{a.entityId && <> · {href ? <Link href={href} className="font-mono text-brand hover:underline">{a.entityId}</Link> : <span className="font-mono">{a.entityId}</span>}</>}</span>
                <span>{fmtDateTime(a.createdAt)}</span>
              </div>
              <div className="mt-1.5">{a.summary}</div>
              {a.diff && (
                <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted">{Object.keys(a.diff).length} field{Object.keys(a.diff).length === 1 ? "" : "s"}</summary>
                  <table className="mt-2 w-full"><tbody>{Object.entries(a.diff).map(([k, [b, n]]) => <tr key={k} className="align-top"><td className="w-36 py-1 pr-3 font-mono text-muted">{k}</td><td className="py-1 pr-3 text-red-200/80 line-through">{fmt(b)}</td><td className="py-1 text-green-100">{fmt(n)}</td></tr>)}</tbody></table>
                </details>
              )}
            </div>
          );
        })}
        {list.length === 0 && <div className="card p-8 text-center text-muted">Nothing logged yet.</div>}
      </div>
    </div>
  );
}
