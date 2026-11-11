/**
 * useBleEeg — bridges the BLE manager + ring buffer to React state.
 *
 * Intended to be instantiated ONCE (in App.tsx) so the buffer survives
 * tab switches. Snapshots the buffer at ~10 Hz — never setState per
 * sample (~250 Hz stays inside the ref-backed ring buffer).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThingSpeakFeedItem } from '../types';
import { BleRingBuffer } from '../services/ble/bleRingBuffer';
import {
  BIOAMP_DEVICE_NAME,
  bioAmpBleManager,
  type BleConnectionState,
  type BleScanResult,
} from '../services/ble/bleManager';
import type { BleEegPair } from '../services/ble/bleParser';

/** Snapshot cadence: 10 UI updates/sec (never 250 setState/sec). */
const SNAPSHOT_INTERVAL_MS = 100;

export interface BleEegStatus {
  state: BleConnectionState;
  message?: string;
  deviceName: string | null;
  receivedHz: number;
  sampleCount: number;
  parseErrors: number;
  gaps: number;
  buffered: number;
}

/** Adapter boundary: BLE sample → ThingSpeakFeedItem-compatible object. */
export function bleSampleToFeedItem(seq: number, tMs: number, eeg: number, eog: number): ThingSpeakFeedItem {
  return {
    entry_id: seq,
    created_at: new Date(tMs).toISOString(),
    field1: String(eeg),
    field2: String(eog),
    field3: null,
    field4: null,
    field5: null,
    field6: null,
  };
}

export function useBleEeg() {
  const bufferRef = useRef<BleRingBuffer | null>(null);
  if (!bufferRef.current) bufferRef.current = new BleRingBuffer();

  const [bleFeeds, setBleFeeds] = useState<ThingSpeakFeedItem[]>([]);
  const [bleState, setBleState] = useState<BleConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [scanResults, setScanResults] = useState<BleScanResult[]>([]);
  const [stats, setStats] = useState({ receivedHz: 0, sampleCount: 0, parseErrors: 0, gaps: 0, buffered: 0 });
  const [error, setError] = useState<string | null>(null);

  // Wire manager events once + run the 10 Hz snapshot loop.
  useEffect(() => {
    const buffer = bufferRef.current!;

    bioAmpBleManager.setEvents({
      onPairs: (pairs: BleEegPair[], receivedAtMs: number) => {
        if (pairs.length > 0) {
          console.log(`[BLE DIAG] useBleEeg.onPairs received ${pairs.length} samples. Pushing to ring buffer.`);
        }
        buffer.pushPairs(pairs, receivedAtMs);
      },
      onState: (state, message) => {
        console.log(`[BLE DIAG] useBleEeg.onState: ${state} (${message ?? ''})`);
        setBleState(state);
        setStatusMessage(message);
        if (state === 'scanning' || state === 'idle') {
          setScanResults(bioAmpBleManager.getScanResults());
        }
        if (state === 'error') {
          setError(message ?? 'Bluetooth error');
        } else if (state === 'streaming' || state === 'connected') {
          setError(null);
        }
      },
      onScanResult: () => {
        setScanResults(bioAmpBleManager.getScanResults());
      },
    });
    setBleState(bioAmpBleManager.connectionState);

    const timer = setInterval(() => {
      const snap = buffer.snapshot();
      // Rebuild the adapter array only when the buffer actually advanced.
      setBleFeeds(prev => {
        if (prev.length > 0 && snap.length > 0 &&
            prev[prev.length - 1].entry_id === snap[snap.length - 1].seq &&
            prev.length === snap.length) {
          return prev; // no change → skip re-render
        }
        if (snap.length > 0) {
          console.log(`[BLE DIAG] useBleEeg setting bleFeeds count: ${snap.length}`);
        }
        return snap.map(s => bleSampleToFeedItem(s.seq, s.tMs, s.eeg, s.eog));
      });
      const bs = buffer.getStats();
      setStats(prev => {
        if (prev.receivedHz === bs.receivedHz && prev.sampleCount === bs.sampleCount &&
            prev.gaps === bs.gaps && prev.buffered === bs.buffered &&
            prev.parseErrors === bioAmpBleManager.getParseErrors()) {
          return prev;
        }
        return {
          receivedHz: bs.receivedHz,
          sampleCount: bs.sampleCount,
          parseErrors: bioAmpBleManager.getParseErrors(),
          gaps: bs.gaps,
          buffered: bs.buffered,
        };
      });
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      // NOTE: do NOT disconnect here — the singleton manager + buffer persist
      // across tab switches; this hook is mounted once in App.tsx.
    };
  }, []);

  const scan = useCallback(async () => {
    setError(null);
    try {
      await bioAmpBleManager.startScan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const stopScan = useCallback(async () => {
    await bioAmpBleManager.stopScan().catch(() => undefined);
    setScanResults(bioAmpBleManager.getScanResults());
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    setError(null);
    try {
      await bioAmpBleManager.connect(deviceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const connectToBioAmp = useCallback(async () => {
    setError(null);
    try {
      await bioAmpBleManager.connectToBioAmp();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await bioAmpBleManager.disconnect();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const clearBuffer = useCallback(() => {
    bufferRef.current?.reset();
    setBleFeeds([]);
    setStats({ receivedHz: 0, sampleCount: 0, parseErrors: bioAmpBleManager.getParseErrors(), gaps: 0, buffered: 0 });
  }, []);

  const status: BleEegStatus = {
    state: bleState,
    message: statusMessage,
    deviceName: bleState === 'connected' || bleState === 'streaming' ? BIOAMP_DEVICE_NAME : null,
    receivedHz: stats.receivedHz,
    sampleCount: stats.sampleCount,
    parseErrors: stats.parseErrors,
    gaps: stats.gaps,
    buffered: stats.buffered,
  };

  return {
    bleFeeds,
    status,
    scanResults,
    error,
    scan,
    stopScan,
    connect,
    connectToBioAmp,
    disconnect,
    clearBuffer,
    isStreaming: bleState === 'streaming',
    isBusy: bleState === 'scanning' || bleState === 'connecting' || bleState === 'disconnecting',
  };
}

export type UseBleEegReturn = ReturnType<typeof useBleEeg>;
