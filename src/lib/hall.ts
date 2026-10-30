import type { HallLayout } from "@/db/schema";

/**
 * Port of the simulator's halls.js so seat ids (G7, K12...) match exactly what
 * https://praneet-admin.github.io/show/ expects in its URL hash.
 */
export const CATEGORIES: Record<string, { name: string; css: string; pitch: number }> = {
  classic: { name: "Classic", css: "#5ec8ff", pitch: 0.56 },
  prime: { name: "Prime", css: "#f5c451", pitch: 0.56 },
  recliner: { name: "Recliner", css: "#c58bff", pitch: 0.76 },
};
export const CATEGORY_ORDER = ["classic", "prime", "recliner"] as const;

export function categoryOf(h: HallLayout, rowLetter: string) {
  for (const [letters, cat] of h.bands) if (letters.includes(rowLetter)) return cat;
  return "prime";
}

export type LayoutSeat = {
  id: string; // label, e.g. G7
  row: string;
  r: number;
  num: number;
  x: number;
  cat: string;
  aisleAfter: boolean;
};

export function layoutSeats(h: HallLayout): LayoutSeat[] {
  const out: LayoutSeat[] = [];
  [...h.rows].forEach((row, r) => {
    const catId = categoryOf(h, row);
    const cat = CATEGORIES[catId] ?? CATEGORIES.prime;
    const stagger = r % 2 ? cat.pitch * 0.4 : 0;
    const perSide = catId === "recliner" ? Math.round(h.perSide * 0.75) : h.perSide;
    const rowSeats: LayoutSeat[] = [];
    for (let side = -1; side <= 1; side += 2)
      for (let i = 0; i < perSide; i++)
        rowSeats.push({ id: "", row, r, num: 0, x: side * (h.aisle / 2 + cat.pitch * (i + 0.5)) + stagger, cat: catId, aisleAfter: false });
    rowSeats
      .sort((a, b) => a.x - b.x)
      .forEach((s, i) => {
        s.num = i + 1;
        s.id = row + (i + 1);
        s.aisleAfter = i === perSide - 1;
        out.push(s);
      });
  });
  return out;
}

/** The exact object shape the simulator's halls.js expects (functions omitted). */
export function toSimulatorJson(h: HallLayout) {
  const { basePrices: _bp, ...rest } = h;
  void _bp;
  return rest;
}

export const SIMULATOR_URL = process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "https://praneet-admin.github.io/show/";

export function simulatorLink(hallId: string, seatLabel: string, view: "seat" | "overview" = "seat") {
  return `${SIMULATOR_URL}#hall=${encodeURIComponent(hallId)}&seat=${encodeURIComponent(seatLabel)}&view=${view}`;
}

export function validateLayout(h: Partial<HallLayout>): string[] {
  const errs: string[] = [];
  if (!h.id || !/^[a-z0-9_-]+$/i.test(h.id)) errs.push("id must be letters/numbers only");
  if (!h.name) errs.push("name is required");
  if (!h.rows || !/^[A-Z]+$/.test(h.rows) || new Set(h.rows).size !== h.rows.length) errs.push("rows must be unique capital letters, front to back");
  if (!h.perSide || h.perSide < 1 || h.perSide > 30) errs.push("perSide must be 1-30");
  for (const k of ["screenW", "screenBottom", "aspect", "firstRowZ", "rowPitch", "riser", "hallW", "hallH", "aisle"] as const)
    if (typeof h[k] !== "number" || !(h[k] as number >= 0)) errs.push(`${k} must be a number`);
  if (typeof h.flatRows !== "number" || h.flatRows < 0) errs.push("flatRows must be 0 or more");
  if (!Array.isArray(h.bands) || h.bands.length === 0) errs.push("at least one band is required");
  else {
    const covered = new Set<string>();
    for (const b of h.bands) {
      if (!Array.isArray(b) || b.length !== 2 || !CATEGORIES[b[1]]) errs.push("each band is [rows, category]");
      else for (const ch of b[0]) covered.add(ch);
    }
    for (const ch of h.rows ?? "") if (!covered.has(ch)) errs.push(`row ${ch} is not in any band`);
  }
  return errs;
}
