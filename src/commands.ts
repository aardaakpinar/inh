// Giris, ana shell, saldiri komutlari ve root shell.
import { randomBytes } from "node:crypto";
import {
  ATTACK_COOLDOWN_S, B, BRUTE_TIME_S, BRUTE_TRIES, C, CHALLENGE_TIME_S, COST, D, G, R, REMOTE_TIME_S,
  X, Y, type CostKey, type Service,
} from "./config.js";
import type { Host } from "./db.js";
import {
  BANNER, bullsCows, HELPDB, helpText, hostOs, hashPw, makeChallenge, MISSION, REMOTE_HELP, showSecret, verifyPw,
  vulnOf,
} from "./game.js";
import { AskTimeout, type Sess } from "./session.js";
import { nowHms, pad, randomIp, rint, validIp } from "./util.js";

// ============================================================ giris
const LOGIN_TRIES = 3;

export async function login(s: Sess): Promise<boolean> {
  const { repo } = s.game;
  s.out(BANNER);
  const name = (await s.ask("Kullanici adi: ", 120)).toLowerCase();
  if (!/^[\p{L}\p{N}]{3,12}$/u.test(name)) {
    s.out(R + "3-12 karakter, sadece harf/rakam." + X);
    return false;
  }

  const existing = repo.user(name);
  const isNew = !existing;
  if (existing) {
    let ok = false;
    for (let i = 0; i < LOGIN_TRIES && !ok; i++) {
      const pw = await s.ask(i === 0 ? "Parola: " : `Parola (${i + 1}/${LOGIN_TRIES}): `, 120);
      ok = verifyPw(existing.salt, pw, existing.pw);
      if (!ok) s.out(`${R}Erisim reddedildi.${X}`);
    }
    if (!ok) {
      s.out(`${R}Cok fazla hatali deneme. Baglanti kapatiliyor.${X}`);
      return false;
    }
    s.ip = existing.ip;
  } else {
    s.out(Y + "Yeni kullanici. Sunucun kuruluyor..." + X);
    let pw = "";
    for (let i = 0; i < LOGIN_TRIES; i++) {
      const p1 = await s.ask("Parola belirle: ", 120);
      if (p1.length < 4) {
        s.out(`${R}Parola en az 4 karakter olmali.${X}`);
        continue;
      }
      if (p1 !== (await s.ask("Tekrar: ", 120))) {
        s.out(`${R}Parolalar uyusmuyor.${X}`);
        continue;
      }
      pw = p1;
      break;
    }
    if (!pw) {
      s.out(`${R}Kayit tamamlanamadi. Baglanti kapatiliyor.${X}`);
      return false;
    }
    if (repo.user(name)) {
      s.out(`${R}Bu kullanici adi az once alindi.${X}`);
      return false;
    }
    const salt = randomBytes(4).toString("hex");
    s.ip = repo.registerPlayer(name, salt, hashPw(salt, pw));
    s.out(`${G}[+] Sunucu kuruldu. IP adresin: ${B}${s.ip}${X}`);
  }

  s.user = name;
  // Ayni oyuncu baska yerden girerse eski oturum kapatilir (alarmlar yeni oturuma gelsin).
  const old = s.game.online.get(s.ip);
  if (old && old !== s) {
    old.out(`\n${Y}[!] Hesabina baska bir yerden giris yapildi. Baglanti kapatiliyor.${X}`);
    old.close();
  }
  s.game.online.set(s.ip, s);

  const host = repo.host(s.ip)!;
  const os = hostOs(s.ip);
  const ownPorts = repo.servicesOf(s.ip).map((p) => `${p.port}/${p.name}`).join(", ");
  s.out(
    `${G}[+] ${isNew ? "Sunucun hazir" : "Baglanti kuruldu"}: ${s.user}@${host.name} (${s.ip})${X}\n` +
      `${D}OS: ${os.short} | seviye ${host.level}/5 | puan ${host.score}\nAcik portlar: ${ownPorts}${X}`,
  );
  const logs = repo.logCount(s.ip);
  if (logs) s.out(`${Y}Sen yokken ${logs} olay kaydedildi. 'logs' yaz.${X}`);
  s.out(isNew ? "\n" + MISSION : `\n${D}Yardim: help | Durum: status | Olaylar: logs${X}`);
  return true;
}

// ============================================================ ana shell
export async function shell(s: Sess): Promise<void> {
  const { repo } = s.game;
  for (;;) {
    const me = repo.host(s.ip)!;
    const parts = (await s.ask(`${G}${s.user}@${me.name}${X}:~$ `)).split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const cmd = parts[0].toLowerCase();
    const a = parts.slice(1);
    const nowMs = Date.now();
    const usage = () => s.out(`${Y}Kullanim: ${HELPDB.get(cmd)!.usage}${X}`);
    const pay = (name: CostKey): boolean => {
      if (me.score < COST[name]) {
        s.out(`${R}Yetersiz puan (${COST[name]} gerekli, sende ${me.score}).${X}`);
        return false;
      }
      repo.addScore(s.ip, -COST[name]);
      return true;
    };
    const ports = () => repo.servicesOf(s.ip).map((p) => p.port).join(", ");

    switch (cmd) {
      case "exit":
      case "logout":
        s.out("Baglanti kapatildi.");
        return;
      case "help":
        s.out(helpText(a[0]?.toLowerCase()));
        break;
      case "clear":
        s.out("\x1b[2J\x1b[H");
        break;
      case "ls":
        s.out("secret.txt");
        break;
      case "cat":
        if (a[0] === "secret.txt") s.out(showSecret(me.owner, repo.secretLines(s.ip)));
        else usage();
        break;
      case "ifconfig":
        s.out(
          `eth0  inet ${s.ip}  netmask 255.0.0.0\nhost  ${me.name}\nos    ${hostOs(s.ip).short}\n` +
            `seviye ${me.level}/5   puan ${me.score}\nacik portlar: ${ports()}`,
        );
        break;
      case "status": {
        const lockLeft = Math.trunc((me.lockUntil - nowMs) / 1000);
        const lock =
          lockLeft > 0
            ? `${Y}AKTIF (${lockLeft} sn)${X}`
            : me.lockCdUntil > nowMs
              ? `bekleme ${Math.trunc((me.lockCdUntil - nowMs) / 1000)} sn`
              : "hazir";
        s.out(
          `${B}SAVUNMA DURUMU${X}\n  seviye     : ${me.level}/5\n  puan       : ${me.score}\n` +
            `  firewall   : ${repo.firewallList(s.ip).length} engelli IP\n` +
            `  honeypot   : ${me.honey ? G + "KURULU" + X : "yok"}\n  lockdown   : ${lock}\n  acik portlar: ${ports()}`,
        );
        break;
      }
      case "logs": {
        const logs = repo.recentLogs(s.ip, 25);
        s.out(`${B}SON OLAYLAR${X}`);
        s.out(logs.join("\n") || "Kayit yok.");
        if (logs.length) repo.clearLogs(s.ip);
        break;
      }
      case "top": {
        const rows = repo.topPlayers(10);
        if (!rows.length) {
          s.out("Skor tablosu bos.");
          break;
        }
        s.out(`${B}#  PUAN  KULLANICI      IP${X}`);
        rows.forEach((r, i) => s.out(`${pad(i + 1, 2)} ${pad(r.score, 5)} ${pad(r.owner, 13)} ${r.ip}`));
        break;
      }
      case "scan": {
        s.out(`[*] ${B}10.0.0.0/8${X} agi taraniyor (TCP SYN)`);
        await s.lag(0.4, 0.7);
        for (let i = 0; i < 4; i++) {
          await s.lag(0.25, 0.5);
          s.write(".");
        }
        const found = repo.scanHosts(s.ip, 6);
        const players = found.filter((h) => !h.npc).length;
        s.out(`\n\n${B}IP               HOSTNAME        ISLETIM SISTEMI           GECIKME${X}`);
        for (const h of found) {
          const os = hostOs(h.ip);
          s.out(`${pad(h.ip, 16)} ${pad(h.name, 15)} ${pad(os.short, 24)} ${rint(5, 90)}ms`);
        }
        s.out(`${D}(${found.length} canli sunucu: ${players} oyuncu, ${found.length - players} NPC)${X}`);
        break;
      }
      case "portscan": {
        if (!a.length) {
          usage();
          break;
        }
        if (!validIp(a[0])) {
          s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
          break;
        }
        s.out(`[*] ${a[0]} uzerinde 1000 port deneniyor...`);
        await s.lag(0.7, 1.3);
        const t = repo.host(a[0]);
        if (!t) {
          s.out(`${R}Host kapali / ulasilamiyor.${X}`);
          break;
        }
        const src = s.spoof ?? s.ip;
        if (!t.npc && a[0] !== s.ip) {
          repo.addLog(a[0], `[${nowHms()}] PORT TARAMASI: ${src}`);
          s.game.notify(a[0], `${src} adresinden port taramasi tespit edildi.`);
        }
        const services = repo.servicesOf(a[0]).sort((x, y) => x.port - y.port);
        s.out(`${B}PORT     STATE  SERVICE   VERSION${X}`);
        for (const p of services) {
          s.out(`${pad(p.port, 8)} ${G}open ${X}  ${pad(p.name, 9)} ${p.version}`);
        }
        const os = hostOs(a[0]);
        s.out(
          `${D}OS tahmini: ${os.short} | Guvenlik seviyesi: ${t.level}/5 | ${services.length} acik port${X}`,
        );
        break;
      }
      case "ping": {
        if (!a.length) {
          usage();
          break;
        }
        if (!validIp(a[0])) {
          s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
          break;
        }
        const target = a[0];
        const targetName = repo.host(target)?.name ?? target;
        s.out(`PING ${targetName} (${target}) 56(84) bytes of data.`);
        if (!repo.hostExists(target)) {
          await s.lag(0.4, 0.8);
          s.out(
            `From ${target} icmp_seq=1 Destination Host Unreachable\n\n` +
              `--- ${target} ping statistics ---\n1 packets transmitted, 0 received, 100% packet loss`,
          );
          break;
        }
        const times: number[] = [];
        for (let i = 1; i <= 3; i++) {
          await s.lag(0.2, 0.4);
          const ms = rint(8, 90);
          times.push(ms);
          s.out(`64 bytes from ${target}: icmp_seq=${i} ttl=${rint(52, 64)} time=${ms} ms`);
        }
        const avg = Math.round(times.reduce((x, y) => x + y, 0) / times.length);
        s.out(
          `\n--- ${target} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss\n` +
            `rtt min/avg/max = ${Math.min(...times)}/${avg}/${Math.max(...times)} ms`,
        );
        break;
      }
      case "traceroute": {
        if (!a.length) {
          usage();
          break;
        }
        if (!validIp(a[0])) {
          s.out(`${R}Gecersiz IP: ${a[0]}${X}`);
          break;
        }
        const t = repo.host(a[0]);
        if (!t) {
          s.out(`${R}* * * ulasilamiyor${X}`);
          break;
        }
        s.out(`traceroute to ${t.name} (${a[0]}), 30 hops max, 60 byte packets`);
        const hops = rint(4, 7);
        for (let i = 1; i < hops; i++) {
          await s.lag(0.2, 0.5);
          s.out(`${pad(i, 2)}  ${pad(`10.${rint(0, 254)}.${rint(0, 254)}.${rint(1, 254)}`, 16)} ${i * rint(4, 15)}ms`);
        }
        await s.lag(0.2, 0.4);
        s.out(`${pad(hops, 2)}  ${pad(a[0], 16)} ${hops * rint(4, 15)}ms`);
        break;
      }
      case "spoof": {
        const fake = a[0] ?? randomIp();
        if (!validIp(fake)) {
          usage();
          break;
        }
        if (pay("spoof")) {
          s.spoof = fake;
          s.out(`${G}[+] Siradaki saldiri/tarama ${fake} adresinden gelmis gorunecek. (-${COST.spoof} puan)${X}`);
          if (repo.hostExists(fake)) s.out(`${D}(Bu gercek bir oyuncunun/sunucunun IP'si: suc ona kalacak.)${X}`);
        }
        break;
      }
      case "cleanse":
        repo.clearSecret(s.ip);
        s.out(`${G}secret.txt temizlendi.${X}`);
        break;
      case "harden": {
        if (me.level >= 5) {
          s.out("Zaten maksimum seviye.");
          break;
        }
        const cost = 40 * me.level;
        if (me.score < cost) {
          s.out(`${R}Yetersiz puan (${cost} gerekli).${X}`);
          break;
        }
        repo.addScore(s.ip, -cost);
        repo.setLevel(s.ip, me.level + 1);
        const gone = repo.closeRandomService(s.ip);
        if (gone) s.out(`${Y}Port ${gone.port} kapatildi.${X}`);
        s.out(`${G}Savunma seviyesi: ${me.level + 1}/5 (-${cost} puan)${X}`);
        break;
      }
      case "firewall":
        firewall(s, a, usage);
        break;
      case "audit": {
        if (!pay("audit")) break;
        await s.lag(0.8, 1.5);
        const bd = repo.backdoorList(s.ip);
        if (bd.length) {
          s.out(`${R}[!] ${bd.length} arka kapi bulundu ve silindi:${X}`);
          for (const ip of bd) s.out(`    kurucu IP: ${ip}`);
          repo.clearBackdoors(s.ip);
        } else {
          s.out(`${G}[+] Temiz. Arka kapi bulunamadi.${X}`);
        }
        break;
      }
      case "honeypot":
        if (me.honey) {
          s.out("Tuzak zaten kurulu.");
          break;
        }
        if (pay("honeypot")) {
          repo.setHoney(s.ip, true);
          s.out(`${G}[+] Honeypot kuruldu. Siradaki sizan tuzaga dusecek. (-${COST.honeypot} puan)${X}`);
        }
        break;
      case "lockdown":
        if (me.lockUntil > nowMs) {
          s.out("Lockdown zaten aktif.");
          break;
        }
        if (me.lockCdUntil > nowMs) {
          s.out(`${Y}Lockdown beklemede: ${Math.trunc((me.lockCdUntil - nowMs) / 1000)} sn.${X}`);
          break;
        }
        if (pay("lockdown")) {
          repo.setLock(s.ip, nowMs + 60_000, nowMs + 300_000);
          s.out(`${R}[!] LOCKDOWN: tum portlar 60 sn kapali. (-${COST.lockdown} puan)${X}`);
        }
        break;
      case "exploit":
      case "bruteforce":
        if (a.length < 2) usage();
        else await (cmd === "exploit" ? exploit : bruteforce)(s, a[0], a[1]);
        break;
      default:
        if (HELPDB.has(cmd)) usage();
        else s.out(`${R}Bilinmeyen komut. 'help' yaz.${X}`);
    }
  }
}

function firewall(s: Sess, a: string[], usage: () => void): void {
  const { repo } = s.game;
  const list = repo.firewallList(s.ip);
  if (!a.length) {
    s.out("Engelli IP'ler: " + (list.join(", ") || "yok"));
    return;
  }
  if (a.length !== 2 || (a[0] !== "block" && a[0] !== "unblock") || !validIp(a[1])) {
    usage();
    return;
  }
  const target = a[1];
  if (a[0] === "block") {
    if (target === s.ip) s.out(`${R}Kendini engelleyemezsin.${X}`);
    else if (list.includes(target)) s.out("Zaten engelli.");
    else if (list.length >= 8) s.out(`${R}En fazla 8 IP engelleyebilirsin.${X}`);
    else {
      repo.block(s.ip, target);
      s.out(`${G}[+] ${target} engellendi.${X}`);
    }
  } else if (list.includes(target)) {
    repo.unblock(s.ip, target);
    s.out(`[+] ${target} engeli kalkti.`);
  } else {
    s.out("Bu IP engelli degil.");
  }
}

// ============================================================ saldiri
interface Approach {
  t: Host;
  svc: Service;
  src: string;
  bd: boolean;
}

/** Saldirinin ortak on kontrolleri. */
async function approach(s: Sess, ip: string, port: string, noisy = false): Promise<Approach | null> {
  const { repo } = s.game;
  if (!validIp(ip)) {
    s.out(`${R}Gecersiz IP: ${ip}${X}`);
    return null;
  }
  if (!/^\d+$/.test(port)) {
    s.out(`${R}Gecersiz port: ${port}${X}`);
    return null;
  }
  const t = repo.host(ip);
  if (!t || ip === s.ip) {
    s.out(`${R}Gecersiz hedef.${X}`);
    return null;
  }
  const svc = repo.servicesOf(ip).find((x) => String(x.port) === port);
  if (!svc) {
    s.out(`${R}connect: Connection refused${X}`);
    return null;
  }
  if (t.lockUntil > Date.now()) {
    s.out(`${R}connect: Connection timed out (hedef lockdown'da)${X}`);
    return null;
  }
  const src = noisy ? s.ip : (s.spoof ?? s.ip);
  const bd = repo.hasBackdoor(ip, s.ip);
  if (repo.isBlocked(ip, src) && !bd) {
    s.out(`${R}connect: Connection refused (firewall tarafindan filtrelendi)${X}`);
    repo.addLog(ip, `[${nowHms()}] ENGELLENDI (firewall): ${src}`);
    s.game.notify(ip, `Firewall ${src} adresinden gelen baglantiyi engelledi.`);
    return null;
  }
  const wait = Math.trunc((repo.lastAttack(ip, s.ip) + ATTACK_COOLDOWN_S * 1000 - Date.now()) / 1000);
  if (wait > 0) {
    s.out(`${Y}Hedef IDS'i seni izliyor. ${wait} sn bekle.${X}`);
    return null;
  }
  repo.markAttack(ip, s.ip, Date.now());
  if (!noisy) s.spoof = null;
  return { t, svc, src, bd };
}

function failed(s: Sess, ip: string, t: Host, src: string, port: string, how: string): void {
  const { repo } = s.game;
  repo.addLog(ip, `[${nowHms()}] BASARISIZ ${how} denemesi: ${src} -> port ${port}`);
  s.game.notify(ip, `${src} adresinden port ${port}'ye ${how} denemesi engellendi! (+10 puan)`);
  if (!t.npc) repo.addScore(ip, 10);
}

async function exploit(s: Sess, ip: string, port: string): Promise<void> {
  const r = await approach(s, ip, port);
  if (!r) return;
  const { t, svc, src, bd } = r;
  s.out(`[*] [1/3] ${ip}:${port} baglantisi aciliyor...`);
  await s.lag(0.6, 1.2);
  s.out(`[+] Servis: ${svc.name} ${svc.version}`);
  if (bd) {
    s.out(`${G}[+] Arka kapi anahtari kabul edildi. Gorev atlandi.${X}`);
    return remoteShell(s, ip, src, port, "backdoor");
  }
  s.out(`[*] [2/3] Zafiyet dogrulaniyor: ${vulnOf(svc)}`);
  await s.lag(0.5, 1.0);
  s.out(`[+] Zafiyet kullanilabilir. Hedef savunma seviyesi: ${t.level}/5`);
  s.out(`[*] [3/3] Kimlik dogrulama atlatildi, sifreli parola yakalandi.\n`);
  const ch = makeChallenge(t.level);
  s.out(`${B}${ch.title}${X}\n  ${C}${ch.data}${X}\n${D}Cevabi kucuk harfle yaz (${CHALLENGE_TIME_S} sn):${X}`);
  let got: string | null;
  try {
    got = (await s.ask("payload> ", CHALLENGE_TIME_S)).toLowerCase();
  } catch (e) {
    if (!(e instanceof AskTimeout)) throw e;
    got = null;
  }
  if (got !== ch.answer) {
    s.out(`${R}[-] Yanlis payload. Sizma basarisiz, baglanti dusuruldu.${X}`);
    failed(s, ip, t, src, port, "sizma");
    return;
  }
  return remoteShell(s, ip, src, port, "exploit");
}

async function bruteforce(s: Sess, ip: string, port: string): Promise<void> {
  const r = await approach(s, ip, port, true);
  if (!r) return;
  const { t, svc, src, bd } = r;
  s.out(`[*] [1/2] ${ip}:${port} baglantisi aciliyor...`);
  await s.lag(0.6, 1.0);
  s.out(`[+] Servis: ${svc.name} ${svc.version}`);
  if (bd) {
    s.out(`${G}[+] Arka kapi aktif! Brute-force gerekmedi.${X}`);
    return remoteShell(s, ip, src, port, "backdoor");
  }
  const n = t.level <= 2 ? 3 : t.level <= 4 ? 4 : 5;
  const pin = Array.from({ length: n }, () => rint(0, 9)).join("");
  s.game.repo.addLog(ip, `[${nowHms()}] BRUTE-FORCE basladi: ${s.ip} -> port ${port}`);
  s.game.notify(ip, `${s.ip} adresinden port ${port}'ye brute-force saldirisi basladi!`);
  s.out(
    `[*] [2/2] ${svc.name} servisinde ${n} haneli PIN deneniyor.\n` +
      `    ${BRUTE_TRIES} hakkin, ${BRUTE_TIME_S} sn suren var. '+' = dogru yerde, '~' = yanlis yerde.`,
  );
  const deadline = Date.now() + BRUTE_TIME_S * 1000;
  let tries = 0;
  while (tries < BRUTE_TRIES) {
    const left = (deadline - Date.now()) / 1000;
    if (left <= 0) break;
    let g: string;
    try {
      g = await s.ask(`pin(${tries + 1}/${BRUTE_TRIES})> `, left);
    } catch (e) {
      if (e instanceof AskTimeout) break;
      throw e;
    }
    if (g.length !== n || !/^\d+$/.test(g)) {
      s.out(`${Y}${n} haneli rakam gir.${X}`);
      continue;
    }
    tries++;
    const [bulls, cows] = bullsCows(pin, g);
    if (bulls === n) {
      s.out(`${G}[+] PIN kirildi!${X}`);
      return remoteShell(s, ip, src, port, "bruteforce");
    }
    s.out("    " + ("+".repeat(bulls) + "~".repeat(cows) || "-"));
  }
  s.out(`${R}[-] Brute-force basarisiz. PIN: ${pin}. Hesap kilitlendi.${X}`);
  failed(s, ip, t, src, port, "brute-force");
}

// ============================================================ root shell
const MULT = { exploit: 20, bruteforce: 25, backdoor: 5 } as const;

async function remoteShell(s: Sess, ip: string, src: string, port: string, how: keyof typeof MULT): Promise<void> {
  const { repo } = s.game;
  const mult = MULT[how];
  const target = repo.host(ip)!;
  const os = hostOs(ip);
  const svcName = repo.servicesOf(ip).find((p) => String(p.port) === port)?.name ?? "service";
  s.out(`${G}[+] ERISIM SAGLANDI. root shell acildi (${REMOTE_TIME_S} sn).${X}`);
  s.out(`${D}${target.name} | ${os.short} | Komutlar icin 'help' yaz.${X}`);
  const deadline = Date.now() + REMOTE_TIME_S * 1000;
  let wrote = false;
  let looted = false;
  repo.addLog(ip, `[${nowHms()}] SIZMA BASARILI (${how}): ${src} port ${port} uzerinden girdi`);
  s.game.notify(ip, `${src} sunucuna sizdi! (${how})`);

  const trapped = async (t: Host): Promise<void> => {
    repo.setHoney(ip, false);
    repo.addScore(s.ip, -20);
    if (!t.npc) repo.addScore(ip, 30);
    repo.addLog(ip, `[${nowHms()}] HONEYPOT: saldirgan yakalandi! GERCEK IP: ${s.ip} (gorunen: ${src})`);
    s.game.notify(ip, `HONEYPOT tetiklendi! Yakalanan gercek IP: ${s.ip} (+30 puan)`);
    await s.lag(1.0, 1.8);
    s.out(`${R}[!!] Bu bir HONEYPOT'tu! Gercek IP'n ifsa oldu. -20 puan. Baglanti kesildi.${X}`);
  };

  const prompt = `${R}root@${target.name}${X}:~# `;
  const warn = setTimeout(() => {
    if (Date.now() < deadline) s.write(`\n${Y}[!] Oturumun kapanmasina 10 sn kaldi.${X}\n`);
  }, Math.max(0, (REMOTE_TIME_S - 10) * 1000));
  warn.unref();

  try {
    for (;;) {
      const left = (deadline - Date.now()) / 1000;
      let line: string;
      if (left <= 0) {
        s.out(`${Y}[!] Oturum zaman asimina ugradi.${X}`);
        break;
      }
      try {
        line = await s.ask(prompt, left);
      } catch (e) {
        if (!(e instanceof AskTimeout)) throw e;
        s.out(`${Y}[!] Oturum zaman asimina ugradi.${X}`);
        break;
      }
      if (!line) continue;
      const sp = line.search(/\s/);
      const c = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
      const rest = sp < 0 ? "" : line.slice(sp).trim();

      if (c === "exit" || c === "logout") break;
      const t = repo.host(ip)!; // hedef bu arada degismis olabilir
      if (c === "help") s.out(REMOTE_HELP);
      else if (c === "whoami") s.out("root");
      else if (c === "id") s.out("uid=0(root) gid=0(root) groups=0(root)");
      else if (c === "hostname") s.out(target.name);
      else if (c === "uname") s.out(`${os.short} ${os.kernel} #1 SMP ${os.arch}`);
      else if (c === "pwd") s.out("/root");
      else if (c === "clear") s.out("\x1b[2J\x1b[H");
      else if (c === "echo") s.out(rest);
      else if (c === "ls")
        s.out(
          `total 32\n` +
            `drwx------ 2 root root 4096 Jan 12 03:14 .\n` +
            `drwxr-xr-x 8 root root 4096 Jan 12 03:14 ..\n` +
            `-rw-r--r-- 1 root root  312 Jan 12 03:14 secret.txt\n` +
            `-rw------- 1 root root  128 Jan 12 03:14 .bash_history\n` +
            `drwx------ 2 root root 4096 Jan 12 03:14 .ssh`,
        );
      else if (c === "ps")
        s.out(
          `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n` +
            `root         1  0.0  0.2 225312  9216 ?        Ss   03:14   0:01 /sbin/init\n` +
            `root       412  0.0  0.1  15432  6144 ?        Ss   03:14   0:00 sshd: /usr/sbin/sshd -D\n` +
            `root       787  0.0  0.1  82312  5120 ?        S    03:15   0:00 /usr/sbin/${svcName}\n` +
            `root       933  0.0  0.0  12336  3072 ?        S    03:16   0:00 -bash`,
        );
      else if (c === "cat" && (rest === "secret.txt" || rest === "/root/secret.txt"))
        s.out(showSecret(t.owner, repo.secretLines(ip)));
      else if (c === "write" || c === "loot" || c === "backdoor") {
        if (c === "write" && !rest) {
          s.out(`${Y}Kullanim: write <metin>${X}`);
          continue;
        }
        if (t.honey) {
          await trapped(t);
          return;
        }
        if (c === "write") {
          repo.addSecretLine(ip, `[${src}] ${[...rest].slice(0, 80).join("")}`);
          s.out(`${G}[+] secret.txt'e yazildi.${X}`);
          repo.addLog(ip, `[${nowHms()}] secret.txt DEGISTIRILDI (${src})`);
          s.game.notify(ip, `secret.txt'in ${src} tarafindan degistirildi!`);
          if (!wrote) {
            wrote = true;
            repo.addScore(s.ip, mult * t.level);
            s.out(`${Y}+${mult * t.level} puan!${X}`);
          }
        } else if (c === "loot") {
          if (looted) {
            s.out("Bu oturumda zaten calindi.");
            continue;
          }
          looted = true;
          let amt = t.npc ? 10 * t.level : Math.max(5, Math.floor(t.score / 10));
          if (!t.npc) {
            amt = Math.min(amt, t.score);
            repo.addScore(ip, -amt);
          }
          repo.addScore(s.ip, amt);
          s.out(`${Y}[+] ${amt} puan calindi!${X}`);
          repo.addLog(ip, `[${nowHms()}] SOYULDU: -${amt} puan (${src})`);
          s.game.notify(ip, `${src} sunucundan ${amt} puan caldi!`);
        } else {
          if (repo.hasBackdoor(ip, s.ip)) {
            s.out("Arka kapi zaten kurulu.");
            continue;
          }
          repo.addBackdoor(ip, s.ip);
          s.out(`${G}[+] Arka kapi yerlestirildi. Sonraki girislerde gorev yok (hedef 'audit' yapana dek).${X}`);
          repo.addLog(ip, `[${nowHms()}] SUPHELI SUREC: sistemde yeni servis olustu (arka kapi?)`);
        }
      } else s.out(`sh: ${c}: command not found ('help' yaz)`);
    }
  } finally {
    clearTimeout(warn);
  }
  s.out("[*] Baglanti kapandi.");
}
