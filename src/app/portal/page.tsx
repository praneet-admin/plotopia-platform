import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentCustomer, customerLogin } from "@/lib/auth";
import { uuid } from "@/lib/ids";

export const dynamic = "force-dynamic";
const DEMO_OTP = "1234";
const portalUrl = (dest: string, extra = "") => `/portal?next=${encodeURIComponent(dest)}${extra}`;
import { VISITED_COOKIE } from "@/lib/portal";

/** The front door: sign in with a mobile number, or walk in as a guest. */
export default async function Portal({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string; error?: string }> }) {
  const { next, phone, error } = await searchParams;
  if (await currentCustomer()) redirect(next && next.startsWith("/") ? next : "/");
  const dest = next && next.startsWith("/") ? next : "/";

  async function sendOtp(fd: FormData) {
    "use server";
    const p = String(fd.get("phone") ?? "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) redirect(portalUrl(dest, `&error=${encodeURIComponent("Enter a 10-digit mobile number")}`));
    redirect(portalUrl(dest, `&phone=${p}`));
  }
  async function verify(fd: FormData) {
    "use server";
    const p = String(fd.get("phone") ?? ""), otp = String(fd.get("otp") ?? ""), name = String(fd.get("name") ?? "").trim();
    if (otp !== DEMO_OTP) redirect(portalUrl(dest, `&phone=${p}&error=${encodeURIComponent("Wrong code. The demo code is 1234.")}`));
    let c = await db.query.customers.findFirst({ where: eq(schema.customers.phone, p) });
    if (!c) {
      if (name.length < 2) redirect(portalUrl(dest, `&phone=${p}&error=${encodeURIComponent("New here? Add your name.")}`));
      const id = uuid();
      await db.insert(schema.customers).values({ id, phone: p, name, createdAt: Date.now() });
      c = (await db.query.customers.findFirst({ where: eq(schema.customers.id, id) }))!;
    }
    await customerLogin(c.id);
    (await cookies()).set(VISITED_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    redirect(dest);
  }
  async function guest() {
    "use server";
    (await cookies()).set(VISITED_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    redirect(dest);
  }
  const known = phone ? await db.query.customers.findFirst({ where: eq(schema.customers.phone, phone) }) : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-[-20%] h-[60vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,194,14,.14),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
      </div>
      <div className="fade-up flex flex-col items-center text-center">
        <Image src="/brand/mark.png" alt="" width={96} height={96} className="h-24 w-24 rounded-full shadow-[0_0_60px_rgba(255,194,14,.25)]" priority />
        <Image src="/brand/wordmark-white.png" alt="Plotopia" width={220} height={67} className="mt-5 h-12 w-auto" priority />
        <p className="mt-3 max-w-sm text-sm text-muted">Movies across Chennai&apos;s theatres. Pick a seat and see the screen from it before you pay.</p>
      </div>

      <div className="card fade-up mt-8 w-full max-w-sm p-6" style={{ animationDelay: "120ms" }}>
        <h1 className="text-lg font-bold">{phone ? "Enter the code" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-muted">{phone ? `Code sent to +91 ${phone}. Demo code: 1234.` : "One-time code on your mobile. No password."}</p>
        {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {!phone ? (
          <form action={sendOtp} className="mt-4 space-y-3">
            <div className="flex"><span className="flex h-11 items-center rounded-l-xl border border-r-0 border-line bg-panel-2 px-3 text-sm text-muted">+91</span><input name="phone" className="input rounded-l-none" inputMode="numeric" placeholder="Mobile number" autoFocus aria-label="Mobile number" /></div>
            <button className="btn btn-primary w-full">Send code</button>
          </form>
        ) : (
          <form action={verify} className="mt-4 space-y-3">
            <input type="hidden" name="phone" value={phone} />
            {!known && <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" autoComplete="name" /></div>}
            <div><label className="label" htmlFor="otp">Code</label><input id="otp" name="otp" className="input num text-center text-xl tracking-[.5em]" inputMode="numeric" maxLength={4} autoFocus /></div>
            <button className="btn btn-primary w-full">Verify &amp; continue</button>
            <Link href={portalUrl(dest)} className="block text-center text-xs text-muted hover:text-text">Use a different number</Link>
          </form>
        )}
        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        <form action={guest}><button className="btn btn-ghost w-full">Browse as guest</button></form>
      </div>
      <div className="mt-6 flex gap-4 text-xs text-muted">
        <Link href="/admin/login" className="hover:text-text">Staff sign in</Link>
        <a href="https://praneet-admin.github.io/plotopia/" target="_blank" rel="noreferrer" className="hover:text-text">Seat simulator ↗</a>
      </div>
    </main>
  );
}
