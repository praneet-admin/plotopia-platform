import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Poster } from "@/components/Poster";
import { requireStaff } from "@/lib/admin";
import { runtime } from "@/lib/format";

export default async function MoviesAdmin() {
  await requireStaff(["admin", "manager"]);
  const movies = await db.query.movies.findMany({ orderBy: asc(schema.movies.title) });
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">Movies</h1><div className="text-sm text-muted">{movies.length} titles</div></div><Link href="/admin/movies/new" className="btn btn-primary btn-sm">Add movie</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {movies.map((m) => (
          <Link key={m.id} href={`/admin/movies/${m.id}`} className="card flex gap-4 p-3 hover:border-brand/60">
            <Poster movie={m} className="w-16 flex-none" size="sm" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">{m.title}</div>
              <div className="text-xs text-muted">{m.language} · {m.certificate} · {runtime(m.runtimeMin)}</div>
              <div className="mt-1 text-xs text-muted">{m.genre}</div>
              <span className={`pill mt-2 text-[10px] ${m.status === "now_showing" ? "text-ok" : ""}`}>{m.status.replace("_", " ")}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
