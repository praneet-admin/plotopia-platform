"use client";
import { useRouter } from "next/navigation";

export function TheatreSelect({ id, cinemas, value, params }: { id: string; cinemas: { id: string; name: string }[]; value: string; params: Record<string, string | undefined> }) {
  const router = useRouter();
  return (
    <select
      id={id}
      className="input h-11 w-full max-w-[360px]"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...params, cinema: e.target.value })) if (v) p.set(k, v);
        router.push(p.toString() ? `/?${p}` : "/");
      }}
    >
      <option value="">All theatres in Chennai</option>
      {cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
