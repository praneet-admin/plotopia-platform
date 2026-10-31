import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { fillTone } from "@/components/ui";
import { simulatorShowLink, siteOrigin } from "@/lib/simulator";
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
  const origin = await siteOrigin();
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
        <section className="container-x pt-6 sm:pt-8">
          <Link href="/" className="text-sm text-muted hover:text-text">All movies</Link>
          <div className="mt-3 flex gap-5 sm:gap-7">
            <Poster movie={movie} className="w-[110px] flex-none sm:w-[160px]" size="sm" />
            <div className="min-w-0">
              <h1 className="text-[clamp(26px,4vw,40px)] font-extrabold leading-[1] tracking-[-0.03em]">{movie.title}</h1>
              <p className="mt-2 text-sm text-muted">{movie.language} · {movie.certificate} · {runtime(movie.runtimeMin)} · {movie.genre}</p>
              <p className="mt-3 hidden max-w-[62ch] text-[15px] leading-relaxed text-text/90 sm:block">{movie.synopsis}</p>
              <p className="mt-2 hidden max-w-[62ch] text-sm text-muted sm:block">Directed by {movie.director}. With {movie.cast.join(", ")}.</p>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-text/90 sm:hidden">{movie.synopsis}</p>
        </section>

        <section id="showtimes" className="container-x mt-8 border-t border-line pt-6">
          <h2 className="text-xl font-bold tracking-tight">Showtimes</h2>
          <p className="mt-1 text-sm text-muted">Pick a day and a time. The time opens the 3D hall where you choose your seat.</p>
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
                              const inner = (<><b>{fmtTime(s.startsAt)}</b><small className={past || soldOut ? "" : tone.cls}>{past ? "Started" : soldOut ? "Sold out" : tone.label}</small></>);
                              return past || soldOut ? <span key={s.id} className="showtime off" aria-disabled="true">{inner}</span> : <a key={s.id} href={simulatorShowLink({ ...s, movie }, origin)} className="showtime">{inner}</a>;
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
