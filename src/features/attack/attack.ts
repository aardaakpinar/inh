import { HELPDB } from "../../content/help.js";
import { ATTACK_COOLDOWN_S, BRUTE_TIME_S, BRUTE_TRIES, CHALLENGE_TIME_S } from "../../core/config.js";
import { err, ok, type Result } from "../../core/result.js";
import { validIp } from "../../core/util.js";
import { attackCooldownLeft } from "../../domain/attack.js";
import { bullsCows, makeChallenge } from "../../domain/challenge.js";
import type { Host } from "../../domain/host.js";
import { vulnOf } from "../../domain/host.js";
import { brutePinLength } from "../../domain/scoring.js";
import type { Service } from "../../domain/service.js";
import { AskTimeout, type Sess } from "../../infra/net/session.js";
import { B, C, D, G, R, X, Y } from "../../ui/ansi.js";
import { remoteShell } from "../remote/shell.js";

interface Approach {
  target: Host;
  service: Service;
  src: string;
  backdoor: boolean;
}

const usage = (s: Sess, key: string): void => s.out(`${Y}Kullanim: ${HELPDB.get(key)!.usage}${X}`);

/** Saldirinin ortak on kontrolleri. */
async function approach(s: Sess, ip: string, port: string, noisy = false): Promise<Result<Approach, string>> {
  const { repo, clock } = s.world;
  if (!validIp(ip)) return err(`Gecersiz IP: ${ip}`);
  if (!/^\d+$/.test(port)) return err(`Gecersiz port: ${port}`);

  const target = repo.host(ip);
  if (!target || ip === s.ip) return err("Gecersiz hedef.");

  const service = repo.servicesOf(ip).find((x) => String(x.port) === port);
  if (!service) return err("connect: Connection refused");
  if (target.lockUntil > clock.now()) return err("connect: Connection timed out (hedef lockdown'da)");

  const src = noisy ? s.ip : (s.spoof ?? s.ip);
  const backdoor = repo.hasBackdoor(ip, s.ip);
  if (repo.isBlocked(ip, src) && !backdoor) {
    s.world.events.emit({ type: "AttackBlocked", targetIp: ip, srcIp: src, reason: "firewall" });
    return err("connect: Connection refused (firewall tarafindan filtrelendi)");
  }

  const wait = attackCooldownLeft(repo.lastAttack(ip, s.ip), clock.now(), ATTACK_COOLDOWN_S * 1000);
  if (wait > 0) return err(`Hedef IDS'i seni izliyor. ${wait} sn bekle.`);

  repo.markAttack(ip, s.ip, clock.now());
  if (!noisy) s.spoof = null;
  return ok({ target, service, src, backdoor });
}

function failed(s: Sess, ip: string, src: string, port: string, method: string): void {
  s.world.events.emit({ type: "AttackFailed", targetIp: ip, srcIp: src, port, method });
}

async function exploit(s: Sess, ip: string, port: string): Promise<void> {
  const r = await approach(s, ip, port);
  if (!r.ok) {
    s.out(`${R}${r.error}${X}`);
    return;
  }
  const { target, service, src, backdoor } = r.value;
  s.out(`[*] [1/3] ${ip}:${port} baglantisi aciliyor...`);
  await s.lag(0.6, 1.2);
  s.out(`[+] Servis: ${service.name} ${service.version}`);
  if (backdoor) {
    s.out(`${G}[+] Arka kapi anahtari kabul edildi. Gorev atlandi.${X}`);
    return remoteShell(s, ip, src, port, "backdoor");
  }
  s.out(`[*] [2/3] Zafiyet dogrulaniyor: ${vulnOf(service)}`);
  await s.lag(0.5, 1.0);
  s.out(`[+] Zafiyet kullanilabilir. Hedef savunma seviyesi: ${target.level}/5`);
  s.out(`[*] [3/3] Kimlik dogrulama atlatildi, sifreli parola yakalandi.\n`);

  const challenge = makeChallenge(target.level, s.world.rng);
  s.out(
    `${B}${challenge.title}${X}\n  ${C}${challenge.data}${X}\n` +
      `${D}Cevabi kucuk harfle yaz (${CHALLENGE_TIME_S} sn):${X}`,
  );
  let got: string | null;
  try {
    got = (await s.ask("payload> ", CHALLENGE_TIME_S)).toLowerCase();
  } catch (e) {
    if (!(e instanceof AskTimeout)) throw e;
    got = null;
  }
  if (got !== challenge.answer) {
    s.out(`${R}[-] Yanlis payload. Sizma basarisiz, baglanti dusuruldu.${X}`);
    failed(s, ip, src, port, "sizma");
    return;
  }
  return remoteShell(s, ip, src, port, "exploit");
}

async function bruteforce(s: Sess, ip: string, port: string): Promise<void> {
  const r = await approach(s, ip, port, true);
  if (!r.ok) {
    s.out(`${R}${r.error}${X}`);
    return;
  }
  const { target, service, src, backdoor } = r.value;
  s.out(`[*] [1/2] ${ip}:${port} baglantisi aciliyor...`);
  await s.lag(0.6, 1.0);
  s.out(`[+] Servis: ${service.name} ${service.version}`);
  if (backdoor) {
    s.out(`${G}[+] Arka kapi aktif! Brute-force gerekmedi.${X}`);
    return remoteShell(s, ip, src, port, "backdoor");
  }

  const n = brutePinLength(target.level);
  const pin = Array.from({ length: n }, () => s.world.rng.int(0, 9)).join("");
  s.out(
    `[*] [2/2] ${service.name} servisinde ${n} haneli PIN deneniyor.\n` +
      `    ${BRUTE_TRIES} hakkin, ${BRUTE_TIME_S} sn suren var. '+' = dogru yerde, '~' = yanlis yerde.`,
  );
  s.world.events.emit({ type: "BruteForceStarted", targetIp: ip, srcIp: s.ip, port });

  const deadline = s.world.clock.now() + BRUTE_TIME_S * 1000;
  let tries = 0;
  while (tries < BRUTE_TRIES) {
    const left = (deadline - s.world.clock.now()) / 1000;
    if (left <= 0) break;
    let guess: string;
    try {
      guess = await s.ask(`pin(${tries + 1}/${BRUTE_TRIES})> `, left);
    } catch (e) {
      if (e instanceof AskTimeout) break;
      throw e;
    }
    if (guess.length !== n || !/^\d+$/.test(guess)) {
      s.out(`${Y}${n} haneli rakam gir.${X}`);
      continue;
    }
    tries++;
    const [bulls, cows] = bullsCows(pin, guess);
    if (bulls === n) {
      s.out(`${G}[+] PIN kirildi!${X}`);
      return remoteShell(s, ip, src, port, "bruteforce");
    }
    s.out("    " + ("+".repeat(bulls) + "~".repeat(cows) || "-"));
  }
  s.out(`${R}[-] Brute-force basarisiz. PIN: ${pin}. Hesap kilitlendi.${X}`);
  failed(s, ip, src, port, "brute-force");
}

export async function runAttack(cmd: string, s: Sess, a: string[]): Promise<boolean> {
  if (cmd !== "exploit" && cmd !== "bruteforce") return false;
  if (a.length < 2) {
    usage(s, cmd);
    return true;
  }
  if (cmd === "exploit") await exploit(s, a[0], a[1]);
  else await bruteforce(s, a[0], a[1]);
  return true;
}
