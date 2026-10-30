import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:data/show.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __showClient?: ReturnType<typeof createClient> };
const client = globalForDb.__showClient ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__showClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
