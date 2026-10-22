import { createHash, timingSafeEqual } from "node:crypto";

export const hashPw = (salt: string, pw: string): string =>
  createHash("sha256").update(salt + pw).digest("hex");

export function verifyPw(salt: string, pw: string, expectedHex: string): boolean {
  const a = Buffer.from(hashPw(salt, pw), "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
