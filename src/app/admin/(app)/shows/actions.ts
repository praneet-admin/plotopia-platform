"use server";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { cancelBooking } from "@/lib/booking";
import { dayKey } from "@/lib/format";
import { sendCancellation } from "@/lib/notify";
import { priceShow } from "@/lib/pricing";
import { bookingFull } from "@/lib/queries";

function back(day: string, msg: string, kind: "error" | "ok" = "error"): never {
  redirect(`/admin/shows?day=${day}&${kind}=${encodeURIComponent(msg)}`);
}

export async function createShow(fd: FormData) {
  await requireStaff(["admin", "manager"]);
  const movieId = String(fd.get("movieId") ?? ""), screenId = String(fd.get("screenId") ?? "");
  const date = String(fd.get("date") ?? ""), time = String(fd.get("time") ?? "");
  const format = String(fd.get("format") ?? "2D");
  const movie = await db.query.movies.findFirst({ where: eq(schema.movies.id, movieId) });
  const screen = await db.query.screens.findFirst({ where: eq(schema.screens.id, screenId) });
  if (!movie || !screen || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) back(date || dayKey(Date.now()), "Fill in film, screen, date and time.");
  const startsAt = Date.parse(`${date}T${time}:00+05:30`);
  const endsAt = startsAt + (movie.runtimeMin + 20) * 60_000; // 20 min for ads + cleaning
  if (startsAt < Date.now()) back(date, "That time is in the past.");
  const clash = await db.query.shows.findFirst({ where: and(eq(schema.shows.screenId, screenId), eq(schema.shows.status, "scheduled"), lt(schema.shows.startsAt, endsAt), gt(schema.shows.endsAt, startsAt)), with: { movie: true } });
  if (clash) back(date, `Clashes with ${clash.movie.title} at ${new Date(clash.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} on ${screen.name}.`);
  const rules = await db.query.pricingRules.findMany();
  const auto = priceShow(screen.layout.basePrices, rules, startsAt, screenId);
  const prices: Record<string, number> = {};
  for (const k of Object.keys(auto)) { const v = Number(fd.get(`price_${k}`)); prices[k] = Number.isFinite(v) && v > 0 ? Math.round(v) : auto[k]; }
  const id = `${screenId}-${date}-${time.replace(":", "")}`;
  if (await db.query.shows.findFirst({ where: eq(schema.shows.id, id) })) back(date, "A show with that screen and time already exists (maybe cancelled). Pick another minute.");
  await db.insert(schema.shows).values({ id, movieId, screenId, startsAt, endsAt, format, status: "scheduled", prices });
  back(date, `${movie.title} scheduled on ${screen.name} at ${time}.`, "ok");
}

export async function cancelShow(fd: FormData) {
  await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  const day = dayKey(show.startsAt);
  const confirmed = await db.query.bookings.findMany({ where: and(eq(schema.bookings.showId, id), eq(schema.bookings.status, "confirmed")) });
  let refunded = 0;
  for (const b of confirmed) {
    const r = await cancelBooking(b.id, { force: true });
    refunded += r.amount;
    const full = await bookingFull(b.id);
    if (full) await sendCancellation(full, r.amount);
  }
  await db.update(schema.shows).set({ status: "cancelled" }).where(eq(schema.shows.id, id));
  await db.delete(schema.seatHolds).where(eq(schema.seatHolds.showId, id));
  back(day, `Show cancelled. ${confirmed.length} bookings refunded in full (₹${refunded.toLocaleString("en-IN")}).`, "ok");
}

export async function updatePrices(fd: FormData) {
  await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  const prices = { ...show.prices };
  for (const k of Object.keys(prices)) { const v = Number(fd.get(`price_${k}`)); if (Number.isFinite(v) && v > 0) prices[k] = Math.round(v); }
  await db.update(schema.shows).set({ prices }).where(and(eq(schema.shows.id, id), ne(schema.shows.status, "cancelled")));
  back(dayKey(show.startsAt), "Prices updated for new bookings.", "ok");
}
