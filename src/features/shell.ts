import { HELPDB } from "../content/help.js";
import { COST } from "../core/config.js";
import { randomIp } from "../core/random.js";
import { validIp } from "../core/util.js";
import type { Sess } from "../infra/net/session.js";
import { G, R, X, Y } from "../ui/ansi.js";
import { runAttack } from "./attack/attack.js";
import { runDefense } from "./defense/actions.js";
import { runGeneral } from "./general.js";
import { runRecon } from "./recon/actions.js";

export async function shell(s: Sess): Promise<void> {
  const { repo } = s.world;

  for (;;) {
    const me = repo.host(s.ip)!;
    const parts = (await s.ask(`${G}${s.user}@${me.name}${X}:~$ `)).split(/\s+/).filter(Boolean);
    if (!parts.length) continue;

    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const usage = (): void => s.out(`${Y}Kullanim: ${HELPDB.get(command)?.usage ?? command}${X}`);
    const pay = (cost: number): boolean => {
      if (me.score < cost) {
        s.out(`${R}Yetersiz puan (${cost} gerekli, sende ${me.score}).${X}`);
        return false;
      }
      repo.addScore(s.ip, -cost);
      me.score -= cost;
      return true;
    };

    if (command === "exit" || command === "logout") {
      s.out("Baglanti kapatildi.");
      return;
    }

    if (command === "spoof") {
      const fake = args[0] ?? randomIp(s.world.rng);
      if (!validIp(fake)) {
        usage();
        continue;
      }
      if (pay(COST.spoof)) {
        s.spoof = fake;
        s.out(`${G}[+] Siradaki saldiri/tarama ${fake} adresinden gelmis gorunecek. (-${COST.spoof} puan)${X}`);
        if (repo.hostExists(fake)) s.out(`${Y}(Bu gercek bir oyuncunun/sunucunun IP'si: suc ona kalacak.)${X}`);
      }
      continue;
    }

    if (await runRecon(command, s, args)) continue;
    if (await runDefense(command, s, args, pay)) continue;
    if (runGeneral(command, s, args)) continue;
    if (await runAttack(command, s, args)) continue;

    if (HELPDB.has(command)) usage();
    else s.out(`${R}Bilinmeyen komut. 'help' yaz.${X}`);
  }
}
