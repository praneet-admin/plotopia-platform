/* Seeds a realistic demo: PVR Phoenix (Chennai) with the simulator's three halls,
   three films, a week of shows, pricing rules, staff, and a spread of bookings. */
import { db, schema } from "../src/db";
import { layoutSeats } from "../src/lib/hall";
import { hashPassword } from "../src/lib/auth-core";
import { priceShow } from "../src/lib/pricing";
import { bookingCode, token, uuid } from "../src/lib/ids";
import { dayKey, dayStart } from "../src/lib/format";
import type { HallLayout } from "../src/db/schema";

const now = Date.now();
const today = dayKey(now);

const CINEMA = { id: "pvr-phoenix", name: "PVR Phoenix MarketCity", city: "Chennai", address: "Phoenix MarketCity, Velachery Main Rd, Chennai 600042" };

const HALLS: HallLayout[] = [
  {
    id: "audi3", name: "Audi 3 · Standard", venue: "PVR Phoenix",
    screenW: 12, screenBottom: 1.0, aspect: 16 / 9, firstRowZ: 6, rowPitch: 1.1, riser: 0.3, flatRows: 1,
    hallW: 17, hallH: 8.5, aisle: 1.3, rows: "ABCDEFGHIJKLM", perSide: 8,
    bands: [["ABC", "classic"], ["DEFGHIJ", "prime"], ["KLM", "recliner"]],
    basePrices: { classic: 180, prime: 250, recliner: 550 },
  },
  {
    id: "audi1", name: "Audi 1 · Large", venue: "PVR Phoenix",
    screenW: 15, screenBottom: 1.1, aspect: 2.39, firstRowZ: 7, rowPitch: 1.05, riser: 0.28, flatRows: 3,
    hallW: 21, hallH: 9.5, aisle: 1.4, rows: "ABCDEFGHIJKLMNOPQ", perSide: 10,
    bands: [["ABCD", "classic"], ["EFGHIJKLMN", "prime"], ["OPQ", "recliner"]],
    basePrices: { classic: 200, prime: 280, recliner: 600 },
  },
  {
    id: "imax", name: "IMAX · Steep rake", venue: "PVR Phoenix",
    screenW: 22, screenBottom: 0.6, aspect: 1.9, firstRowZ: 7.5, rowPitch: 1.15, riser: 0.42, flatRows: 0,
    hallW: 26, hallH: 16, aisle: 1.6, rows: "ABCDEFGHIJKLMNOP", perSide: 11,
    bands: [["ABC", "classic"], ["DEFGHIJKLM", "prime"], ["NOP", "recliner"]],
    basePrices: { classic: 350, prime: 490, recliner: 890 },
  },
];

const MOVIES = [
  {
    id: "meiyazhagan", slug: "meiyazhagan", title: "Meiyazhagan", language: "Tamil", certificate: "U", runtimeMin: 177, genre: "Drama · Family",
    director: "C. Prem Kumar", cast: ["Karthi", "Arvind Swamy", "Sri Divya", "Rajkiran", "Devadarshini"], releaseDate: "2024-09-27", rating: 8.5,
    accent: "#2f7d5a", accent2: "#f2c14e",
    synopsis: "Twenty-two years after his family was forced out of their ancestral home in Thanjavur, Arulmozhi returns for a cousin's wedding and meets a warm, talkative relative whose name he cannot remember. A tender, funny film about memory, belonging and the people who love us without being asked.",
  },
  {
    id: "amaran", slug: "amaran", title: "Amaran", language: "Tamil", certificate: "U/A", runtimeMin: 169, genre: "Biography · Action",
    director: "Rajkumar Periasamy", cast: ["Sivakarthikeyan", "Sai Pallavi", "Bhuvan Arora", "Rahul Bose"], releaseDate: "2024-10-31", rating: 8.2,
    accent: "#8a3b2a", accent2: "#e9b872",
    synopsis: "The life of Major Mukund Varadarajan, from a college romance in Chennai to the Rashtriya Rifles in Kashmir. A story of duty, love and the family that waits at home.",
  },
  {
    id: "interstellar", slug: "interstellar", title: "Interstellar", language: "English", certificate: "U/A", runtimeMin: 169, genre: "Sci-Fi · Adventure",
    director: "Christopher Nolan", cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"], releaseDate: "2014-11-07", rating: 8.7,
    accent: "#1b2a4a", accent2: "#9fd3ff",
    synopsis: "IMAX re-release. As Earth's crops fail, a former pilot joins a last-ditch mission through a wormhole to find humanity a new home. Best seen on the biggest screen in the city.",
  },
];

const RULES = [
  { id: "r-morning", name: "Morning saver (before 1pm)", dayType: "any", fromHour: 0, toHour: 13, multiplier: 0.8, sortOrder: 1 },
  { id: "r-evening", name: "Evening prime time (6pm-11pm)", dayType: "any", fromHour: 18, toHour: 23, multiplier: 1.15, sortOrder: 2 },
  { id: "r-weekend", name: "Weekend surcharge", dayType: "weekend", fromHour: 0, toHour: 24, multiplier: 1.1, sortOrder: 3 },
];

const STAFF = [
  { email: "admin@show.demo", name: "Praneet (Owner)", role: "admin", password: "admin123" },
  { email: "manager@show.demo", name: "Divya Raman", role: "manager", password: "manager123" },
  { email: "counter@show.demo", name: "Suresh Kumar", role: "boxoffice", password: "counter123" },
  { email: "gate@show.demo", name: "Priya Nair", role: "usher", password: "gate123" },
];

const CUSTOMER_NAMES = ["Arjun Menon", "Keerthana S", "Vikram Iyer", "Meera Krishnan", "Rahul Das", "Anitha Raj", "Sanjay P", "Lakshmi V", "Karthik B", "Nithya M", "Harish R", "Pooja G"];

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

async function main() {
  console.log("Wiping...");
  for (const t of [schema.payments, schema.tickets, schema.bookings, schema.seatHolds, schema.sessions, schema.shows, schema.seats, schema.screens, schema.movies, schema.customers, schema.staff, schema.pricingRules, schema.cinemas])
    await db.delete(t);

  await db.insert(schema.cinemas).values(CINEMA);
  const seatsByScreen: Record<string, (typeof schema.seats.$inferSelect)[]> = {};
  for (const [i, h] of HALLS.entries()) {
    const ls = layoutSeats(h);
    await db.insert(schema.screens).values({ id: h.id, cinemaId: CINEMA.id, name: h.name, layout: h, seatCount: ls.length, sortOrder: i });
    const rows = ls.map((s) => ({ id: `${h.id}:${s.id}`, screenId: h.id, label: s.id, row: s.row, rowIndex: s.r, num: s.num, category: s.cat, aisleAfter: s.aisleAfter }));
    for (let j = 0; j < rows.length; j += 100) await db.insert(schema.seats).values(rows.slice(j, j + 100));
    seatsByScreen[h.id] = rows as never;
    console.log(`${h.id}: ${rows.length} seats`);
  }
  await db.insert(schema.movies).values(MOVIES);
  await db.insert(schema.pricingRules).values(RULES);
  await db.insert(schema.staff).values(STAFF.map((s) => ({ id: uuid(), email: s.email, name: s.name, role: s.role, passwordHash: hashPassword(s.password), createdAt: now })));
  const customers = CUSTOMER_NAMES.map((name, i) => ({ id: uuid(), name, phone: `98${String(40000000 + i * 7919).padStart(8, "0")}`, email: `${name.split(" ")[0].toLowerCase()}@example.com`, createdAt: now - i * 86_400_000 }));
  await db.insert(schema.customers).values(customers);

  // Schedule: 2 days of history + today + 6 days ahead. Each hall: 4 shows/day.
  const schedule: Record<string, { movie: string; format: string }> = {
    audi3: { movie: "meiyazhagan", format: "2D" },
    audi1: { movie: "amaran", format: "2D" },
    imax: { movie: "interstellar", format: "IMAX 2D" },
  };
  const slots = ["10:30", "14:00", "17:30", "21:00"];
  const rules = await db.query.pricingRules.findMany();
  const movieById = Object.fromEntries(MOVIES.map((m) => [m.id, m]));
  const showRows: (typeof schema.shows.$inferInsert)[] = [];
  const base = dayStart(today);
  for (let d = -2; d <= 6; d++) {
    const dayMs = base + d * 86_400_000;
    for (const h of HALLS) {
      let pick = schedule[h.id];
      // Mix things up: weekend afternoon in Audi 1 shows Meiyazhagan too.
      for (const [si, slot] of slots.entries()) {
        if (h.id === "audi1" && si === 1 && (d + 4) % 3 === 0) pick = { movie: "meiyazhagan", format: "2D" };
        else pick = schedule[h.id];
        const [hh, mm] = slot.split(":").map(Number);
        const startsAt = dayMs + (hh * 60 + mm) * 60_000;
        const m = movieById[pick.movie];
        showRows.push({ id: `${h.id}-${dayKey(startsAt)}-${slot.replace(":", "")}`, movieId: m.id, screenId: h.id, startsAt, endsAt: startsAt + (m.runtimeMin + 20) * 60_000, format: pick.format, status: "scheduled", prices: priceShow(h.basePrices, rules, startsAt, h.id) });
      }
    }
  }
  await db.insert(schema.shows).values(showRows);
  console.log(`${showRows.length} shows`);

  // Bookings: past shows well filled, today partially, future tapering.
  const rnd = lcg(20261030);
  let nb = 0;
  for (const show of showRows) {
    const daysOut = (show.startsAt - now) / 86_400_000;
    const target = daysOut < 0 ? 0.55 + rnd() * 0.3 : daysOut < 1 ? 0.25 + rnd() * 0.3 : Math.max(0.03, 0.22 - daysOut * 0.035);
    const seatsHere = seatsByScreen[show.screenId];
    const want = Math.round(seatsHere.length * target);
    // Group bookings of 1-4 adjacent seats, biased to the middle rows.
    const used = new Set<string>();
    let placed = 0, guard = 0;
    while (placed < want && guard++ < 2000) {
      const size = 1 + Math.floor(rnd() * 4);
      const rowBias = Math.min(seatsHere.length - 1, Math.floor((0.3 + rnd() * 0.6) * seatsHere.length));
      const start = seatsHere[rowBias];
      const rowSeats = seatsHere.filter((s) => s.row === start.row);
      const idx = rowSeats.findIndex((s) => s.id === start.id);
      const run = rowSeats.slice(idx, idx + size);
      if (run.length < size || run.some((s) => used.has(s.id))) continue;
      run.forEach((s) => used.add(s.id));
      const cust = customers[Math.floor(rnd() * customers.length)];
      const counter = rnd() < 0.25;
      const subtotal = run.reduce((a, s) => a + show.prices![s.category], 0);
      const fee = counter ? 0 : 30 * run.length;
      const createdAt = Math.min(now - 60_000, show.startsAt - Math.floor(rnd() * 3 * 86_400_000) - 3_600_000);
      const cancelled = rnd() < 0.04;
      const bid = bookingCode();
      await db.insert(schema.bookings).values({ id: bid, showId: show.id!, customerId: cust.id, holdGroup: null, status: cancelled ? "refunded" : "confirmed", channel: counter ? "counter" : "online", seatLabels: run.map((s) => s.label), subtotal, fee, total: subtotal + fee, refundAmount: cancelled ? subtotal + fee : 0, qrToken: token(18), createdAt, confirmedAt: createdAt + 90_000, cancelledAt: cancelled ? createdAt + 3_600_000 : null });
      const checkedIn = show.startsAt < now - 10 * 60_000 && !cancelled && rnd() < 0.9;
      await db.insert(schema.tickets).values(run.map((s) => ({ id: uuid(), bookingId: bid, showId: show.id!, seatId: s.id, seatLabel: s.label, category: s.category, price: show.prices![s.category], active: !cancelled, checkedInAt: checkedIn ? show.startsAt - Math.floor(rnd() * 25 * 60_000) : null })));
      await db.insert(schema.payments).values({ id: uuid(), bookingId: bid, idempotencyKey: `seed:${bid}`, amount: subtotal + fee, method: counter ? (rnd() < 0.5 ? "cash" : "card") : rnd() < 0.7 ? "upi" : "card", status: "succeeded", gatewayRef: `pay_${token(8)}`, createdAt: createdAt + 90_000 });
      if (cancelled) await db.insert(schema.payments).values({ id: uuid(), bookingId: bid, idempotencyKey: `refund:${bid}`, amount: -(subtotal + fee), method: "refund", status: "refunded", gatewayRef: `rf_${token(8)}`, createdAt: createdAt + 3_600_000 });
      placed += run.length;
      nb++;
    }
  }
  console.log(`${nb} bookings`);
  console.log("Staff logins: " + STAFF.map((s) => `${s.email} / ${s.password}`).join(", "));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
