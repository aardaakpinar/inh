// SQLite katmani. Oyun durumunun tamami burada tutulur; her degisiklik aninda diske yazilir
// (eski surumdeki save() / .data.json yok).
import type { DatabaseSync, SQLInputValue, StatementSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { SERVICES } from "../../content/systems.js";
import { cryptoRng, type Rng } from "../../core/random.js";
import type { Host, ScanHost, UserRow } from "../../domain/host.js";
import type { GameRepository, LegacyImportResult, TopPlayer } from "../../domain/ports.js";
import type { Service } from "../../domain/service.js";

// node:sqlite'i statik import etmiyoruz: ESM'de yerlesik modullerin uyarisi, quiet.ts calismadan
// once (baglama asamasinda) basilirdi. Burada kod calisirken yukluyoruz.
const { DatabaseSync: Database } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 3000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hosts (
  ip            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner         TEXT NOT NULL,
  npc           INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  score         INTEGER NOT NULL DEFAULT 50,
  honey         INTEGER NOT NULL DEFAULT 0,
  lock_until    INTEGER NOT NULL DEFAULT 0,
  lock_cd_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  ip   TEXT NOT NULL UNIQUE REFERENCES hosts(ip) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  pw   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  ip      TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  port    INTEGER NOT NULL,
  name    TEXT NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY (ip, port)
);
CREATE TABLE IF NOT EXISTS secret_lines (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  ip   TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_ip ON secret_lines(ip);
CREATE TABLE IF NOT EXISTS logs (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  ip   TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip);
CREATE TABLE IF NOT EXISTS firewall (
  ip         TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  blocked_ip TEXT NOT NULL,
  PRIMARY KEY (ip, blocked_ip)
);
CREATE TABLE IF NOT EXISTS backdoors (
  ip          TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  attacker_ip TEXT NOT NULL,
  PRIMARY KEY (ip, attacker_ip)
);
CREATE TABLE IF NOT EXISTS cooldowns (
  target_ip   TEXT NOT NULL REFERENCES hosts(ip) ON DELETE CASCADE,
  attacker_ip TEXT NOT NULL,
  last_attack INTEGER NOT NULL,
  PRIMARY KEY (target_ip, attacker_ip)
);
`;

const MAX_SECRET_LINES = 29;
const MAX_LOG_ROWS = 100;

type Row = Record<string, unknown>;

interface LegacyHost {
  name: string;
  owner: string;
  npc: boolean;
  level: number;
  score: number;
  services: [number, string, string][];
  secret: string[];
  log: string[];
  cd?: Record<string, number>;
  fw?: string[];
  bd?: string[];
  honey?: boolean;
  lock?: number;
  lockcd?: number;
}
interface LegacyData {
  hosts: Record<string, LegacyHost>;
  users: Record<string, { ip: string; salt: string; pw: string }>;
}

export class Repo implements GameRepository {
  private db: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private closed = false;

  constructor(
    path: string,
    private readonly rng: Rng = cryptoRng,
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.exec(SCHEMA);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }

  // ---------------------------------------------------------------- dusuk seviye
  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) this.cache.set(sql, (s = this.db.prepare(sql)));
    return s;
  }
  private run(sql: string, ...p: SQLInputValue[]): void {
    this.stmt(sql).run(...p);
  }
  private one<T>(sql: string, ...p: SQLInputValue[]): T | undefined {
    return this.stmt(sql).get(...p) as unknown as T | undefined;
  }
  private all<T>(sql: string, ...p: SQLInputValue[]): T[] {
    return this.stmt(sql).all(...p) as unknown as T[];
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  // ---------------------------------------------------------------- sunucular
  private toHost(r: Row): Host {
    return {
      ip: r.ip as string,
      name: r.name as string,
      owner: r.owner as string,
      npc: r.npc === 1,
      level: r.level as number,
      score: r.score as number,
      honey: r.honey === 1,
      lockUntil: r.lock_until as number,
      lockCdUntil: r.lock_cd_until as number,
    };
  }

  host(ip: string): Host | undefined {
    const r = this.one<Row>("SELECT * FROM hosts WHERE ip = ?", ip);
    return r && this.toHost(r);
  }
  hostExists(ip: string): boolean {
    return this.one("SELECT 1 AS x FROM hosts WHERE ip = ?", ip) !== undefined;
  }
  hasHosts(): boolean {
    return this.one("SELECT 1 AS x FROM hosts LIMIT 1") !== undefined;
  }
  hasNpcs(): boolean {
    return this.one("SELECT 1 AS x FROM hosts WHERE npc = 1 LIMIT 1") !== undefined;
  }
  /**
   * Tarama sonucu: tum oyuncu sunuculari gorunur, NPC'lerden sadece bir ornek gelir.
   * Boylece rakip oyuncular taramada kaybolmaz, ag da her taramada ayni gorunmez.
   */
  scanHosts(excludeIp: string, npcLimit: number): ScanHost[] {
    const rows = this.all<{ ip: string; name: string; npc: number }>(
      "SELECT ip, name, npc FROM hosts WHERE ip != ? AND npc = 0 ORDER BY name",
      excludeIp,
    );
    const npcs = this.all<{ ip: string; name: string; npc: number }>(
      "SELECT ip, name, npc FROM hosts WHERE ip != ? AND npc = 1 ORDER BY name",
      excludeIp,
    );
    return [...rows, ...this.rng.sample(npcs, npcLimit)].map((r) => ({ ip: r.ip, name: r.name, npc: r.npc === 1 }));
  }
  topPlayers(limit: number): TopPlayer[] {
    return this.all<TopPlayer>(
      "SELECT score, owner, ip FROM hosts WHERE npc = 0 ORDER BY score DESC, owner DESC, ip DESC LIMIT ?",
      limit,
    );
  }

  private newIp(): string {
    for (;;) {
      const ip = `10.${this.rng.int(0, 254)}.${this.rng.int(0, 254)}.${this.rng.int(1, 254)}`;
      if (!this.hostExists(ip)) return ip;
    }
  }
  private insertHost(name: string, owner: string, npc: boolean, level: number): string {
    const ip = this.newIp();
    this.run("INSERT INTO hosts (ip, name, owner, npc, level) VALUES (?, ?, ?, ?, ?)", ip, name, owner, npc ? 1 : 0, level);
    for (const s of this.rng.sample(SERVICES, this.rng.int(2, 4))) {
      this.run("INSERT INTO services (ip, port, name, version) VALUES (?, ?, ?, ?)", ip, s.port, s.name, s.version);
    }
    return ip;
  }
  createHost(name: string, owner: string, npc: boolean, level: number): string {
    return this.tx(() => this.insertHost(name, owner, npc, level));
  }

  setLevel(ip: string, level: number): void {
    this.run("UPDATE hosts SET level = ? WHERE ip = ?", level, ip);
  }
  setHoney(ip: string, on: boolean): void {
    this.run("UPDATE hosts SET honey = ? WHERE ip = ?", on ? 1 : 0, ip);
  }
  setLock(ip: string, untilMs: number, cooldownUntilMs: number): void {
    this.run("UPDATE hosts SET lock_until = ?, lock_cd_until = ? WHERE ip = ?", untilMs, cooldownUntilMs, ip);
  }
  /** Puani degistirir; 0'in altina dusmez. */
  addScore(ip: string, delta: number): void {
    this.run("UPDATE hosts SET score = MAX(0, score + ?) WHERE ip = ?", delta, ip);
  }

  // ---------------------------------------------------------------- servisler
  servicesOf(ip: string): Service[] {
    return this.all<Service>("SELECT port, name, version FROM services WHERE ip = ? ORDER BY rowid", ip);
  }
  /** Rastgele bir portu kapatir (en az 1 servis kalir). */
  closeRandomService(ip: string): Service | undefined {
    const list = this.servicesOf(ip);
    if (list.length <= 1) return undefined;
    const gone = list[this.rng.int(0, list.length - 1)];
    this.run("DELETE FROM services WHERE ip = ? AND port = ?", ip, gone.port);
    return gone;
  }

  // ---------------------------------------------------------------- secret.txt
  /** Yetkisiz yazilan satirlar (baslik satiri haric). Bos = dosya temiz. */
  secretLines(ip: string): string[] {
    return this.all<{ text: string }>("SELECT text FROM secret_lines WHERE ip = ? ORDER BY id", ip).map((r) => r.text);
  }
  addSecretLine(ip: string, text: string): void {
    this.run("INSERT INTO secret_lines (ip, text) VALUES (?, ?)", ip, text);
    this.run(
      "DELETE FROM secret_lines WHERE ip = ? AND id NOT IN (SELECT id FROM secret_lines WHERE ip = ? ORDER BY id DESC LIMIT ?)",
      ip, ip, MAX_SECRET_LINES,
    );
  }
  clearSecret(ip: string): void {
    this.run("DELETE FROM secret_lines WHERE ip = ?", ip);
  }

  // ---------------------------------------------------------------- loglar
  addLog(ip: string, text: string): void {
    this.run("INSERT INTO logs (ip, text) VALUES (?, ?)", ip, text);
    this.run(
      "DELETE FROM logs WHERE ip = ? AND id NOT IN (SELECT id FROM logs WHERE ip = ? ORDER BY id DESC LIMIT ?)",
      ip, ip, MAX_LOG_ROWS,
    );
  }
  logCount(ip: string): number {
    return this.one<{ n: number }>("SELECT COUNT(*) AS n FROM logs WHERE ip = ?", ip)!.n;
  }
  recentLogs(ip: string, limit: number): string[] {
    return this.all<{ text: string }>(
      "SELECT text FROM (SELECT id, text FROM logs WHERE ip = ? ORDER BY id DESC LIMIT ?) ORDER BY id",
      ip, limit,
    ).map((r) => r.text);
  }
  clearLogs(ip: string): void {
    this.run("DELETE FROM logs WHERE ip = ?", ip);
  }

  // ---------------------------------------------------------------- firewall
  firewallList(ip: string): string[] {
    return this.all<{ blocked_ip: string }>("SELECT blocked_ip FROM firewall WHERE ip = ? ORDER BY rowid", ip).map((r) => r.blocked_ip);
  }
  isBlocked(ip: string, src: string): boolean {
    return this.one("SELECT 1 AS x FROM firewall WHERE ip = ? AND blocked_ip = ?", ip, src) !== undefined;
  }
  block(ip: string, src: string): void {
    this.run("INSERT OR IGNORE INTO firewall (ip, blocked_ip) VALUES (?, ?)", ip, src);
  }
  unblock(ip: string, src: string): void {
    this.run("DELETE FROM firewall WHERE ip = ? AND blocked_ip = ?", ip, src);
  }

  // ---------------------------------------------------------------- arka kapilar
  backdoorList(ip: string): string[] {
    return this.all<{ attacker_ip: string }>("SELECT attacker_ip FROM backdoors WHERE ip = ? ORDER BY rowid", ip).map((r) => r.attacker_ip);
  }
  hasBackdoor(ip: string, attacker: string): boolean {
    return this.one("SELECT 1 AS x FROM backdoors WHERE ip = ? AND attacker_ip = ?", ip, attacker) !== undefined;
  }
  addBackdoor(ip: string, attacker: string): void {
    this.run("INSERT OR IGNORE INTO backdoors (ip, attacker_ip) VALUES (?, ?)", ip, attacker);
  }
  clearBackdoors(ip: string): void {
    this.run("DELETE FROM backdoors WHERE ip = ?", ip);
  }

  // ---------------------------------------------------------------- saldiri bekleme suresi
  lastAttack(target: string, attacker: string): number {
    return this.one<{ last_attack: number }>(
      "SELECT last_attack FROM cooldowns WHERE target_ip = ? AND attacker_ip = ?", target, attacker,
    )?.last_attack ?? 0;
  }
  markAttack(target: string, attacker: string, ms: number): void {
    this.run(
      "INSERT INTO cooldowns (target_ip, attacker_ip, last_attack) VALUES (?, ?, ?) " +
        "ON CONFLICT (target_ip, attacker_ip) DO UPDATE SET last_attack = excluded.last_attack",
      target, attacker, ms,
    );
  }

  // ---------------------------------------------------------------- oyuncular
  user(name: string): UserRow | undefined {
    return this.one<UserRow>("SELECT name, ip, salt, pw FROM users WHERE name = ?", name);
  }
  /** Yeni oyuncu + sunucusu. Sunucunun IP'sini dondurur. */
  registerPlayer(name: string, salt: string, pwHash: string): string {
    return this.tx(() => {
      const ip = this.insertHost(`${name}-srv`, name, false, 1);
      this.run("INSERT INTO users (name, ip, salt, pw) VALUES (?, ?, ?, ?)", name, ip, salt, pwHash);
      return ip;
    });
  }

  // ---------------------------------------------------------------- periyodik isler
  /** Temiz secret.txt'i olan oyunculara pasif gelir. */
  passiveIncome(points: number): void {
    this.run(
      "UPDATE hosts SET score = score + ? WHERE npc = 0 AND NOT EXISTS (SELECT 1 FROM secret_lines s WHERE s.ip = hosts.ip)",
      points,
    );
  }
  resetNpcSecrets(): void {
    this.run("DELETE FROM secret_lines WHERE ip IN (SELECT ip FROM hosts WHERE npc = 1)");
  }

  // ---------------------------------------------------------------- eski .data.json'dan aktarma
  importLegacy(file: string): LegacyImportResult {
    const d = JSON.parse(readFileSync(file, "utf8")) as LegacyData;
    const ms = (sec?: number) => Math.round((sec ?? 0) * 1000);
    return this.tx(() => {
      let hosts = 0;
      for (const [ip, h] of Object.entries(d.hosts)) {
        this.run(
          "INSERT INTO hosts (ip, name, owner, npc, level, score, honey, lock_until, lock_cd_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          ip, h.name, h.owner, h.npc ? 1 : 0, h.level, h.score, h.honey ? 1 : 0, ms(h.lock), ms(h.lockcd),
        );
        for (const [port, name, version] of h.services) {
          this.run("INSERT INTO services (ip, port, name, version) VALUES (?, ?, ?, ?)", ip, port, name, version);
        }
        for (const t of h.secret.slice(1)) this.run("INSERT INTO secret_lines (ip, text) VALUES (?, ?)", ip, t);
        for (const t of h.log ?? []) this.run("INSERT INTO logs (ip, text) VALUES (?, ?)", ip, t);
        for (const b of h.fw ?? []) this.run("INSERT OR IGNORE INTO firewall (ip, blocked_ip) VALUES (?, ?)", ip, b);
        for (const b of h.bd ?? []) this.run("INSERT OR IGNORE INTO backdoors (ip, attacker_ip) VALUES (?, ?)", ip, b);
        for (const [att, t] of Object.entries(h.cd ?? {})) {
          this.run("INSERT OR REPLACE INTO cooldowns (target_ip, attacker_ip, last_attack) VALUES (?, ?, ?)", ip, att, ms(t));
        }
        hosts++;
      }
      let users = 0;
      for (const [name, u] of Object.entries(d.users)) {
        this.run("INSERT INTO users (name, ip, salt, pw) VALUES (?, ?, ?, ?)", name, u.ip, u.salt, u.pw);
        users++;
      }
      return { hosts, users };
    });
  }
}
