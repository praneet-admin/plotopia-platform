"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="scroll-x -mx-4 flex gap-1 px-4 lg:mx-0 lg:mt-6 lg:flex-col lg:px-0">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`flex-none rounded-lg px-3 py-2 text-sm ${active ? "bg-panel font-semibold text-text shadow-[inset_3px_0_0_var(--brand)]" : "text-muted hover:bg-panel hover:text-text"}`}>{n.label}</Link>
        );
      })}
    </nav>
  );
}
