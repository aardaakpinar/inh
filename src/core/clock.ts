/** Oyun saati. Testlerde sabit bir saat enjekte edilebilir. */
export interface Clock {
  /** Epoch milisaniye. */
  now(): number;
  /** Gorunen saat: HH:MM:SS. */
  hms(): string;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  hms(): string {
    return new Date(this.now()).toTimeString().slice(0, 8);
  }
}

export const systemClock = new SystemClock();
