/** Oyun icinde olan seyler. Yan etkiler (log, alarm, skor) bu olaylara baglanir. */
export type DomainEvent =
  | { type: "PortScanned"; targetIp: string; srcIp: string }
  | { type: "AttackBlocked"; targetIp: string; srcIp: string; reason: "firewall" }
  | { type: "AttackFailed"; targetIp: string; srcIp: string; port: string; method: string }
  | { type: "HostCompromised"; targetIp: string; srcIp: string; port: string; method: string }
  | { type: "BruteForceStarted"; targetIp: string; srcIp: string; port: string }
  | { type: "SecretWritten"; targetIp: string; srcIp: string }
  | { type: "Looted"; targetIp: string; srcIp: string; amount: number }
  | { type: "HoneypotTriggered"; targetIp: string; realIp: string; shownIp: string }
  | { type: "BackdoorInstalled"; targetIp: string; attackerIp: string };

export type EventHandler = (event: DomainEvent) => void;

/** Surec ici, senkron olay veriyolu. Event sourcing degil; veritabani ana kaynak. */
export class EventBus {
  private readonly handlers = new Set<EventHandler>();

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: DomainEvent): void {
    for (const handler of [...this.handlers]) {
      try {
        handler(event);
      } catch (e) {
        console.error("olay isleyici hatasi:", e);
      }
    }
  }
}
