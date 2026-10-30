import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKey, dayStart } from "./format";

export type DayRow = { day: string; bookings: number; tickets: number; gross: number; refunds: number; online: number; counter: number; net: number };

/** Collections per local day between two day keys (inclusive), by payment time. */
export async function dailyCollections(from: string, to: string): Promise<DayRow[]> {
  const start = dayStart(from), end = dayStart(to) + 86_400_000;
  const pays = await db.select({ amount: schema.payments.amount, status: schema.payments.status, createdAt: schema.payments.createdAt, bookingId: schema.payments.bookingId, channel: schema.bookings.channel, seats: schema.bookings.seatLabels })
    .from(schema.payments).innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(and(gte(schema.payments.createdAt, start), lt(schema.payments.createdAt, end), inArray(schema.payments.status, ["succeeded", "refunded"])));
  const m = new Map<string, DayRow>();
  for (let t = start; t < end; t += 86_400_000) m.set(dayKey(t), { day: dayKey(t), bookings: 0, tickets: 0, gross: 0, refunds: 0, online: 0, counter: 0, net: 0 });
  for (const p of pays) {
    const r = m.get(dayKey(p.createdAt)); if (!r) continue;
    if (p.status === "succeeded") { r.bookings++; r.tickets += (p.seats as string[]).length; r.gross += p.amount; if (p.channel === "counter") r.counter += p.amount; else r.online += p.amount; }
    else r.refunds += -p.amount;
    r.net = r.gross - r.refunds;
  }
  return [...m.values()];
}

/** Every show on a day with sold seats, revenue and check-ins. */
export async function showsOnDay(day: string) {
  const start = dayStart(day), end = start + 86_400_000;
  const list = await db.query.shows.findMany({ where: and(gte(schema.shows.startsAt, start), lt(schema.shows.startsAt, end)), with: { movie: true, screen: true }, orderBy: asc(schema.shows.startsAt) });
  if (!list.length) return [];
  const agg = await db.select({ showId: schema.tickets.showId, sold: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(price),0)`, checkedIn: sql<number>`sum(case when checked_in_at is not null then 1 else 0 end)` })
    .from(schema.tickets).where(and(inArray(schema.tickets.showId, list.map((s) => s.id)), eq(schema.tickets.active, true))).groupBy(schema.tickets.showId);
  const m = new Map(agg.map((a) => [a.showId, a]));
  return list.map((s) => ({ ...s, sold: m.get(s.id)?.sold ?? 0, revenue: m.get(s.id)?.revenue ?? 0, checkedIn: m.get(s.id)?.checkedIn ?? 0, capacity: s.screen.seatCount }));
}

export async function movieTotals(from: string, to: string) {
  const start = dayStart(from), end = dayStart(to) + 86_400_000;
  return db.select({ movieId: schema.shows.movieId, title: schema.movies.title, shows: sql<number>`count(distinct ${schema.shows.id})`, sold: sql<number>`count(${schema.tickets.id})`, revenue: sql<number>`coalesce(sum(${schema.tickets.price}),0)` })
    .from(schema.shows).innerJoin(schema.movies, eq(schema.shows.movieId, schema.movies.id))
    .leftJoin(schema.tickets, and(eq(schema.tickets.showId, schema.shows.id), eq(schema.tickets.active, true)))
    .where(and(gte(schema.shows.startsAt, start), lt(schema.shows.startsAt, end), eq(schema.shows.status, "scheduled")))
    .groupBy(schema.shows.movieId, schema.movies.title).then((rows) => rows.sort((a, b) => b.revenue - a.revenue));
}
