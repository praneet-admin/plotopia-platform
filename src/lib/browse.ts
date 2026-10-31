import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayStart } from "./format";

/** Genre tokens from "Drama · Family" style strings, ordered by frequency. */
export function genreTokens(movies: { genre: string }[]) {
  const n = new Map<string, number>();
  for (const m of movies) for (const g of m.genre.split("·").map((s) => s.trim()).filter(Boolean)) n.set(g, (n.get(g) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/** Movies now showing, optionally only those with a show at `cinemaId` on `day`, optionally in a genre / language. */
export async function browseMovies(opts: { cinemaId?: string; genre?: string; language?: string; day: string }) {
  let movies = await db.query.movies.findMany({ where: eq(schema.movies.status, "now_showing"), orderBy: asc(schema.movies.releaseDate) });
  const start = dayStart(opts.day), end = start + 86_400_000;
  // Which movies play where (on that day), for the theatre filter and the "playing at" labels.
  const shows = await db
    .select({ movieId: schema.shows.movieId, cinemaId: schema.screens.cinemaId })
    .from(schema.shows)
    .innerJoin(schema.screens, eq(schema.shows.screenId, schema.screens.id))
    .where(and(gte(schema.shows.startsAt, start), lt(schema.shows.startsAt, end), eq(schema.shows.status, "scheduled"), inArray(schema.shows.movieId, movies.map((m) => m.id))));
  const cinemasOf = new Map<string, Set<string>>();
  for (const s of shows) cinemasOf.set(s.movieId, (cinemasOf.get(s.movieId) ?? new Set()).add(s.cinemaId));
  if (opts.cinemaId) movies = movies.filter((m) => cinemasOf.get(m.id)?.has(opts.cinemaId!));
  if (opts.genre) movies = movies.filter((m) => m.genre.split("·").map((s) => s.trim()).includes(opts.genre!));
  if (opts.language) movies = movies.filter((m) => m.language === opts.language);
  return movies.map((m) => ({ ...m, cinemaIds: [...(cinemasOf.get(m.id) ?? [])] }));
}

export const listCinemas = () => db.query.cinemas.findMany({ orderBy: asc(schema.cinemas.name) });
