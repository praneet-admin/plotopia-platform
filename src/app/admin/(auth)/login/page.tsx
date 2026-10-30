import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Logo } from "@/components/Header";
import { currentStaff, staffLogin, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await currentStaff()) redirect("/admin");
  async function login(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const pw = String(fd.get("password") ?? "");
    const u = await db.query.staff.findFirst({ where: eq(schema.staff.email, email) });
    if (!u || !u.active || !verifyPassword(pw, u.passwordHash)) redirect("/admin/login?error=1");
    await staffLogin(u.id);
    redirect(u.role === "usher" ? "/admin/scan" : "/admin");
  }
  const demo = [["admin@show.demo", "admin123", "Owner"], ["manager@show.demo", "manager123", "Manager"], ["counter@show.demo", "counter123", "Box office"], ["gate@show.demo", "gate123", "Gate usher"]];
  return (
    <main className="container-x flex min-h-screen flex-col items-center justify-center py-10">
      <Logo className="mb-6" />
      <form action={login} className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted">PVR Phoenix MarketCity · back office</p>
        {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">Wrong email or password.</div>}
        <div className="mt-4 space-y-3">
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue="admin@show.demo" autoComplete="username" /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" defaultValue="admin123" autoComplete="current-password" /></div>
          <button className="btn btn-primary w-full">Sign in</button>
        </div>
      </form>
      <div className="card mt-4 w-full max-w-sm p-4 text-xs text-muted">
        <div className="font-semibold text-text">Demo accounts</div>
        <table className="mt-2 w-full">
          <tbody>{demo.map(([e, p, r]) => <tr key={e}><td className="py-0.5 font-mono">{e}</td><td className="font-mono">{p}</td><td className="text-right">{r}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
