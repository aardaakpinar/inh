import type { Host } from "./host.js";

export interface LockdownState {
  active: boolean;
  left: number;
  cooldownLeft: number;
}

export function lockdownState(host: Host, now: number): LockdownState {
  const left = Math.max(0, Math.trunc((host.lockUntil - now) / 1000));
  const cooldownLeft = Math.max(0, Math.trunc((host.lockCdUntil - now) / 1000));
  return { active: left > 0, left, cooldownLeft };
}
