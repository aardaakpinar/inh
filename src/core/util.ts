export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function validIp(x: string): boolean {
  const p = x.split(".");
  return p.length === 4 && p.every((i) => /^\d{1,3}$/.test(i) && Number(i) <= 255);
}
