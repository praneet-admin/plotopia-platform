import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { CATEGORIES } from "@/lib/hall";

export default async function HallsAdmin() {
  await requireStaff(["admin", "manager"]);
  const screens = await db.query.screens.findMany({ orderBy: asc(schema.screens.sortOrder) });
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">Halls</h1><div className="text-sm text-muted">Layouts use the same JSON as the seat simulator, so a hall built here opens in 3D.</div></div><Link href="/admin/halls/new" className="btn btn-primary btn-sm">New hall</Link></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {screens.map((s) => (
          <Link key={s.id} href={`/admin/halls/${s.id}`} className="card p-4 hover:border-brand/60">
            <div className="flex items-baseline justify-between"><div className="font-semibold">{s.name}</div><span className="font-mono text-xs text-muted">{s.id}</span></div>
            <div className="mt-1 text-xs text-muted">{s.seatCount} seats · {s.layout.rows.length} rows · screen {s.layout.screenW} m · riser {s.layout.riser} m</div>
            <div className="mt-3 flex gap-1">{s.layout.bands.map(([rows, cat]) => <span key={cat + rows} className="pill text-[10px]" style={{ color: CATEGORIES[cat]?.css }}>{CATEGORIES[cat]?.name} {rows} · ₹{s.layout.basePrices[cat]}</span>)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
