import Image from "next/image";
import Link from "next/link";
import { currentCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/** Brand mark + wordmark. Both images are replaceable in /admin/settings → Brand. */
export async function Logo({ className = "", size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  const { brand } = await getSettings();
  const mark = brand.logoUrl || "/brand/mark.png";
  const word = brand.wordmarkUrl || "/brand/wordmark-white.png";
  const mh = size === "lg" ? 72 : 32, wh = size === "lg" ? 44 : 22;
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label={`${brand.siteName} home`}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt="" style={{ height: mh, width: mh }} className="rounded-full object-cover" />
      ) : (
        <Image src={mark} alt="" width={mh} height={mh} style={{ height: mh, width: mh }} className="rounded-full" priority />
      )}
      {brand.wordmarkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={word} alt={brand.siteName} style={{ height: wh }} className="w-auto" />
      ) : (
        <Image src={word} alt={brand.siteName} width={112} height={24} style={{ height: wh }} className="w-auto" priority />
      )}
    </Link>
  );
}

export async function Header({ q = "" }: { q?: string }) {
  const [customer, { home }] = await Promise.all([currentCustomer(), getSettings()]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3 sm:gap-6">
        <Logo />
        <form action="/" role="search" className="relative min-w-0 flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input name="q" defaultValue={q} className="search h-10 max-w-none pl-10" placeholder="Search movies, actors" aria-label="Search movies" />
        </form>
        <nav className="flex flex-none items-center gap-1 text-sm">
          {home.showTheatresLink && <Link href="/theatres" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:inline-block">Theatres</Link>}
          {customer ? (
            <Link href="/my" className="rounded-lg px-3 py-2 text-muted hover:text-text">My tickets</Link>
          ) : (
            <Link href="/portal" className="btn btn-primary btn-sm">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export async function Footer() {
  const { brand, home, simulator, cinema } = await getSettings();
  return (
    <footer className="container-x mt-16 border-t border-line py-8 text-sm text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{brand.footerText}{cinema.supportEmail && <> · <a className="hover:text-text" href={`mailto:${cinema.supportEmail}`}>{cinema.supportEmail}</a></>}{cinema.whatsapp && <> · <a className="hover:text-text" href={`https://wa.me/${cinema.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></>}</span>
        <span className="flex gap-4">
          {home.showTheatresLink && <Link className="hover:text-text" href="/theatres">Theatres</Link>}
          {simulator.showSeatPreview && <a className="hover:text-text" href={simulator.url} target="_blank" rel="noreferrer">Seat simulator</a>}
          {brand.showStaffLink && <Link className="hover:text-text" href="/admin">Staff</Link>}
        </span>
      </div>
    </footer>
  );
}
