/**
 * Fixed time-window ring buffer for BLE EEG/EOG samples — Phase 1.
 *
 * Capacity: nominal 256 Hz × 30 s = 7680 samples. Memory never grows
 * beyond capacity (oldest samples are overwritten).
 *
 * No resampling, no fabrication: every received pair is stored with its
 * arrival-derived timestamp. Gaps (inter-notification delay above
 * threshold) are counted, never filled.
 */

import type { BleEegPair } from './bleParser';

export interface BleSample extends BleEegPair {
  /** Phone receipt/interpolated timestamp (ms since epoch). */
  tMs: number;
  /** Local monotonically increasing sequence number (adapter entry_id). */
  seq: number;
}

export const BLE_NOMINAL_HZ = 256;
export const BLE_WINDOW_SECONDS = 30;
export const BLE_BUFFER_CAPACITY = BLE_NOMINAL_HZ * BLE_WINDOW_SECONDS; // 7680

/** Inter-notification silence above this counts as a comms gap. */
export const BLE_GAP_THRESHOLD_MS = 100;
/** Samples older than window + grace are evicted on snapshot. */
const EVICT_GRACE_MS = 2000;

export interface BleBufferStats {
  sampleCount: number; // total pairs received since reset
  receivedHz: number; // EMA over recent 5 s window
  malformed: number; // malformed tokens reported by parser
  gaps: number; // detected comms gaps
  buffered: number; // currently retained samples
}

export class BleRingBuffer {
  private buf: BleSample[];
  private head = 0; // next write index
  private size = 0;
  private seq = 0;

  private totalSamples = 0;
  private malformed = 0;
  private gaps = 0;
  private lastNotifyMs: number | null = null;

  // Receive-rate EMA: timestamps of recent arrivals (5 s sliding window).
  private arrivalTimes: number[] = [];

  constructor(private capacity: number = BLE_BUFFER_CAPACITY) {
    this.buf = new Array(capacity);
  }

  reset(): void {
    this.head = 0;
    this.size = 0;
    this.seq = 0;
    this.totalSamples = 0;
    this.malformed = 0;
    this.gaps = 0;
    this.lastNotifyMs = null;
    this.arrivalTimes = [];
  }

  /**
   * Append one notification's pairs. `receivedAtMs` is the callback arrival
   * time; per-sample timestamps are interpolated backwards uniformly so the
   * 4 pairs of a packet keep their intra-packet order without claiming a
   * false 256 Hz clock.
   */
  pushPairs(pairs: BleEegPair[], receivedAtMs: number, nominalHz = BLE_NOMINAL_HZ): void {
    if (pairs.length === 0) return;

    if (this.lastNotifyMs !== null && receivedAtMs - this.lastNotifyMs > BLE_GAP_THRESHOLD_MS) {
      this.gaps += 1;
    }
    this.lastNotifyMs = receivedAtMs;

    this.arrivalTimes.push(receivedAtMs);
    const cutoff = receivedAtMs - 5000;
    while (this.arrivalTimes.length > 0 && this.arrivalTimes[0] < cutoff) {
      this.arrivalTimes.shift();
    }

    const dt = 1000 / nominalHz;
    for (let i = 0; i < pairs.length; i++) {
      const tMs = receivedAtMs - (pairs.length - 1 - i) * dt;
      this.buf[this.head] = { eeg: pairs[i].eeg, eog: pairs[i].eog, tMs, seq: this.seq++ };
      this.head = (this.head + 1) % this.capacity;
      if (this.size < this.capacity) this.size += 1;
      this.totalSamples += 1;
    }
  }

  addMalformed(count: number): void {
    this.malformed += count;
  }

  /** Chronological snapshot (oldest → newest), evicting expired samples. */
  snapshot(nowMs = Date.now()): BleSample[] {
    const expireBefore = nowMs - (BLE_WINDOW_SECONDS * 1000 + EVICT_GRACE_MS);
    const out: BleSample[] = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      out[i] = this.buf[(this.head - this.size + i + this.capacity * 2) % this.capacity];
    }
    // Buffer is time-ordered by construction; drop expired prefix.
    let start = 0;
    while (start < out.length && out[start].tMs < expireBefore) start++;
    return start === 0 ? out : out.slice(start);
  }

  /** Last N samples (for time-based window presets). */
  tail(n: number, nowMs = Date.now()): BleSample[] {
    const snap = this.snapshot(nowMs);
    return n >= snap.length ? snap : snap.slice(snap.length - n);
  }

  getStats(nowMs = Date.now()): BleBufferStats {
    // receivedHz: density of retained samples over their own time span.
    // This reflects the observed arrival rate (~245-249 Hz) without ever
    // claiming the nominal 256 Hz device clock.
    const snap = this.snapshot(nowMs);
    let hz = 0;
    if (snap.length >= 2) {
      const span = (snap[snap.length - 1].tMs - snap[0].tMs) / 1000;
      if (span > 0.5) hz = snap.length / span;
    }
    return {
      sampleCount: this.totalSamples,
      receivedHz: Number(hz.toFixed(1)),
      malformed: this.malformed,
      gaps: this.gaps,
      buffered: snap.length,
    };
  }
}
