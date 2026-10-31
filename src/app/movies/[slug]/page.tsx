import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { fillTone } from "@/components/ui";
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
      <main className="container-x flex-1">
        <div className="fade-up mt-6 flex gap-5 sm:mt-10 sm:gap-8">
          <Poster movie={movie} className="w-28 flex-none sm:w-44" size="sm" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{movie.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="pill">{movie.language}</span>
              <span className="pill">{movie.certificate}</span>
              <span className="pill">{runtime(movie.runtimeMin)}</span>
              <span className="pill text-prime">★ {movie.rating.toFixed(1)}</span>
            </div>
            <p className="mt-3 hidden text-sm text-muted sm:block">{movie.synopsis}</p>
            <div className="mt-3 text-xs text-muted">
              <span className="text-text">Director</span> {movie.director} · <span className="text-text">Cast</span> {movie.cast.join(", ")}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted sm:hidden">{movie.synopsis}</p>

        <section className="mt-8">
          <div className="scroll-x -mx-4 flex gap-2 px-4 pb-2 sm:mx-0 sm:px-0">
            {days.map((d) => {
              const ms = dayStart(d);
              const active = d === day;
              return (
                <Link key={d} href={qs(d, cinema?.id)} scroll={false} className={`flex w-[62px] flex-none flex-col items-center rounded-xl border px-2 py-2 text-center ${active ? "border-brand bg-brand/10" : "border-line bg-panel hover:bg-panel-2"}`}>
                  <span className="text-[10px] font-semibold uppercase text-muted">{new Date(ms).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</span>
                  <span className="text-lg font-bold leading-tight">{new Date(ms).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</span>
                  <span className="text-[10px] text-muted">{new Date(ms).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span>
                </Link>
              );
            })}
          </div>

          {cinemaIdsToday.length > 1 && (
            <div className="scroll-x mt-3 flex gap-2 pb-1">
              <Link href={qs(day)} className={`pill h-8 flex-none ${!cinema ? "border-brand text-brand" : "text-muted hover:text-text"}`}>All theatres</Link>
              {cinemas.filter((c) => cinemaIdsToday.includes(c.id)).map((c) => <Link key={c.id} href={qs(day, c.id)} className={`pill h-8 flex-none ${cinema?.id === c.id ? "border-brand text-brand" : "text-muted hover:text-text"}`}>{c.name}</Link>)}
            </div>
          )}
          <div className="mt-4 space-y-6">
            {byCinema.size === 0 && <div className="card p-8 text-center text-muted">No shows on this day{cinema ? ` at ${cinema.name}` : ""}.</div>}
            {[...byCinema.entries()].map(([cid, byScreen]) => { const c = cinemas.find((x) => x.id === cid)!; return (
            <div key={cid}>
              <div className="mb-2 flex items-baseline justify-between"><h3 className="font-bold">{c.name}</h3><span className="text-xs text-muted">{c.address}</span></div>
              <div className="space-y-3">
            {[...byScreen.values()].map((list) => {
              const screen = list[0].screen;
              const prices = list.flatMap((s) => Object.values(s.prices));
              return (
                <div key={screen.id} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="font-semibold">{screen.name}</div>
                      <div className="text-xs text-muted">{list[0].format} · {screen.seatCount} seats · {inr(Math.min(...prices))} – {inr(Math.max(...prices))}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {list.map((s) => {
                      const pct = (s.sold / screen.seatCount) * 100;
                      const tone = fillTone(pct);
                      const past = s.startsAt < now - 20 * 60_000;
                      const soldOut = s.sold >= screen.seatCount;
                      const disabled = past || soldOut;
                      const inner = (
                        <>
                          <span className="font-semibold">{fmtTime(s.startsAt)}</span>
                          <span className={`text-[10px] font-semibold ${past ? "text-muted" : tone.cls}`}>{past ? "Started" : tone.label}</span>
                        </>
                      );
                      return disabled ? (
                        <span key={s.id} className="flex min-w-[92px] flex-col items-center rounded-xl border border-line px-3 py-2 opacity-50">{inner}</span>
                      ) : (
                        <Link key={s.id} href={`/book/${s.id}`} className="flex min-w-[92px] flex-col items-center rounded-xl border border-line bg-bg-2 px-3 py-2 transition hover:border-brand hover:bg-brand/10">{inner}</Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
              </div>
            </div>
            ); })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
