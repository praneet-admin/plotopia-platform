import { headers } from "next/headers";
import type { Movie, Screen, Show } from "@/db/schema";
import { coverFor } from "./covers";
import { dayKey, runtime } from "./format";
import { SIMULATOR_URL } from "./hall";

/** Absolute origin of this deployment, for poster and return URLs. */
export async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

type ShowFull = Pick<Show, "id" | "startsAt"> & { screen: Pick<Screen, "id" | "layout">; movie: Pick<Movie, "id" | "title" | "language" | "certificate" | "runtimeMin" | "genre" | "cast"> };

/**
 * Where a showtime sends the customer: the Plotopia seat simulator, told which
 * hall, film and time to show. Its "Book <seat>" button comes back to
 * `return?seat=G7&hall=audi3&show=<id>`, which holds the seat and opens checkout.
 */
export function simulatorShowLink(show: ShowFull, origin: string) {
  const d = new Date(show.startsAt);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const p = new URLSearchParams({
    hall: show.screen.layout.simId ?? show.screen.id,
    view: "overview",
    show: show.id,
    title: show.movie.title,
    lang: show.movie.language,
    cert: show.movie.certificate,
    runtime: runtime(show.movie.runtimeMin),
    genre: show.movie.genre.split("·")[0].trim(),
    cast: show.movie.cast.slice(0, 3).join(", "),
    time,
    date: dayKey(show.startsAt),
    return: `${origin}/api/checkout/start`,
  });
  const cover = coverFor(show.movie.id);
  if (cover && origin.startsWith("https://")) p.set("poster", `${origin}${cover}`);
  return `${SIMULATOR_URL}#${p.toString()}`;
}
