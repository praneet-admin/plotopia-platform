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
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 pb-16 pt-10 sm:pt-16">
      <div className="beam" aria-hidden />
      <div className="relative flex flex-col items-center text-center">
        <Image src="/brand/mark.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full" priority />
        <Image src="/brand/wordmark-white.png" alt="Plotopia" width={220} height={67} className="mt-4 h-11 w-auto" priority />
        <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted">Movie tickets across Chennai. Pick a seat and see the screen from it before you pay.</p>
      </div>

      <div className="screen relative mt-10 w-full max-w-[420px] p-6 sm:p-7">
        <h1 className="text-xl font-bold tracking-tight">{phone ? "Enter the code" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-muted">{phone ? `We sent a 4-digit code to +91 ${phone}. In this demo the code is 1234.` : "A one-time code on your mobile. No password to remember."}</p>
        {error && <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {!phone ? (
          <form action={sendOtp} className="mt-5 space-y-3">
            <div className="flex"><span className="flex h-12 items-center rounded-l-xl border border-r-0 border-line bg-panel-2 px-3 text-sm text-muted">+91</span><input name="phone" className="input h-12 rounded-l-none text-base" inputMode="numeric" placeholder="Mobile number" autoFocus aria-label="Mobile number" /></div>
            <button className="btn btn-primary h-12 w-full text-base">Send code</button>
          </form>
        ) : (
          <form action={verify} className="mt-5 space-y-3">
            <input type="hidden" name="phone" value={phone} />
            {!known && <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input h-12" autoComplete="name" /></div>}
            <div><label className="label" htmlFor="otp">Code</label><input id="otp" name="otp" className="input num h-12 text-center text-2xl tracking-[.5em]" inputMode="numeric" maxLength={4} autoFocus /></div>
            <button className="btn btn-primary h-12 w-full text-base">Continue</button>
            <Link href={portalUrl(dest)} className="block text-center text-sm text-muted hover:text-text">Use a different number</Link>
          </form>
        )}
        <form action={guest} className="mt-4 border-t border-line pt-4"><button className="btn btn-ghost w-full">Just browse for now</button></form>
      </div>
      <div className="seat-row mt-4 w-full max-w-[380px]" aria-hidden />
      <div className="seat-row mt-1.5 w-full max-w-[440px] opacity-60" aria-hidden />

      <div className="mt-10 flex gap-5 text-sm text-muted">
        <Link href="/admin/login" className="hover:text-text">Staff sign in</Link>
        <a href="https://praneet-admin.github.io/plotopia/" target="_blank" rel="noreferrer" className="hover:text-text">Try the seat simulator</a>
      </div>
    </main>
  );
}
