import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { simulatorShowLink } from "@/lib/hall";

export const dynamic = "force-dynamic";

/** Seat selection happens in the Plotopia seat simulator; old /book links go there. */
export default async function BookRedirect({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const show = await db.query.shows.findFirst({ where: eq(schema.shows.id, showId), with: { screen: true } });
  if (!show) notFound();
  redirect(simulatorShowLink(show.screen.layout.simId ?? show.screen.id, show.id));
}
