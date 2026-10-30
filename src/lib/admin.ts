import "server-only";
import { redirect } from "next/navigation";
import { can, currentStaff, type Role } from "./auth";

/** Page guard: redirects to the staff login, or to the dashboard when the role is too low. */
export async function requireStaff(need?: Role | Role[]) {
  const s = await currentStaff();
  if (!s) redirect("/admin/login");
  if (need && !can(s.role, need)) redirect("/admin?denied=1");
  return s;
}

export const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["admin", "manager", "boxoffice"] },
  { href: "/admin/counter", label: "Counter", roles: ["admin", "manager", "boxoffice"] },
  { href: "/admin/scan", label: "Gate scan", roles: ["admin", "manager", "boxoffice", "usher"] },
  { href: "/admin/bookings", label: "Bookings", roles: ["admin", "manager", "boxoffice"] },
  { href: "/admin/shows", label: "Shows", roles: ["admin", "manager"] },
  { href: "/admin/movies", label: "Movies", roles: ["admin", "manager"] },
  { href: "/admin/halls", label: "Halls", roles: ["admin", "manager"] },
  { href: "/admin/pricing", label: "Pricing", roles: ["admin", "manager"] },
  { href: "/admin/reports", label: "Reports", roles: ["admin", "manager"] },
  { href: "/admin/messages", label: "Messages", roles: ["admin", "manager", "boxoffice"] },
  { href: "/admin/staff", label: "Staff", roles: ["admin"] },
];
