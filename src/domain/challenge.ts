import type { Rng } from "../core/random.js";
import { WORDS } from "../content/systems.js";

export function caesar(text: string, k: number): string {
  return text.replace(/[a-z]/g, (c) =>
    String.fromCharCode((((c.charCodeAt(0) - 97 + k) % 26) + 26) % 26 + 97),
  );
}

export interface Challenge {
  title: string;
  data: string;
  answer: string;
}

export function makeChallenge(level: number, rng: Rng): Challenge {
  const w = rng.choice(WORDS);
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const hex = (s: string) => Buffer.from(s).toString("hex");
  switch (level) {
    case 1:
      return { title: "Base64 kodlu parola yakalandi:", data: b64(w), answer: w };
    case 2: {
      const k = rng.int(3, 13);
      return { title: `ROT-${k} ile sifrelenmis parola (kaydirma bilgisi sizdi):`, data: caesar(w, k), answer: w };
    }
    case 3:
      return { title: "Hex kodlu parola yakalandi:", data: hex(w), answer: w };
    case 4:
      return { title: "Sezar sifresi, kaydirma miktari BILINMIYOR:", data: caesar(w, rng.int(1, 25)), answer: w };
    default:
      return { title: "Katmanli kodlama (ipucu: base64 -> hex -> metin):", data: b64(hex(w)), answer: w };
  }
}

/** PIN oyunu: bulls = dogru yerde, cows = yanlis yerde. */
export function bullsCows(secret: string, guess: string): [number, number] {
  let bulls = 0;
  for (let i = 0; i < Math.min(secret.length, guess.length); i++) if (secret[i] === guess[i]) bulls++;
  const count = (s: string, d: string) => [...s].filter((c) => c === d).length;
  let common = 0;
  for (const d of new Set(guess)) common += Math.min(count(secret, d), count(guess, d));
  return [bulls, common - bulls];
}
