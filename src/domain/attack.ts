/** Saniye cinsinden kalan saldiri bekleme suresi. */
export const attackCooldownLeft = (lastAttack: number, now: number, cooldownMs: number): number =>
  Math.max(0, Math.trunc((lastAttack + cooldownMs - now) / 1000));
