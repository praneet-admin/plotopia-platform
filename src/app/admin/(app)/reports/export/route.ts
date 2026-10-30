import { currentStaff } from "@/lib/auth";
import { can } from "@/lib/auth";
import { dailyCollections } from "@/lib/reports";

export async function GET(req: Request) {
  const me = await currentStaff();
  if (!me || !can(me.role, ["admin", "manager"])) return new Response("Forbidden", { status: 403 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? "", to = u.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Bad range", { status: 400 });
  const rows = await dailyCollections(from, to);
  const csv = ["day,bookings,tickets,online,counter,gross,refunds,net", ...rows.map((r) => [r.day, r.bookings, r.tickets, r.online, r.counter, r.gross, r.refunds, r.net].join(","))].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="collections-${from}-to-${to}.csv"` } });
}
