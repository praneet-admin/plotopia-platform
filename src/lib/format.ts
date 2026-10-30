export const TZ = "Asia/Kolkata";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}
export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(ms).toLocaleDateString("en-IN", { ...opts, timeZone: TZ });
}
export function fmtDateTime(ms: number) {
  return `${fmtDate(ms)}, ${fmtTime(ms)}`;
}
/** YYYY-MM-DD in theatre local time. */
export function dayKey(ms: number) {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
/** Start of a YYYY-MM-DD day in theatre local time, as epoch ms. */
export function dayStart(key: string) {
  // IST has no DST: fixed +05:30.
  return Date.parse(`${key}T00:00:00+05:30`);
}
export function hourOf(ms: number) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(ms)));
}
export function isWeekend(ms: number) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(ms));
  return wd === "Sat" || wd === "Sun";
}
export function runtime(min: number) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
