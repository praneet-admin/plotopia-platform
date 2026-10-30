import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { token } from "./ids";

export const ROLES = ["admin", "manager", "boxoffice", "usher"] as const;
export type Role = (typeof ROLES)[number];

export { hashPassword, verifyPassword } from "./auth-core";

const STAFF_COOKIE = "show_staff";
const CUST_COOKIE = "show_customer";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

async function createSession(kind: "staff" | "customer", subjectId: string, cookieName: string) {
  const id = token();
  await db.insert(schema.sessions).values({ id, kind, subjectId, expiresAt: Date.now() + SESSION_MS });
  (await cookies()).set(cookieName, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MS / 1000, secure: process.env.NODE_ENV === "production" });
}
async function readSession(kind: "staff" | "customer", cookieName: string) {
  const id = (await cookies()).get(cookieName)?.value;
  if (!id) return null;
  const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!s || s.kind !== kind || s.expiresAt < Date.now()) return null;
  return s;
}
async function destroySession(cookieName: string) {
  const jar = await cookies();
  const id = jar.get(cookieName)?.value;
  if (id) await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  jar.delete(cookieName);
}

export const staffLogin = (id: string) => createSession("staff", id, STAFF_COOKIE);
export const staffLogout = () => destroySession(STAFF_COOKIE);
export async function currentStaff() {
  const s = await readSession("staff", STAFF_COOKIE);
  if (!s) return null;
  const u = await db.query.staff.findFirst({ where: eq(schema.staff.id, s.subjectId) });
  return u && u.active ? u : null;
}

export const customerLogin = (id: string) => createSession("customer", id, CUST_COOKIE);
export const customerLogout = () => destroySession(CUST_COOKIE);
export async function currentCustomer() {
  const s = await readSession("customer", CUST_COOKIE);
  if (!s) return null;
  return (await db.query.customers.findFirst({ where: eq(schema.customers.id, s.subjectId) })) ?? null;
}

/** Role hierarchy: admin > manager > boxoffice/usher. */
export function can(role: string, need: Role | Role[]) {
  const needs = Array.isArray(need) ? need : [need];
  if (role === "admin") return true;
  if (role === "manager") return !needs.includes("admin");
  return needs.includes(role as Role);
}
