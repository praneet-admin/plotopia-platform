import { existsSync } from "node:fs";
import path from "node:path";
import type { Movie } from "@/db/schema";

type P = Pick<Movie, "id" | "title" | "accent" | "accent2" | "language" | "certificate">;

/** A real cover wins over the generated one: drop public/covers/<movie id>.jpg|webp|png. */
export function coverFor(id: string) {
  for (const ext of ["jpg", "webp", "png"]) if (existsSync(path.join(process.cwd(), "public", "covers", `${id}.${ext}`))) return `/covers/${id}.${ext}`;
  return null;
}

function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/**
 * Procedural film poster: one of four motifs chosen by the film id, the film's
 * two colours, film grain and a vignette, with the title set large. The demo
 * ships without licensed artwork, so the posters have to carry themselves.
 */
export function Poster({ movie, className = "", size = "md", priority }: { movie: P; className?: string; size?: "sm" | "md" | "lg"; priority?: boolean }) {
  const h = hash(movie.id);
  const motif = h % 4;
  const seed = (h >> 4) % 1000;
  const fs = size === "lg" ? "text-[clamp(28px,4vw,44px)]" : size === "sm" ? "text-[15px]" : "text-[clamp(17px,2vw,22px)]";
  const a = movie.accent, b = movie.accent2;
  const cover = coverFor(movie.id);
  if (cover) {
    return (
      <div className={`poster ${className}`} style={{ background: a }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={`${movie.title} poster`} className="absolute inset-0 h-full w-full object-cover" loading={priority ? "eager" : "lazy"} />
      </div>
    );
  }
  return (
    <div className={`poster ${className}`} style={{ background: a }} aria-hidden={false}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id={`g-${movie.id}`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={seed} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0 0.35" /></feComponentTransfer></filter>
          <radialGradient id={`v-${movie.id}`} cx="50%" cy="35%" r="80%"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".75" /></radialGradient>
        </defs>
        {motif === 0 && (<g>
          <circle cx="135" cy="95" r="62" fill={b} />
          <rect x="0" y="150" width="200" height="150" fill="#000" opacity=".35" />
          <path d="M0 165 Q100 120 200 165 L200 300 L0 300 Z" fill={a} opacity=".9" />
        </g>)}
        {motif === 1 && (<g>
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-60 + i * 48} y="-40" width="26" height="380" fill={b} opacity={0.18 + (i % 3) * 0.14} transform="rotate(-18 100 150)" />)}
          <circle cx="60" cy="210" r="40" fill={b} />
        </g>)}
        {motif === 2 && (<g>
          {[150, 120, 90, 60, 30].map((r, i) => <circle key={r} cx="100" cy="300" r={r} fill="none" stroke={b} strokeWidth="10" opacity={0.15 + i * 0.12} />)}
          <rect x="0" y="0" width="200" height="110" fill={b} opacity=".12" />
        </g>)}
        {motif === 3 && (<g>
          {Array.from({ length: 36 }, (_, i) => { const x = (i % 6) * 36 + 18, y = Math.floor(i / 6) * 40 + 20; const r = 3 + ((hash(movie.id + i) % 7) ); return <circle key={i} cx={x} cy={y} r={r} fill={b} opacity=".55" />; })}
          <path d="M0 300 L200 120 L200 300 Z" fill={b} opacity=".35" />
        </g>)}
        <rect width="200" height="300" fill={`url(#v-${movie.id})`} />
        <rect width="200" height="300" filter={`url(#g-${movie.id})`} opacity=".9" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
        <div className={`${fs} font-extrabold leading-[0.98] tracking-[-0.03em] text-white`} style={{ textWrap: "balance", textShadow: "0 2px 18px rgba(0,0,0,.45)" }}>{movie.title}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-white/80"><span>{movie.language}</span><span className="rounded border border-white/40 px-1 leading-4">{movie.certificate}</span></div>
      </div>
    </div>
  );
}
