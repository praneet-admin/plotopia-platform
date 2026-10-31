import Link from "next/link";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { currentCustomer } from "@/lib/auth";
import { browseMovies, genreTokens, listCinemas } from "@/lib/browse";
import { dayKey, fmtTime, inr, runtime } from "@/lib/format";
import { showsForMovieOnDay } from "@/lib/queries";
import { TheatreSelect } from "@/components/TheatreSelect";
import { simulatorShowLink, siteOrigin } from "@/lib/simulator";

export const dynamic = "force-dynamic";

type SP = { cinema?: string; genre?: string; lang?: string; q?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await currentCustomer();
  const sp = await searchParams;
  const today = dayKey(Date.now());
  const now = Date.now();
  const origin = await siteOrigin();
  const cinemas = await listCinemas();
  const cinema = cinemas.find((c) => c.id === sp.cinema);
  const all = await browseMovies({ day: today });
  const genres = genreTokens(all);
  const languages = [...new Set(all.map((m) => m.language))].sort();
  const q = (sp.q ?? "").trim();
  const movies = (await browseMovies({ day: today, cinemaId: cinema?.id, genre: sp.genre, language: sp.lang })).filter((m) => !q || m.title.toLowerCase().includes(q.toLowerCase()) || m.cast.some((c) => c.toLowerCase().includes(q.toLowerCase())));
  const filtered = !!(cinema || sp.genre || sp.lang || q);
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const short = (id: string) => cinemas.find((c) => c.id === id)?.name.replace(/^(PVR|INOX) /, "").replace(/ (Cinemas|MarketCity|Chennai Citi Centre)$/, "") ?? id;

  // Featured: the highest-rated film still playing later today.
  const featured = [...(filtered ? movies : all)].sort((a, b) => b.rating - a.rating)[0];
  const featuredShows = featured ? (await showsForMovieOnDay(featured.id, today)).filter((s) => s.startsAt > now - 20 * 60_000 && (!cinema || s.screen.cinemaId === cinema.id)) : [];

  const Card = ({ m, wide }: { m: (typeof movies)[number]; wide?: boolean }) => (
    <Link href={`/movies/${m.slug}${cinema ? `?cinema=${cinema.id}` : ""}`} className={`group block ${wide ? "w-[160px] sm:w-[200px]" : ""}`}>
      <Poster movie={m} className="transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1" />
      <div className="mt-2.5 text-[15px] font-semibold leading-tight">{m.title}</div>
      <div className="mt-0.5 text-xs text-muted">{m.genre.replace(/ · /g, ", ")} · {runtime(m.runtimeMin)}</div>
      {!cinema && m.cinemaIds.length > 0 && <div className="mt-0.5 truncate text-xs text-muted">{m.cinemaIds.map(short).join(", ")}</div>}
      <div className="mt-2 text-sm font-semibold text-brand group-hover:underline">Showtimes</div>
    </Link>
  );

  return (
    <>
      <Header />
      <main className="flex-1 pb-10">
        {/* Hero: tonight's film projected on the screen */}
        {featured && (
          <section className="relative overflow-hidden">
            <div className="beam" aria-hidden />
            <div className="container-x relative pt-8 sm:pt-12">
              <p className="text-sm text-muted">{customer ? `Good evening, ${customer.name.split(" ")[0]}.` : "Chennai."} {cinema ? `Tonight at ${cinema.name}.` : `Tonight across ${cinemas.length} theatres.`}</p>
              <div className="screen mt-4 grid gap-6 p-5 sm:grid-cols-[180px_1fr] sm:gap-8 sm:p-8 lg:grid-cols-[220px_1fr]">
                <Link href={`/movies/${featured.slug}`} className="block w-[140px] sm:w-auto"><Poster movie={featured} size="md" /></Link>
                <div className="min-w-0">
                  <h1 className="text-[clamp(34px,6vw,64px)] font-extrabold leading-[0.95] tracking-[-0.035em]">{featured.title}</h1>
                  <p className="mt-3 text-sm text-muted">{featured.language}, {featured.certificate}, {runtime(featured.runtimeMin)}. {featured.genre.replace(/ · /g, " and ")}. Directed by {featured.director}.</p>
                  <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-text/90">{featured.synopsis}</p>
                  {featuredShows.length > 0 ? (
                    <div className="mt-5">
                      <div className="text-sm text-muted">Showtimes today. Tap a time to pick your seat in the 3D hall.</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {featuredShows.slice(0, 6).map((s) => (
                          <a key={s.id} href={simulatorShowLink({ ...s, movie: featured }, origin)} className="showtime">
                            <b>{fmtTime(s.startsAt)}</b>
                            <small className="text-muted">{short(s.screen.cinemaId)} · from {inr(Math.min(...Object.values(s.prices)))}</small>
                          </a>
                        ))}
                        {featuredShows.length > 6 && <Link href={`/movies/${featured.slug}`} className="showtime justify-center text-muted"><b className="font-medium">+{featuredShows.length - 6} more</b></Link>}
                      </div>
                    </div>
                  ) : (
                    <Link href={`/movies/${featured.slug}`} className="btn btn-primary mt-5">See showtimes</Link>
                  )}
                </div>
              </div>
              <div className="seat-row mx-6 mt-3 sm:mx-10" aria-hidden />
              <div className="seat-row mx-2 mt-1.5 opacity-60 sm:mx-4" aria-hidden />
            </div>
          </section>
        )}

        {/* Find a film */}
        <section className="container-x mt-10">
          <form className="relative" role="search">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input name="q" defaultValue={q} className="search" placeholder="Search films or actors" aria-label="Search films" />
            {cinema && <input type="hidden" name="cinema" value={cinema.id} />}
          </form>
          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <label className="text-sm text-muted" htmlFor="theatre">Theatre</label>
            <TheatreSelect id="theatre" cinemas={cinemas} value={cinema?.id ?? ""} params={{ genre: sp.genre, lang: sp.lang, q }} />
            <span className="text-sm text-muted">Genre</span>
            <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Genre">
              <Link href={href({ genre: undefined })} className={`chip ${!sp.genre ? "on" : ""}`}>All</Link>
              {genres.map((g) => <Link key={g} href={href({ genre: sp.genre === g ? undefined : g })} className={`chip ${sp.genre === g ? "on" : ""}`}>{g}</Link>)}
            </div>
            <span className="text-sm text-muted">Language</span>
            <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Language">
              <Link href={href({ lang: undefined })} className={`chip ${!sp.lang ? "on" : ""}`}>All</Link>
              {languages.map((l) => <Link key={l} href={href({ lang: sp.lang === l ? undefined : l })} className={`chip ${sp.lang === l ? "on" : ""}`}>{l}</Link>)}
            </div>
          </div>
        </section>

        {/* Now showing rail */}
        <section className="container-x mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold tracking-tight">{filtered ? [q && `“${q}”`, sp.genre, sp.lang, cinema?.name].filter(Boolean).join(", ") : "Now showing"}</h2>
            <span className="text-sm text-muted">{movies.length} film{movies.length === 1 ? "" : "s"} today{filtered && <> · <Link href="/" className="text-text underline-offset-2 hover:underline">clear</Link></>}</span>
          </div>
          {movies.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-line p-10 text-center text-muted">No film matches that today. <Link href="/" className="text-brand hover:underline">Show everything</Link></div>
          ) : (
            <div className="rail -mx-4 mt-4 px-4 sm:mx-0 sm:px-0">{movies.map((m) => <Card key={m.id} m={m} wide />)}</div>
          )}
        </section>

        {/* Genre rows */}
        {!filtered && (
          <section className="container-x mt-10 space-y-8">
            {genres.slice(0, 4).map((g) => {
              const list = movies.filter((m) => m.genre.split("·").map((s) => s.trim()).includes(g));
              if (list.length < 2) return null;
              return (
                <div key={g}>
                  <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold tracking-tight">{g}</h2><Link href={href({ genre: g })} className="text-sm text-muted hover:text-text">All {g.toLowerCase()}</Link></div>
                  <div className="rail -mx-4 mt-3 px-4 sm:mx-0 sm:px-0">{list.map((m) => <Card key={m.id} m={m} wide />)}</div>
                </div>
              );
            })}
          </section>
        )}

        {/* Theatres as a programme list */}
        <section id="theatres" className="container-x mt-12">
          <h2 className="text-xl font-bold tracking-tight">Theatres</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {cinemas.map((c) => {
              const playing = all.filter((m) => m.cinemaIds.includes(c.id));
              return (
                <li key={c.id}>
                  <Link href={href({ cinema: c.id })} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                    <span className="w-56 flex-none text-[15px] font-semibold group-hover:text-brand">{c.name}</span>
                    <span className="flex-1 text-sm text-muted">{c.address}</span>
                    <span className="text-sm text-muted">{playing.map((m) => m.title).slice(0, 3).join(", ")}{playing.length > 3 ? ` and ${playing.length - 3} more` : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
