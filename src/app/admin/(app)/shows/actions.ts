"use server";
import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { cancelBooking } from "@/lib/booking";
import { dayKey, dayStart, fmtTime } from "@/lib/format";
import { sendCancellation } from "@/lib/notify";
import { priceShow } from "@/lib/pricing";
import { bookingFull } from "@/lib/queries";

function back(day: string, msg: string, kind: "error" | "ok" = "error"): never {
  redirect(`/admin/shows?day=${day}&${kind}=${encodeURIComponent(msg)}`);
}

/**
 * Schedule one show, or a run of them: `until` repeats the date range and
 * `times` (comma separated HH:MM) adds several slots per day. Clashing slots
 * are skipped and reported; prices come from the rules unless overridden.
 */
export async function createShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const movieId = String(fd.get("movieId") ?? ""), screenId = String(fd.get("screenId") ?? "");
  const date = String(fd.get("date") ?? ""), until = String(fd.get("until") ?? "") || date;
  const times = String(fd.get("times") ?? fd.get("time") ?? "").split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  const format = String(fd.get("format") ?? "2D");
  const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => fd.get(`wd_${d}`) === "on");
  const anyDay = weekdays.every((x) => !x);
  const movie = await db.query.movies.findFirst({ where: eq(schema.movies.id, movieId) });
  const screen = await db.query.screens.findFirst({ where: eq(schema.screens.id, screenId) });
  if (!movie || !screen || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || !times.length || times.some((t) => !/^\d{2}:\d{2}$/.test(t))) back(date || dayKey(Date.now()), "Fill in film, screen, date and at least one HH:MM time.");
  if (dayStart(until) - dayStart(date) > 60 * 86_400_000) back(date, "Schedule at most 60 days at a time.");
  const rules = await db.query.pricingRules.findMany();
  const override: Record<string, number> = {};
  for (const k of Object.keys(screen.layout.basePrices)) { const v = Number(fd.get(`price_${k}`)); if (Number.isFinite(v) && v > 0) override[k] = Math.round(v); }
  const single = until === date && times.length === 1;
  let made = 0; const skipped: string[] = [];
  for (let d = dayStart(date); d <= dayStart(until); d += 86_400_000) {
    const day = dayKey(d);
    if (!anyDay && !weekdays[new Date(d + 12 * 3_600_000).getUTCDay()]) continue; // IST noon → weekday
    for (const time of times) {
      const startsAt = Date.parse(`${day}T${time}:00+05:30`);
      const endsAt = startsAt + (movie.runtimeMin + 20) * 60_000; // 20 min for ads + cleaning
      const label = `${day} ${time}`;
      if (startsAt < Date.now()) { skipped.push(`${label} (past)`); continue; }
      const clash = await db.query.shows.findFirst({ where: and(eq(schema.shows.screenId, screenId), eq(schema.shows.status, "scheduled"), isNull(schema.shows.deletedAt), lt(schema.shows.startsAt, endsAt), gt(schema.shows.endsAt, startsAt)), with: { movie: true } });
      if (clash) { skipped.push(`${label} (clashes with ${clash.movie.title} ${fmtTime(clash.startsAt)})`); continue; }
      const id = `${screenId}-${day}-${time.replace(":", "")}`;
      if (await db.query.shows.findFirst({ where: eq(schema.shows.id, id) })) { skipped.push(`${label} (slot exists, maybe cancelled)`); continue; }
      const prices = { ...priceShow(screen.layout.basePrices, rules, startsAt, screenId), ...(single ? override : {}) };
      await db.insert(schema.shows).values({ id, movieId, screenId, startsAt, endsAt, format, status: "scheduled", prices });
      made++;
    }
  }
  await logActivity(me, "create", "show", null, `${made} show${made === 1 ? "" : "s"} of “${movie.title}” scheduled on ${screen.name} (${date}${until !== date ? ` to ${until}` : ""}, ${times.join(" ")})${skipped.length ? `; skipped ${skipped.length}` : ""}`);
  if (!made) back(date, `Nothing scheduled: ${skipped.join("; ")}`);
  back(date, `${made} show${made === 1 ? "" : "s"} scheduled.${skipped.length ? ` Skipped: ${skipped.join("; ")}` : ""}`, "ok");
}

export async function cancelShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
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
  await logActivity(me, "cancel", "show", id, `Show ${id} cancelled; ${confirmed.length} bookings refunded ₹${refunded.toLocaleString("en-IN")}`);
  back(day, `Show cancelled. ${confirmed.length} bookings refunded in full (₹${refunded.toLocaleString("en-IN")}).`, "ok");
}

/** Hide a cancelled or finished show from every list; restorable. */
export async function deleteShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  const day = dayKey(show.startsAt);
  if (show.status === "scheduled" && show.endsAt > Date.now()) back(day, "Cancel the show before deleting it.");
  await db.update(schema.shows).set({ deletedAt: Date.now() }).where(eq(schema.shows.id, id));
  await logActivity(me, "delete", "show", id, `Show ${id} deleted (restorable)`);
  back(day, "Show deleted.", "ok");
}

export async function restoreShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  await db.update(schema.shows).set({ deletedAt: null }).where(eq(schema.shows.id, id));
  await logActivity(me, "restore", "show", id, `Show ${id} restored`);
  back(dayKey(show.startsAt), "Show restored.", "ok");
}

/** Re-apply the pricing rules (base prices × time-of-day) to one show. */
export async function repriceShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id), with: { screen: true } });
  if (!show) return;
  const prices = priceShow(show.screen.layout.basePrices, await db.query.pricingRules.findMany(), show.startsAt, show.screenId);
  await db.update(schema.shows).set({ prices }).where(eq(schema.shows.id, id));
  await logActivity(me, "update", "show", id, `Show ${id} repriced from rules`, { prices: [show.prices, prices] });
  back(dayKey(show.startsAt), "Prices recomputed from the rules.", "ok");
}

/** Change which film plays, the format, or move the start time (only while nothing is sold). */
export async function editShow(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  const day = dayKey(show.startsAt);
  const movieId = String(fd.get("movieId") ?? show.movieId), format = String(fd.get("format") ?? show.format), time = String(fd.get("time") ?? "");
  const movie = await db.query.movies.findFirst({ where: eq(schema.movies.id, movieId) });
  if (!movie) back(day, "Unknown film.");
  const sold = await db.query.tickets.findFirst({ where: and(eq(schema.tickets.showId, id), eq(schema.tickets.active, true)) });
  let startsAt = show.startsAt;
  if (/^\d{2}:\d{2}$/.test(time)) startsAt = Date.parse(`${day}T${time}:00+05:30`);
  if (sold && (movieId !== show.movieId || startsAt !== show.startsAt)) back(day, "Tickets are sold for this show, so the film and time can't change. Cancel it (refunds everyone) and schedule a new one.");
  const endsAt = startsAt + (movie.runtimeMin + 20) * 60_000;
  const clash = await db.query.shows.findFirst({ where: and(eq(schema.shows.screenId, show.screenId), ne(schema.shows.id, id), eq(schema.shows.status, "scheduled"), isNull(schema.shows.deletedAt), lt(schema.shows.startsAt, endsAt), gt(schema.shows.endsAt, startsAt)), with: { movie: true } });
  if (clash) back(day, `Clashes with ${clash.movie.title} at ${fmtTime(clash.startsAt)}.`);
  await db.update(schema.shows).set({ movieId, format, startsAt, endsAt }).where(eq(schema.shows.id, id));
  await logActivity(me, "update", "show", id, `Show ${id}: ${movie.title}, ${format}, ${fmtTime(startsAt)}`, { movieId: [show.movieId, movieId], format: [show.format, format], startsAt: [fmtTime(show.startsAt), fmtTime(startsAt)] });
  back(day, "Show updated.", "ok");
}

export async function updatePrices(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const id = String(fd.get("id") ?? "");
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return;
  const prices = { ...show.prices };
  for (const k of Object.keys(prices)) { const v = Number(fd.get(`price_${k}`)); if (Number.isFinite(v) && v > 0) prices[k] = Math.round(v); }
  await db.update(schema.shows).set({ prices }).where(and(eq(schema.shows.id, id), ne(schema.shows.status, "cancelled")));
  await logActivity(me, "update", "show", id, `Show ${id} prices set`, { prices: [show.prices, prices] });
  back(dayKey(show.startsAt), "Prices updated for new bookings.", "ok");
}
