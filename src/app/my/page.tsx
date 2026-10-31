import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { Empty } from "@/components/ui";
import { Poster } from "@/components/Poster";
import { currentCustomer, customerLogout } from "@/lib/auth";
import { fmtDateTime, inr } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const customer = await currentCustomer();
  if (!customer) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const list = await db.query.bookings.findMany({ where: eq(schema.bookings.customerId, customer.id), with: { show: { with: { movie: true, screen: true } } }, orderBy: desc(schema.bookings.createdAt) });
  const now = Date.now();
  const upcoming = list.filter((b) => b.show.startsAt >= now && b.status === "confirmed");
  const past = list.filter((b) => !(b.show.startsAt >= now && b.status === "confirmed"));
  async function logout() { "use server"; await customerLogout(); redirect("/"); }

  const Row = ({ b }: { b: (typeof list)[number] }) => (
    <Link href={`/tickets/${b.id}`} className="group flex items-center gap-4 py-4 hover:bg-panel/60 sm:px-2">
      <Poster movie={b.show.movie} className="w-12 flex-none" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{b.show.movie.title}</div>
        <div className="text-xs text-muted">{fmtDateTime(b.show.startsAt)} · {b.show.screen.name.split(" ·")[0]} · {b.seatLabels.join(", ")}</div>
        <div className="mt-1 text-xs"><span className="font-mono text-muted">{b.id}</span> <span className={b.status === "confirmed" ? "text-ok" : "text-muted"}>{b.status}</span></div>
      </div>
      <div className="num text-sm font-semibold">{inr(b.total)}</div>
    </Link>
  );

  return (
    <>
      <Header />
      <main className="container-x flex-1">
        <div className="mt-6 flex items-center justify-between sm:mt-10">
          <div><h1 className="text-3xl font-extrabold tracking-tight">My tickets</h1><div className="text-sm text-muted">{customer.name} · +91 {customer.phone}</div></div>
          <form action={logout}><button className="btn btn-ghost btn-sm">Sign out</button></form>
        </div>
        <h2 className="mt-8 text-lg font-bold tracking-tight">Upcoming</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">{upcoming.length ? upcoming.map((b) => <Row key={b.id} b={b} />) : <Empty title="No upcoming shows" hint="Book something good." action={{ href: "/", label: "Browse movies" }} />}</div>
        {past.length > 0 && (<><h2 className="mt-10 text-lg font-bold tracking-tight">Past and cancelled</h2><div className="mt-2 divide-y divide-line border-y border-line">{past.map((b) => <Row key={b.id} b={b} />)}</div></>)}
      </main>
      <Footer />
    </>
  );
}
