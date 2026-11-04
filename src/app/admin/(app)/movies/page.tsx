import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Poster } from "@/components/Poster";
import { requireStaff } from "@/lib/admin";
import { runtime } from "@/lib/format";

const LABEL: Record<string, string> = { now_showing: "Now showing", coming_soon: "Coming soon", hidden: "Hidden", archived: "Hidden" };

export default async function MoviesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; deleted?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const sp = await searchParams;
  const all = await db.query.movies.findMany({ orderBy: asc(schema.movies.title) });
  const live = all.filter((m) => !m.deletedAt), gone = all.filter((m) => m.deletedAt);
  const list = sp.deleted ? gone : live;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-2xl font-bold">Movies</h1><div className="text-sm text-muted">{live.length} titles{gone.length > 0 && <> · <Link href={sp.deleted ? "/admin/movies" : "/admin/movies?deleted=1"} className="text-brand hover:underline">{sp.deleted ? "back to current" : `${gone.length} deleted`}</Link></>}</div></div><Link href="/admin/movies/new" className="btn btn-primary btn-sm">Add movie</Link></div>
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => (
          <Link key={m.id} href={`/admin/movies/${m.id}`} className={`card flex gap-4 p-3 hover:border-brand/60 ${m.deletedAt ? "opacity-60" : ""}`}>
            <Poster movie={m} className="w-16 flex-none" size="sm" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">{m.title}</div>
              <div className="text-xs text-muted">{m.language} · {m.certificate} · {runtime(m.runtimeMin)}</div>
              <div className="mt-1 text-xs text-muted">{m.genre}{m.formats.length > 0 && <> · {m.formats.join(", ")}</>}</div>
              <span className={`pill mt-2 text-[10px] ${m.status === "now_showing" ? "text-ok" : m.status === "coming_soon" ? "text-warn" : ""}`}>{LABEL[m.status] ?? m.status}</span>
            </div>
          </Link>
        ))}
        {list.length === 0 && <div className="card p-8 text-center text-muted sm:col-span-2 xl:col-span-3">Nothing here.</div>}
      </div>
    </div>
  );
}
