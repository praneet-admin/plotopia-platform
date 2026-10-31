import Link from "next/link";
import { Footer, Header } from "@/components/Header";
import { browseMovies, listCinemas } from "@/lib/browse";
import { dayKey } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Theatres() {
  const cinemas = await listCinemas();
  const all = await browseMovies({ day: dayKey(Date.now()) });
  return (
    <>
      <Header />
      <main className="container-x flex-1 pb-10">
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:mt-8 sm:text-3xl">Theatres in Chennai</h1>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {cinemas.map((c) => {
            const playing = all.filter((m) => m.cinemaIds.includes(c.id));
            return (
              <li key={c.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">{c.name}</div>
                  <div className="mt-0.5 text-sm text-muted">{c.address}</div>
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
