"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="scroll-x -mx-1 flex min-w-0 flex-1 gap-1 px-1 lg:mt-6 lg:flex-none lg:flex-col">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`flex-none rounded-lg px-3 py-2 text-sm ${active ? "bg-brand/15 font-semibold text-brand" : "text-muted hover:bg-panel hover:text-text"}`}>{n.label}</Link>
        );
      })}
    </nav>
  );
}
