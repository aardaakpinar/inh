import { R, X } from "../ui/ansi.js";

/** secret.txt dosyasinin gercekci basligi + yetkisiz degisiklikler. */
export function showSecret(owner: string, lines: string[]): string {
  const changes = lines.length;
  const head =
    changes > 0
      ? `${R}Bu sunucu ${owner} kullanicisina aittir. [!] DOKUNULDU: ${changes} yetkisiz degisiklik.${X}`
      : `Bu sunucu ${owner} kullanicisina aittir. Dokunulmamistir.`;
  return [head, ...lines].join("\n");
}
