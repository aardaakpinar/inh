export const DEFAULT_PORT = 9999;

export const ATTACK_COOLDOWN_S = 45; // ayni hedefe tekrar saldirmadan once bekleme
export const CHALLENGE_TIME_S = 45; // sifre cozme suresi
export const REMOTE_TIME_S = 60; // ele gecirilen sunucuda kalma suresi
export const BRUTE_TIME_S = 90; // bruteforce toplam suresi
export const BRUTE_TRIES = 8;
export const TICK_MS = 60_000; // pasif gelir / NPC sifirlama araligi

// ANSI renkleri
export const G = "\x1b[92m";
export const R = "\x1b[91m";
export const Y = "\x1b[93m";
export const C = "\x1b[96m";
export const D = "\x1b[90m";
export const B = "\x1b[1m";
export const X = "\x1b[0m";

export interface Service {
  port: number;
  name: string;
  version: string;
}

export const WORDS = [
  "shadow", "kernel", "proxy", "cipher", "matrix", "packet", "socket", "rootkit",
  "daemon", "buffer", "binary", "gateway", "payload", "tunnel", "vector", "exploit",
] as const;

export const SERVICES: readonly Service[] = [
  { port: 21, name: "ftp", version: "vsftpd 2.3.4" },
  { port: 22, name: "ssh", version: "OpenSSH 6.6.1" },
  { port: 25, name: "smtp", version: "Postfix 2.9.6" },
  { port: 80, name: "http", version: "Apache 2.2.8" },
  { port: 445, name: "smb", version: "Samba 3.0.20" },
  { port: 3306, name: "mysql", version: "MySQL 5.1.73" },
];

export const NPC_NAMES = [
  "bank-core", "dmz-gw", "mail-eu", "hr-portal", "backup-01", "cctv-hub", "dev-build", "vpn-edge",
] as const;

export const COST = { spoof: 15, audit: 15, honeypot: 30, lockdown: 25 } as const;
export type CostKey = keyof typeof COST;
