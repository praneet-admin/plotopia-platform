import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";

import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Serverless demo fallback (no hosted database configured): copy the seeded
  // SQLite file into the instance's writable temp dir on cold start. Bookings
  // and holds then live per instance and reset when it recycles: demo-grade.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmp = "/tmp/show.db";
    if (!existsSync(tmp)) {
      const seed = path.join(process.cwd(), "seed", "show.db");
      if (existsSync(seed)) copyFileSync(seed, tmp);
    }
    return `file:${tmp}`;
  }
  return "file:data/show.db";
}
const url = resolveUrl();
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (url.startsWith("file:")) { try { mkdirSync(url.slice(5).replace(/[^/]*$/, "") || ".", { recursive: true }); } catch {} }

const globalForDb = globalThis as unknown as { __showClient?: ReturnType<typeof createClient> };
// `timeout` is SQLite's busy timeout for file databases: concurrent write
// transactions queue for the lock instead of failing with SQLITE_BUSY.
const client = globalForDb.__showClient ?? createClient({ url, authToken, timeout: 10_000 });
if (process.env.NODE_ENV !== "production") globalForDb.__showClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

/**
 * Serialised write transaction. Drizzle's libSQL driver opens DEFERRED
 * transactions, so two writers that both read first can deadlock into
 * SQLITE_BUSY. All booking writes go through this queue (one writer at a time
 * per process) and retry briefly on BUSY from other processes. The unique
 * indexes on holds and tickets remain the final guarantee.
 */
let chain: Promise<unknown> = Promise.resolve();
export function writeTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.transaction(fn);
      } catch (e) {
        if (attempt < 5 && isBusy(e)) { await new Promise((r) => setTimeout(r, 40 * (attempt + 1))); continue; }
        throw e;
      }
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

/** Drizzle wraps driver errors ("Failed query") with the real one in `cause`. */
export function errorText(e: unknown): string {
  let s = "", cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) { s += " " + String((cur as Error).message ?? cur); cur = (cur as { cause?: unknown }).cause; }
  return s;
}
export const isUniqueViolation = (e: unknown) => /UNIQUE/i.test(errorText(e));
export const isBusy = (e: unknown) => /SQLITE_BUSY/.test(errorText(e));
