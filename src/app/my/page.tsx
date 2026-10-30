import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { Empty } from "@/components/ui";
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
    <Link href={`/tickets/${b.id}`} className="card flex items-center gap-4 p-4 hover:border-brand/60">
      <div className="h-14 w-10 flex-none rounded-md" style={{ background: `linear-gradient(160deg, ${b.show.movie.accent2}, ${b.show.movie.accent})` }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{b.show.movie.title}</div>
        <div className="text-xs text-muted">{fmtDateTime(b.show.startsAt)} · {b.show.screen.name.split(" ·")[0]} · {b.seatLabels.join(", ")}</div>
        <div className="mt-1 text-xs"><span className="font-mono text-muted">{b.id}</span> · <span className={b.status === "confirmed" ? "text-ok" : "text-muted"}>{b.status}</span></div>
      </div>
      <div className="num text-sm font-semibold">{inr(b.total)}</div>
    </Link>
  );

  return (
    <>
      <Header />
      <main className="container-x flex-1">
        <div className="mt-6 flex items-center justify-between sm:mt-10">
          <div><h1 className="text-2xl font-bold">My bookings</h1><div className="text-sm text-muted">{customer.name} · +91 {customer.phone}</div></div>
          <form action={logout}><button className="btn btn-ghost btn-sm">Sign out</button></form>
        </div>
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Upcoming</h2>
        <div className="mt-2 space-y-2">{upcoming.length ? upcoming.map((b) => <Row key={b.id} b={b} />) : <Empty title="No upcoming shows" hint="Book something good." action={{ href: "/", label: "Browse movies" }} />}</div>
        {past.length > 0 && (<><h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Past &amp; cancelled</h2><div className="mt-2 space-y-2">{past.map((b) => <Row key={b.id} b={b} />)}</div></>)}
      </main>
      <Footer />
    </>
  );
}
