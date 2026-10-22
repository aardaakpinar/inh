import type { Host } from "./host.js";

export const ATTACK_MULT = { exploit: 20, bruteforce: 25, backdoor: 5 } as const;
export type AttackMethod = keyof typeof ATTACK_MULT;

export const writeReward = (method: AttackMethod, level: number): number => ATTACK_MULT[method] * level;

export const hardenCost = (level: number): number => 40 * level;

export const brutePinLength = (level: number): number => (level <= 2 ? 3 : level <= 4 ? 4 : 5);

/** NPC'lerden sabit, oyunculardan puanlarinin bir kismi calinir. */
export function lootAmount(target: Host): number {
  const amount = target.npc ? 10 * target.level : Math.max(5, Math.floor(target.score / 10));
  return target.npc ? amount : Math.min(amount, target.score);
}
