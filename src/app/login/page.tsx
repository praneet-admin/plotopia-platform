import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header } from "@/components/Header";
import { currentCustomer, customerLogin } from "@/lib/auth";
import { uuid } from "@/lib/ids";

export const dynamic = "force-dynamic";
const DEMO_OTP = "1234";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string; error?: string }> }) {
  const { next, phone, error } = await searchParams;
  if (await currentCustomer()) redirect(next || "/my");
  const dest = next && next.startsWith("/") ? next : "/my";

  async function sendOtp(fd: FormData) {
    "use server";
    const p = String(fd.get("phone") ?? "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) redirect(`/login?next=${encodeURIComponent(dest)}&error=${encodeURIComponent("Enter a 10-digit mobile number")}`);
    redirect(`/login?next=${encodeURIComponent(dest)}&phone=${p}`);
  }
  async function verify(fd: FormData) {
    "use server";
    const p = String(fd.get("phone") ?? "");
    const otp = String(fd.get("otp") ?? "");
    const name = String(fd.get("name") ?? "").trim();
    if (otp !== DEMO_OTP) redirect(`/login?next=${encodeURIComponent(dest)}&phone=${p}&error=${encodeURIComponent("Wrong code. The demo code is 1234.")}`);
    let c = await db.query.customers.findFirst({ where: eq(schema.customers.phone, p) });
    if (!c) {
      if (name.length < 2) redirect(`/login?next=${encodeURIComponent(dest)}&phone=${p}&error=${encodeURIComponent("New here? Add your name.")}`);
      const id = uuid();
      await db.insert(schema.customers).values({ id, phone: p, name, createdAt: Date.now() });
      c = (await db.query.customers.findFirst({ where: eq(schema.customers.id, id) }))!;
    }
    await customerLogin(c.id);
    redirect(dest);
  }

  const known = phone ? await db.query.customers.findFirst({ where: eq(schema.customers.phone, phone) }) : null;
  return (
    <>
      <Header />
      <main className="container-x flex-1">
        <div className="card mx-auto mt-10 max-w-sm p-6">
          <h1 className="text-xl font-bold">{phone ? "Enter the code" : "Sign in with mobile"}</h1>
          <p className="mt-1 text-sm text-muted">{phone ? `We sent a 4-digit code to +91 ${phone}. Demo code: 1234.` : "We'll text you a one-time code. No passwords."}</p>
          {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          {!phone ? (
            <form action={sendOtp} className="mt-4 space-y-3">
              <div><label className="label" htmlFor="phone">Mobile</label><input id="phone" name="phone" className="input" inputMode="numeric" placeholder="98400 00000" autoFocus /></div>
              <button className="btn btn-primary w-full">Send code</button>
            </form>
          ) : (
            <form action={verify} className="mt-4 space-y-3">
              <input type="hidden" name="phone" value={phone} />
              {!known && <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" autoComplete="name" /></div>}
              <div><label className="label" htmlFor="otp">Code</label><input id="otp" name="otp" className="input num text-center text-xl tracking-[.5em]" inputMode="numeric" maxLength={4} autoFocus /></div>
              <button className="btn btn-primary w-full">Verify</button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
