/**
 * BioAmp_Sleep BLE notification parser — Phase 1.
 *
 * Payload format (UTF-8 text per notification):
 *   EEG,EOG;EEG,EOG;EEG,EOG;EEG,EOG
 * Example:
 *   12,-3;15,-2;18,1;14,4
 *
 * Handles:
 * - DataView or string input
 * - Fragmented notifications (persistent carry buffer)
 * - Multiple logical packets per callback
 * - Negative numbers, whitespace/CRLF tolerance
 * - Malformed tokens counted, never thrown
 *
 * Framing note: notifications use ';' as a *separator* (the final pair has
 * no trailing ';'). Each notification callback is therefore flushed
 * optimistically: a trailing fragment that is already a complete valid
 * "EEG,EOG" pair is emitted immediately; anything else stays in the carry
 * buffer for the next notification (MTU-split safe).
 */

export interface BleEegPair {
  eeg: number;
  eog: number;
}

const PAIR_RE = /^-?\d+,-?\d+$/;
const MAX_CARRY_CHARS = 4096;

function parseToken(token: string): BleEegPair | null {
  const t = token.trim().replace(/[\r\n]+/g, '');
  if (t === '' || !PAIR_RE.test(t)) return null;
  const comma = t.indexOf(',');
  const eeg = Number(t.slice(0, comma));
  const eog = Number(t.slice(comma + 1));
  if (!Number.isFinite(eeg) || !Number.isFinite(eog)) return null;
  return { eeg, eog };
}

export class BioAmpBleParser {
  private carry = '';
  private textDecoder: TextDecoder | null = null;
  parseErrors = 0;

  /** Total complete pairs emitted so far (diagnostic). */
  totalPairs = 0;

  reset(): void {
    this.carry = '';
    this.parseErrors = 0;
    this.totalPairs = 0;
  }

  /** Current unprocessed fragment length (diagnostic). */
  get pendingChars(): number {
    return this.carry.length;
  }

  push(input: DataView | string): BleEegPair[] {
    let chunk: string;
    if (typeof input === 'string') {
      chunk = input;
    } else {
      try {
        if (!this.textDecoder) this.textDecoder = new TextDecoder('utf-8');
        chunk = this.textDecoder.decode(input, { stream: true });
      } catch {
        this.parseErrors += 1;
        return [];
      }
    }
    return this.pushText(chunk);
  }

  /** Push already-decoded text (also used by tests). */
  pushText(chunk: string): BleEegPair[] {
    if (!chunk) return [];
    this.carry += chunk;

    // Overflow guard: drop oldest data rather than growing forever.
    if (this.carry.length > MAX_CARRY_CHARS) {
      this.carry = this.carry.slice(-MAX_CARRY_CHARS);
      this.parseErrors += 1;
    }

    const out: BleEegPair[] = [];
    // Consume every complete segment terminated by ';'.
    const lastSemi = this.carry.lastIndexOf(';');
    if (lastSemi !== -1) {
      const consumable = this.carry.slice(0, lastSemi + 1);
      this.carry = this.carry.slice(lastSemi + 1);
      for (const raw of consumable.split(';')) {
        if (raw.trim() === '') continue;
        const pair = parseToken(raw);
        if (pair) out.push(pair);
        else this.parseErrors += 1;
      }
    }

    // Optimistic per-message flush: if the remaining trailing fragment is
    // already a complete valid pair, it was the (unterminated) final pair
    // of this notification — emit it now so no sample is systematically
    // delayed. A mid-number MTU split (e.g. "14,") never matches PAIR_RE
    // and correctly stays buffered.
    if (this.carry !== '') {
      const tail = parseToken(this.carry);
      if (tail) {
        out.push(tail);
        this.carry = '';
      }
    }

    this.totalPairs += out.length;
    return out;
  }

  /** Force-flush any trailing valid pair (e.g. on disconnect). */
  flush(): BleEegPair[] {
    if (this.carry === '') return [];
    const tail = parseToken(this.carry);
    this.carry = '';
    if (tail) {
      this.totalPairs += 1;
      return [tail];
    }
    this.parseErrors += 1;
    return [];
  }
}

/** One-shot convenience for complete payloads (no carry needed). */
export function parseBioAmpPayload(input: DataView | string): BleEegPair[] {
  const parser = new BioAmpBleParser();
  return parser.push(input);
}
