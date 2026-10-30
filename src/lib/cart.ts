import "server-only";
import { cookies } from "next/headers";
import { token } from "./ids";

export const cartCookie = (showId: string) => `cart_${showId.replace(/[^a-z0-9]/gi, "_")}`;

export async function getCartGroup(showId: string) {
  return (await cookies()).get(cartCookie(showId))?.value ?? null;
}
export async function ensureCartGroup(showId: string) {
  const jar = await cookies();
  const existing = jar.get(cartCookie(showId))?.value;
  if (existing) return existing;
  const g = token(16);
  jar.set(cartCookie(showId), g, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 3 });
  return g;
}
