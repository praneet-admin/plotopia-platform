import Image from "next/image";
import Link from "next/link";
import { currentCustomer } from "@/lib/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Plotopia home">
      <Image src="/brand/mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" priority />
      <Image src="/brand/wordmark-white.png" alt="Plotopia" width={112} height={24} className="h-[22px] w-auto" priority />
    </Link>
  );
}

export async function Header({ q = "" }: { q?: string }) {
  const customer = await currentCustomer();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3 sm:gap-6">
        <Logo />
        <form action="/" role="search" className="relative min-w-0 flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input name="q" defaultValue={q} className="search h-10 max-w-none pl-10" placeholder="Search movies, actors" aria-label="Search movies" />
        </form>
        <nav className="flex flex-none items-center gap-1 text-sm">
          <Link href="/theatres" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:inline-block">Theatres</Link>
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

export function Footer() {
  return (
    <footer className="container-x mt-16 border-t border-line py-8 text-sm text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>Plotopia, Chennai. Demo build, no real payments.</span>
        <span className="flex gap-4">
          <Link className="hover:text-text" href="/theatres">Theatres</Link>
          <a className="hover:text-text" href="https://praneet-admin.github.io/plotopia/" target="_blank" rel="noreferrer">Seat simulator</a>
          <Link className="hover:text-text" href="/admin">Staff</Link>
        </span>
      </div>
    </footer>
  );
}
