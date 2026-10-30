import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Poster } from "@/components/Poster";
import { requireStaff } from "@/lib/admin";

export default async function MovieEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(["admin", "manager"]);
  const { id } = await params;
  const isNew = id === "new";
  const m = isNew ? null : await db.query.movies.findFirst({ where: eq(schema.movies.id, id) });
  if (!isNew && !m) notFound();

  async function save(fd: FormData) {
    "use server";
    await requireStaff(["admin", "manager"]);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const title = g("title");
    const slug = (g("slug") || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!title || !slug) return;
    const row = { slug, title, language: g("language") || "Tamil", certificate: g("certificate") || "U/A", runtimeMin: Math.max(30, Number(g("runtimeMin")) || 120), genre: g("genre"), synopsis: g("synopsis"), cast: g("cast").split(",").map((s) => s.trim()).filter(Boolean), director: g("director"), releaseDate: g("releaseDate") || new Date().toISOString().slice(0, 10), accent: g("accent") || "#2f7d5a", accent2: g("accent2") || "#f2c14e", rating: Number(g("rating")) || 0, status: g("status") || "now_showing" };
    if (isNew) await db.insert(schema.movies).values({ id: slug, ...row });
    else await db.update(schema.movies).set(row).where(eq(schema.movies.id, id));
    redirect("/admin/movies");
  }
  const F = ({ name, label, def, type = "text", span }: { name: string; label: string; def?: string | number; type?: string; span?: boolean }) => (
    <div className={span ? "sm:col-span-2" : ""}><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={def} className="input" /></div>
  );
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{isNew ? "Add movie" : m!.title}</h1>
      <form action={save} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr]">
        <F name="title" label="Title" def={m?.title} span />
        <F name="slug" label="URL slug" def={m?.slug} />
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" className="input" defaultValue={m?.status ?? "now_showing"}><option value="now_showing">Now showing</option><option value="coming_soon">Coming soon</option><option value="archived">Archived</option></select></div>
        <F name="language" label="Language" def={m?.language ?? "Tamil"} />
        <div><label className="label" htmlFor="certificate">Certificate</label><select id="certificate" name="certificate" className="input" defaultValue={m?.certificate ?? "U/A"}><option>U</option><option>U/A</option><option>A</option></select></div>
        <F name="runtimeMin" label="Runtime (min)" def={m?.runtimeMin ?? 150} type="number" />
        <F name="releaseDate" label="Release date" def={m?.releaseDate} type="date" />
        <F name="genre" label="Genre" def={m?.genre} />
        <F name="rating" label="Rating (0-10)" def={m?.rating ?? 8} type="number" />
        <F name="director" label="Director" def={m?.director} />
        <F name="cast" label="Cast (comma separated)" def={m?.cast.join(", ")} />
        <div className="sm:col-span-2"><label className="label" htmlFor="synopsis">Synopsis</label><textarea id="synopsis" name="synopsis" rows={4} className="input" defaultValue={m?.synopsis} /></div>
        <div className="flex items-end gap-3 sm:col-span-2">
          <div><label className="label" htmlFor="accent">Poster colour</label><input id="accent" name="accent" type="color" defaultValue={m?.accent ?? "#2f7d5a"} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-bg-2" /></div>
          <div><label className="label" htmlFor="accent2">Highlight</label><input id="accent2" name="accent2" type="color" defaultValue={m?.accent2 ?? "#f2c14e"} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-bg-2" /></div>
          {m && <Poster movie={m} className="w-14" size="sm" />}
          <p className="text-xs text-muted">Posters are generated from the title and these two colours, so the demo needs no licensed artwork.</p>
        </div>
        <div className="sm:col-span-2"><button className="btn btn-primary">{isNew ? "Add movie" : "Save changes"}</button></div>
      </form>
    </div>
  );
}
