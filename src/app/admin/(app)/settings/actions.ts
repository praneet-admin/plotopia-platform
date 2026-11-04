"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { diffOf, logActivity } from "@/lib/activity";
import { DEFAULTS, saveSection, SECTIONS, type SectionKey } from "@/lib/settings";
import { fileToDataUrl } from "@/lib/upload";
import { FIELDS } from "./fields";

/** Parse a tab's form against its field spec; unknown keys are ignored. */
export async function saveSettings(tab: string, fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  if (!SECTIONS.includes(tab as SectionKey)) redirect("/admin/settings");
  const key = tab as SectionKey;
  const patch: Record<string, unknown> = {};
  try {
    for (const f of FIELDS[key]) {
      const raw = fd.get(f.key);
      switch (f.type) {
        case "bool": patch[f.key] = fd.get(f.key) === "on"; break;
        case "number": { const n = Number(raw); if (!Number.isFinite(n)) throw new Error(`${f.label} must be a number`); patch[f.key] = Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n)); break; }
        case "list": patch[f.key] = String(raw ?? "").split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean); break;
        case "image": { const up = await fileToDataUrl(fd.get(`${f.key}_file`), 400 * 1024); patch[f.key] = fd.get(`${f.key}_clear`) === "on" ? "" : up ?? String(raw ?? "").trim(); break; }
        case "color": { const v = String(raw ?? "").trim(); if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${f.label} must be a hex colour like #ffc20e`); patch[f.key] = v.toLowerCase(); break; }
        case "featured": {
          const entries = [...fd.entries()].filter(([k]) => k.startsWith("featured_")).map(([k, v]) => [k.slice(9), Number(v)] as const).filter(([, n]) => Number.isFinite(n) && n > 0);
          patch[f.key] = entries.sort((a, b) => a[1] - b[1]).map(([id]) => id);
          break;
        }
        default: patch[f.key] = String(raw ?? "").trim();
      }
    }
  } catch (e) {
    redirect(`/admin/settings/${tab}?error=${encodeURIComponent((e as Error).message)}`);
  }
  const { before, after } = await saveSection(key, patch as never, me.id);
  const diff = diffOf(before as Record<string, unknown>, after as Record<string, unknown>);
  // Don't put megabytes of base64 into the audit log.
  if (diff) for (const k of Object.keys(diff)) diff[k] = diff[k].map((v) => (typeof v === "string" && v.startsWith("data:") ? `(uploaded image, ${Math.round(v.length / 1024)} KB)` : v)) as [unknown, unknown];
  if (diff) await logActivity(me, "settings", "settings", key, `${Object.keys(diff).length} ${key} setting${Object.keys(diff).length === 1 ? "" : "s"} changed: ${Object.keys(diff).join(", ")}`, diff);
  redirect(`/admin/settings/${tab}?ok=${encodeURIComponent(diff ? "Saved. The site shows this now." : "No changes.")}`);
}

export async function resetSettings(tab: string) {
  const me = await requireStaff("admin");
  if (!SECTIONS.includes(tab as SectionKey)) redirect("/admin/settings");
  const key = tab as SectionKey;
  const { before } = await saveSection(key, DEFAULTS[key] as never, me.id);
  await logActivity(me, "settings", "settings", key, `${key} settings reset to defaults`, diffOf(before as Record<string, unknown>, DEFAULTS[key] as Record<string, unknown>));
  redirect(`/admin/settings/${tab}?ok=Reset+to+defaults`);
}

export async function saveCinema(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const id = g("id") || g("name").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const row = { name: g("name"), city: g("city"), address: g("address"), phone: g("phone") || null, mapUrl: g("mapUrl") || null, hours: g("hours") || null };
  if (!row.name || !id) redirect("/admin/settings/cinema?error=Name+is+required");
  const cur = await db.query.cinemas.findFirst({ where: eq(schema.cinemas.id, id) });
  if (cur) {
    await db.update(schema.cinemas).set(row).where(eq(schema.cinemas.id, id));
    await logActivity(me, "update", "cinema", id, `Theatre ${row.name} updated`, diffOf(cur, { ...cur, ...row }));
  } else {
    await db.insert(schema.cinemas).values({ id, ...row });
    await logActivity(me, "create", "cinema", id, `Theatre ${row.name} added`);
  }
  redirect("/admin/settings/cinema?ok=Theatre+saved");
}

export async function deleteCinema(fd: FormData) {
  const me = await requireStaff("admin");
  const id = String(fd.get("id") ?? "");
  const screens = await db.query.screens.findMany({ where: eq(schema.screens.cinemaId, id) });
  if (screens.length) redirect(`/admin/settings/cinema?error=${encodeURIComponent(`Move or delete its ${screens.length} hall(s) first`)}`);
  const cur = await db.query.cinemas.findFirst({ where: eq(schema.cinemas.id, id) });
  if (cur) { await db.delete(schema.cinemas).where(eq(schema.cinemas.id, id)); await logActivity(me, "delete", "cinema", id, `Theatre ${cur.name} deleted`); }
  redirect("/admin/settings/cinema?ok=Theatre+deleted");
}

/** Which simulator hall each screen opens in 3D (the simulator ships audi3, audi1 and imax). */
export async function saveHallMap(fd: FormData) {
  const me = await requireStaff(["admin", "manager"]);
  const screens = await db.query.screens.findMany();
  const changed: string[] = [];
  for (const s of screens) {
    const simId = String(fd.get(`sim_${s.id}`) ?? "").trim() || undefined;
    if ((s.layout.simId ?? undefined) === simId) continue;
    await db.update(schema.screens).set({ layout: { ...s.layout, simId } }).where(eq(schema.screens.id, s.id));
    changed.push(`${s.name} → ${simId ?? s.id}`);
  }
  if (changed.length) await logActivity(me, "update", "hall", null, `Simulator hall mapping: ${changed.join("; ")}`);
  redirect(`/admin/settings/simulator?ok=${encodeURIComponent(changed.length ? "Hall mapping saved" : "No changes")}`);
}
