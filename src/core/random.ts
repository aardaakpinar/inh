import { randomInt } from "node:crypto";

/** Oyunun rastgelelik kaynagi. Testlerde deterministik bir uygulama enjekte edilebilir. */
export interface Rng {
  /** [min, max] araliginda (ikisi de dahil) tam sayi. */
  int(min: number, max: number): number;
  choice<T>(items: readonly T[]): T;
  /** Tekrarsiz count eleman (Fisher-Yates). */
  sample<T>(items: readonly T[], count: number): T[];
}

export class CryptoRng implements Rng {
  int(min: number, max: number): number {
    return randomInt(min, max + 1);
  }

  choice<T>(items: readonly T[]): T {
    return items[randomInt(items.length)];
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const copy = [...items];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const j = i + randomInt(copy.length - i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }
}

export const cryptoRng = new CryptoRng();

export const randomIp = (rng: Rng): string =>
  `10.${rng.int(0, 254)}.${rng.int(0, 254)}.${rng.int(1, 254)}`;
