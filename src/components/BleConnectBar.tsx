/**
 * BleConnectBar — Bluetooth connection controls for BioAmp_Sleep (Phase 1).
 *
 * Visually consistent with the Brainmatrix monitor control bars:
 * compact mono, slate/blue palette. Monitor-only; does not touch the
 * ThingSpeak path.
 */

import React from 'react';
import { AlertTriangle, Bluetooth, Info, Loader2, PlugZap, Radar, Unplug } from 'lucide-react';
import { BIOAMP_DEVICE_NAME } from '../services/ble/bleManager';
import type { UseBleEegReturn } from '../hooks/useBleEeg';

interface BleConnectBarProps {
  ble: UseBleEegReturn;
}

export const BleConnectBar: React.FC<BleConnectBarProps> = ({ ble }) => {
  const { status, scanResults, error, scan, stopScan, connect, connectToBioAmp, disconnect, isBusy } = ble;
  const connected = status.state === 'connected' || status.state === 'streaming';
  const scanning = status.state === 'scanning';
  const stateLabel =
    status.state === 'streaming' ? 'Streaming' :
    status.state === 'connected' ? 'Connected' :
    status.state === 'scanning' ? 'Scanning…' :
    status.state === 'connecting' ? (status.message?.startsWith('Retrying') ? status.message : 'Connecting…') :
    status.state === 'disconnecting' ? 'Disconnecting…' :
    status.state === 'error' ? 'Needs attention' : 'Not connected';

  const tone =
    status.state === 'streaming' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
    status.state === 'connected' ? 'bg-[#EEF2FF] text-[#4338CA] ring-[#C7D2FE]' :
    status.state === 'error' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
    isBusy ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-[#F1F5F9] text-[#64748B] ring-[#E2E8F0]';

  const targetSeen = scanResults.some(r => r.name === BIOAMP_DEVICE_NAME);
  const errorText = error ?? (status.state === 'error' ? status.message : undefined);

  return (
    <div id="ble-connect-bar" className="surface overflow-hidden select-none">
      {/* Device row */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative h-10 w-10 shrink-0 rounded-md brand-gradient flex items-center justify-center shadow-sm">
            <Bluetooth className="w-[18px] h-[18px] text-white" />
            {status.state === 'streaming' && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-tight text-[#0B1220] truncate">{BIOAMP_DEVICE_NAME}</div>
            <span className={`inline-flex items-center gap-1.5 mt-1 h-5 px-2 rounded-full text-[11px] font-medium ring-1 ${tone}`}>
              {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
              {stateLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!connected ? (
            <>
              <button
                id="btn-ble-scan"
                onClick={() => (scanning ? void stopScan() : void scan())}
                disabled={isBusy && !scanning}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium bg-white text-[#334155] ring-1 ring-[#0F172A]/10 shadow-2xs hover:text-[#0B1220] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" /> : <Radar className="w-4 h-4 text-[#4F46E5]" />}
                {scanning ? 'Stop' : 'Scan'}
              </button>
              <button
                id="btn-ble-connect"
                onClick={() => void connectToBioAmp()}
                disabled={isBusy || scanResults.length === 0}
                title={scanResults.length === 0 ? 'Scan for devices first' : targetSeen ? `Connect to ${BIOAMP_DEVICE_NAME}` : 'Connect to strongest scanned device'}
                className="flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-semibold text-white brand-gradient shadow-sm ring-1 ring-[#4338CA]/40 hover:brightness-110 transition disabled:opacity-40 disabled:hover:brightness-100"
              >
                <PlugZap className="w-4 h-4" />
                Connect
              </button>
            </>
          ) : (
            <button
              id="btn-ble-disconnect"
              onClick={() => void disconnect()}
              disabled={isBusy}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium bg-white text-rose-700 ring-1 ring-rose-200 shadow-2xs hover:bg-rose-50 transition-colors disabled:opacity-40"
            >
              <Unplug className="w-4 h-4" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 border-t border-[#0F172A]/[0.06] divide-x divide-[#0F172A]/[0.06] bg-[#F8FAFC]/60">
        {[
          { label: 'Rate', value: status.receivedHz > 0 ? `${status.receivedHz.toFixed(0)} Hz` : '—' },
          { label: 'Samples', value: status.sampleCount.toLocaleString() },
          { label: 'Buffered', value: status.buffered.toLocaleString() },
        ].map(m => (
          <div key={m.label} className="px-4 py-2.5">
            <div className="eyebrow">{m.label}</div>
            <div className="mt-0.5 text-[15px] font-semibold font-mono text-[#0B1220]">{m.value}</div>
          </div>
        ))}
      </div>

      {connected && (
        <div className="px-4 py-2 border-t border-[#0F172A]/[0.06] text-[11px] font-mono text-[#94A3B8] flex flex-wrap gap-x-3">
          <span>MTU {status.mtu ?? '—'}</span>
          <span>packets {status.notifications.toLocaleString()}</span>
          <span className={status.parseErrors > 0 ? 'text-amber-600' : ''}>parse errors {status.parseErrors}</span>
          {status.gaps > 0 && <span className="text-amber-600">gaps {status.gaps}</span>}
        </div>
      )}

      {/* Scan results */}
      {!connected && scanResults.length > 0 && (
        <div className="border-t border-[#0F172A]/[0.06] p-2">
          <div className="eyebrow px-2 pt-1 pb-1.5">Nearby devices</div>
          <div className="space-y-0.5">
            {scanResults.slice(0, 8).map(r => {
              const isTarget = r.name === BIOAMP_DEVICE_NAME;
              const bars = r.rssi === undefined ? 0 : r.rssi > -60 ? 4 : r.rssi > -70 ? 3 : r.rssi > -80 ? 2 : 1;
              return (
                <button
                  key={r.deviceId}
                  onClick={() => void connect(r.deviceId)}
                  disabled={isBusy}
                  className={`w-full flex items-center justify-between gap-3 h-11 px-3 rounded-md text-left transition-colors disabled:opacity-40 ${
                    isTarget ? 'bg-[#EEF2FF]/70 hover:bg-[#EEF2FF]' : 'hover:bg-[#F1F5F9]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Bluetooth className={`w-4 h-4 shrink-0 ${isTarget ? 'text-[#4F46E5]' : 'text-[#94A3B8]'}`} />
                    <span className={`text-[13px] truncate ${isTarget ? 'font-semibold text-[#312E81]' : 'text-[#334155]'}`}>
                      {r.name ?? 'Unnamed device'}
                    </span>
                    {isTarget && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5] bg-white ring-1 ring-[#C7D2FE] rounded-full px-1.5 py-px">
                        Mask
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-[#94A3B8]">
                    {r.rssi !== undefined && `${r.rssi} dBm`}
                    <span className="flex items-end gap-[2px] h-3">
                      {[1, 2, 3, 4].map(b => (
                        <span
                          key={b}
                          className={`w-[3px] rounded-sm ${b <= bars ? (isTarget ? 'bg-[#4F46E5]' : 'bg-[#64748B]') : 'bg-[#CBD5E1]'}`}
                          style={{ height: `${b * 25}%` }}
                        />
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {errorText && (
        <div className="m-3 mt-0 flex gap-2.5 rounded-md bg-rose-50 ring-1 ring-rose-200 px-3 py-2.5 text-[12.5px] text-rose-800 break-words">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-500" />
          <span>{errorText}</span>
        </div>
      )}

      {status.noDataWarning && (
        <div className="m-3 mt-0 flex gap-2.5 rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5 text-[12.5px] text-amber-900 break-words">
          <Info className="w-4 h-4 shrink-0 mt-px text-amber-500" />
          <span>{status.noDataWarning}</span>
        </div>
      )}
    </div>
  );
};
