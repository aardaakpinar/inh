import { HELPDB } from "../../content/help.js";
import { validIp } from "../../core/util.js";
import { hostOs } from "../../domain/host.js";
import type { Sess } from "../../infra/net/session.js";
import { B, D, R, X, Y } from "../../ui/ansi.js";
import { renderPortscan, renderScan } from "../../ui/render.js";

const usage = (s: Sess, key: string): void => s.out(`${Y}Kullanim: ${HELPDB.get(key)!.usage}${X}`);

async function scan(s: Sess): Promise<void> {
  const { repo, rng } = s.world;
  s.out(`[*] ${B}10.0.0.0/8${X} agi taraniyor (TCP SYN)`);
  await s.lag(0.4, 0.7);
  for (let i = 0; i < 4; i++) {
    await s.lag(0.25, 0.5);
    s.write(".");
  }
  const found = repo.scanHosts(s.ip, 6);
  const players = found.filter((h) => !h.npc).length;
  const rows = found.map((h) => ({ ip: h.ip, name: h.name, os: hostOs(h.ip).short, ms: rng.int(5, 90) }));
  s.out(`\n\n${renderScan(rows, players, found.length - players)}`);
}

async function portscan(s: Sess, a: string[]): Promise<void> {
  if (!a.length) {
    usage(s, "portscan");
    return;
  }
  if (!validIp(a[0])) {
    s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
    return;
  }
  const targetIp = a[0];
  s.out(`[*] ${targetIp} uzerinde 1000 port deneniyor...`);
  await s.lag(0.7, 1.3);
  const { repo } = s.world;
  const t = repo.host(targetIp);
  if (!t) {
    s.out(`${R}Host kapali / ulasilamiyor.${X}`);
    return;
  }
  const src = s.spoof ?? s.ip;
  if (!t.npc && targetIp !== s.ip) {
    s.world.events.emit({ type: "PortScanned", targetIp, srcIp: src });
  }
  const services = repo.servicesOf(targetIp).sort((x, y) => x.port - y.port);
  s.out(renderPortscan(services, hostOs(targetIp).short, t.level));
}

async function ping(s: Sess, a: string[]): Promise<void> {
  if (!a.length) {
    usage(s, "ping");
    return;
  }
  if (!validIp(a[0])) {
    s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
    return;
  }
  const target = a[0];
  const targetName = s.world.repo.host(target)?.name ?? target;
  s.out(`PING ${targetName} (${target}) 56(84) bytes of data.`);
  if (!s.world.repo.hostExists(target)) {
    await s.lag(0.4, 0.8);
    s.out(
      `From ${target} icmp_seq=1 Destination Host Unreachable\n\n` +
        `--- ${target} ping statistics ---\n1 packets transmitted, 0 received, 100% packet loss`,
    );
    return;
  }
  const times: number[] = [];
  for (let i = 1; i <= 3; i++) {
    await s.lag(0.2, 0.4);
    const ms = s.world.rng.int(8, 90);
    times.push(ms);
    s.out(`64 bytes from ${target}: icmp_seq=${i} ttl=${s.world.rng.int(52, 64)} time=${ms} ms`);
  }
  const avg = Math.round(times.reduce((x, y) => x + y, 0) / times.length);
  s.out(
    `\n--- ${target} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss\n` +
      `rtt min/avg/max = ${Math.min(...times)}/${avg}/${Math.max(...times)} ms`,
  );
}

async function traceroute(s: Sess, a: string[]): Promise<void> {
  if (!a.length) {
    usage(s, "traceroute");
    return;
  }
  if (!validIp(a[0])) {
    s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
    return;
  }
  const t = s.world.repo.host(a[0]);
  if (!t) {
    s.out(`${R}* * * ulasilamiyor${X}`);
    return;
  }
  s.out(`traceroute to ${t.name} (${a[0]}), 30 hops max, 60 byte packets`);
  const hops = s.world.rng.int(4, 7);
  for (let i = 1; i < hops; i++) {
    await s.lag(0.2, 0.5);
    const hop = `10.${s.world.rng.int(0, 254)}.${s.world.rng.int(0, 254)}.${s.world.rng.int(1, 254)}`;
    s.out(`${String(i).padStart(2)}  ${hop.padEnd(16)} ${i * s.world.rng.int(4, 15)}ms`);
  }
  await s.lag(0.2, 0.4);
  s.out(`${String(hops).padStart(2)}  ${a[0].padEnd(16)} ${hops * s.world.rng.int(4, 15)}ms`);
}

export async function runRecon(cmd: string, s: Sess, a: string[]): Promise<boolean> {
  switch (cmd) {
    case "scan":
      await scan(s);
      return true;
    case "portscan":
      await portscan(s, a);
      return true;
    case "ping":
      await ping(s, a);
      return true;
    case "traceroute":
      await traceroute(s, a);
      return true;
    default:
      return false;
  }
}
