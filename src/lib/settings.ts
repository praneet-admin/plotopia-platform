import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Everything the public site and the booking flow show that is not a record of
 * its own (film, show, hall...) lives here, one JSON document per section, and
 * is edited in /admin/settings. Defaults below are what a fresh database shows.
 */
export const DEFAULTS = {
  brand: {
    siteName: "Plotopia",
    tagline: "Movie tickets",
    description: "Book movie tickets and see the screen from your seat before you pay.",
    logoUrl: "", // mark (square). Empty = the bundled /brand/mark.png
    wordmarkUrl: "", // wide wordmark. Empty = bundled /brand/wordmark-white.png
    faviconUrl: "",
    accent: "#ffc20e",
    footerText: "Plotopia, Chennai. Demo build, no real payments.",
    showStaffLink: true,
  },
  cinema: {
    city: "Chennai",
    supportEmail: "help@plotopia.demo",
    supportPhone: "",
    whatsapp: "",
  },
  home: {
    heading: "Movies in {city}",
    subheading: "",
    heroImageUrl: "",
    promoText: "",
    promoLink: "",
    featured: [] as string[], // movie ids, in order, shown first
    showFilters: true,
    showPlayingAt: true,
    showTheatresLink: true,
    showComingSoon: false,
  },
  booking: {
    holdMinutes: 8,
    maxSeats: 10,
    feePerTicket: 30,
    gstPct: 0,
    closeMinutesAfterStart: 20,
    gateOpensHoursBefore: 3,
    fullRefundHours: 24,
    partialRefundHours: 2,
    partialRefundPct: 50,
    allowOnline: true,
    allowCounterCash: true,
    policyText: "Full refund up to {fullHours}h before the show, {partialPct}% up to {partialHours}h before, none after that.",
  },
  payment: {
    upiId: "nightriderpraneet@okaxis",
    payeeName: "Plotopia",
    apps: ["Google Pay", "PhonePe", "Paytm", "BHIM"],
    testMode: true,
    title: "Pay with UPI",
    instructions: "Scan the QR with any UPI app or tap Google Pay, then come back and tap \"I've paid\".",
    testModeNote: "Test mode: there is no bank callback, so \"I've paid\" is the confirmation. Confirmations are idempotent, so a double tap never books twice.",
  },
  messages: {
    confirmation: "Hi {name}, your tickets are confirmed!\n{title} · {screen}\n{time}\nSeats {seats} · Paid {total}\nBooking {id}. Show this QR at the gate: {link}",
    confirmationSms: "{site}: {title}, {time}, seats {seats}. Ticket: {link}",
    cancellation: "Your booking {id} for {title} ({time}) is cancelled. {refundLine}",
    refundLine: "Refund of {refund} will reach your original payment method in 5-7 days.",
    noRefundLine: "No refund applies under the cancellation policy.",
    reminder: "Reminder from {site}: {title} starts at {time} in {screen}. Seats {seats}. Gates open {gateHours}h before. Ticket: {link}",
  },
  simulator: {
    url: "https://praneet-admin.github.io/plotopia/",
    screenImageUrl: "", // sent to the simulator as the hall screen image; empty = the simulator's own
    showSeatPreview: true, // "view" links from checkout and tickets
    sendCast: true,
  },
};

export type Settings = typeof DEFAULTS;
export type SectionKey = keyof Settings;
export const SECTIONS = Object.keys(DEFAULTS) as SectionKey[];

type Cache = { at: number; value: Settings } | null;
const g = globalThis as unknown as { __plotopiaSettings?: Cache };
const TTL = 3_000;

function merge<K extends SectionKey>(k: K, raw: unknown): Settings[K] {
  const base = DEFAULTS[k] as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  if (raw && typeof raw === "object") for (const [key, v] of Object.entries(raw as Record<string, unknown>)) if (key in base && v !== undefined && v !== null) out[key] = v;
  return out as Settings[K];
}

export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (g.__plotopiaSettings && now - g.__plotopiaSettings.at < TTL) return g.__plotopiaSettings.value;
  const rows = await db.query.settings.findMany();
  const value = {} as Settings;
  for (const k of SECTIONS) (value as Record<string, unknown>)[k] = merge(k, rows.find((r) => r.key === k)?.value);
  g.__plotopiaSettings = { at: now, value };
  return value;
}

export async function getSection<K extends SectionKey>(k: K): Promise<Settings[K]> {
  return (await getSettings())[k];
}

export async function saveSection<K extends SectionKey>(k: K, patch: Partial<Settings[K]>, staffId: string | null) {
  const cur = await getSection(k);
  const next = merge(k, { ...cur, ...patch });
  const now = Date.now();
  await db.insert(schema.settings).values({ key: k, value: next, updatedBy: staffId, updatedAt: now }).onConflictDoUpdate({ target: schema.settings.key, set: { value: next, updatedBy: staffId, updatedAt: now } });
  g.__plotopiaSettings = null;
  return { before: cur, after: next };
}

export async function settingsMeta() {
  const rows = await db.query.settings.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, { updatedBy: r.updatedBy, updatedAt: r.updatedAt }])) as Partial<Record<SectionKey, { updatedBy: string | null; updatedAt: number }>>;
}

/** `{name}`-style placeholders. Unknown keys are left as they are. */
export function fill(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Refund policy from the booking settings: full → partial → none, by hours before the show. */
export function refundPolicy(b: Settings["booking"], total: number, startsAt: number, now = Date.now()) {
  const hrs = (startsAt - now) / 3_600_000;
  if (hrs >= b.fullRefundHours) return { pct: 100, amount: total };
  if (hrs >= b.partialRefundHours && b.partialRefundPct > 0) return { pct: b.partialRefundPct, amount: Math.round((total * b.partialRefundPct) / 100) };
  return { pct: 0, amount: 0 };
}

export function policyText(b: Settings["booking"]) {
  return fill(b.policyText, { fullHours: b.fullRefundHours, partialHours: b.partialRefundHours, partialPct: b.partialRefundPct });
}

/** Per-ticket charges on top of the seat price. */
export function ticketCharges(b: Settings["booking"], subtotal: number, seats: number, channel: "online" | "counter") {
  const fee = channel === "counter" ? 0 : Math.round(b.feePerTicket * seats);
  const gst = Math.round(((subtotal + fee) * b.gstPct) / 100);
  return { fee: fee + gst, feeOnly: fee, gst };
}
