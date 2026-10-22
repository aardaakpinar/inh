import net from "node:net";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { login, shell } from "./commands.js";
import { B, D, G, X } from "./config.js";
import { Repo } from "./db.js";
import { AskTimeout, Disconnected, LineChannel, Sess, type Io } from "./session.js";
import { Game } from "./world.js";

export interface RunOptions {
  port: number;
  dbPath: string;
  importFile?: string;
}

/** Tek bir oyuncunun oturumunu bastan sona yurutur. */
async function handle(s: Sess): Promise<void> {
  try {
    if (await login(s)) await shell(s);
  } catch (e) {
    if (!(e instanceof Disconnected || e instanceof AskTimeout)) console.error("oturum hatasi:", e);
  } finally {
    if (s.ip && s.game.online.get(s.ip) === s) s.game.online.delete(s.ip);
    s.close();
  }
}

function openWorld(dbPath: string, importFile?: string): Game {
  const repo = new Repo(dbPath);
  if (!repo.hasHosts() && importFile && existsSync(importFile)) {
    const r = repo.importLegacy(importFile);
    console.log(`[*] ${importFile} icindeki eski kayit aktarildi: ${r.hosts} sunucu, ${r.users} oyuncu.`);
  }
  const game = new Game(repo);
  game.seedNpcs();
  game.start();
  return game;
}

// ------------------------------------------------------------------ COK OYUNCULU
export async function runMulti(opts: RunOptions): Promise<void> {
  const game = openWorld(opts.dbPath, opts.importFile);
  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 60_000);
    const chan = new LineChannel();
    const io: Io = { write: (d) => void socket.write(d), close: () => void socket.end() };
    socket.on("data", (d: string) => chan.feed(d));
    socket.on("end", () => chan.end());
    socket.on("close", () => {
      sockets.delete(socket);
      chan.end();
    });
    socket.on("error", () => chan.end());
    void handle(new Sess(game, io, chan));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(opts.port, "0.0.0.0", () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (e) {
    game.stop();
    game.repo.close();
    throw e;
  }
  server.on("error", (e) => console.error("sunucu hatasi:", e));

  const shutdown = () => {
    game.stop();
    server.close();
    for (const s of sockets) s.destroy();
    game.repo.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);

  console.log("=".repeat(56));
  console.log(` INH COK OYUNCULU sunucu CALISIYOR (port ${opts.port})`);
  console.log(` Kayit dosyasi: ${opts.dbPath}`);
  console.log(" Bu pencere acik kalmali, imlec donmeyecek - normal!");
  console.log(" Oynamak icin YENI bir terminal ac ve sunu yaz:");
  console.log(`   ${G}npm run client -- localhost${X}`);
  if (ips.length) {
    console.log(" Ayni agdaki arkadaslarin icin:");
    for (const ip of ips) console.log(`   ${B}npm run client -- ${ip}${X}${opts.port === 9999 ? "" : " " + opts.port}`);
  }
  console.log(` ${D}Durdurmak icin: Ctrl+C${X}`);
  console.log("=".repeat(56));
}
