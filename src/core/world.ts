import { NPC_NAMES } from "../content/systems.js";
import type { GameRepository } from "../domain/ports.js";
import { R, X } from "../ui/ansi.js";
import type { Clock } from "./clock.js";
import { TICK_MS } from "./config.js";
import type { DomainEvent, EventBus } from "./events.js";
import type { Rng } from "./random.js";

/** Dunyaya bagli bir istemci ucu (oturum). Sadece yazma yetenegi gerekir. */
export interface OnlineSink {
  write(text: string): void;
  close(): void;
}

/** Calisan oyun dunyasi: veritabani + cevrimici oturumlar + zamanlayici + olaylar. */
export class World {
  readonly online = new Map<string, OnlineSink>(); // ip -> oturum
  private timer: NodeJS.Timeout | null = null;
  private ticks = 0;

  constructor(
    readonly repo: GameRepository,
    readonly events: EventBus,
    readonly clock: Clock,
    readonly rng: Rng,
  ) {
    this.events.on((event) => this.handle(event));
  }

  seedNpcs(): void {
    if (this.repo.hasNpcs()) return;
    for (const name of NPC_NAMES) this.repo.createHost(name, "root", true, this.rng.int(1, 4));
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
    this.online.get(ip)?.write(`\n${R}[ALARM ${this.clock.hms()}] ${msg}${X}\n`);
  }

  /** Domain olaylarinin yan etkileri: log, alarm ve savunma puanlari. */
  private handle(e: DomainEvent): void {
    const stamp = `[${this.clock.hms()}]`;
    switch (e.type) {
      case "PortScanned":
        this.repo.addLog(e.targetIp, `${stamp} PORT TARAMASI: ${e.srcIp}`);
        this.notify(e.targetIp, `${e.srcIp} adresinden port taramasi tespit edildi.`);
        break;
      case "AttackBlocked":
        this.repo.addLog(e.targetIp, `${stamp} ENGELLENDI (firewall): ${e.srcIp}`);
        this.notify(e.targetIp, `Firewall ${e.srcIp} adresinden gelen baglantiyi engelledi.`);
        break;
      case "AttackFailed":
        this.repo.addLog(e.targetIp, `${stamp} BASARISIZ ${e.method} denemesi: ${e.srcIp} -> port ${e.port}`);
        this.notify(e.targetIp, `${e.srcIp} adresinden port ${e.port}'ye ${e.method} denemesi engellendi! (+10 puan)`);
        if (!this.repo.host(e.targetIp)?.npc) this.repo.addScore(e.targetIp, 10);
        break;
      case "HostCompromised":
        this.repo.addLog(e.targetIp, `${stamp} SIZMA BASARILI (${e.method}): ${e.srcIp} port ${e.port} uzerinden girdi`);
        this.notify(e.targetIp, `${e.srcIp} sunucuna sizdi! (${e.method})`);
        break;
      case "BruteForceStarted":
        this.repo.addLog(e.targetIp, `${stamp} BRUTE-FORCE basladi: ${e.srcIp} -> port ${e.port}`);
        this.notify(e.targetIp, `${e.srcIp} adresinden port ${e.port}'ye brute-force saldirisi basladi!`);
        break;
      case "SecretWritten":
        this.repo.addLog(e.targetIp, `${stamp} secret.txt DEGISTIRILDI (${e.srcIp})`);
        this.notify(e.targetIp, `secret.txt'in ${e.srcIp} tarafindan degistirildi!`);
        break;
      case "Looted":
        this.repo.addLog(e.targetIp, `${stamp} SOYULDU: -${e.amount} puan (${e.srcIp})`);
        this.notify(e.targetIp, `${e.srcIp} sunucundan ${e.amount} puan caldi!`);
        break;
      case "HoneypotTriggered": {
        this.repo.setHoney(e.targetIp, false);
        this.repo.addScore(e.realIp, -20);
        if (!this.repo.host(e.targetIp)?.npc) this.repo.addScore(e.targetIp, 30);
        this.repo.addLog(
          e.targetIp,
          `${stamp} HONEYPOT: saldirgan yakalandi! GERCEK IP: ${e.realIp} (gorunen: ${e.shownIp})`,
        );
        this.notify(e.targetIp, `HONEYPOT tetiklendi! Yakalanan gercek IP: ${e.realIp} (+30 puan)`);
        break;
      }
      case "BackdoorInstalled":
        this.repo.addLog(e.targetIp, `${stamp} SUPHELI SUREC: sistemde yeni servis olustu (arka kapi?)`);
        break;
    }
  }
}
