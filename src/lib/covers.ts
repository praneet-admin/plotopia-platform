import { existsSync } from "node:fs";
import path from "node:path";

/** A real cover wins over the generated one: drop public/covers/<movie id>.jpg|webp|png. */
export function coverFor(id: string) {
  for (const ext of ["jpg", "webp", "png"]) if (existsSync(path.join(process.cwd(), "public", "covers", `${id}.${ext}`))) return `/covers/${id}.${ext}`;
  return null;
}
