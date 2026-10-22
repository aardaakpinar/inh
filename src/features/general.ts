import { HELPDB, helpText } from "../content/help.js";
import { lockdownState } from "../domain/defense.js";
import { hostOs, type Host } from "../domain/host.js";
import { showSecret } from "../domain/secret.js";
import type { Sess } from "../infra/net/session.js";
import { B, CLEAR_SCREEN, X } from "../ui/ansi.js";
import { renderStatus, renderTop } from "../ui/render.js";

const ports = (s: Sess): string => s.world.repo.servicesOf(s.ip).map((p) => p.port).join(", ");

function ifconfig(s: Sess, me: Host): void {
  s.out(
    `eth0  inet ${s.ip}  netmask 255.0.0.0\nhost  ${me.name}\nos    ${hostOs(s.ip).short}\n` +
      `seviye ${me.level}/5   puan ${me.score}\nacik portlar: ${ports(s)}`,
  );
}

function status(s: Sess, me: Host): void {
  const { repo, clock } = s.world;
  s.out(
    renderStatus(
      me,
      repo.firewallList(s.ip).length,
      lockdownState(me, clock.now()),
      ports(s),
    ),
  );
}

function logs(s: Sess): void {
  const { repo } = s.world;
  const lines = repo.recentLogs(s.ip, 25);
  s.out(`${B}SON OLAYLAR${X}`);
  s.out(lines.join("\n") || "Kayit yok.");
  if (lines.length) repo.clearLogs(s.ip);
}

export function runGeneral(cmd: string, s: Sess, a: string[]): boolean {
  const me = s.world.repo.host(s.ip)!;
  switch (cmd) {
    case "help":
      s.out(helpText(a[0]?.toLowerCase()));
      return true;
    case "clear":
      s.out(CLEAR_SCREEN);
      return true;
    case "ls":
      s.out("secret.txt");
      return true;
    case "cat":
      if (a[0] === "secret.txt") s.out(showSecret(me.owner, s.world.repo.secretLines(s.ip)));
      else s.out(`Kullanim: ${HELPDB.get(cmd)!.usage}`);
      return true;
    case "ifconfig":
      ifconfig(s, me);
      return true;
    case "status":
      status(s, me);
      return true;
    case "logs":
      logs(s);
      return true;
    case "top":
      s.out(renderTop(s.world.repo.topPlayers(10)));
      return true;
    default:
      return false;
  }
}
