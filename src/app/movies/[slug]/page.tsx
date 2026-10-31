import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { fillTone } from "@/components/ui";
import { simulatorShowLink } from "@/lib/hall";
import { showsForMovieOnDay } from "@/lib/queries";
import { listCinemas } from "@/lib/browse";
import { dayKey, dayStart, fmtTime, inr, runtime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MoviePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ day?: string; cinema?: string }> }) {
  const { slug } = await params;
  const { day: dayParam, cinema: cinemaParam } = await searchParams;
  const movie = await db.query.movies.findFirst({ where: eq(schema.movies.slug, slug) });
  if (!movie) notFound();
  const today = dayKey(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => dayKey(dayStart(today) + i * 86_400_000));
  const day = dayParam && days.includes(dayParam) ? dayParam : today;
  const allShows = await showsForMovieOnDay(movie.id, day);
  const cinemas = await listCinemas();
  const cinemaIdsToday = [...new Set(allShows.map((s) => s.screen.cinemaId))];
  const cinema = cinemas.find((c) => c.id === cinemaParam);
  const shows = cinema ? allShows.filter((s) => s.screen.cinemaId === cinema.id) : allShows;
  const byCinema = new Map<string, Map<string, typeof shows>>();
  for (const s of shows) {
    const m = byCinema.get(s.screen.cinemaId) ?? new Map<string, typeof shows>();
    m.set(s.screenId, [...(m.get(s.screenId) ?? []), s]);
    byCinema.set(s.screen.cinemaId, m);
  }
  const qs = (d: string, c?: string) => `?day=${d}${c ? `&cinema=${c}` : ""}`;
  const now = Date.now();

  return (
    <>
      <Header />
      <main className="flex-1 pb-10">
        <section className="relative overflow-hidden">
          <div className="beam" aria-hidden />
          <div className="container-x relative pt-6 sm:pt-10">
            <Link href="/" className="text-sm text-muted hover:text-text">All movies</Link>
            <div className="screen mt-3 grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:gap-8 sm:p-8 lg:grid-cols-[240px_1fr]">
              <Poster movie={movie} className="w-[150px] sm:w-auto" size="md" />
              <div className="min-w-0">
                <h1 className="text-[clamp(34px,6vw,64px)] font-extrabold leading-[0.95] tracking-[-0.035em]">{movie.title}</h1>
                <p className="mt-3 text-sm text-muted">{movie.language}, {movie.certificate}, {runtime(movie.runtimeMin)}. {movie.genre.replace(/ · /g, " and ")}. Rated {movie.rating.toFixed(1)}.</p>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-text/90">{movie.synopsis}</p>
                <p className="mt-3 max-w-[62ch] text-sm text-muted">Directed by {movie.director}. With {movie.cast.join(", ")}.</p>
              </div>
            </div>
            <div className="seat-row mx-6 mt-3 sm:mx-10" aria-hidden />
            <div className="seat-row mx-2 mt-1.5 opacity-60 sm:mx-4" aria-hidden />
          </div>
        </section>

        <section className="container-x mt-8">
          <h2 className="text-xl font-bold tracking-tight">Showtimes</h2>
          <div className="rail -mx-4 mt-3 px-4 sm:mx-0 sm:px-0" aria-label="Day">
            {days.map((d) => {
              const ms = dayStart(d);
              const active = d === day;
              return (
                <Link key={d} href={qs(d, cinema?.id)} scroll={false} className={`chip h-auto flex-col items-start gap-0 px-4 py-2 ${active ? "on" : ""}`}>
                  <span className="text-[11px] leading-4 opacity-80">{new Date(ms).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</span>
                  <span className="num text-base font-semibold leading-5">{new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
                </Link>
              );
            })}
          </div>
          {cinemaIdsToday.length > 1 && (
            <div className="rail -mx-4 mt-3 px-4 sm:mx-0 sm:px-0" aria-label="Theatre">
              <Link href={qs(day)} className={`chip ${!cinema ? "on" : ""}`}>All theatres</Link>
              {cinemas.filter((c) => cinemaIdsToday.includes(c.id)).map((c) => <Link key={c.id} href={qs(day, c.id)} className={`chip ${cinema?.id === c.id ? "on" : ""}`}>{c.name}</Link>)}
            </div>
          )}

          <div className="mt-6 divide-y divide-line border-t border-line">
            {byCinema.size === 0 && <div className="py-10 text-center text-muted">No shows on this day{cinema ? ` at ${cinema.name}` : ""}. Try another date.</div>}
            {[...byCinema.entries()].map(([cid, byScreen]) => {
              const c = cinemas.find((x) => x.id === cid)!;
              return (
                <div key={cid} className="grid gap-4 py-6 md:grid-cols-[260px_1fr]">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{c.name}</h3>
                    <p className="mt-1 text-sm text-muted">{c.address}</p>
                  </div>
                  <div className="space-y-5">
                    {[...byScreen.values()].map((list) => {
                      const screen = list[0].screen;
                      const prices = list.flatMap((s) => Object.values(s.prices));
                      return (
                        <div key={screen.id}>
                          <div className="text-sm"><span className="font-semibold">{screen.name}</span><span className="text-muted"> · {list[0].format} · {inr(Math.min(...prices))} to {inr(Math.max(...prices))}</span></div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {list.map((s) => {
                              const pct = (s.sold / screen.seatCount) * 100;
                              const tone = fillTone(pct);
                              const past = s.startsAt < now - 20 * 60_000;
                              const soldOut = s.sold >= screen.seatCount;
                              const inner = (<><b>{fmtTime(s.startsAt)}</b><small className={past ? "text-muted" : tone.cls}>{past ? "Started" : tone.label}</small></>);
                              return past || soldOut ? <span key={s.id} className="showtime opacity-50">{inner}</span> : <a key={s.id} href={simulatorShowLink(s.screen.layout.simId ?? s.screen.id, s.id)} className="showtime">{inner}</a>;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
