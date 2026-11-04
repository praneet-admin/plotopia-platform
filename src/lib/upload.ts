import "server-only";

export const MAX_UPLOAD = 600 * 1024;

/**
 * Admin image uploads become data URLs stored in the row: the hosted build has
 * no writable disk and every image here is small (a logo, a poster thumbnail).
 */
export async function fileToDataUrl(f: FormDataEntryValue | null, max = MAX_UPLOAD): Promise<string | null> {
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > max) throw new Error(`${f.name} is ${Math.round(f.size / 1024)} KB; the limit is ${Math.round(max / 1024)} KB. Resize it or paste a URL instead.`);
  if (!/^image\/(png|jpeg|webp|svg\+xml|gif|x-icon|avif)$/.test(f.type)) throw new Error("Upload a PNG, JPEG, WebP, AVIF, SVG or GIF.");
  const buf = Buffer.from(await f.arrayBuffer());
  return `data:${f.type};base64,${buf.toString("base64")}`;
}

/** Resolve an image field from a form: cleared, uploaded, pasted URL, or kept. */
export async function imageField(fd: FormData, key: string, current: string | null | undefined, max = MAX_UPLOAD) {
  if (fd.get(`${key}_clear`) === "on") return null;
  const up = await fileToDataUrl(fd.get(`${key}_file`), max);
  if (up) return up;
  const url = String(fd.get(key) ?? "").trim();
  if (url) return url;
  return current?.startsWith("data:") ? current : null;
}
