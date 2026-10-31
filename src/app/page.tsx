import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { currentCustomer } from "@/lib/auth";
import { browseMovies, genreTokens, listCinemas } from "@/lib/browse";
import { dayKey, runtime } from "@/lib/format";
import { VISITED_COOKIE } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cinema?: string; genre?: string; lang?: string }> }) {
  const [customer, jar] = await Promise.all([currentCustomer(), cookies()]);
  if (!customer && !jar.get(VISITED_COOKIE)) redirect("/portal");
  const sp = await searchParams;
  const today = dayKey(Date.now());
  const cinemas = await listCinemas();
  const cinema = cinemas.find((c) => c.id === sp.cinema);
  const all = await browseMovies({ day: today });
  const genres = genreTokens(all);
  const languages = [...new Set(all.map((m) => m.language))].sort();
  const movies = await browseMovies({ day: today, cinemaId: cinema?.id, genre: sp.genre, language: sp.lang });
  const filtered = !!(cinema || sp.genre || sp.lang);
  const href = (patch: Partial<typeof sp>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const cinemaName = (id: string) => cinemas.find((c) => c.id === id)?.name.replace(/ (Cinemas|MarketCity|Chennai Citi Centre)$/, "") ?? id;

  const Card = ({ m, i }: { m: (typeof movies)[number]; i: number }) => (
    <Link href={`/movies/${m.slug}${cinema ? `?cinema=${cinema.id}` : ""}`} className="group fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
      <Poster movie={m} className="transition-transform duration-200 group-hover:-translate-y-1" />
      <div className="mt-3">
        <div className="font-semibold leading-tight">{m.title}</div>
        <div className="mt-1 text-xs text-muted">{m.language} · {m.certificate} · {runtime(m.runtimeMin)}</div>
        <div className="mt-1 flex items-center gap-2 text-xs"><span className="text-brand">★ {m.rating.toFixed(1)}</span><span className="text-muted">{m.genre}</span></div>
        {!cinema && m.cinemaIds.length > 0 && <div className="mt-1 truncate text-[11px] text-muted">at {m.cinemaIds.map(cinemaName).join(", ")}</div>}
      </div>
    </Link>
  );

  return (
    <>
      <Header />
      <main className="container-x flex-1 pb-8">
        <section className="fade-up pt-8 sm:pt-12">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">{cinema ? `${cinema.name} · ${cinema.city}` : `Chennai · ${cinemas.length} theatres`}</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {customer ? `Hi ${customer.name.split(" ")[0]}, pick` : "Pick"} a seat. <span className="text-brand">See the screen</span> before you pay.
          </h1>
        </section>

        <section className="mt-8 space-y-3">
          <div className="scroll-x -mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0" aria-label="Theatre">
            <Link href={href({ cinema: undefined })} className={`flex-none rounded-xl border px-3 py-2 text-sm ${!cinema ? "border-brand bg-brand/10 font-semibold" : "border-line bg-panel text-muted hover:text-text"}`}>All theatres</Link>
            {cinemas.map((c) => (
              <Link key={c.id} href={href({ cinema: c.id })} className={`flex-none rounded-xl border px-3 py-2 text-sm ${cinema?.id === c.id ? "border-brand bg-brand/10 font-semibold" : "border-line bg-panel text-muted hover:text-text"}`}>{c.name}</Link>
            ))}
          </div>
          <div className="scroll-x -mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0" aria-label="Genre">
            <Link href={href({ genre: undefined })} className={`pill h-8 flex-none ${!sp.genre ? "border-brand text-brand" : "text-muted hover:text-text"}`}>All genres</Link>
            {genres.map((g) => <Link key={g} href={href({ genre: sp.genre === g ? undefined : g })} className={`pill h-8 flex-none ${sp.genre === g ? "border-brand text-brand" : "text-muted hover:text-text"}`}>{g}</Link>)}
            <span className="mx-1 w-px flex-none bg-line" />
            {languages.map((l) => <Link key={l} href={href({ lang: sp.lang === l ? undefined : l })} className={`pill h-8 flex-none ${sp.lang === l ? "border-brand text-brand" : "text-muted hover:text-text"}`}>{l}</Link>)}
          </div>
        </section>

        {filtered ? (
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between"><h2 className="text-lg font-bold">{[sp.genre, sp.lang, cinema?.name].filter(Boolean).join(" · ") || "Now showing"}</h2><span className="text-xs text-muted">{movies.length} film{movies.length === 1 ? "" : "s"}</span></div>
            {movies.length === 0 ? (
              <div className="card p-10 text-center text-muted">Nothing matches today. <Link href="/" className="text-brand hover:underline">Clear filters</Link></div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{movies.map((m, i) => <Card key={m.id} m={m} i={i} />)}</div>
            )}
          </section>
        ) : (
          <>
            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between"><h2 className="text-lg font-bold">Now showing</h2><span className="text-xs text-muted">{movies.length} films today</span></div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{movies.map((m, i) => <Card key={m.id} m={m} i={i} />)}</div>
            </section>
            <section className="mt-12 space-y-8">
              {genres.slice(0, 5).map((g) => {
                const list = movies.filter((m) => m.genre.split("·").map((s) => s.trim()).includes(g));
                if (list.length < 2) return null;
                return (
                  <div key={g}>
                    <div className="mb-3 flex items-end justify-between"><h2 className="font-bold">{g}</h2><Link href={href({ genre: g })} className="text-xs text-muted hover:text-text">See all →</Link></div>
                    <div className="scroll-x -mx-4 flex gap-4 px-4 sm:mx-0 sm:px-0">{list.map((m) => <div key={m.id} className="w-36 flex-none sm:w-44"><Card m={m} i={0} /></div>)}</div>
                  </div>
                );
              })}
            </section>
            <section className="mt-12">
              <h2 className="mb-3 font-bold">Theatres</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {cinemas.map((c) => {
                  const n = all.filter((m) => m.cinemaIds.includes(c.id)).length;
                  return (
                    <Link key={c.id} href={href({ cinema: c.id })} className="card flex items-center justify-between p-4 hover:border-brand/60">
                      <div><div className="font-semibold">{c.name}</div><div className="text-xs text-muted">{c.address}</div></div>
                      <span className="pill flex-none">{n} film{n === 1 ? "" : "s"}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
