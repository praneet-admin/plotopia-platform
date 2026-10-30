import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { checkIn } from "@/lib/booking";
import { fmtTime } from "@/lib/format";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  let code = String(body.code ?? "").trim();
  code = code.replace(/^(PLOTOPIA|SHOW):/, "");
  // Allow typing a booking id at the gate as a fallback.
  if (/^(PLT|SHW)-[A-Z0-9]{6}$/i.test(code)) {
    const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, code.toUpperCase()) });
    if (!b) return NextResponse.json({ ok: false, reason: "Unknown booking id" });
    code = b.qrToken;
  }
  const r = await checkIn(code);
  const b = r.booking ? { id: r.booking.id, seats: r.booking.seatLabels, status: r.booking.status } : null;
  const s = r.show ? { title: r.show.movie.title, screen: r.show.screen.name, time: fmtTime(r.show.startsAt), startsAt: r.show.startsAt } : null;
  return NextResponse.json({ ok: r.ok, reason: r.ok ? undefined : r.reason, booking: b, show: s });
}
