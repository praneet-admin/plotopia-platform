import { NextResponse } from "next/server";
import { seatStatus } from "@/lib/booking";
import { getCartGroup } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = (await getCartGroup(id)) ?? undefined;
  const s = await seatStatus(id, group);
  const strip = (x: string) => x.slice(x.indexOf(":") + 1);
  return NextResponse.json({ sold: s.sold.map(strip), held: s.held.map(strip), mine: s.mine.map(strip), myExpiresAt: s.myExpiresAt, now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
