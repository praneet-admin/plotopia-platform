import Link from "next/link";
import { Footer, Header } from "@/components/Header";
import { browseMovies, listCinemas } from "@/lib/browse";
import { dayKey } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Theatres() {
  const [cinemas, all, { cinema }] = await Promise.all([listCinemas(), browseMovies({ day: dayKey(Date.now()) }), getSettings()]);
  return (
    <>
      <Header />
      <main className="container-x flex-1 pb-10">
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:mt-8 sm:text-3xl">Theatres in {cinema.city}</h1>
        {(cinema.supportPhone || cinema.supportEmail) && <p className="mt-1 text-sm text-muted">Help: {[cinema.supportPhone, cinema.supportEmail].filter(Boolean).join(" · ")}</p>}
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {cinemas.map((c) => {
            const playing = all.filter((m) => m.cinemaIds.includes(c.id));
            return (
              <li key={c.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">{c.name}</div>
                  <div className="mt-0.5 text-sm text-muted">{c.address}{c.mapUrl && <> · <a className="text-brand hover:underline" href={c.mapUrl} target="_blank" rel="noreferrer">Map</a></>}</div>
                  {(c.phone || c.hours) && <div className="mt-0.5 text-sm text-muted">{[c.phone, c.hours].filter(Boolean).join(" · ")}</div>}
                  <div className="mt-1 text-sm text-muted">{playing.map((m) => m.title).join(", ") || "Nothing today"}</div>
                </div>
                <Link href={`/?cinema=${c.id}`} className="btn btn-ghost btn-sm">See movies</Link>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
