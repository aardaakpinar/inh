import type { Service } from "../domain/service.js";

/** Sifre cozme gorevlerinde kullanilan kelime havuzu. */
export const WORDS = [
  "shadow", "kernel", "proxy", "cipher", "matrix", "packet", "socket", "rootkit",
  "daemon", "buffer", "binary", "gateway", "payload", "tunnel", "vector", "exploit",
] as const;

/** Sunucularda rastgele acilan servisler. */
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

export interface OsInfo {
  short: string;
  kernel: string;
  arch: string;
}

export const OSES: readonly OsInfo[] = [
  { short: "Linux 5.15 (Ubuntu 22.04)", kernel: "5.15.0-91-generic", arch: "x86_64" },
  { short: "Linux 6.1 (Debian 12)", kernel: "6.1.0-18-amd64", arch: "x86_64" },
  { short: "Linux 3.10 (CentOS 7)", kernel: "3.10.0-1160.el7.x86_64", arch: "x86_64" },
  { short: "FreeBSD 13.2", kernel: "13.2-RELEASE-p10", arch: "amd64" },
];

export const VULNS: Record<string, string> = {
  ftp: "anonim yazma izni + zayif parola dogrulamasi",
  ssh: "eski anahtar degisimi + kullanici numaralandirma",
  smtp: "acik relay + dogrulanmamis kullanici listesi",
  http: "dizin listeleme + yapilandirma dosyasi sizintisi",
  smb: "imzasiz oturum + uzaktan kod calistirma",
  mysql: "parolasiz root + uzak baglanti izni",
};
