import { HELPDB } from "../../content/help.js";
import { COST } from "../../core/config.js";
import { validIp } from "../../core/util.js";
import { lockdownState } from "../../domain/defense.js";
import { hardenCost } from "../../domain/scoring.js";
import type { Sess } from "../../infra/net/session.js";
import { G, R, X, Y } from "../../ui/ansi.js";

type Pay = (cost: number) => boolean;

function firewall(s: Sess, a: string[]): void {
  const { repo } = s.world;
  const list = repo.firewallList(s.ip);
  if (!a.length) {
    s.out("Engelli IP'ler: " + (list.join(", ") || "yok"));
    return;
  }
  if (a.length !== 2 || (a[0] !== "block" && a[0] !== "unblock") || !validIp(a[1])) {
    s.out(`${Y}Kullanim: ${HELPDB.get("firewall")!.usage}${X}`);
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

export async function runDefense(cmd: string, s: Sess, a: string[], pay: Pay): Promise<boolean> {
  const { repo, clock } = s.world;
  const me = repo.host(s.ip)!;

  switch (cmd) {
    case "harden": {
      if (me.level >= 5) {
        s.out("Zaten maksimum seviye.");
        return true;
      }
      const cost = hardenCost(me.level);
      if (!pay(cost)) return true;
      repo.setLevel(s.ip, me.level + 1);
      const gone = repo.closeRandomService(s.ip);
      if (gone) s.out(`${Y}Port ${gone.port} kapatildi.${X}`);
      s.out(`${G}Savunma seviyesi: ${me.level + 1}/5 (-${cost} puan)${X}`);
      return true;
    }
    case "firewall":
      firewall(s, a);
      return true;
    case "audit": {
      if (!pay(COST.audit)) return true;
      await s.lag(0.8, 1.5);
      const bd = repo.backdoorList(s.ip);
      if (bd.length) {
        s.out(`${R}[!] ${bd.length} arka kapi bulundu ve silindi:${X}`);
        for (const ip of bd) s.out(`    kurucu IP: ${ip}`);
        repo.clearBackdoors(s.ip);
      } else {
        s.out(`${G}[+] Temiz. Arka kapi bulunamadi.${X}`);
      }
      return true;
    }
    case "honeypot":
      if (me.honey) {
        s.out("Tuzak zaten kurulu.");
        return true;
      }
      if (pay(COST.honeypot)) {
        repo.setHoney(s.ip, true);
        s.out(`${G}[+] Honeypot kuruldu. Siradaki sizan tuzaga dusecek. (-${COST.honeypot} puan)${X}`);
      }
      return true;
    case "lockdown": {
      const lock = lockdownState(me, clock.now());
      if (lock.active) {
        s.out("Lockdown zaten aktif.");
        return true;
      }
      if (lock.cooldownLeft > 0) {
        s.out(`${Y}Lockdown beklemede: ${lock.cooldownLeft} sn.${X}`);
        return true;
      }
      if (pay(COST.lockdown)) {
        const now = clock.now();
        repo.setLock(s.ip, now + 60_000, now + 300_000);
        s.out(`${R}[!] LOCKDOWN: tum portlar 60 sn kapali. (-${COST.lockdown} puan)${X}`);
      }
      return true;
    }
    case "cleanse":
      repo.clearSecret(s.ip);
      s.out(`${G}secret.txt temizlendi.${X}`);
      return true;
    default:
      return false;
  }
}
