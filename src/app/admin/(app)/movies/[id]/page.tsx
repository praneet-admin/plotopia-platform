import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { Poster } from "@/components/Poster";
import { requireStaff } from "@/lib/admin";
import { diffOf, logActivity } from "@/lib/activity";
import { imageField } from "@/lib/upload";

const FORMATS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "Dolby Atmos"];

export default async function MovieEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const m = isNew ? null : await db.query.movies.findFirst({ where: eq(schema.movies.id, id) });
  if (!isNew && !m) notFound();
  const [{ n: upcoming }] = m ? await db.select({ n: count() }).from(schema.shows).where(and(eq(schema.shows.movieId, m.id), eq(schema.shows.status, "scheduled"), isNull(schema.shows.deletedAt), gt(schema.shows.startsAt, Date.now()))) : [{ n: 0 }];

  async function save(fd: FormData) {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const title = g("title");
    const slug = (g("slug") || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const back = (msg: string): never => redirect(`/admin/movies/${id}?error=${encodeURIComponent(msg)}`);
    if (!title || !slug) back("Title is required.");
    let posterUrl: string | null = null;
    try { posterUrl = await imageField(fd, "posterUrl", m?.posterUrl); } catch (e) { back((e as Error).message); }
    const row = {
      slug, title, language: g("language") || "Tamil", certificate: g("certificate") || "U/A", runtimeMin: Math.max(30, Number(g("runtimeMin")) || 120), genre: g("genre").split(/[,·]/).map((s) => s.trim()).filter(Boolean).join(" · "), synopsis: g("synopsis"),
      cast: g("cast").split(",").map((s) => s.trim()).filter(Boolean), director: g("director"), releaseDate: g("releaseDate") || new Date().toISOString().slice(0, 10), accent: g("accent") || "#2f7d5a", accent2: g("accent2") || "#f2c14e",
      rating: Math.max(0, Math.min(10, Number(g("rating")) || 0)), status: ["now_showing", "coming_soon", "hidden"].includes(g("status")) ? g("status") : "now_showing",
      posterUrl, trailerUrl: g("trailerUrl") || null, formats: FORMATS.filter((f) => fd.get(`fmt_${f}`) === "on"),
    };
    const clash = await db.query.movies.findFirst({ where: eq(schema.movies.slug, slug) });
    if (clash && clash.id !== id) back(`Another film already uses the slug "${slug}".`);
    const strip = (r: Record<string, unknown>) => ({ ...r, posterUrl: typeof r.posterUrl === "string" && r.posterUrl.startsWith("data:") ? "(uploaded image)" : r.posterUrl });
    if (isNew) {
      const newId = slug;
      if (await db.query.movies.findFirst({ where: eq(schema.movies.id, newId) })) back("A film with that id exists (maybe deleted). Pick another slug.");
      await db.insert(schema.movies).values({ id: newId, ...row });
      await logActivity(me, "create", "movie", newId, `Film “${title}” added`);
      redirect(`/admin/movies/${newId}?ok=Added`);
    }
    await db.update(schema.movies).set(row).where(eq(schema.movies.id, id));
    const d = diffOf(strip(m as unknown as Record<string, unknown>), strip({ ...m, ...row } as Record<string, unknown>));
    if (d) await logActivity(me, "update", "movie", id, `Film “${title}” updated: ${Object.keys(d).join(", ")}`, d);
    redirect(`/admin/movies/${id}?ok=Saved`);
  }
  async function remove() {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    const [{ n }] = await db.select({ n: count() }).from(schema.shows).where(and(eq(schema.shows.movieId, id), eq(schema.shows.status, "scheduled"), isNull(schema.shows.deletedAt), gt(schema.shows.startsAt, Date.now())));
    if (n > 0) redirect(`/admin/movies/${id}?error=${encodeURIComponent(`${n} upcoming show(s) are scheduled for this film. Cancel them first.`)}`);
    await db.update(schema.movies).set({ deletedAt: Date.now() }).where(eq(schema.movies.id, id));
    await logActivity(me, "delete", "movie", id, `Film “${m!.title}” deleted (can be restored)`);
    redirect("/admin/movies?ok=Deleted");
  }
  async function restore() {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    await db.update(schema.movies).set({ deletedAt: null }).where(eq(schema.movies.id, id));
    await logActivity(me, "restore", "movie", id, `Film “${m!.title}” restored`);
    redirect(`/admin/movies/${id}?ok=Restored`);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><Link href="/admin/movies" className="text-xs text-muted hover:text-text">← Movies</Link><h1 className="text-2xl font-bold">{isNew ? "Add movie" : m!.title}</h1>{m && <div className="text-sm text-muted">{upcoming} upcoming show{upcoming === 1 ? "" : "s"}{m.deletedAt && <span className="pill ml-2 text-[10px] text-bad">DELETED</span>}</div>}</div>
        {m && <a href={`/movies/${m.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View on site ↗</a>}
      </div>
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}
      {sp.error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{sp.error}</div>}
      <form action={save} className="card grid gap-4 p-5 sm:grid-cols-2">
        <F name="title" label="Title" def={m?.title} span required />
        <F name="slug" label="URL slug" def={m?.slug} hint="Part of the public link, /movies/<slug>." />
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" className="input" defaultValue={m?.status ?? "now_showing"}><option value="now_showing">Now showing</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option></select><p className="mt-1 text-[11px] text-muted">Hidden films stay bookable from a direct show link but are not listed.</p></div>
        <F name="language" label="Language" def={m?.language ?? "Tamil"} hint="Separate several with a slash, e.g. Tamil / Telugu." />
        <div><label className="label" htmlFor="certificate">Certificate</label><select id="certificate" name="certificate" className="input" defaultValue={m?.certificate ?? "U/A"}><option>U</option><option>U/A</option><option>A</option><option>S</option></select></div>
        <F name="runtimeMin" label="Runtime (min)" def={m?.runtimeMin ?? 150} type="number" />
        <F name="releaseDate" label="Release date" def={m?.releaseDate} type="date" />
        <F name="genre" label="Genres" def={m?.genre} hint="Comma separated, e.g. Drama, Family. They become the genre filter." />
        <F name="rating" label="Rating (0-10)" def={m?.rating ?? 8} type="number" />
        <F name="director" label="Director" def={m?.director} />
        <F name="cast" label="Cast" def={m?.cast.join(", ")} hint="Comma separated. Searchable from the header." />
        <F name="trailerUrl" label="Trailer URL" def={m?.trailerUrl ?? ""} type="url" span />
        <div className="sm:col-span-2"><label className="label" htmlFor="synopsis">Synopsis</label><textarea id="synopsis" name="synopsis" rows={4} className="input" defaultValue={m?.synopsis} /></div>
        <div className="sm:col-span-2"><div className="label">Formats offered</div><div className="flex flex-wrap gap-2">{FORMATS.map((f) => <label key={f} className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-2 px-3 py-1.5 text-sm"><input type="checkbox" name={`fmt_${f}`} defaultChecked={m?.formats.includes(f)} className="accent-[var(--brand)]" />{f}</label>)}</div></div>
        <div className="sm:col-span-2">
          <div className="label">Poster</div>
          <div className="flex flex-wrap items-start gap-4">
            {m && <Poster movie={m} className="w-24 flex-none" size="sm" />}
            <div className="min-w-0 flex-1 space-y-2">
              <input name="posterUrl" defaultValue={m?.posterUrl?.startsWith("data:") ? "" : m?.posterUrl ?? ""} className="input h-9" placeholder="https://… poster image URL (or upload below)" />
              <div className="flex flex-wrap items-center gap-3 text-xs"><input type="file" name="posterUrl_file" accept="image/*" className="text-muted file:mr-2 file:rounded-md file:border file:border-line file:bg-bg-2 file:px-2 file:py-1 file:text-xs file:text-text" />{m?.posterUrl && <label className="flex items-center gap-1 text-muted"><input type="checkbox" name="posterUrl_clear" /> Remove uploaded poster</label>}</div>
              <p className="text-[11px] text-muted">Up to 600 KB. Without a poster the site falls back to a file in public/covers or a generated poster in the two colours below.</p>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3 sm:col-span-2">
          <div><label className="label" htmlFor="accent">Poster colour</label><input id="accent" name="accent" type="color" defaultValue={m?.accent ?? "#2f7d5a"} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-bg-2" /></div>
          <div><label className="label" htmlFor="accent2">Highlight</label><input id="accent2" name="accent2" type="color" defaultValue={m?.accent2 ?? "#f2c14e"} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-bg-2" /></div>
          <p className="text-xs text-muted">Also used as the ticket header gradient.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 sm:col-span-2">
          <button className="btn btn-primary">{isNew ? "Add movie" : "Save changes"}</button>
          {m && !m.deletedAt && <button formAction={remove} formNoValidate className="btn btn-danger btn-sm ml-auto">Delete film</button>}
          {m?.deletedAt && <button formAction={restore} formNoValidate className="btn btn-ghost btn-sm ml-auto">Restore film</button>}
        </div>
      </form>
    </div>
  );
}

function F({ name, label, def, type = "text", span, required, hint }: { name: string; label: string; def?: string | number; type?: string; span?: boolean; required?: boolean; hint?: string }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={def} className="input" required={required} />{hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}</div>
  );
}
