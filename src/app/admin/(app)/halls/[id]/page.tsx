import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { HallLayout } from "@/db/schema";
import { requireStaff } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
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
  const [cinemas, blocked] = await Promise.all([db.query.cinemas.findMany({ orderBy: asc(schema.cinemas.name) }), screen ? db.query.seats.findMany({ where: and(eq(schema.seats.screenId, screen.id), eq(schema.seats.blocked, true)) }) : []]);

  async function save(layoutJson: string) {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
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
      await logActivity(me, "create", "hall", layout.id, `Hall “${layout.name}” created with ${rows.length} seats`);
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
    await logActivity(me, "update", "hall", id, `Hall “${layout.name}” saved${same ? "" : ` (seat map regenerated, ${rows.length} seats)`}`, { name: [cur.name, layout.name], basePrices: [cur.layout.basePrices, layout.basePrices], rows: [cur.layout.rows, layout.rows], bands: [cur.layout.bands, layout.bands] });
    redirect(`/admin/halls/${id}?ok=${encodeURIComponent(same ? "Saved." : "Saved and seat map regenerated (" + rows.length + " seats).")}`);
  }

  async function meta(fd: FormData) {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    const cinemaId = String(fd.get("cinemaId") ?? "");
    const labels = String(fd.get("blocked") ?? "").toUpperCase().split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const cur = (await db.query.screens.findFirst({ where: eq(schema.screens.id, id) }))!;
    if (cinemaId && cinemaId !== cur.cinemaId) {
      if (!(await db.query.cinemas.findFirst({ where: eq(schema.cinemas.id, cinemaId) }))) redirect(`/admin/halls/${id}?error=Unknown+theatre`);
      await db.update(schema.screens).set({ cinemaId }).where(eq(schema.screens.id, id));
    }
    const seats = await db.query.seats.findMany({ where: eq(schema.seats.screenId, id) });
    const unknown = labels.filter((l) => !seats.some((s) => s.label === l));
    if (unknown.length) redirect(`/admin/halls/${id}?error=${encodeURIComponent(`No such seat: ${unknown.join(", ")}`)}`);
    const was = seats.filter((s) => s.blocked).map((s) => s.label).sort();
    await db.update(schema.seats).set({ blocked: false }).where(eq(schema.seats.screenId, id));
    for (const l of labels) await db.update(schema.seats).set({ blocked: true }).where(eq(schema.seats.id, `${id}:${l}`));
    await logActivity(me, "update", "hall", id, `Hall “${cur.name}”: theatre and blocked seats saved`, { cinemaId: [cur.cinemaId, cinemaId || cur.cinemaId], blockedSeats: [was, [...labels].sort()] });
    redirect(`/admin/halls/${id}?ok=Saved`);
  }
  async function remove() {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    const upcoming = await db.query.shows.findFirst({ where: and(eq(schema.shows.screenId, id), eq(schema.shows.status, "scheduled"), isNull(schema.shows.deletedAt), gt(schema.shows.endsAt, Date.now())) });
    if (upcoming) redirect(`/admin/halls/${id}?error=${encodeURIComponent("Cancel this hall's upcoming shows first.")}`);
    await db.update(schema.screens).set({ deletedAt: Date.now() }).where(eq(schema.screens.id, id));
    await logActivity(me, "delete", "hall", id, `Hall “${screen!.name}” deleted (restorable)`);
    redirect("/admin/halls?ok=Hall+deleted");
  }
  async function restore() {
    "use server";
    const me = await requireStaff(["admin", "manager"]);
    await db.update(schema.screens).set({ deletedAt: null }).where(eq(schema.screens.id, id));
    await logActivity(me, "restore", "hall", id, `Hall “${screen!.name}” restored`);
    redirect(`/admin/halls/${id}?ok=Restored`);
  }

  return (
    <div className="space-y-4">
      <div><Link href="/admin/halls" className="text-xs text-muted hover:text-text">← Halls</Link><h1 className="text-2xl font-bold">{isNew ? "New hall" : screen!.name}{screen?.deletedAt && <span className="pill ml-2 align-middle text-[10px] text-bad">DELETED</span>}</h1><div className="text-sm text-muted">All distances in metres, as in the simulator. Rows are listed front to back.</div></div>
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}
      {sp.error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{sp.error}</div>}
      {screen && (
        <form action={meta} className="card grid gap-3 p-4 text-sm sm:grid-cols-[220px_1fr_auto]">
          <div><label className="label" htmlFor="cinemaId">Theatre</label><select id="cinemaId" name="cinemaId" defaultValue={screen.cinemaId} className="input h-10">{cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="blocked">Blocked seats</label><input id="blocked" name="blocked" defaultValue={blocked.map((b) => b.label).join(", ")} className="input h-10 font-mono" placeholder="A1, A2, K14" /><p className="mt-1 text-[11px] text-muted">Never sold: broken seats, wheelchair bays, projector line. Shown as unavailable everywhere.</p></div>
          <div className="flex items-end gap-2"><button className="btn btn-primary btn-sm h-10">Save</button>{screen.deletedAt ? <button formAction={restore} formNoValidate className="btn btn-ghost btn-sm h-10">Restore hall</button> : <button formAction={remove} formNoValidate className="btn btn-danger btn-sm h-10">Delete hall</button>}</div>
        </form>
      )}
      {locked && <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">Upcoming shows on this hall have sold tickets, so the seat layout is locked. Name, screen geometry and base prices can still change.</div>}
      <HallEditor initial={screen?.layout ?? BLANK} isNew={isNew} save={save} />
    </div>
  );
}
