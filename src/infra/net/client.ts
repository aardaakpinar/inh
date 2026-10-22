import net from "node:net";

/** Sunucuya baglanir; stdin -> sunucu, sunucu -> stdout. */
export function runClient(host: string, port: number): void {
  const socket = net.createConnection({ host, port });
  let connected = false;
  socket.setTimeout(8000);

  socket.once("connect", () => {
    connected = true;
    socket.setTimeout(0);
    socket.setEncoding("utf8");
    socket.on("data", (d: string) => process.stdout.write(d));
    process.stdin.pipe(socket);
  });

  socket.once("timeout", () => {
    if (!connected) socket.destroy();
  });

  socket.on("error", () => {
    /* 'close' olayi mesaji yazar */
  });

  socket.on("close", () => {
    if (!connected) {
      console.log(
        `Baglanilamadi: ${host}:${port}\nSunucu calisiyor mu? IP ve port dogru mu? Guvenlik duvari ${port} portunu engelliyor olabilir.`,
      );
    } else {
      console.log("\n[Baglanti kapandi]");
    }
    process.exit(connected ? 0 : 1);
  });
}
