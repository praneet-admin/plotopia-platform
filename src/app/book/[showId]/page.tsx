import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SeatPicker } from "@/components/SeatPicker";
import { MAX_SEATS_PER_BOOKING, seatStatus } from "@/lib/booking";
import { getCartGroup } from "@/lib/cart";
import { fmtDateTime, runtime } from "@/lib/format";
import { showWithSeats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BookPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ expired?: string }> }) {
  const { showId } = await params;
  const { expired } = await searchParams;
  const data = await showWithSeats(showId);
  if (!data) notFound();
  const { show, seats } = data;
  if (show.status !== "scheduled" || show.startsAt < Date.now() - 20 * 60_000) redirect(`/movies/${show.movie.slug}`);
  const group = (await getCartGroup(showId)) ?? undefined;
  const st = await seatStatus(showId, group);
  const strip = (x: string) => x.slice(x.indexOf(":") + 1);
  const initial = { sold: st.sold.map(strip), held: st.held.map(strip), mine: st.mine.map(strip), myExpiresAt: st.myExpiresAt };

  return (
    <>
      <Header />
      <main className="container-x relative flex-1">
        <div className="beam" aria-hidden />
        <div className="relative mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/movies/${show.movie.slug}`} className="text-sm text-muted hover:text-text">{show.movie.title}</Link>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">Choose your seats</h1>
            <div className="mt-1 text-sm text-muted">{show.screen.name}, {show.screen.cinema.name}. {fmtDateTime(show.startsAt)}, {show.format}, {runtime(show.movie.runtimeMin)}.</div>
          </div>
        </div>
        {expired && <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-amber-100">Your 8-minute seat hold expired, so the seats were released. Pick again.</div>}
        <div className="mt-6">
          <SeatPicker showId={show.id} hallId={show.screen.layout.simId ?? show.screen.id} layout={show.screen.layout} seats={seats.map((s) => ({ label: s.label, row: s.row, rowIndex: s.rowIndex, num: s.num, category: s.category, aisleAfter: s.aisleAfter }))} prices={show.prices} initial={initial} maxSeats={MAX_SEATS_PER_BOOKING} />
        </div>
      </main>
    </>
  );
}
