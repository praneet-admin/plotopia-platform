import Link from "next/link";
import { Filters } from "@/components/Filters";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { browseMovies, comingSoon, genreTokens, listCinemas } from "@/lib/browse";
import { dayKey, runtime } from "@/lib/format";
import { fill, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SP = { cinema?: string; genre?: string; lang?: string; q?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { home, cinema: cinemaSettings } = await getSettings();
  const today = dayKey(Date.now());
  const cinemas = await listCinemas();
  const cinema = cinemas.find((c) => c.id === sp.cinema);
  const all = await browseMovies({ day: today });
  const genres = genreTokens(all);
  const languages = [...new Set(all.map((m) => m.language))].sort();
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = !!(cinema || sp.genre || sp.lang || q);
  const rank = new Map(home.featured.map((id, i) => [id, i]));
  const movies = (await browseMovies({ day: today, cinemaId: cinema?.id, genre: sp.genre, language: sp.lang }))
    .filter((m) => !q || m.title.toLowerCase().includes(q) || m.cast.some((c) => c.toLowerCase().includes(q)))
    .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  const upcoming = home.showComingSoon && !filtered ? await comingSoon() : [];
  const short = (id: string) => cinemas.find((c) => c.id === id)?.name.replace(/^(PVR|INOX) /, "").replace(/ (Cinemas|MarketCity|Chennai Citi Centre)$/, "") ?? id;
  const heading = cinema ? cinema.name : fill(home.heading, { city: cinemaSettings.city });
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <>
      <Header q={sp.q} />
      <main className="container-x flex-1 pb-10">
        {home.heroImageUrl && !filtered && (
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={home.heroImageUrl} alt="" className="h-40 w-full object-cover sm:h-64" />
          </div>
        )}
        {home.promoText && (
          <div className="mt-5 rounded-xl border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm">
            {home.promoLink ? <a href={home.promoLink} className="font-medium hover:underline">{home.promoText}</a> : <span className="font-medium">{home.promoText}</span>}
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 sm:mt-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h1>
            <p className="mt-1 text-sm text-muted">{home.subheading && !cinema ? home.subheading : <>{dateLine} · {movies.length} film{movies.length === 1 ? "" : "s"}{filtered ? " match" : " showing"}</>}</p>
          </div>
          {home.showFilters && <Filters cinemas={cinemas} genres={genres} languages={languages} value={{ cinema: sp.cinema, genre: sp.genre, lang: sp.lang, q: sp.q }} />}
        </div>

        {movies.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-line p-12 text-center text-muted">No film matches. <Link href="/" className="text-brand hover:underline">Show all movies</Link></div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {movies.map((m) => (
              <li key={m.id}>
                <Link href={`/movies/${m.slug}${cinema ? `?cinema=${cinema.id}` : ""}`} className="group block">
                  <Poster movie={m} className="transition-transform duration-200 group-hover:-translate-y-1" />
                  <div className="mt-3 text-[15px] font-semibold leading-tight">{m.title}</div>
                  <div className="mt-1 text-xs text-muted">{m.language} · {m.certificate} · {runtime(m.runtimeMin)}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{m.genre.replace(/ · /g, ", ")}</div>
                  {home.showPlayingAt && !cinema && m.cinemaIds.length > 0 && <div className="mt-0.5 truncate text-xs text-muted">{m.cinemaIds.map(short).join(", ")}</div>}
                </Link>
                <Link href={`/movies/${m.slug}${cinema ? `?cinema=${cinema.id}` : ""}`} className="btn btn-primary btn-sm mt-3 w-full">Book</Link>
              </li>
            ))}
          </ul>
        )}

        {upcoming.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">Coming soon</h2>
            <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {upcoming.map((m) => (
                <li key={m.id}>
                  <Link href={`/movies/${m.slug}`} className="group block">
                    <Poster movie={m} size="sm" className="transition-transform duration-200 group-hover:-translate-y-1" />
                    <div className="mt-2 text-sm font-semibold leading-tight">{m.title}</div>
                    <div className="mt-0.5 text-xs text-muted">{new Date(m.releaseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
