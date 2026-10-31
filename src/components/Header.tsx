import Image from "next/image";
import Link from "next/link";
import { currentCustomer } from "@/lib/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`} aria-label="Plotopia home">
      <Image src="/brand/mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" priority />
      <Image src="/brand/wordmark-white.png" alt="Plotopia" width={112} height={24} className="h-5 w-auto" priority />
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
          <Link href={customer ? "/my" : "/portal"} className="rounded-lg px-3 py-2 text-muted hover:bg-panel hover:text-text">
            {customer ? `Hi, ${customer.name.split(" ")[0]}` : "Sign in"}
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
        <span>© Plotopia · PVR Phoenix MarketCity, Chennai · Demo build</span>
        <span>
          Seat views by the <a className="underline hover:text-text" href="https://praneet-admin.github.io/plotopia/" target="_blank" rel="noreferrer">Plotopia seat simulator</a>
        </span>
      </div>
    </footer>
  );
}
