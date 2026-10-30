import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BookingError, holdSeats, releaseHolds } from "@/lib/booking";
import { ensureCartGroup, getCartGroup } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const labels: string[] = Array.isArray(body.seats) ? body.seats.map(String) : [];
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, id) });
  if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });
  const group = await ensureCartGroup(id);
  try {
    const r = await holdSeats(id, labels.map((l) => `${show.screenId}:${l}`), group);
    return NextResponse.json({ ok: true, expiresAt: r.expiresAt });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, code: e.code, seats: e.seats.map((s) => s.slice(s.indexOf(":") + 1)) }, { status: 409 });
    throw e;
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getCartGroup(id);
  if (group) await releaseHolds(group);
  return NextResponse.json({ ok: true });
}
