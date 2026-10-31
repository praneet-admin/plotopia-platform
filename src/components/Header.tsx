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

export async function Header() {
  const customer = await currentCustomer();
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 text-muted hover:text-text">Movies</Link>
          <Link href="/#theatres" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:inline-block">Theatres</Link>
          {customer ? (
            <Link href="/my" className="rounded-lg px-3 py-2 text-muted hover:text-text">My tickets</Link>
          ) : (
            <Link href="/portal" className="btn btn-primary btn-sm ml-2">Sign in</Link>
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
          <a className="hover:text-text" href="https://praneet-admin.github.io/plotopia/" target="_blank" rel="noreferrer">Seat simulator</a>
          <Link className="hover:text-text" href="/admin">Staff</Link>
        </span>
      </div>
    </footer>
  );
}
