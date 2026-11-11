/**
 * BleConnectBar — Bluetooth connection controls for BioAmp_Sleep (Phase 1).
 *
 * Visually consistent with the BrianMatrix monitor control bars:
 * compact mono, slate/blue palette. Monitor-only; does not touch the
 * ThingSpeak path.
 */

import React from 'react';
import { Bluetooth, Loader2, PlugZap, Radar, Unplug } from 'lucide-react';
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
    status.state === 'streaming' ? 'STREAMING LIVE BLE DATA' :
    status.state === 'connected' ? 'CONNECTED' :
    status.state === 'scanning' ? 'SCANNING…' :
    status.state === 'connecting' ? 'CONNECTING…' :
    status.state === 'disconnecting' ? 'DISCONNECTING…' :
    status.state === 'error' ? 'BLUETOOTH ERROR' : 'DISCONNECTED';

  const dotClass =
    status.state === 'streaming' ? 'bg-[#16A34A] animate-pulse' :
    status.state === 'connected' ? 'bg-[#2563EB]' :
    status.state === 'error' ? 'bg-[#DC2626]' :
    isBusy ? 'bg-[#D97706] animate-pulse' : 'bg-[#94A3B8]';

  const targetSeen = scanResults.some(r => r.name === BIOAMP_DEVICE_NAME);

  return (
    <div id="ble-connect-bar" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] select-none text-xs font-mono">
        {/* Left: status */}
        <div className="flex items-center gap-2.5">
          <Bluetooth className="w-4 h-4 text-[#2563EB]" />
          <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
          <span className="font-bold text-[#0F172A] tracking-tight">
            BLUETOOTH &bull; {BIOAMP_DEVICE_NAME} &bull; {stateLabel}
          </span>
          {status.message && status.state !== 'error' && (
            <span className="text-[#64748B] text-[11px] truncate max-w-[220px]">({status.message})</span>
          )}
        </div>

        {/* Center: live metrics */}
        <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
          <span>Rate: <strong className="text-[#0F172A]">{status.receivedHz > 0 ? `~${status.receivedHz.toFixed(0)} Hz` : '—'}</strong></span>
          <span className="text-[#CBD5E1]">&bull;</span>
          <span>Samples: <strong className="text-[#0F172A]">{status.sampleCount.toLocaleString()}</strong></span>
          <span className="text-[#CBD5E1]">&bull;</span>
          <span>Buffered: <strong className="text-[#0F172A]">{status.buffered.toLocaleString()}</strong></span>
          {(status.parseErrors > 0 || status.gaps > 0) && (
            <>
              <span className="text-[#CBD5E1]">&bull;</span>
              <span className="text-[#D97706]">err:{status.parseErrors} gap:{status.gaps}</span>
            </>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1.5">
          {!connected ? (
            <>
              <button
                id="btn-ble-scan"
                onClick={() => (scanning ? void stopScan() : void scan())}
                disabled={isBusy && !scanning}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F1F5F9] disabled:opacity-40"
              >
                {scanning ? <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" /> : <Radar className="w-3 h-3 text-[#2563EB]" />}
                <span>{scanning ? 'Stop Scan' : 'Scan'}</span>
              </button>
              <button
                id="btn-ble-connect"
                onClick={() => void connectToBioAmp()}
                disabled={isBusy || scanResults.length === 0}
                title={scanResults.length === 0 ? 'Scan for devices first' : targetSeen ? `Connect to ${BIOAMP_DEVICE_NAME}` : 'Connect to strongest scanned device'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors bg-[#2563EB] text-white border-[#2563EB] hover:bg-blue-700 disabled:opacity-40"
              >
                <PlugZap className="w-3 h-3" />
                <span>Connect{targetSeen ? ` ${BIOAMP_DEVICE_NAME}` : ''}</span>
              </button>
            </>
          ) : (
            <button
              id="btn-ble-disconnect"
              onClick={() => void disconnect()}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 disabled:opacity-40"
            >
              <Unplug className="w-3 h-3" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Scan results (only while disconnected and results exist) */}
      {!connected && scanResults.length > 0 && (
        <div className="px-4 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-mono">
          <div className="text-[10px] uppercase font-semibold text-[#64748B] mb-1.5">
            Devices found ({scanResults.length}) — select to connect:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scanResults.slice(0, 8).map(r => {
              const isTarget = r.name === BIOAMP_DEVICE_NAME;
              return (
                <button
                  key={r.deviceId}
                  onClick={() => void connect(r.deviceId)}
                  disabled={isBusy}
                  className={`px-2.5 py-1 rounded border text-[11px] transition-colors disabled:opacity-40 ${
                    isTarget
                      ? 'bg-blue-50 border-[#2563EB] text-[#1D4ED8] font-semibold hover:bg-blue-100'
                      : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {r.name ?? '(unnamed)'} {r.rssi !== undefined ? `· ${r.rssi}dBm` : ''}
                  {isTarget ? ' ★' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(error || (status.state === 'error' && status.message)) && (
        <div className="px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono text-rose-800 break-words">
          Bluetooth: {error ?? status.message}
        </div>
      )}

      {status.noDataWarning && (
        <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono text-amber-900 break-words">
          No data yet: {status.noDataWarning}
        </div>
      )}

      {connected && (
        <div className="px-4 text-[10px] font-mono text-[#94A3B8]">
          Link: MTU {status.mtu ?? '—'} &bull; packets {status.notifications.toLocaleString()} &bull; parse errors {status.parseErrors}
        </div>
      )}
    </div>
  );
};
