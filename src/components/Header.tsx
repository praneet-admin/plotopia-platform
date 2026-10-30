import Link from "next/link";
import { currentCustomer } from "@/lib/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`} aria-label="Show home">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-[#140a05]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v10H4z" /><path d="M8 17v2m8-2v2M2 7l2 0m16 0 2 0" /></svg>
      </span>
      <span className="text-lg">Show</span>
    </Link>
  );
}

export async function Header() {
  const customer = await currentCustomer();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="container-x flex h-14 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 text-muted hover:bg-panel hover:text-text">Movies</Link>
          <Link href="/my" className="rounded-lg px-3 py-2 text-muted hover:bg-panel hover:text-text">
            {customer ? `Hi, ${customer.name.split(" ")[0]}` : "My bookings"}
          </Link>
          <Link href="/admin" className="ml-1 hidden rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-text sm:inline-block">Staff</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="container-x mt-16 border-t border-line py-8 text-xs text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>© Show · PVR Phoenix MarketCity, Chennai · Demo build</span>
        <span>
          Seat views by the <a className="underline hover:text-text" href="https://praneet-admin.github.io/show/" target="_blank" rel="noreferrer">Show seat simulator</a>
        </span>
      </div>
    </footer>
  );
}
