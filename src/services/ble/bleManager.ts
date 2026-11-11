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

import { BleClient, ConnectionPriority } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
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
/** Verbose per-device / per-notification BLE logs: dev builds only. */
const BLE_DEBUG = Boolean(import.meta.env?.DEV);
const debug = (...args: unknown[]): void => {
  if (BLE_DEBUG) console.log(...args);
};
/** Aggregate diagnostics interval — the only recurring BLE log. */
const DIAG_INTERVAL_MS = 5000;
/** Android's stack needs a moment after stopLEScan before connectGatt (avoids GATT 133). */
const POST_SCAN_SETTLE_MS = 400;
const CONNECT_TIMEOUT_MS = 15000;
const CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;
/** A link that drops within this window of connecting is reported as a connection failure. */
const EARLY_DROP_WINDOW_MS = 10000;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Transient Android GATT failures that usually succeed on a retry. */
function isTransientConnectError(err: unknown): boolean {
  return /status (133|62|8|34|257)\b|GATT_ERROR|GATT_CONN_FAIL_ESTABLISH|GATT_CONN_TIMEOUT|LMP_TIMEOUT|Connection timeout/i.test(errText(err));
}

/** Turns plugin/Android status text into an actionable message. */
export function explainBleError(err: unknown): string {
  const msg = errText(err);
  const hints: [RegExp, string][] = [
    [/status 133|GATT_ERROR/i, 'Android GATT error 133 — the phone\'s Bluetooth stack refused the link. Move closer, toggle Bluetooth off/on, and retry.'],
    [/status 8\b|GATT_CONN_TIMEOUT|LMP_TIMEOUT|status 34/i, 'Link supervision timeout — the device went out of range, lost power, or stopped responding.'],
    [/status 19\b|TERMINATE_PEER_USER/i, 'The BioAmp device closed the connection itself (firmware disconnect or reboot). Check its power and that no other phone/app is connected to it.'],
    [/status 22\b|TERMINATE_LOCAL_HOST/i, 'The phone ended the link (often after a failed pairing/encryption request or another app using the device).'],
    [/status 62\b|FAIL_ESTABLISH/i, 'Connection could not be established — the device stopped advertising or is connected elsewhere.'],
    [/status (?:code )?(5|15|137)\b|auth|bond|encrypt/i, 'The device requires pairing/encryption. Pair it in Android Bluetooth settings or disable security in the firmware.'],
    [/Characteristic not found/i, 'The device does not expose the expected data characteristic (6e400003…). The firmware UUIDs may differ.'],
    [/Setting notification/i, 'Enabling notifications on the data characteristic failed.'],
    [/permission|not allowed|denied/i, 'Bluetooth permission was denied. Allow "Nearby devices" for this app in Android settings.'],
    [/disabled|not enabled|turned off/i, 'Bluetooth is turned off on this phone.'],
    [/Connection timeout/i, 'Connection timed out — the device did not answer. Make sure it is powered and advertising.'],
  ];
  const hint = hints.find(([re]) => re.test(msg))?.[1];
  return hint ? `${hint} [${msg}]` : msg;
}

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
  private connectedAtMs = 0;
  private connectInProgress = false;
  /** Set when the peer drops the link while connect() is still setting it up. */
  private setupDropMs: number | null = null;
  private mtu: number | null = null;
  private lastRawPreview = '';
  private totalNotifications = 0;

  /** Diagnostics surfaced in the UI when a link is up but no samples decode. */
  getLinkDiagnostics(): { mtu: number | null; notifications: number; lastRawPreview: string } {
    return { mtu: this.mtu, notifications: this.totalNotifications, lastRawPreview: this.lastRawPreview };
  }

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
    if (this.state === 'connected' || this.state === 'streaming' || this.state === 'connecting') {
      throw new Error('Disconnect from the current device before scanning.');
    }
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
        debug('[BLE DIAG] Device discovered:', { deviceId: id, name, rssi: entry.rssi });
        // Keep every candidate, but surface the target device prominently.
        if (!this.scanResults.has(id)) {
          this.scanResults.set(id, entry);
          this.events.onScanResult?.(entry);
        }
      });
    } catch (err: unknown) {
      console.error('[BLE] Scan error:', err);
      this.emitState('error', explainBleError(err));
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
    debug('[BLE DIAG] Initiating connect to deviceId:', deviceId);
    // Safe reconnect: tear down any previous session first.
    if (this.deviceId && this.deviceId !== deviceId) {
      await this.disconnect();
    } else if (this.deviceId === deviceId && (this.state === 'connected' || this.state === 'streaming')) {
      return; // already on this device
    }
    const wasScanning = this.state === 'scanning' || this.scanTimeout !== null;
    await this.stopScan().catch(() => undefined);
    if (wasScanning) await sleep(POST_SCAN_SETTLE_MS);

    this.emitState('connecting');
    let lastErr: unknown = null;
    this.connectInProgress = true;
    try {
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      this.setupDropMs = null;
      try {
        await this.connectOnce(deviceId);
        return;
      } catch (err) {
        lastErr = err;
        console.warn(`[BLE] connect attempt ${attempt}/${CONNECT_ATTEMPTS} failed: ${errText(err)}`);
        if (attempt < CONNECT_ATTEMPTS && isTransientConnectError(err)) {
          this.emitState('connecting', `Retrying (${attempt + 1}/${CONNECT_ATTEMPTS})…`);
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        break;
      }
    }
    } finally {
      this.connectInProgress = false;
    }
    this.deviceId = null;
    const message =
      (this.setupDropMs !== null
        ? `The mask closed the connection ${(this.setupDropMs / 1000).toFixed(1)}s after connecting, before streaming started. `
        : '') + explainBleError(lastErr);
    this.emitState('error', message);
    throw new Error(message);
  }

  /** One full connect → verify GATT → tune link → subscribe sequence. */
  private async connectOnce(deviceId: string): Promise<void> {
    this.connectedAtMs = 0;
    await BleClient.connect(
      deviceId,
      () => this.handleNativeDisconnect(deviceId),
      { timeout: CONNECT_TIMEOUT_MS }
    );
    this.deviceId = deviceId;
    this.connectedAtMs = Date.now();
    this.parser.reset();
    this.mtu = null;
    this.lastRawPreview = '';
    this.totalNotifications = 0;

    try {
      // Verify the NUS data characteristic exists before subscribing, so a UUID
      // mismatch is reported clearly instead of as a generic notification error.
      const services = await BleClient.getServices(deviceId);
      const svc = services.find(s => s.uuid.toLowerCase() === BIOAMP_SERVICE_UUID);
      const chr = svc?.characteristics.find(c => c.uuid.toLowerCase() === BIOAMP_DATA_CHAR_UUID);
      if (!chr) {
        const found = services.map(s => s.uuid).join(', ') || 'none';
        throw new Error(`Characteristic not found: ${BIOAMP_DATA_CHAR_UUID} (services on device: ${found})`);
      }
      if (!chr.properties.notify && !chr.properties.indicate) {
        throw new Error(`Setting notification failed: ${BIOAMP_DATA_CHAR_UUID} supports neither notify nor indicate`);
      }

      if (Capacitor.getPlatform() === 'android') {
        // 256 Hz text streaming needs short connection intervals; MTU is negotiated by the plugin.
        await BleClient.requestConnectionPriority(deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH).catch(() => undefined);
        this.mtu = await BleClient.getMtu(deviceId).catch(() => null);
        if (this.mtu !== null && this.mtu < 50) {
          console.warn(`[BLE] Negotiated MTU is only ${this.mtu}; notifications may be truncated by the firmware.`);
        }
      }

      this.emitState('connected', this.mtu ? `MTU ${this.mtu}` : undefined);
      await this.subscribe();
    } catch (err) {
      // Connected but failed later: release the link so it isn't leaked or left half-open.
      this.notifying = false;
      this.stopDiagTimer();
      // Our own teardown also fires the disconnect callback; don't blame the mask for it.
      const peerDropMs = this.setupDropMs;
      await BleClient.disconnect(deviceId).catch(() => undefined);
      this.setupDropMs = peerDropMs;
      this.deviceId = null;
      throw err;
    }
  }

  /** Connect to the first scanned BioAmp_Sleep, or throw if not seen. */
  async connectToBioAmp(): Promise<void> {
    // Scan is filtered on the BioAmp service UUID, so an unnamed result (name only in the
    // scan response on some phones) is still a valid candidate.
    const target = this.getScanResults().find(r => r.name === BIOAMP_DEVICE_NAME) ?? this.getScanResults()[0];
    if (!target) throw new Error(`Device ${BIOAMP_DEVICE_NAME} not found. Scan first and make sure the mask is powered on.`);
    return this.connect(target.deviceId);
  }

  // ---------------------------------------------------------- subscribe
  async subscribe(): Promise<void> {
    if (!this.deviceId) throw new Error('No device connected');
    if (this.notifying) return; // duplicate-subscription guard

    await BleClient.startNotifications(
      this.deviceId,
      BIOAMP_SERVICE_UUID,
      BIOAMP_DATA_CHAR_UUID,
      (value: DataView) => this.handleNotification(value)
    );
    this.notifying = true;
    this.startDiagTimer();
    this.emitState('streaming', this.mtu ? `MTU ${this.mtu}` : undefined);
  }

  async unsubscribe(): Promise<void> {
    if (!this.deviceId || !this.notifying) return;
    try {
      await BleClient.stopNotifications(this.deviceId, BIOAMP_SERVICE_UUID, BIOAMP_DATA_CHAR_UUID);
      debug('[BLE DIAG] Notifications stopped');
    } catch (err) {
      console.warn('[BLE DIAG] stopNotifications error:', err);
    }
    this.notifying = false;
    this.stopDiagTimer();
  }

  private handleNotification(value: DataView): void {
    const receivedAt = Date.now();
    this.diagNotifies += 1;
    this.totalNotifications += 1;
    if (this.totalNotifications <= 3 || this.totalNotifications % 50 === 0) {
      const bytes = new Uint8Array(value.buffer, value.byteOffset, Math.min(48, value.byteLength));
      this.lastRawPreview = String.fromCharCode(...bytes).replace(/[^\x20-\x7E]/g, '·');
    }
    const logThis = BLE_DEBUG && (this.diagNotifies <= 10 || this.diagNotifies % 100 === 0);

    if (logThis) {
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = String.fromCharCode(...bytes.slice(0, 32)).replace(/[^\x20-\x7E]/g, '.');
      debug(`[BLE DIAG] Notification #${this.diagNotifies} | Bytes: ${value.byteLength} | Hex(16): [${hex}] | ASCII: "${ascii}"`);
    }

    let pairs: BleEegPair[];
    try {
      pairs = this.parser.push(value);
    } catch (err) {
      console.error('[BLE DIAG] Parser push exception:', err);
      return;
    }

    if (logThis) {
      debug(`[BLE DIAG] Packet Decoded: ${pairs.length} EEG samples | parseErrors: ${this.parser.parseErrors}`, pairs.slice(0, 3));
    }

    if (pairs.length === 0) return;
    this.diagPairs += pairs.length;
    this.events.onPairs?.(pairs, receivedAt);
  }

  // ---------------------------------------------------------- disconnect
  private handleNativeDisconnect(deviceId: string): void {
    // Ignore callbacks from a stale link (e.g. a failed earlier attempt).
    if (this.deviceId !== null && this.deviceId !== deviceId) return;
    const wasStreaming = this.notifying;
    const connectedFor = this.connectedAtMs ? Date.now() - this.connectedAtMs : 0;
    this.notifying = false;
    this.stopDiagTimer();
    this.deviceId = null;
    const tail = this.parser.flush();
    if (tail.length > 0) this.events.onPairs?.(tail, Date.now());

    // While connect() is still running, its own catch reports the failure (with the
    // Android status). Afterwards, a drop is unexpected and is surfaced as an error.
    if (this.connectInProgress) {
      if (this.connectedAtMs) this.setupDropMs = connectedFor;
      return;
    }
    if (this.state === 'disconnecting') return;
    if (this.connectedAtMs && connectedFor < EARLY_DROP_WINDOW_MS) {
      this.emitState(
        'error',
        `Device disconnected ${(connectedFor / 1000).toFixed(1)}s after connecting` +
          (wasStreaming ? ` (${this.totalNotifications} packets received)` : ' before data started') +
          '. The mask may have closed the link (power, firmware, or another phone connected to it).'
      );
    } else {
      this.emitState('idle', 'Device disconnected (link lost)');
    }
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
