import type { Movie } from "@/db/schema";

/** Typographic poster so the demo ships without copyrighted artwork. */
export function Poster({ movie, className = "", size = "md" }: { movie: Pick<Movie, "title" | "accent" | "accent2" | "language" | "certificate">; className?: string; size?: "sm" | "md" | "lg" }) {
  const fs = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className={`poster ${className}`} style={{ background: `linear-gradient(160deg, ${movie.accent2} -30%, ${movie.accent} 55%, #0b0d12 130%)` }}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(255,255,255,.5) 0, transparent 35%), repeating-linear-gradient(135deg, transparent 0 14px, rgba(255,255,255,.05) 14px 15px)" }} />
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
        <div className={`${fs} font-black leading-[1.05] tracking-tight text-white drop-shadow`} style={{ textWrap: "balance" }}>{movie.title}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/75">{movie.language} · {movie.certificate}</div>
      </div>
    </div>
  );
}
