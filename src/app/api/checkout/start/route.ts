import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BookingError, holdSeats } from "@/lib/booking";
import { ensureCartGroup } from "@/lib/cart";
import { simulatorShowLink } from "@/lib/simulator";

export const dynamic = "force-dynamic";

/** Hand-off from the seat simulator: ?seat=G7&hall=audi3&show=<id> → hold the seat, go to checkout. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const showId = u.searchParams.get("show") ?? "";
  const seats = (u.searchParams.get("seat") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, showId), with: { screen: true, movie: true } });
  if (!show) return NextResponse.redirect(new URL("/", u.origin));
  if (!seats.length) return NextResponse.redirect(simulatorShowLink(show, u.origin));
  const group = await ensureCartGroup(showId);
  try {
    await holdSeats(showId, seats.map((l) => `${show.screenId}:${l}`), group);
  } catch (e) {
    if (e instanceof BookingError) {
      // Seat went while they were looking: back to the hall with the reason in the hash.
      return NextResponse.redirect(`${simulatorShowLink(show, u.origin)}&error=${encodeURIComponent(e.code)}`);
    }
    throw e;
  }
  return NextResponse.redirect(new URL(`/checkout/${showId}`, u.origin));
}
