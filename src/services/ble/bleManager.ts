/**
 * BLE central manager for BioAmp_Sleep — Phase 1.
 *
 * Wraps @capacitor-community/bluetooth-le with:
 * - single initialization
 * - LE scan for BioAmp_Sleep (service-UUID filtered, name verified)
 * - connect / service+characteristic notification subscribe (duplicate-safe)
 * - disconnect + listener cleanup + safe reconnect
 * - throttled aggregate diagnostics (never logs every packet)
 */

import { BleClient } from '@capacitor-community/bluetooth-le';
import { BioAmpBleParser, type BleEegPair } from './bleParser';

export const BIOAMP_DEVICE_NAME = 'BioAmp_Sleep';
export const BIOAMP_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BIOAMP_DATA_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export type BleConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'disconnecting'
  | 'error';

export interface BleScanResult {
  deviceId: string;
  name?: string;
  rssi?: number;
}

interface ManagerEvents {
  onPairs?: (pairs: BleEegPair[], receivedAtMs: number) => void;
  onParseErrors?: (count: number) => void;
  onState?: (state: BleConnectionState, message?: string) => void;
  onScanResult?: (result: BleScanResult) => void;
}

const SCAN_TIMEOUT_MS = 15000;
/** Aggregate diagnostics interval — the only recurring BLE log. */
const DIAG_INTERVAL_MS = 5000;

export class BioAmpBleManager {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private state: BleConnectionState = 'idle';
  private deviceId: string | null = null;
  private notifying = false;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private scanResults = new Map<string, BleScanResult>();
  private parser = new BioAmpBleParser();
  private diagTimer: ReturnType<typeof setInterval> | null = null;
  private diagPairs = 0;
  private diagNotifies = 0;
  private events: ManagerEvents = {};

  setEvents(events: ManagerEvents): void {
    this.events = events;
  }

  get connectionState(): BleConnectionState {
    return this.state;
  }

  get connectedDeviceId(): string | null {
    return this.deviceId;
  }

  get isSubscribed(): boolean {
    return this.notifying;
  }

  private emitState(state: BleConnectionState, message?: string): void {
    this.state = state;
    this.events.onState?.(state, message);
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = BleClient.initialize({ androidNeverForLocation: true })
      .then(() => {
        this.initialized = true;
      })
      .catch(err => {
        this.initPromise = null;
        throw err;
      });
    return this.initPromise;
  }

  // ------------------------------------------------------------------ scan
  async startScan(): Promise<void> {
    await this.ensureInitialized();
    if (this.state === 'scanning') return;
    this.scanResults.clear();
    this.emitState('scanning');

    try {
      await BleClient.requestLEScan({ services: [BIOAMP_SERVICE_UUID] }, result => {
        const name = (result as unknown as { device?: { name?: string }; rssi?: number }).device?.name
          ?? (result as unknown as { name?: string }).name;
        const id = (result as unknown as { device?: { deviceId?: string }; deviceId?: string }).device?.deviceId
          ?? (result as unknown as { deviceId?: string }).deviceId
          ?? '';
        if (!id) return;
        const entry: BleScanResult = { deviceId: id, name, rssi: (result as unknown as { rssi?: number }).rssi };
        console.log('[BLE DIAG] Device discovered:', { deviceId: id, name, rssi: entry.rssi });
        // Keep every candidate, but surface the target device prominently.
        if (!this.scanResults.has(id)) {
          this.scanResults.set(id, entry);
          this.events.onScanResult?.(entry);
        }
      });
    } catch (err: unknown) {
      console.error('[BLE DIAG] Scan error:', err);
      this.emitState('error', err instanceof Error ? err.message : String(err));
      return;
    }

    if (this.scanTimeout) clearTimeout(this.scanTimeout);
    this.scanTimeout = setTimeout(() => {
      void this.stopScan().then(() => {
        if (this.state === 'scanning') this.emitState('idle', 'Scan finished');
      });
    }, SCAN_TIMEOUT_MS);
  }

  async stopScan(): Promise<void> {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    try {
      await BleClient.stopLEScan();
    } catch {
      // stopLEScan throws when no scan is active on some platforms — harmless.
    }
    if (this.state === 'scanning') this.emitState('idle');
  }

  getScanResults(): BleScanResult[] {
    return [...this.scanResults.values()].sort((a, b) => {
      const aTarget = a.name === BIOAMP_DEVICE_NAME ? 0 : 1;
      const bTarget = b.name === BIOAMP_DEVICE_NAME ? 0 : 1;
      if (aTarget !== bTarget) return aTarget - bTarget;
      return (b.rssi ?? -999) - (a.rssi ?? -999);
    });
  }

  // -------------------------------------------------------------- connect
  async connect(deviceId: string): Promise<void> {
    await this.ensureInitialized();
    console.log('[BLE DIAG] Initiating connect to deviceId:', deviceId);
    // Safe reconnect: tear down any previous session first.
    if (this.deviceId && this.deviceId !== deviceId) {
      await this.disconnect();
    } else if (this.deviceId === deviceId && (this.state === 'connected' || this.state === 'streaming')) {
      console.log('[BLE DIAG] Already connected to deviceId:', deviceId);
      return; // already on this device
    }
    await this.stopScan().catch(() => undefined);

    this.emitState('connecting');
    try {
      await BleClient.connect(deviceId, () => {
        console.log('[BLE DIAG] Native disconnect callback fired for deviceId:', deviceId);
        // Native disconnect callback (link loss / peripheral reboot).
        this.handleNativeDisconnect();
      });
      this.deviceId = deviceId;
      this.parser.reset();
      console.log('[BLE DIAG] Device connected successfully:', deviceId);

      // Perform GATT Service & Characteristic Discovery
      try {
        const services = await BleClient.getServices(deviceId);
        console.log('[BLE DIAG] Services discovered count:', services.length);
        let foundTargetChar = false;
        services.forEach(s => {
          console.log(`[BLE DIAG] Service UUID: ${s.uuid}`);
          s.characteristics.forEach(c => {
            console.log(`  └─ Char UUID: ${c.uuid} | Properties: ${JSON.stringify(c.properties)}`);
            if (s.uuid.toLowerCase() === BIOAMP_SERVICE_UUID.toLowerCase() &&
                c.uuid.toLowerCase() === BIOAMP_DATA_CHAR_UUID.toLowerCase()) {
              foundTargetChar = true;
            }
          });
        });
        console.log('[BLE DIAG] Target service/char match found:', foundTargetChar, {
          targetService: BIOAMP_SERVICE_UUID,
          targetChar: BIOAMP_DATA_CHAR_UUID,
        });
      } catch (discErr) {
        console.error('[BLE DIAG] Service discovery error (getServices):', discErr);
      }

      this.emitState('connected');
      await this.subscribe();
    } catch (err: unknown) {
      console.error('[BLE DIAG] Connection or subscription failed:', err);
      this.deviceId = null;
      this.emitState('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** Connect to the first scanned BioAmp_Sleep, or throw if not seen. */
  async connectToBioAmp(): Promise<void> {
    const target = this.getScanResults().find(r => r.name === BIOAMP_DEVICE_NAME)
      ?? this.getScanResults()[0];
    if (!target) throw new Error(`Device ${BIOAMP_DEVICE_NAME} not found. Scan first.`);
    return this.connect(target.deviceId);
  }

  // ---------------------------------------------------------- subscribe
  async subscribe(): Promise<void> {
    if (!this.deviceId) throw new Error('No device connected');
    if (this.notifying) return; // duplicate-subscription guard

    console.log('[BLE DIAG] Enabling notifications for device:', this.deviceId, {
      service: BIOAMP_SERVICE_UUID,
      characteristic: BIOAMP_DATA_CHAR_UUID,
    });

    try {
      await BleClient.startNotifications(
        this.deviceId,
        BIOAMP_SERVICE_UUID,
        BIOAMP_DATA_CHAR_UUID,
        (value: DataView) => this.handleNotification(value)
      );
      this.notifying = true;
      console.log('[BLE DIAG] Notifications successfully enabled!');
      this.startDiagTimer();
      this.emitState('streaming');
    } catch (err) {
      console.error('[BLE DIAG] startNotifications failed:', err);
      throw err;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.deviceId || !this.notifying) return;
    try {
      await BleClient.stopNotifications(this.deviceId, BIOAMP_SERVICE_UUID, BIOAMP_DATA_CHAR_UUID);
      console.log('[BLE DIAG] Notifications stopped');
    } catch (err) {
      console.warn('[BLE DIAG] stopNotifications error:', err);
    }
    this.notifying = false;
    this.stopDiagTimer();
  }

  private handleNotification(value: DataView): void {
    const receivedAt = Date.now();
    const byteLength = value.byteLength;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = String.fromCharCode(...bytes.slice(0, 32)).replace(/[^\x20-\x7E]/g, '.');

    if (this.diagNotifies < 10 || this.diagNotifies % 100 === 0) {
      console.log(`[BLE DIAG] Notification Callback Fired! Count: ${this.diagNotifies + 1} | Bytes: ${byteLength} | Hex(16): [${hex}] | ASCII: "${ascii}"`);
    }

    let pairs: BleEegPair[];
    try {
      pairs = this.parser.push(value);
    } catch (err) {
      console.error('[BLE DIAG] Parser push exception:', err);
      return;
    }

    if (this.diagNotifies < 10 || this.diagNotifies % 100 === 0) {
      console.log(`[BLE DIAG] Packet Decoded: ${pairs.length} EEG samples | parseErrors: ${this.parser.parseErrors}`, pairs.slice(0, 3));
    }

    if (pairs.length === 0) return;
    this.diagPairs += pairs.length;
    this.diagNotifies += 1;
    this.events.onPairs?.(pairs, receivedAt);
  }

  // ---------------------------------------------------------- disconnect
  private handleNativeDisconnect(): void {
    this.notifying = false;
    this.stopDiagTimer();
    this.deviceId = null;
    this.emitState('idle', 'Device disconnected');
  }

  async disconnect(): Promise<void> {
    if (!this.deviceId && this.state === 'idle') return;
    this.emitState('disconnecting');
    await this.stopScan().catch(() => undefined);
    await this.unsubscribe().catch(() => undefined);
    if (this.deviceId) {
      try {
        await BleClient.disconnect(this.deviceId);
      } catch {
        // Best effort.
      }
    }
    this.deviceId = null;
    // Flush any trailing valid pair so no sample is stranded in the parser.
    const tail = this.parser.flush();
    if (tail.length > 0) this.events.onPairs?.(tail, Date.now());
    this.emitState('idle', 'Disconnected');
  }

  getParseErrors(): number {
    return this.parser.parseErrors;
  }

  // ---------------------------------------------------------- diagnostics
  private startDiagTimer(): void {
    this.stopDiagTimer();
    this.diagPairs = 0;
    this.diagNotifies = 0;
    const start = Date.now();
    this.diagTimer = setInterval(() => {
      const elapsedSec = (Date.now() - start) / 1000;
      const hz = elapsedSec > 0 ? this.diagPairs / elapsedSec : 0;
      // Single aggregate line per interval — never per-packet logging.
      console.log(
        `[BLE] streaming ${BIOAMP_DEVICE_NAME}: ${this.diagPairs} samples in ${elapsedSec.toFixed(1)}s ` +
        `(~${hz.toFixed(1)} Hz, ${this.diagNotifies} notifications, parseErrors=${this.parser.parseErrors})`
      );
    }, DIAG_INTERVAL_MS);
  }

  private stopDiagTimer(): void {
    if (this.diagTimer) {
      clearInterval(this.diagTimer);
      this.diagTimer = null;
    }
  }
}

/** Shared singleton — one manager per app lifetime prevents duplicate listeners. */
export const bioAmpBleManager = new BioAmpBleManager();
