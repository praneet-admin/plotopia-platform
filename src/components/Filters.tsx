"use client";
import { useRouter } from "next/navigation";

type Props = { cinemas: { id: string; name: string }[]; genres: string[]; languages: string[]; value: { cinema?: string; genre?: string; lang?: string; q?: string } };

/** One row of native selects: the fastest way to narrow a list on any device. */
export function Filters({ cinemas, genres, languages, value }: Props) {
  const router = useRouter();
  const go = (patch: Partial<Props["value"]>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...value, ...patch })) if (v) p.set(k, v);
    router.push(p.toString() ? `/?${p}` : "/");
  };
  const sel = (k: keyof Props["value"], label: string, options: { id: string; name: string }[], all: string) => (
    <label key={k} className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
      {label}
      <select className="input h-10 min-w-0 px-3 text-sm sm:min-w-[160px]" value={value[k] ?? ""} onChange={(e) => go({ [k]: e.target.value || undefined })}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
  const active = Object.entries(value).filter(([, v]) => v).length;
  return (
    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
      {sel("cinema", "Theatre", cinemas, "All theatres")}
      {sel("genre", "Genre", genres.map((g) => ({ id: g, name: g })), "All genres")}
      {sel("lang", "Language", languages.map((l) => ({ id: l, name: l })), "All languages")}
      {active > 0 && <button type="button" onClick={() => router.push("/")} className="btn btn-ghost btn-sm h-10">Clear</button>}
    </div>
  );
}
