import { bookingFull } from "@/lib/queries";

export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const t = new URL(req.url).searchParams.get("t");
  const b = await bookingFull(bookingId);
  if (!b || b.qrToken !== t) return new Response("Not found", { status: 404 });
  const dt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plotopia//Tickets//EN", "BEGIN:VEVENT", `UID:${b.id}@plotopia`, `DTSTAMP:${dt(Date.now())}`, `DTSTART:${dt(b.show.startsAt)}`, `DTEND:${dt(b.show.endsAt)}`, `SUMMARY:${b.show.movie.title} · ${b.show.screen.name}`, `DESCRIPTION:Seats ${b.seatLabels.join(", ")} · Booking ${b.id}`, `LOCATION:${b.show.screen.cinema.name}, ${b.show.screen.cinema.address}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${b.id}.ics"` } });
}
