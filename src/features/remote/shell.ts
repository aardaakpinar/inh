import { REMOTE_HELP } from "../../content/help.js";
import { REMOTE_TIME_S } from "../../core/config.js";
import { hostOs, virtualFiles, virtualProcesses, type Host } from "../../domain/host.js";
import { lootAmount, writeReward, type AttackMethod } from "../../domain/scoring.js";
import { showSecret } from "../../domain/secret.js";
import { AskTimeout, type Sess } from "../../infra/net/session.js";
import { CLEAR_SCREEN, D, G, R, X, Y } from "../../ui/ansi.js";
import { renderLs, renderPs } from "../../ui/render.js";

export async function remoteShell(
  s: Sess,
  ip: string,
  src: string,
  port: string,
  how: AttackMethod,
): Promise<void> {
  const { repo, clock } = s.world;
  const target = repo.host(ip)!;
  const os = hostOs(ip);
  s.out(`${G}[+] ERISIM SAGLANDI. root shell acildi (${REMOTE_TIME_S} sn).${X}`);
  s.out(`${D}${target.name} | ${os.short} | Komutlar icin 'help' yaz.${X}`);

  const deadline = clock.now() + REMOTE_TIME_S * 1000;
  let wrote = false;
  let looted = false;
  s.world.events.emit({ type: "HostCompromised", targetIp: ip, srcIp: src, port, method: how });

  const trapped = async (t: Host): Promise<void> => {
    s.world.events.emit({ type: "HoneypotTriggered", targetIp: ip, realIp: s.ip, shownIp: src });
    await s.lag(1.0, 1.8);
    s.out(`${R}[!!] Bu bir HONEYPOT'tu! Gercek IP'n ifsa oldu. -20 puan. Baglanti kesildi.${X}`);
  };

  const prompt = `${R}root@${target.name}${X}:~# `;
  const warn = setTimeout(() => {
    if (clock.now() < deadline) s.write(`\n${Y}[!] Oturumun kapanmasina 10 sn kaldi.${X}\n`);
  }, Math.max(0, (REMOTE_TIME_S - 10) * 1000));
  warn.unref();

  try {
    for (;;) {
      const left = (deadline - clock.now()) / 1000;
      let line: string;
      if (left <= 0) {
        s.out(`${Y}[!] Oturum zaman asimina ugradi.${X}`);
        break;
      }
      try {
        line = await s.ask(prompt, left);
      } catch (e) {
        if (e instanceof AskTimeout) {
          s.out(`${Y}[!] Oturum zaman asimina ugradi.${X}`);
          break;
        }
        throw e;
      }
      if (!line) continue;

      const sp = line.search(/\s/);
      const command = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
      const rest = sp < 0 ? "" : line.slice(sp).trim();

      if (command === "exit" || command === "logout") break;
      const t = repo.host(ip)!; // hedef bu arada degismis olabilir

      if (command === "help") s.out(REMOTE_HELP);
      else if (command === "whoami") s.out("root");
      else if (command === "id") s.out("uid=0(root) gid=0(root) groups=0(root)");
      else if (command === "hostname") s.out(target.name);
      else if (command === "uname") s.out(`${os.short} ${os.kernel} #1 SMP ${os.arch}`);
      else if (command === "pwd") s.out("/root");
      else if (command === "clear") s.out(CLEAR_SCREEN);
      else if (command === "echo") s.out(rest);
      else if (command === "ls") s.out(renderLs(virtualFiles(t, repo.secretLines(ip).length)));
      else if (command === "ps") s.out(renderPs(virtualProcesses(repo.servicesOf(ip))));
      else if (command === "cat" && (rest === "secret.txt" || rest === "/root/secret.txt")) {
        s.out(showSecret(t.owner, repo.secretLines(ip)));
      } else if (command === "write" || command === "loot" || command === "backdoor") {
        if (command === "write" && !rest) {
          s.out(`${Y}Kullanim: write <metin>${X}`);
          continue;
        }
        if (t.honey) {
          await trapped(t);
          return;
        }
        if (command === "write") {
          repo.addSecretLine(ip, `[${src}] ${[...rest].slice(0, 80).join("")}`);
          s.out(`${G}[+] secret.txt'e yazildi.${X}`);
          s.world.events.emit({ type: "SecretWritten", targetIp: ip, srcIp: src });
          if (!wrote) {
            wrote = true;
            const reward = writeReward(how, t.level);
            repo.addScore(s.ip, reward);
            s.out(`${Y}+${reward} puan!${X}`);
          }
        } else if (command === "loot") {
          if (looted) {
            s.out("Bu oturumda zaten calindi.");
            continue;
          }
          looted = true;
          const amount = lootAmount(t);
          if (!t.npc) repo.addScore(ip, -amount);
          repo.addScore(s.ip, amount);
          s.out(`${Y}[+] ${amount} puan calindi!${X}`);
          s.world.events.emit({ type: "Looted", targetIp: ip, srcIp: src, amount });
        } else {
          if (repo.hasBackdoor(ip, s.ip)) {
            s.out("Arka kapi zaten kurulu.");
            continue;
          }
          repo.addBackdoor(ip, s.ip);
          s.out(`${G}[+] Arka kapi yerlestirildi. Sonraki girislerde gorev yok (hedef 'audit' yapana dek).${X}`);
          s.world.events.emit({ type: "BackdoorInstalled", targetIp: ip, attackerIp: s.ip });
        }
      } else {
        s.out(`sh: ${command}: command not found ('help' yaz)`);
      }
    }
  } finally {
    clearTimeout(warn);
  }
  s.out("[*] Baglanti kapandi.");
}
