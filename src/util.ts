import { randomInt } from "node:crypto";

/** [a, b] araliginda (ikisi de dahil) rastgele tam sayi. */
export const rint = (a: number, b: number): number => randomInt(a, b + 1);

export const choice = <T>(arr: readonly T[]): T => arr[randomInt(arr.length)];

/** Tekrarsiz k eleman (Fisher-Yates ile). */
export function sample<T>(arr: readonly T[], k: number): T[] {
  const copy = [...arr];
  const n = Math.min(k, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(copy.length - i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const pad = (v: string | number, n: number): string => String(v).padEnd(n);

export const nowHms = (): string => new Date().toTimeString().slice(0, 8);

export function validIp(x: string): boolean {
  const p = x.split(".");
  return p.length === 4 && p.every((i) => /^\d{1,3}$/.test(i) && Number(i) <= 255);
}

export const randomIp = (): string => `10.${rint(0, 254)}.${rint(0, 254)}.${rint(1, 254)}`;
