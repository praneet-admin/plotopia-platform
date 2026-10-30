import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cinemas = sqliteTable("cinemas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
});

/** A screen/auditorium. `layout` is the simulator's hall JSON (metres, rows, bands). */
export const screens = sqliteTable("screens", {
  id: text("id").primaryKey(), // same id the simulator uses: audi3, audi1, imax
  cinemaId: text("cinema_id").notNull().references(() => cinemas.id),
  name: text("name").notNull(),
  layout: text("layout", { mode: "json" }).$type<HallLayout>().notNull(),
  seatCount: integer("seat_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const seats = sqliteTable(
  "seats",
  {
    id: text("id").primaryKey(), // `${screenId}:${label}`
    screenId: text("screen_id").notNull().references(() => screens.id),
    label: text("label").notNull(), // G7
    row: text("row").notNull(), // G
    rowIndex: integer("row_index").notNull(), // 0 = front
    num: integer("num").notNull(),
    category: text("category").notNull(), // classic | prime | recliner
    aisleAfter: integer("aisle_after", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("seats_screen").on(t.screenId)],
);

export const movies = sqliteTable("movies", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  language: text("language").notNull(),
  certificate: text("certificate").notNull(), // U, U/A, A
  runtimeMin: integer("runtime_min").notNull(),
  genre: text("genre").notNull(),
  synopsis: text("synopsis").notNull(),
  cast: text("cast", { mode: "json" }).$type<string[]>().notNull(),
  director: text("director").notNull(),
  releaseDate: text("release_date").notNull(), // YYYY-MM-DD
  accent: text("accent").notNull(), // poster colour
  accent2: text("accent2").notNull(),
  rating: real("rating").notNull().default(0),
  status: text("status").notNull().default("now_showing"), // now_showing | coming_soon | archived
});

export const shows = sqliteTable(
  "shows",
  {
    id: text("id").primaryKey(),
    movieId: text("movie_id").notNull().references(() => movies.id),
    screenId: text("screen_id").notNull().references(() => screens.id),
    startsAt: integer("starts_at").notNull(), // epoch ms
    endsAt: integer("ends_at").notNull(),
    format: text("format").notNull().default("2D"),
    status: text("status").notNull().default("scheduled"), // scheduled | cancelled
    prices: text("prices", { mode: "json" }).$type<Record<string, number>>().notNull(),
  },
  (t) => [index("shows_starts").on(t.startsAt), index("shows_screen").on(t.screenId, t.startsAt)],
);

export const seatHolds = sqliteTable(
  "seat_holds",
  {
    id: text("id").primaryKey(),
    showId: text("show_id").notNull().references(() => shows.id),
    seatId: text("seat_id").notNull().references(() => seats.id),
    holdGroup: text("hold_group").notNull(), // one cart = one group
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("holds_show_seat").on(t.showId, t.seatId), index("holds_group").on(t.holdGroup)],
);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: integer("created_at").notNull(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(), // PLT-XXXXXX
    showId: text("show_id").notNull().references(() => shows.id),
    customerId: text("customer_id").references(() => customers.id),
    holdGroup: text("hold_group"),
    status: text("status").notNull(), // pending | confirmed | cancelled | refunded
    channel: text("channel").notNull().default("online"), // online | counter
    seatLabels: text("seat_labels", { mode: "json" }).$type<string[]>().notNull(),
    subtotal: integer("subtotal").notNull(),
    fee: integer("fee").notNull(),
    total: integer("total").notNull(),
    refundAmount: integer("refund_amount").notNull().default(0),
    qrToken: text("qr_token").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    confirmedAt: integer("confirmed_at"),
    cancelledAt: integer("cancelled_at"),
    createdBy: text("created_by"), // staff id for counter sales
  },
  (t) => [index("bookings_show").on(t.showId), index("bookings_customer").on(t.customerId)],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    showId: text("show_id").notNull().references(() => shows.id),
    seatId: text("seat_id").notNull().references(() => seats.id),
    seatLabel: text("seat_label").notNull(),
    category: text("category").notNull(),
    price: integer("price").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    checkedInAt: integer("checked_in_at"),
  },
  (t) => [
    // The one rule that makes double booking impossible at the database level.
    uniqueIndex("tickets_show_seat_active").on(t.showId, t.seatId).where(sql`active = 1`),
    index("tickets_booking").on(t.bookingId),
  ],
);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(), // upi | card | cash
  status: text("status").notNull(), // succeeded | failed | refunded
  gatewayRef: text("gateway_ref").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // admin | manager | boxoffice | usher
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // staff | customer
  subjectId: text("subject_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const pricingRules = sqliteTable("pricing_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  dayType: text("day_type").notNull(), // any | weekday | weekend
  fromHour: integer("from_hour").notNull(),
  toHour: integer("to_hour").notNull(),
  multiplier: real("multiplier").notNull(),
  screenId: text("screen_id"), // null = all screens
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type HallLayout = {
  id: string;
  name: string;
  venue: string;
  screenW: number;
  screenBottom: number;
  aspect: number;
  firstRowZ: number;
  rowPitch: number;
  riser: number;
  flatRows: number;
  hallW: number;
  hallH: number;
  aisle: number;
  rows: string;
  perSide: number;
  bands: [string, string][];
  basePrices: Record<string, number>;
};

export type Movie = typeof movies.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type Screen = typeof screens.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type PricingRule = typeof pricingRules.$inferSelect;

import { relations } from "drizzle-orm";
export const showsRelations = relations(shows, ({ one, many }) => ({
  movie: one(movies, { fields: [shows.movieId], references: [movies.id] }),
  screen: one(screens, { fields: [shows.screenId], references: [screens.id] }),
  tickets: many(tickets),
  bookings: many(bookings),
}));
export const screensRelations = relations(screens, ({ one, many }) => ({
  cinema: one(cinemas, { fields: [screens.cinemaId], references: [cinemas.id] }),
  seats: many(seats),
  shows: many(shows),
}));
export const moviesRelations = relations(movies, ({ many }) => ({ shows: many(shows) }));
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  show: one(shows, { fields: [bookings.showId], references: [shows.id] }),
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
  tickets: many(tickets),
  payments: many(payments),
}));
export const ticketsRelations = relations(tickets, ({ one }) => ({
  booking: one(bookings, { fields: [tickets.bookingId], references: [bookings.id] }),
  show: one(shows, { fields: [tickets.showId], references: [shows.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({ booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }) }));

/** Outbound message log: the demo's email / SMS / WhatsApp "gateway". */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(), // email | sms | whatsapp
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  bookingId: text("booking_id"),
  createdAt: integer("created_at").notNull(),
});
