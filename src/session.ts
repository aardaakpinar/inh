import { sleep, rint } from "./util.js";
import type { Game } from "./world.js";

export class Disconnected extends Error {
  constructor() {
    super("baglanti kapandi");
  }
}
export class AskTimeout extends Error {
  constructor() {
    super("zaman asimi");
  }
}

const MAX_PENDING = 8192; // satir sonu gelmeyen veri sinirii
const MAX_QUEUE = 200;

interface Waiter {
  resolve: (line: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout | null;
}

/** Satir tabanli okuma kuyrugu. Zaman asiminda satir kaybolmaz. */
export class LineChannel {
  private pending = "";
  private queue: string[] = [];
  private waiter: Waiter | null = null;
  private ended = false;

  feed(chunk: string): void {
    this.pending += chunk;
    let i: number;
    while ((i = this.pending.indexOf("\n")) >= 0) {
      this.push(this.pending.slice(0, i));
      this.pending = this.pending.slice(i + 1);
    }
    if (this.pending.length > MAX_PENDING) this.pending = "";
  }

  end(): void {
    if (this.ended) return;
    if (this.pending) {
      this.push(this.pending);
      this.pending = "";
    }
    this.ended = true;
    this.finishWaiter((w) => w.reject(new Disconnected()));
  }

  private push(line: string): void {
    if (this.waiter) {
      this.finishWaiter((w) => w.resolve(line));
    } else {
      this.queue.push(line);
      if (this.queue.length > MAX_QUEUE) this.queue.shift();
    }
  }

  private finishWaiter(fn: (w: Waiter) => void): void {
    const w = this.waiter;
    if (!w) return;
    this.waiter = null;
    if (w.timer) clearTimeout(w.timer);
    fn(w);
  }

  readLine(timeoutMs?: number): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.ended) return Promise.reject(new Disconnected());
    if (this.waiter) return Promise.reject(new Error("ayni anda iki okuma"));
    return new Promise<string>((resolve, reject) => {
      const w: Waiter = { resolve, reject, timer: null };
      if (timeoutMs !== undefined) {
        w.timer = setTimeout(() => this.finishWaiter((x) => x.reject(new AskTimeout())), Math.max(0, timeoutMs));
      }
      this.waiter = w;
    });
  }
}

export interface Io {
  write(data: string): void;
  close(): void;
}

export class Sess {
  ip = "";
  user = "";
  spoof: string | null = null;

  constructor(
    readonly game: Game,
    private readonly io: Io,
    private readonly chan: LineChannel,
  ) {}

  write(text: string): void {
    try {
      this.io.write(text);
    } catch {
      /* baglanti kopmus olabilir */
    }
  }

  out(text = ""): void {
    this.write(text + "\n");
  }

  /** Bir satir okur. timeoutS saniye icinde gelmezse AskTimeout firlatir. */
  async ask(prompt: string, timeoutS?: number): Promise<string> {
    this.write(prompt);
    const line = await this.chan.readLine(timeoutS === undefined ? undefined : timeoutS * 1000);
    return line.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  }

  lag(a = 0.2, b = 0.7): Promise<void> {
    return sleep(a * 1000 + (rint(0, 1000) / 1000) * (b - a) * 1000);
  }

  close(): void {
    try {
      this.io.close();
    } catch {
      /* yut */
    }
    this.chan.end(); // bekleyen okumayi (varsa) Disconnected ile bitirir
  }
}
