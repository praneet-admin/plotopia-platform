import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayStart } from "./format";

export async function nowShowing() {
  return db.query.movies.findMany({ where: eq(schema.movies.status, "now_showing"), orderBy: asc(schema.movies.releaseDate) });
}

/** Shows for a movie on a local day, with sold counts. */
export async function showsForMovieOnDay(movieId: string, day: string) {
  const start = dayStart(day), end = start + 86_400_000;
  const rows = await db.query.shows.findMany({
    where: and(eq(schema.shows.movieId, movieId), gte(schema.shows.startsAt, start), lt(schema.shows.startsAt, end), eq(schema.shows.status, "scheduled")),
    with: { screen: true },
    orderBy: asc(schema.shows.startsAt),
  });
  return attachSold(rows);
}

export async function attachSold<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return [] as (T & { sold: number })[];
  const counts = await db
    .select({ showId: schema.tickets.showId, n: sql<number>`count(*)` })
    .from(schema.tickets)
    .where(and(inArray(schema.tickets.showId, rows.map((r) => r.id)), eq(schema.tickets.active, true)))
    .groupBy(schema.tickets.showId);
  const m = new Map(counts.map((c) => [c.showId, c.n]));
  return rows.map((r) => ({ ...r, sold: m.get(r.id) ?? 0 }));
}

export async function showWithSeats(showId: string) {
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, showId), with: { movie: true, screen: { with: { cinema: true } } } });
  if (!show) return null;
  const seats = await db.query.seats.findMany({ where: eq(schema.seats.screenId, show.screenId), orderBy: [asc(schema.seats.rowIndex), asc(schema.seats.num)] });
  return { show, seats };
}

export async function bookingFull(id: string) {
  return db.query.bookings.findFirst({ where: eq(schema.bookings.id, id), with: { show: { with: { movie: true, screen: { with: { cinema: true } } } }, tickets: true, customer: true, payments: true } });
}
