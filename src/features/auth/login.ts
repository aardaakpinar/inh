import { randomBytes } from "node:crypto";
import { BANNER, MISSION } from "../../content/help.js";
import { hostOs } from "../../domain/host.js";
import { hashPw, verifyPw } from "../../domain/password.js";
import type { Sess } from "../../infra/net/session.js";
import { B, D, G, R, X, Y } from "../../ui/ansi.js";

const LOGIN_TRIES = 3;

export async function login(s: Sess): Promise<boolean> {
  const { repo } = s.world;
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
  const old = s.world.online.get(s.ip);
  s.world.online.set(s.ip, s);
  if (old && old !== s) {
    old.write(`\n${Y}[!] Hesabina baska bir yerden giris yapildi. Baglanti kapatiliyor.${X}\n`);
    old.close();
  }

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
