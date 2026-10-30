import { randomBytes, randomUUID } from "node:crypto";

export const uuid = () => randomUUID();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function shortCode(len = 6) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
export const bookingCode = () => `SHW-${shortCode(6)}`;
export const token = (bytes = 24) => randomBytes(bytes).toString("base64url");
