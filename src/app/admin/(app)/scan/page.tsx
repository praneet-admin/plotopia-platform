import { requireStaff } from "@/lib/admin";
import { Scanner } from "./scanner";

export default async function ScanPage() {
  await requireStaff(["admin", "manager", "boxoffice", "usher"]);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div><h1 className="text-2xl font-bold">Gate check-in</h1><div className="text-sm text-muted">Point the camera at the ticket QR, or type the booking id.</div></div>
      <Scanner />
    </div>
  );
}
