import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { hashPassword, ROLES } from "@/lib/auth";
import { uuid } from "@/lib/ids";

export default async function StaffAdmin({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireStaff("admin");
  const { msg } = await searchParams;
  const list = await db.query.staff.findMany({ orderBy: asc(schema.staff.createdAt) });
  async function add(fd: FormData) {
    "use server";
    await requireStaff("admin");
    const email = String(fd.get("email") ?? "").trim().toLowerCase(), name = String(fd.get("name") ?? "").trim(), role = String(fd.get("role") ?? "boxoffice"), pw = String(fd.get("password") ?? "");
    if (!email.includes("@") || !name || pw.length < 6 || !ROLES.includes(role as never)) redirect("/admin/staff?msg=Check+the+fields+(password+6%2B+chars)");
    if (await db.query.staff.findFirst({ where: eq(schema.staff.email, email) })) redirect("/admin/staff?msg=Email+already+exists");
    await db.insert(schema.staff).values({ id: uuid(), email, name, role, passwordHash: hashPassword(pw), createdAt: Date.now() });
    redirect(`/admin/staff?msg=${encodeURIComponent(name + " added")}`);
  }
  async function toggle(fd: FormData) {
    "use server";
    const admin = await requireStaff("admin");
    const id = String(fd.get("id"));
    if (id === admin.id) redirect("/admin/staff?msg=You+can't+deactivate+yourself");
    const u = await db.query.staff.findFirst({ where: eq(schema.staff.id, id) });
    if (u) await db.update(schema.staff).set({ active: !u.active }).where(eq(schema.staff.id, id));
    redirect("/admin/staff");
  }
  async function setRole(fd: FormData) {
    "use server";
    const admin = await requireStaff("admin");
    const id = String(fd.get("id")), role = String(fd.get("role"));
    if (id === admin.id || !ROLES.includes(role as never)) redirect("/admin/staff?msg=Can't+change+your+own+role");
    await db.update(schema.staff).set({ role }).where(eq(schema.staff.id, id));
    redirect("/admin/staff");
  }
  const desc: Record<string, string> = { admin: "Everything, including staff", manager: "Scheduling, pricing, halls, reports", boxoffice: "Counter sales, bookings, gate", usher: "Gate scanning only" };
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Staff</h1><div className="text-sm text-muted">Roles: {ROLES.map((r) => `${r} (${desc[r]})`).join(" · ")}</div></div>
      {msg && <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">{msg}</div>}
      <div className="card overflow-x-auto"><table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>{list.map((u) => (
          <tr key={u.id} className={u.active ? "" : "opacity-50"}><td className="font-medium">{u.name}{u.id === me.id && <span className="pill ml-2 text-[10px]">you</span>}</td><td className="font-mono text-xs">{u.email}</td>
            <td><form action={setRole} className="flex gap-1"><input type="hidden" name="id" value={u.id} /><select name="role" defaultValue={u.role} className="input h-8 w-32 px-2 text-xs capitalize" disabled={u.id === me.id}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>{u.id !== me.id && <button className="btn btn-ghost btn-sm h-8">Set</button>}</form></td>
            <td>{u.active ? <span className="text-ok">active</span> : "inactive"}</td>
            <td className="text-right">{u.id !== me.id && <form action={toggle}><input type="hidden" name="id" value={u.id} /><button className="btn btn-ghost btn-sm">{u.active ? "Deactivate" : "Reactivate"}</button></form>}</td></tr>
        ))}</tbody></table></div>
      <form action={add} className="card grid gap-3 p-4 sm:grid-cols-5">
        <input name="name" placeholder="Name" className="input" required /><input name="email" type="email" placeholder="email@show.demo" className="input" required />
        <select name="role" className="input capitalize">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <input name="password" type="password" placeholder="Password (6+)" className="input" required minLength={6} autoComplete="new-password" />
        <button className="btn btn-primary">Add staff</button>
      </form>
    </div>
  );
}
