export interface MetricsSnapshot {
  acceptedControls: number;
  rejectedControls: number;
  pendingDeliveries: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
}

/** Bounded, in-memory observability. Keep durable samples in Prisma in production. */
export class Metrics {
  private deliveryStarted = new Map<string, number>();
  private deliverySamples: number[] = [];
  private acceptedControls = 0;
  private rejectedControls = 0;

  controlAccepted(): void { this.acceptedControls += 1; }
  controlRejected(): void { this.rejectedControls += 1; }
  startDelivery(socketId: string, version: number): void { this.deliveryStarted.set(`${socketId}:${version}`, performance.now()); }
  delivered(socketId: string, version: number): void {
    const key = `${socketId}:${version}`;
    const started = this.deliveryStarted.get(key);
    if (started === undefined) return;
    this.deliveryStarted.delete(key);
    this.deliverySamples.push(performance.now() - started);
    if (this.deliverySamples.length > 2_000) this.deliverySamples.splice(0, this.deliverySamples.length - 2_000);
  }
  snapshot(): MetricsSnapshot {
    const ordered = [...this.deliverySamples].sort((a, b) => a - b);
    const percentile = (fraction: number): number | null => {
      if (!ordered.length) return null;
      return Math.round(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)]! * 100) / 100;
    };
    return { acceptedControls: this.acceptedControls, rejectedControls: this.rejectedControls, pendingDeliveries: this.deliveryStarted.size, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
  }
}
