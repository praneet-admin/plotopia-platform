import Link from "next/link";
import { notFound } from "next/navigation";
import { CounterPicker } from "./picker";
import { requireStaff } from "@/lib/admin";
import { MAX_SEATS_PER_BOOKING, seatStatus } from "@/lib/booking";
import { getCartGroup } from "@/lib/cart";
import { fmtDateTime } from "@/lib/format";
import { showWithSeats } from "@/lib/queries";

export default async function CounterSeats({ params }: { params: Promise<{ showId: string }> }) {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const { showId } = await params;
  const data = await showWithSeats(showId);
  if (!data) notFound();
  const { show, seats } = data;
  const st = await seatStatus(showId, (await getCartGroup(showId)) ?? undefined);
  const strip = (x: string) => x.slice(x.indexOf(":") + 1);
  return (
    <div>
      <Link href="/admin/counter" className="text-xs text-muted hover:text-text">← Shows</Link>
      <h1 className="mt-1 text-xl font-bold">{show.movie.title} · {show.screen.name}</h1>
      <div className="text-sm text-muted">{fmtDateTime(show.startsAt)} · counter sale</div>
      <div className="mt-5">
        <CounterPicker showId={show.id} hallId={show.screen.id} layout={show.screen.layout} seats={seats.map((s) => ({ label: s.label, row: s.row, rowIndex: s.rowIndex, num: s.num, category: s.category, aisleAfter: s.aisleAfter }))} prices={show.prices} initial={{ sold: st.sold.map(strip), held: st.held.map(strip), mine: st.mine.map(strip), myExpiresAt: st.myExpiresAt }} maxSeats={MAX_SEATS_PER_BOOKING} />
      </div>
    </div>
  );
}
