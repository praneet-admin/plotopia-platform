import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { fmtDateTime } from "@/lib/format";

export default async function Messages() {
  await requireStaff(["admin", "manager", "boxoffice"]);
  const list = await db.query.notifications.findMany({ orderBy: desc(schema.notifications.createdAt), limit: 60 });
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Messages</h1><div className="text-sm text-muted">Outbound WhatsApp, SMS and email. The demo logs them here instead of sending; swap in a provider in <span className="font-mono">src/lib/notify.ts</span>.</div></div>
      <div className="space-y-2">
        {list.map((n) => (
          <div key={n.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span><span className="pill mr-2 uppercase">{n.channel}</span>to {n.to}</span><span>{fmtDateTime(n.createdAt)}{n.bookingId && <> · <Link href={`/tickets/${n.bookingId}`} className="font-mono text-brand">{n.bookingId}</Link></>}</span></div>
            <div className="mt-2 font-semibold">{n.subject}</div>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-muted">{n.body}</pre>
          </div>
        ))}
        {list.length === 0 && <div className="card p-8 text-center text-muted">Nothing sent yet. Complete a booking to see messages here.</div>}
      </div>
    </div>
  );
}
