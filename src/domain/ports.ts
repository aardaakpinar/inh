import type { Host, ScanHost, UserRow } from "./host.js";
import type { Service } from "./service.js";

export interface TopPlayer {
  score: number;
  owner: string;
  ip: string;
}

export interface LegacyImportResult {
  hosts: number;
  users: number;
}

/**
 * Oyunun kalici veri portu. Ozellikler SQLite'i degil bu arayuzu bilir;
 * gercek uygulama infra/sqlite/repository.ts icindedir.
 */
export interface GameRepository {
  host(ip: string): Host | undefined;
  hostExists(ip: string): boolean;
  hasHosts(): boolean;
  hasNpcs(): boolean;
  scanHosts(excludeIp: string, npcLimit: number): ScanHost[];
  topPlayers(limit: number): TopPlayer[];
  createHost(name: string, owner: string, npc: boolean, level: number): string;

  setLevel(ip: string, level: number): void;
  setHoney(ip: string, on: boolean): void;
  setLock(ip: string, untilMs: number, cooldownUntilMs: number): void;
  addScore(ip: string, delta: number): void;

  servicesOf(ip: string): Service[];
  closeRandomService(ip: string): Service | undefined;

  secretLines(ip: string): string[];
  addSecretLine(ip: string, text: string): void;
  clearSecret(ip: string): void;

  addLog(ip: string, text: string): void;
  logCount(ip: string): number;
  recentLogs(ip: string, limit: number): string[];
  clearLogs(ip: string): void;

  firewallList(ip: string): string[];
  isBlocked(ip: string, src: string): boolean;
  block(ip: string, src: string): void;
  unblock(ip: string, src: string): void;

  backdoorList(ip: string): string[];
  hasBackdoor(ip: string, attacker: string): boolean;
  addBackdoor(ip: string, attacker: string): void;
  clearBackdoors(ip: string): void;

  lastAttack(target: string, attacker: string): number;
  markAttack(target: string, attacker: string, ms: number): void;

  user(name: string): UserRow | undefined;
  registerPlayer(name: string, salt: string, pwHash: string): string;

  passiveIncome(points: number): void;
  resetNpcSecrets(): void;
  importLegacy(file: string): LegacyImportResult;
  close(): void;
}
