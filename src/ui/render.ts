import type { LockdownState } from "../domain/defense.js";
import type { Host, ProcessInfo, VirtualFile } from "../domain/host.js";
import type { Service } from "../domain/service.js";
import type { TopPlayer } from "../domain/ports.js";
import { B, D, G, X, Y } from "./ansi.js";

export const pad = (value: string | number, width: number): string => String(value).padEnd(width);

export interface ScanRow {
  ip: string;
  name: string;
  os: string;
  ms: number;
}

export function renderScan(rows: ScanRow[], players: number, npcs: number): string {
  const out = [`${B}IP               HOSTNAME        ISLETIM SISTEMI           GECIKME${X}`];
  for (const r of rows) out.push(`${pad(r.ip, 16)} ${pad(r.name, 15)} ${pad(r.os, 24)} ${r.ms}ms`);
  out.push(`${D}(${rows.length} canli sunucu: ${players} oyuncu, ${npcs} NPC)${X}`);
  return out.join("\n");
}

export function renderPortscan(services: Service[], os: string, level: number): string {
  const out = [`${B}PORT     STATE  SERVICE   VERSION${X}`];
  for (const p of services) out.push(`${pad(p.port, 8)} ${G}open ${X}  ${pad(p.name, 9)} ${p.version}`);
  out.push(`${D}OS tahmini: ${os} | Guvenlik seviyesi: ${level}/5 | ${services.length} acik port${X}`);
  return out.join("\n");
}

export function renderTop(rows: TopPlayer[]): string {
  if (!rows.length) return "Skor tablosu bos.";
  const out = [`${B}#  PUAN  KULLANICI      IP${X}`];
  rows.forEach((r, i) => out.push(`${pad(i + 1, 2)} ${pad(r.score, 5)} ${pad(r.owner, 13)} ${r.ip}`));
  return out.join("\n");
}

export function renderStatus(
  host: Host,
  firewallCount: number,
  lockdown: LockdownState,
  ports: string,
): string {
  const lock = lockdown.active
    ? `${Y}AKTIF (${lockdown.left} sn)${X}`
    : lockdown.cooldownLeft > 0
      ? `bekleme ${lockdown.cooldownLeft} sn`
      : "hazir";
  return (
    `${B}SAVUNMA DURUMU${X}\n  seviye     : ${host.level}/5\n  puan       : ${host.score}\n` +
    `  firewall   : ${firewallCount} engelli IP\n` +
    `  honeypot   : ${host.honey ? G + "KURULU" + X : "yok"}\n  lockdown   : ${lock}\n  acik portlar: ${ports}`
  );
}

export function renderLs(files: VirtualFile[]): string {
  const out = ["total 32"];
  for (const f of files) {
    out.push(
      `${f.mode} ${String(f.links).padStart(2)} ${pad(f.owner, 5)} ${pad(f.group, 5)} ` +
        `${String(f.size).padStart(5)} ${f.date} ${f.name}`,
    );
  }
  return out.join("\n");
}

export function renderPs(processes: ProcessInfo[]): string {
  const out = [`USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND`];
  for (const p of processes) {
    out.push(
      `${pad(p.user, 10)} ${String(p.pid).padStart(4)} ${p.cpu.padStart(4)} ${p.mem.padStart(4)} ` +
        `${String(p.vsz).padStart(6)} ${String(p.rss).padStart(5)} ${pad(p.tty, 8)} ${pad(p.stat, 4)} ` +
        `${pad(p.start, 5)} ${p.time.padStart(5)} ${p.command}`,
    );
  }
  return out.join("\n");
}
