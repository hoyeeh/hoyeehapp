/**
 * Correlates controller commands with receiver ACKs.
 *
 * Server contract (cast-signaling v2): the receiver can only ACK the *current*
 * command_seq, once. Therefore:
 *  - lastAckedSeq === seq         → that exact command's result (success|error)
 *  - commandSeq > seq and not acked → superseded; it will never be acked
 *  - an ACK for a later seq never marks an earlier one as success
 * Observations that arrive before `wait()` is registered are retained so an
 * ACK racing the command response is not lost.
 */
export interface AckOutcome {
  acked: boolean;
  error?: string;
  timedOut?: boolean;
  superseded?: boolean;
}

export interface AckObservation {
  lastAckedSeq: number;
  lastAckStatus?: string | null;
  lastAckError?: string | null;
  commandSeq?: number;
}

interface Pending {
  resolve: (o: AckOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CastAckTracker {
  private pending = new Map<number, Pending>();
  private acks = new Map<number, { status: string; error: string | null }>();
  private maxCommandSeq = 0;

  constructor(private timeoutMs = 8000) {}

  get pendingCount() {
    return this.pending.size;
  }

  observe(o: AckObservation) {
    const acked = Number(o.lastAckedSeq) || 0;
    if (acked > 0 && o.lastAckStatus) {
      this.acks.set(acked, { status: o.lastAckStatus, error: o.lastAckError ?? null });
      // keep memory bounded
      if (this.acks.size > 50) this.acks.delete(Math.min(...this.acks.keys()));
    }
    const cs = Number(o.commandSeq) || 0;
    if (cs > this.maxCommandSeq) this.maxCommandSeq = cs;
    for (const seq of [...this.pending.keys()]) this.tryResolve(seq);
  }

  wait(seq: number): Promise<AckOutcome> {
    if (seq > this.maxCommandSeq) this.maxCommandSeq = seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(seq)) {
          resolve({ acked: false, timedOut: true, error: 'TV did not confirm playback in time' });
        }
      }, this.timeoutMs);
      this.pending.set(seq, { resolve, timer });
      this.tryResolve(seq);
    });
  }

  cancelAll(reason = 'Cast session ended') {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ acked: false, error: reason });
    }
    this.pending.clear();
    this.acks.clear();
    this.maxCommandSeq = 0;
  }

  private tryResolve(seq: number) {
    const p = this.pending.get(seq);
    if (!p) return;
    const a = this.acks.get(seq);
    let outcome: AckOutcome | null = null;
    if (a) {
      outcome = a.status === 'success'
        ? { acked: true }
        : { acked: false, error: a.error || 'TV reported playback error' };
    } else if (this.maxCommandSeq > seq) {
      outcome = { acked: false, superseded: true, error: 'Superseded by a newer command' };
    }
    if (outcome) {
      clearTimeout(p.timer);
      this.pending.delete(seq);
      p.resolve(outcome);
    }
  }
}
