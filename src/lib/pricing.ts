import type { PricingRule } from "@/db/schema";
import { hourOf, isWeekend } from "./format";

/** Apply active pricing rules to a screen's base prices for a show start time. */
export function priceShow(base: Record<string, number>, rules: PricingRule[], startsAt: number, screenId: string) {
  const h = hourOf(startsAt);
  const weekend = isWeekend(startsAt);
  let mult = 1;
  for (const r of rules) {
    if (!r.active) continue;
    if (r.screenId && r.screenId !== screenId) continue;
    if (r.dayType === "weekday" && weekend) continue;
    if (r.dayType === "weekend" && !weekend) continue;
    if (h < r.fromHour || h >= r.toHour) continue;
    mult *= r.multiplier;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.round((v * mult) / 10) * 10;
  return out;
}

export const CONVENIENCE_FEE_PER_SEAT = 30;

/** Refund policy: full >24h before, 50% between 24h and 2h, none inside 2h. */
export function refundFor(total: number, startsAt: number, now = Date.now()) {
  const hrs = (startsAt - now) / 3_600_000;
  if (hrs >= 24) return { pct: 100, amount: total };
  if (hrs >= 2) return { pct: 50, amount: Math.round(total / 2) };
  return { pct: 0, amount: 0 };
}
