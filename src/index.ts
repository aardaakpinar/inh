#!/usr/bin/env node
import "./quiet.js"; // node:sqlite uyarisini susturur; diger importlardan ONCE gelmeli
import { DEFAULT_PORT } from "./config.js";
import { runClient } from "./client.js";
import { runMulti } from "./server.js";

const USAGE = `INH - terminal CTF oyunu

Kullanim:
  inh                              cok oyunculu sunucuyu baslatir
  inh [--port 9999]                farkli portta sunucu
  inh client [sunucu-ip] [port]    cok oyunculu sunucuya baglan

Secenekler:
  -p, --port <port>           sunucu portu (varsayilan ${DEFAULT_PORT})
      --db <dosya>            kayit dosyasi (varsayilan data/inh-multi.db)
      --import <dosya>        yeni kayda eski .data.json aktar (varsayilan: ./.data.json varsa)
  -h, --help                  bu yardim`;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function parsePort(v: string | undefined): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n < 1 || n > 65535) fail(`Gecersiz port: ${v ?? "(yok)"}`);
  return n;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "client") {
    const host = args[1] ?? "localhost";
    const port = args[2] && /^\d+$/.test(args[2]) ? parsePort(args[2]) : DEFAULT_PORT;
    runClient(host, port);
    return;
  }

  let port = DEFAULT_PORT;
  let db: string | undefined;
  let importFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    let [flag, inline] = args[i].split(/=(.*)/s, 2) as [string, string | undefined];
    const value = () => inline ?? args[++i];
    switch (flag) {
      case "-h":
      case "--help":
        console.log(USAGE);
        return;
      case "-p":
      case "--port":
        port = parsePort(value());
        break;
      case "--db":
        db = value() ?? fail("--db icin dosya yolu ver");
        break;
      case "--import":
        importFile = value() ?? fail("--import icin dosya yolu ver");
        break;
      default:
        if (/^\d+$/.test(flag)) port = parsePort(flag); // eski kullanim: `server 9000`
        else fail(`Bilinmeyen secenek: ${flag}\n\n${USAGE}`);
    }
  }

  const dbPath = db ?? "data/inh-multi.db";
  try {
    await runMulti({ port, dbPath, importFile: importFile ?? ".data.json" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      fail(`Port ${port} kullanimda. Baska bir sunucu acik olabilir; kapat veya --port ile farkli port ver.`);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
