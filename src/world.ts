import { NPC_NAMES, R, TICK_MS, X } from "./config.js";
import type { Repo } from "./db.js";
import type { Sess } from "./session.js";
import { nowHms, rint } from "./util.js";

/** Calisan oyun dunyasi: veritabani + cevrimici oturumlar + zamanlayici. */
export class Game {
  readonly online = new Map<string, Sess>(); // ip -> oturum
  private timer: NodeJS.Timeout | null = null;
  private ticks = 0;

  constructor(readonly repo: Repo) {}

  seedNpcs(): void {
    if (this.repo.hasNpcs()) return;
    for (const name of NPC_NAMES) this.repo.createHost(name, "root", true, rint(1, 4));
  }

  start(): void {
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch (e) {
        console.error("tick hatasi:", e);
      }
    }, TICK_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    this.ticks++;
    if (this.ticks % 5 === 0) this.repo.resetNpcSecrets();
    this.repo.passiveIncome(2); // temiz secret.txt = pasif gelir
  }

  /** Cevrimici savunmaciya anlik alarm gonderir. */
  notify(ip: string, msg: string): void {
    this.online.get(ip)?.write(`\n${R}[ALARM ${nowHms()}] ${msg}${X}\n`);
  }
}
