import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { uuid } from "./ids";

type Who = { id: string | null; name: string };

/** Shallow diff of two records: only keys whose JSON differs, as [before, after]. */
export function diffOf(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const out: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const a = before?.[k], b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a ?? null, b ?? null];
  }
  return Object.keys(out).length ? out : null;
}

export async function logActivity(who: Who, action: string, entity: string, entityId: string | null, summary: string, diff?: Record<string, [unknown, unknown]> | null) {
  await db.insert(schema.activity).values({ id: uuid(), staffId: who.id, staffName: who.name, action, entity, entityId, summary, diff: diff ?? null, createdAt: Date.now() });
}

export function recentActivity(limit = 100) {
  return db.query.activity.findMany({ orderBy: desc(schema.activity.createdAt), limit });
}
