import { notFound, redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { HallLayout } from "@/db/schema";
import { requireStaff } from "@/lib/admin";
import { layoutSeats, validateLayout } from "@/lib/hall";
import { HallEditor } from "./editor";

const BLANK: HallLayout = { id: "", name: "", venue: "PVR Phoenix", screenW: 12, screenBottom: 1, aspect: 16 / 9, firstRowZ: 6, rowPitch: 1.1, riser: 0.3, flatRows: 1, hallW: 17, hallH: 8.5, aisle: 1.3, rows: "ABCDEFGHIJ", perSide: 8, bands: [["ABC", "classic"], ["DEFGH", "prime"], ["IJ", "recliner"]], basePrices: { classic: 180, prime: 250, recliner: 550 } };

export default async function HallEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireStaff(["admin", "manager"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const screen = isNew ? null : await db.query.screens.findFirst({ where: eq(schema.screens.id, id) });
  if (!isNew && !screen) notFound();
  const futureTickets = screen ? await db.select({ id: schema.tickets.id }).from(schema.tickets).innerJoin(schema.shows, eq(schema.tickets.showId, schema.shows.id)).where(and(eq(schema.shows.screenId, screen.id), eq(schema.tickets.active, true), gt(schema.shows.startsAt, Date.now()))).limit(1) : [];
  const locked = futureTickets.length > 0;

  async function save(layoutJson: string) {
    "use server";
    await requireStaff(["admin", "manager"]);
    let layout: HallLayout;
    try { layout = JSON.parse(layoutJson); } catch { return { error: "Invalid JSON" }; }
    const errs = validateLayout(layout);
    if (errs.length) return { error: errs.join(". ") };
    const seats = layoutSeats(layout);
    const rows = seats.map((s) => ({ id: `${layout.id}:${s.id}`, screenId: layout.id, label: s.id, row: s.row, rowIndex: s.r, num: s.num, category: s.cat, aisleAfter: s.aisleAfter }));
    if (isNew) {
      if (await db.query.screens.findFirst({ where: eq(schema.screens.id, layout.id) })) return { error: `Hall id "${layout.id}" already exists` };
      const cinema = (await db.query.cinemas.findFirst())!;
      const n = await db.query.screens.findMany();
      await db.insert(schema.screens).values({ id: layout.id, cinemaId: cinema.id, name: layout.name, layout, seatCount: rows.length, sortOrder: n.length });
      for (let i = 0; i < rows.length; i += 100) await db.insert(schema.seats).values(rows.slice(i, i + 100));
      redirect(`/admin/halls/${layout.id}?ok=${encodeURIComponent("Hall created with " + rows.length + " seats.")}`);
    }
    const cur = (await db.query.screens.findFirst({ where: eq(schema.screens.id, id) }))!;
    if (layout.id !== cur.id) return { error: "The hall id can't change once created" };
    const existing = await db.query.seats.findMany({ where: eq(schema.seats.screenId, id) });
    const same = existing.length === rows.length && existing.every((e) => { const r = rows.find((x) => x.id === e.id); return r && r.category === e.category && r.rowIndex === e.rowIndex && r.num === e.num && r.aisleAfter === e.aisleAfter; });
    if (!same) {
      const ft = await db.select({ id: schema.tickets.id }).from(schema.tickets).innerJoin(schema.shows, eq(schema.tickets.showId, schema.shows.id)).where(and(eq(schema.shows.screenId, id), eq(schema.tickets.active, true), gt(schema.shows.startsAt, Date.now()))).limit(1);
      if (ft.length) return { error: "Seats can't change while upcoming shows on this hall have sold tickets. Metadata and prices were not saved either; fix the seat fields first or cancel those shows." };
      const anyTickets = await db.select({ id: schema.tickets.id }).from(schema.tickets).innerJoin(schema.seats, eq(schema.tickets.seatId, schema.seats.id)).where(eq(schema.seats.screenId, id)).limit(1);
      if (anyTickets.length) {
        // Past tickets reference seats: keep historical seat rows, only add new ones and retag categories.
        for (const r of rows) {
          const e = existing.find((x) => x.id === r.id);
          if (e) await db.update(schema.seats).set({ category: r.category, rowIndex: r.rowIndex, num: r.num, aisleAfter: r.aisleAfter }).where(eq(schema.seats.id, r.id));
          else await db.insert(schema.seats).values(r);
        }
      } else {
        await db.delete(schema.seats).where(eq(schema.seats.screenId, id));
        for (let i = 0; i < rows.length; i += 100) await db.insert(schema.seats).values(rows.slice(i, i + 100));
      }
    }
    await db.update(schema.screens).set({ name: layout.name, layout, seatCount: rows.length }).where(eq(schema.screens.id, id));
    redirect(`/admin/halls/${id}?ok=${encodeURIComponent(same ? "Saved." : "Saved and seat map regenerated (" + rows.length + " seats).")}`);
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">{isNew ? "New hall" : screen!.name}</h1><div className="text-sm text-muted">All distances in metres, as in the simulator. Rows are listed front to back.</div></div>
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}
      {locked && <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">Upcoming shows on this hall have sold tickets, so the seat layout is locked. Name, screen geometry and base prices can still change.</div>}
      <HallEditor initial={screen?.layout ?? BLANK} isNew={isNew} save={save} />
    </div>
  );
}
