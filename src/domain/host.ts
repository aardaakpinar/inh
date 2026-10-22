import { OSES, VULNS, type OsInfo } from "../content/systems.js";
import type { Service } from "./service.js";

/** Veritabanindaki bir sunucunun oyun tarafindaki hali. */
export interface Host {
  ip: string;
  name: string;
  owner: string;
  npc: boolean;
  level: number;
  score: number;
  honey: boolean;
  lockUntil: number; // ms (epoch)
  lockCdUntil: number; // ms (epoch)
}

export interface UserRow {
  name: string;
  ip: string;
  salt: string;
  pw: string;
}

export interface ScanHost {
  ip: string;
  name: string;
  npc: boolean;
}

export type { OsInfo };

/** Ayni IP her zaman ayni isletim sistemini dondurur (dunya tutarli kalsin). */
export function hostOs(ip: string): OsInfo {
  let h = 0;
  for (const ch of ip) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OSES[h % OSES.length];
}

export function vulnOf(svc: Service): string {
  return VULNS[svc.name] ?? "bilinen servis zafiyeti";
}

/** Uzak sunucudaki sanal dosyalar. Secret satiri arttikca dosya buyur. */
export interface VirtualFile {
  mode: string;
  links: number;
  owner: string;
  group: string;
  size: number;
  date: string;
  name: string;
}

export function virtualFiles(host: Host, changes: number): VirtualFile[] {
  const date = "Jan 12 03:14";
  return [
    { mode: "drwx------", links: 2, owner: "root", group: "root", size: 4096, date, name: "." },
    { mode: "drwxr-xr-x", links: 8, owner: "root", group: "root", size: 4096, date, name: ".." },
    { mode: "-rw-r--r--", links: 1, owner: "root", group: "root", size: 256 + changes * 48 + host.level * 16, date, name: "secret.txt" },
    { mode: "-rw-------", links: 1, owner: "root", group: "root", size: 128, date, name: ".bash_history" },
    { mode: "drwx------", links: 2, owner: "root", group: "root", size: 4096, date, name: ".ssh" },
  ];
}

/** Uzak sunucudaki sanal surec listesi; acik servisler de burada gorunur. */
export interface ProcessInfo {
  user: string;
  pid: number;
  cpu: string;
  mem: string;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
  command: string;
}

export function virtualProcesses(services: Service[]): ProcessInfo[] {
  const rows: ProcessInfo[] = [
    { user: "root", pid: 1, cpu: "0.0", mem: "0.2", vsz: 225312, rss: 9216, tty: "?", stat: "Ss", start: "03:14", time: "0:01", command: "/sbin/init" },
    { user: "root", pid: 412, cpu: "0.0", mem: "0.1", vsz: 15432, rss: 6144, tty: "?", stat: "Ss", start: "03:14", time: "0:00", command: "sshd: /usr/sbin/sshd -D" },
  ];
  services.forEach((svc, i) => {
    rows.push({
      user: "root",
      pid: 700 + i,
      cpu: "0.0",
      mem: "0.1",
      vsz: 82312,
      rss: 5120,
      tty: "?",
      stat: "S",
      start: "03:15",
      time: "0:00",
      command: `/usr/sbin/${svc.name} --port ${svc.port}`,
    });
  });
  rows.push({
    user: "root",
    pid: 933,
    cpu: "0.0",
    mem: "0.0",
    vsz: 12336,
    rss: 3072,
    tty: "?",
    stat: "S",
    start: "03:16",
    time: "0:00",
    command: "-bash",
  });
  return rows;
}
