import Link from "next/link";
import { Footer, Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { nowShowing } from "@/lib/queries";
import { runtime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const movies = await nowShowing();
  return (
    <>
      <Header />
      <main className="container-x flex-1 pb-8">
        <section className="fade-up pt-8 sm:pt-12">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">PVR Phoenix MarketCity · Chennai</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Pick a seat. <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">See the screen</span> before you pay.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">Every seat on the map opens a 3D view from exactly that spot, scored for sightline, so you never end up in the neck-ache row again.</p>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold">Now showing</h2>
            <span className="text-xs text-muted">{movies.length} films</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {movies.map((m, i) => (
              <Link key={m.id} href={`/movies/${m.slug}`} className="group fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <Poster movie={m} className="transition-transform duration-200 group-hover:-translate-y-1" />
                <div className="mt-3">
                  <div className="font-semibold leading-tight">{m.title}</div>
                  <div className="mt-1 text-xs text-muted">{m.language} · {m.certificate} · {runtime(m.runtimeMin)}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-prime">★ {m.rating.toFixed(1)}</span>
                    <span className="text-muted">{m.genre}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
