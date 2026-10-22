export const DEFAULT_PORT = 9999;

export const ATTACK_COOLDOWN_S = 45; // ayni hedefe tekrar saldirmadan once bekleme
export const CHALLENGE_TIME_S = 45; // sifre cozme suresi
export const REMOTE_TIME_S = 60; // ele gecirilen sunucuda kalma suresi
export const BRUTE_TIME_S = 90; // bruteforce toplam suresi
export const BRUTE_TRIES = 8;
export const TICK_MS = 60_000; // pasif gelir / NPC sifirlama araligi

export const COST = { spoof: 15, audit: 15, honeypot: 30, lockdown: 25 } as const;
export type CostKey = keyof typeof COST;
