"use client";
import { useRouter } from "next/navigation";
import { SeatPicker } from "@/components/SeatPicker";

type Props = Omit<Parameters<typeof SeatPicker>[0], "mode" | "onProceed">;
export function CounterPicker(props: Props) {
  const router = useRouter();
  return (
    <SeatPicker
      {...props}
      mode="counter"
      onProceed={async (labels) => {
        const r = await fetch(`/api/shows/${props.showId}/hold`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seats: labels }) });
        if (!r.ok) { const j = await r.json(); throw new Error(j.seats?.length ? `${j.seats.join(", ")} just got taken.` : j.error); }
        router.push(`/admin/counter/${props.showId}/confirm`);
      }}
    />
  );
}
