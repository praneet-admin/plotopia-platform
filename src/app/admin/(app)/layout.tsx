import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Header";
import { can, staffLogout } from "@/lib/auth";
import { NAV, requireStaff } from "@/lib/admin";
import { AdminNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const items = NAV.filter((n) => can(me.role, n.roles));
  async function logout() { "use server"; await staffLogout(); redirect("/admin/login"); }
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col gap-2 border-b border-line bg-bg-2 px-4 py-3 lg:w-60 lg:flex-none lg:border-b-0 lg:border-r lg:py-5">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="pill ml-2 hidden text-[10px] lg:inline-flex">Back office</span>
          <form action={logout} className="lg:hidden"><button className="btn btn-ghost btn-sm">Sign out</button></form>
        </div>
        <AdminNav items={items} />
        <div className="hidden lg:mt-auto lg:block">
          <div className="text-sm font-semibold">{me.name}</div>
          <div className="text-xs capitalize text-muted">{me.role}</div>
          <form action={logout} className="mt-2"><button className="btn btn-ghost btn-sm w-full">Sign out</button></form>
          <Link href="/" className="mt-3 block text-xs text-muted hover:text-text">← Customer site</Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
