import React, { useState } from 'react';
import { ThingSpeakFeedItem, ChannelFieldDefinition, ThingSpeakChannel, TimeDisplayMode, DataSourceMode } from '../types';
import { EEGWaveformCanvas } from './EEGWaveformCanvas';
import { BleConnectBar } from './BleConnectBar';
import type { UseBleEegReturn } from '../hooks/useBleEeg';
import { BLE_NOMINAL_HZ } from '../services/ble/bleRingBuffer';
import {
  Pause,
  Play,
  Clock,
  Eye,
  EyeOff,
  Activity,
  Sliders,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface EEGMonitorViewProps {
  channel: ThingSpeakChannel | null;
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  isPolling: boolean;
  setIsPolling: (polling: boolean) => void;
  onToggleChannel: (fieldKey: string) => void;
  lastUpdated: string | null;
  timeDisplayMode?: TimeDisplayMode;
  // Phase 1 BLE (optional; defaults preserve exact ThingSpeak behavior).
  dataSource?: DataSourceMode;
  onDataSourceChange?: (mode: DataSourceMode) => void;
  bleFeeds?: ThingSpeakFeedItem[];
  ble?: UseBleEegReturn | null;
}

export const EEGMonitorView: React.FC<EEGMonitorViewProps> = ({
  channel,
  feeds,
  channels,
  isPolling,
  setIsPolling,
  onToggleChannel,
  lastUpdated,
  timeDisplayMode = 'utc',
  dataSource = 'thingspeak',
  onDataSourceChange,
  bleFeeds = [],
  ble = null,
}) => {
  const [windowSamples, setWindowSamples] = useState<number>(300); // Default 300 samples (~1.5 hours)
  const [monitorGain, setMonitorGain] = useState<number>(1);
  // Phase 1 BLE: time-based window presets (seconds) — independent of ThingSpeak presets.
  const [bleWindowSec, setBleWindowSec] = useState<number>(10);

  const isBle = dataSource === 'bluetooth';

  // Active source feeds. ThingSpeak path is byte-identical to previous behavior.
  const activeFeeds = isBle ? bleFeeds : feeds;
  // Get active window feeds
  const displayFeeds = isBle
    ? activeFeeds.slice(-Math.max(1, Math.round(bleWindowSec * BLE_NOMINAL_HZ)))
    : windowSamples === 0 ? feeds : feeds.slice(-windowSamples);
  const latestFeed = activeFeeds.length > 0 ? activeFeeds[activeFeeds.length - 1] : null;

  return (
    <div id="eeg-monitor-view" className="space-y-4">
      {/* Phase 1 BLE connection controls (Bluetooth source only) */}
      {isBle && ble && <BleConnectBar ble={ble} />}

      {/* 1. TOP COMPACT MONITOR CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] select-none text-xs font-mono">
        {/* Left: Stream Status & Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isBle
                  ? ble?.isStreaming
                    ? 'bg-[#16A34A] animate-pulse'
                    : 'bg-[#D97706]'
                  : isPolling
                    ? 'bg-[#16A34A] animate-pulse'
                    : 'bg-[#D97706]'
              }`}
            />
            <span className="font-bold text-[#0F172A] tracking-tight">
              {isBle
                ? ble?.isStreaming
                  ? 'LIVE BLE DATA — PREVIEW'
                  : 'BLE STREAM IDLE — CONNECT DEVICE'
                : isPolling
                  ? 'LIVE OSCILLOSCOPE STREAM'
                  : 'STREAM ACQUISITION PAUSED'}
            </span>
          </div>

          <button
            id="btn-monitor-pause-resume"
            onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              isPolling
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {isPolling ? <Pause className="w-3 h-3 text-emerald-600" /> : <Play className="w-3 h-3 text-amber-600" />}
            <span>{isPolling ? 'Pause' : 'Resume'}</span>
          </button>
        </div>

        {/* Center: Data Source Selector (Phase 1 BLE, additive) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748B] text-[10px] uppercase font-semibold">SOURCE:</span>
          <div className="flex rounded bg-white p-0.5 border border-[#CBD5E1] shadow-2xs">
            {(
              [
                { id: 'thingspeak', label: 'ThingSpeak' },
                { id: 'bluetooth', label: 'Bluetooth' },
              ] as const
            ).map(s => (
              <button
                key={s.id}
                onClick={() => onDataSourceChange?.(s.id)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  dataSource === s.id
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Buffer Presets (ThingSpeak meaning unchanged; BLE uses time-based presets) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748B] text-[10px] uppercase font-semibold">FEED BUFFER:</span>
          <div className="flex rounded bg-white p-0.5 border border-[#CBD5E1] shadow-2xs">
            {!isBle
              ? [
                  { count: 100, label: '100 pts' },
                  { count: 300, label: '300 pts' },
                  { count: 600, label: '600 pts' },
                  { count: 1200, label: '1.2k pts' },
                  { count: 0, label: `All (${feeds.length})` },
                ].map(b => (
                  <button
                    key={b.count}
                    onClick={() => setWindowSamples(b.count)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      windowSamples === b.count
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))
              : [
                  { secs: 5, label: '5 sec' },
                  { secs: 10, label: '10 sec' },
                  { secs: 30, label: '30 sec' },
                ].map(b => (
                  <button
                    key={b.secs}
                    onClick={() => setBleWindowSec(b.secs)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      bleWindowSec === b.secs
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
          </div>
        </div>

        {/* Right: Telemetry Cadence & Latest Sync */}
        <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#2563EB]" />
            {!isBle ? (
              <span>Cadence: <strong className="text-[#0F172A]">~20.6s</strong></span>
            ) : (
              <span>
                BLE: <strong className="text-[#0F172A]">
                  {ble && ble.status.receivedHz > 0 ? `~${ble.status.receivedHz.toFixed(0)} Hz observed` : 'awaiting stream'}
                </strong>
              </span>
            )}
          </div>
          <span className="text-[#CBD5E1]">&bull;</span>
          <div>
            Latest: <strong className="text-[#0F172A]">#{latestFeed?.entry_id ?? '—'}</strong>
          </div>
        </div>
      </div>

      {/* 2. THE WAVEFORM CENTERPIECE (Full-Width, High-Precision Canvas Workspace) */}
      <div className="w-full">
        <EEGWaveformCanvas
          feeds={displayFeeds}
          channels={channels}
          height={580}
          initialMode="stacked"
          showControls={true}
          gain={monitorGain}
          onGainChange={setMonitorGain}
          onToggleChannel={onToggleChannel}
          timeDisplayMode={timeDisplayMode}
          expectedIntervalMs={isBle ? 1000 / BLE_NOMINAL_HZ : undefined}
          emptyMessage={
            isBle
              ? ble?.isStreaming
                ? 'Connected — waiting for the first samples from the mask…'
                : 'No Bluetooth data yet. Tap Scan, then Connect to stream from BioAmp_Sleep.'
              : undefined
          }
        />
      </div>

      {/* 3. HIGH-DENSITY HORIZONTAL CHANNEL TELEMETRY STRIP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="font-semibold text-[#0F172A] uppercase tracking-wider text-[11px]">
              LEAD TELEMETRY STATUS & LIVE AMPLITUDES
            </span>
          </div>
          <span className="text-[#64748B] text-[11px]">
            {channels.filter(c => c.visible).length} of {channels.length} leads displayed &bull; Click to toggle
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {channels.map(ch => {
            const rawVal = latestFeed ? (latestFeed as any)[ch.fieldKey] : null;
            const num = rawVal !== null && rawVal !== undefined ? parseFloat(rawVal) : null;
            const formatted = num !== null && !isNaN(num) ? num.toFixed(2) : rawVal ?? '—';
            const isPrimary = ch.fieldKey === 'field1';
            const traceColor = isPrimary ? '#0F172A' : ch.color;

            // Calculate min/max in current buffer for this channel
            let bMin = Infinity;
            let bMax = -Infinity;
            for (let i = 0; i < displayFeeds.length; i++) {
              const v = parseFloat((displayFeeds[i] as any)[ch.fieldKey]);
              if (!isNaN(v)) {
                if (v < bMin) bMin = v;
                if (v > bMax) bMax = v;
              }
            }

            return (
              <div
                key={ch.fieldKey}
                onClick={() => onToggleChannel(ch.fieldKey)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none font-mono ${
                  ch.visible
                    ? 'bg-white border-[#CBD5E1] hover:border-[#2563EB] shadow-2xs'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] opacity-40 hover:opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: traceColor }}
                    />
                    <span className="text-[11px] font-bold text-[#0F172A] truncate">
                      {ch.label}
                    </span>
                  </div>
                  {ch.visible ? (
                    <Eye className="w-3 h-3 text-[#2563EB] shrink-0" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-[#94A3B8] shrink-0" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-[#64748B]">{ch.fieldKey}</span>
                    <span className="text-xs font-bold text-[#0F172A]">
                      {formatted} <span className="text-[9px] font-normal text-[#64748B]">{ch.unit}</span>
                    </span>
                  </div>

                  {bMin !== Infinity && (
                    <div className="flex items-center justify-between text-[9px] text-[#94A3B8] pt-1 border-t border-[#F1F5F9]">
                      <span>Min: {bMin.toFixed(1)}</span>
                      <span>Max: {bMax.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CLINICAL WORKSTATION METRIC BAR */}
      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#64748B]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#0F172A] font-semibold">
            <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Channel ID: #{channel?.id || '3469764'}</span>
          </span>
          <span className="text-[#CBD5E1]">&bull;</span>
          {!isBle ? (
            <span>Sampling: Raw ThingSpeak Cadence (~20.6s)</span>
          ) : (
            <span>
              Sampling: Live BLE Preview (nominal 256 Hz device clock
              {ble && ble.status.receivedHz > 0 ? `, ~${ble.status.receivedHz.toFixed(0)} Hz observed` : ''})
            </span>
          )}
          <span className="text-[#CBD5E1]">&bull;</span>
          <span>Buffer: {displayFeeds.length.toLocaleString()} points</span>
        </div>

        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
          <span className="text-[#16A34A] font-medium">Unmodified IEEE 754 Floating-Point Records</span>
        </div>
      </div>
    </div>
  );
};
