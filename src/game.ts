// Oyun kurallari ve icerigi: gorevler, yardim metinleri, yardimci fonksiyonlar.
import { createHash, timingSafeEqual } from "node:crypto";
import { B, D, G, R, WORDS, X, Y, type Service } from "./config.js";
import { choice, rint } from "./util.js";

// ------------------------------------------------------------- parola
export const hashPw = (salt: string, pw: string): string =>
  createHash("sha256").update(salt + pw).digest("hex");

export function verifyPw(salt: string, pw: string, expectedHex: string): boolean {
  const a = Buffer.from(hashPw(salt, pw), "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------- sistem kimligi
export interface OsInfo {
  short: string;
  kernel: string;
  arch: string;
}

const OSES: readonly OsInfo[] = [
  { short: "Linux 5.15 (Ubuntu 22.04)", kernel: "5.15.0-91-generic", arch: "x86_64" },
  { short: "Linux 6.1 (Debian 12)", kernel: "6.1.0-18-amd64", arch: "x86_64" },
  { short: "Linux 3.10 (CentOS 7)", kernel: "3.10.0-1160.el7.x86_64", arch: "x86_64" },
  { short: "FreeBSD 13.2", kernel: "13.2-RELEASE-p10", arch: "amd64" },
];

/** Ayni IP her zaman ayni isletim sistemini dondurur (dunya tutarli kalsin). */
export function hostOs(ip: string): OsInfo {
  let h = 0;
  for (const ch of ip) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OSES[h % OSES.length];
}

const VULNS: Record<string, string> = {
  ftp: "anonim yazma izni + zayif parola dogrulamasi",
  ssh: "eski anahtar degisimi + kullanici numaralandirma",
  smtp: "acik relay + dogrulanmamis kullanici listesi",
  http: "dizin listeleme + yapilandirma dosyasi sizintisi",
  smb: "imzasiz oturum + uzaktan kod calistirma",
  mysql: "parolasiz root + uzak baglanti izni",
};

export function vulnOf(svc: Service): string {
  return VULNS[svc.name] ?? "bilinen servis zafiyeti";
}

// ------------------------------------------------------------- secret.txt
export function showSecret(owner: string, lines: string[]): string {
  const changes = lines.length;
  const head =
    changes > 0
      ? `${R}Bu sunucu ${owner} kullanicisina aittir. [!] DOKUNULDU: ${changes} yetkisiz degisiklik.${X}`
      : `Bu sunucu ${owner} kullanicisina aittir. Dokunulmamistir.`;
  return [head, ...lines].join("\n");
}

// ------------------------------------------------------------- gorevler
export function caesar(text: string, k: number): string {
  return text.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + k) % 26) + 97));
}

export interface Challenge {
  title: string;
  data: string;
  answer: string;
}

export function makeChallenge(level: number): Challenge {
  const w = choice(WORDS);
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const hex = (s: string) => Buffer.from(s).toString("hex");
  switch (level) {
    case 1:
      return { title: "Base64 kodlu parola yakalandi:", data: b64(w), answer: w };
    case 2: {
      const k = rint(3, 13);
      return { title: `ROT-${k} ile sifrelenmis parola (kaydirma bilgisi sizdi):`, data: caesar(w, k), answer: w };
    }
    case 3:
      return { title: "Hex kodlu parola yakalandi:", data: hex(w), answer: w };
    case 4:
      return { title: "Sezar sifresi, kaydirma miktari BILINMIYOR:", data: caesar(w, rint(1, 25)), answer: w };
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

// ------------------------------------------------------------- yardim
export interface HelpEntry {
  cat: "KESIF" | "SALDIRI" | "SAVUNMA" | "GENEL";
  usage: string;
  short: string;
  detail: string;
}

const H = (key: string, cat: HelpEntry["cat"], usage: string, short: string, detail = ""): [string, HelpEntry] => [
  key,
  { cat, usage, short, detail },
];

export const HELPDB = new Map<string, HelpEntry>([
  H("scan", "KESIF", "scan", "agi tara, canli sunuculari bul",
    "10.0.0.0/8 agini tarar. Tum oyuncu sunuculari ve NPC'lerden bir ornek listelenir; isletim sistemi tahmini ve gecikme gosterilir."),
  H("portscan", "KESIF", "portscan <ip>", "hedefin acik portlari ve guvenlik seviyesi",
    "Hedefin servislerini ve seviyesini gosterir. DIKKAT: hedefin loguna 'port taramasi' olarak dusebilir; spoof aciksa sahte IP gorunur."),
  H("ping", "KESIF", "ping <ip>", "gecikme olc", "Hedef ayakta mi diye bakar."),
  H("traceroute", "KESIF", "traceroute <ip>", "hedefe giden rota", "Hedefe giden hop'lari gosterir."),
  H("exploit", "SALDIRI", "exploit <ip> <port>", "servis zafiyetini sifre cozerek kullan",
    "Sessiz saldiri. Hedefin seviyesine gore sifreli bir parola cozersin (45 sn). Spoof varsa sahte IP ile loglanirsin. " +
      "Basarili olursan 60 sn'lik root shell acilir. Puan: 20 x seviye."),
  H("bruteforce", "SALDIRI", "bruteforce <ip> <port>", "PIN tahmin oyunuyla zorla gir",
    "8 denemede PIN'i bul (her denemede '+' dogru yer, '~' yanlis yer ipucu alirsin). GURULTULU: spoof calismaz, " +
      "gercek IP'n her durumda hedefe gider. Ama odul buyuk: 25 x seviye."),
  H("spoof", "SALDIRI", "spoof [sahte-ip]", "siradaki saldiri icin sahte IP (15 puan)",
    "IP vermezsen rastgele uretir. Baska bir oyuncunun IP'sini yazarsan suc ona kalir! Tek kullanimliktir. Firewall'u da asar."),
  H("cat", "GENEL", "cat secret.txt", "kendi secret.txt'ni oku"),
  H("ls", "GENEL", "ls", "dosyalari listele"),
  H("ifconfig", "GENEL", "ifconfig", "IP, seviye, puan, acik portlar"),
  H("status", "GENEL", "status", "tum savunmalarinin durumu", "Firewall, honeypot, lockdown ve puan durumunu ozetler."),
  H("logs", "GENEL", "logs", "sunucuna gelen olaylari oku", "Okuyunca log temizlenir."),
  H("top", "GENEL", "top", "skor tablosu"),
  H("clear", "GENEL", "clear", "ekrani temizle"),
  H("exit", "GENEL", "exit", "oyundan cik"),
  H("help", "GENEL", "help [komut]", "komut listesi / detay", "'help exploit' gibi tek komutu ayrintili anlatir."),
  H("harden", "SAVUNMA", "harden", "savunma seviyesini yukselt (40 x seviye puan)",
    "Saldirganlarin cozmesi gereken gorev zorlasir, ayrica bir port kapanir."),
  H("firewall", "SAVUNMA", "firewall [block|unblock <ip>]", "IP engelle (en fazla 8)",
    "Engelli IP'lerden gelen exploit/bruteforce reddedilir. Spoof'lu saldirganlar ve arka kapi sahipleri engeli asar."),
  H("audit", "SAVUNMA", "audit", "arka kapilari tara ve sil (15 puan)",
    "Saldirganlarin biraktigi arka kapilari bulur, IP'lerini gosterir ve temizler."),
  H("honeypot", "SAVUNMA", "honeypot", "tuzak kur (30 puan)",
    "Siradaki sizan saldirgan write/loot/backdoor yapinca tuzaga duser: -20 puan, sen +30 alirsin, gercek IP'si loga yazilir. Tek kullanimlik."),
  H("lockdown", "SAVUNMA", "lockdown", "60 sn tum erisimi kes (25 puan)",
    "Tum portlar 60 sn kapanir. Bir kez kullanildiktan sonra 5 dk bekleme suresi var."),
  H("cleanse", "SAVUNMA", "cleanse", "secret.txt'ni temizle", "Saldirganlarin yazdiklarini siler."),
]);

const CATS: [HelpEntry["cat"], string][] = [
  ["KESIF", "Kesif"], ["SALDIRI", "Saldiri"], ["SAVUNMA", "Savunma"], ["GENEL", "Genel"],
];

export const REMOTE_HELP = `${B}Root shell komutlari:${X}
  whoami / id         kullanici ve yetki bilgisi
  hostname / uname -a sistem bilgisi
  pwd / ls -la        dizin ve dosyalar
  cat secret.txt      hedefin dosyasini oku
  ps                  calisan surecler
  write <metin>       secret.txt'e yaz (ilk yazista puan)
  loot                hedefin puaninin bir kismini calar (oturum basina 1)
  backdoor            arka kapi birak: sonraki girislerde gorev yok (hedef 'audit' yapana dek)
  clear / help / exit`;

export const MISSION = `${B}GOREV${X}
  Amac: baska sunucularin secret.txt dosyasina yaz, kendi dosyani koru.
  1) ${G}scan${X}                 agdaki sunuculari bul
  2) ${G}portscan <ip>${X}        acik portlari ve savunma seviyesini gor
  3) ${G}exploit <ip> <port>${X}  sifreli parolayi coz ve root shell ac (veya bruteforce)
  4) ${G}write <metin>${X}        root shell icinde hedefin secret.txt dosyasina yaz

  ${D}Kendini koru: harden, firewall, audit, honeypot, lockdown, cleanse
  Tum komutlar icin: help${X}`;

export function helpText(topic?: string): string {
  if (topic) {
    const e = HELPDB.get(topic);
    if (!e) return `${R}Boyle bir komut yok. 'help' yaz.${X}`;
    return `${B}${e.usage}${X}\n  ${e.short}\n  ${e.detail}`;
  }
  const out = [`${B}KOMUTLAR${X}  (ayrinti icin: help <komut>)`];
  for (const [key, label] of CATS) {
    out.push(`\n${Y}[${label}]${X}`);
    for (const e of HELPDB.values()) if (e.cat === key) out.push(`  ${e.usage.padEnd(34)} ${e.short}`);
  }
  return out.join("\n");
}

export const HELP = helpText();

export const BANNER = [
  "",
  `${G}  ___ _   _ _   _`,
  String.raw` |_ _| \ | | | | |`,
  String.raw`  | ||  \| | |_| |`,
  String.raw`  | || |\  |  _  |`,
  String.raw` |___|_| \_|_| |_|` + X,
  ` ${D}Simule edilmis ag. Hedef: baskalarinin secret.txt dosyasina yaz, kendininkini koru.${X}`,
  "",
].join("\n");
