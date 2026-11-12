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
  Bluetooth,
  Radio,
  Cloud,
} from 'lucide-react';
import { Segmented } from './ui/Segmented';

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

  const live = isBle ? Boolean(ble?.isStreaming) : isPolling;
  const cadenceSec = (() => {
    const tail = feeds.slice(-200);
    const d: number[] = [];
    for (let i = 1; i < tail.length; i++) {
      const dt = (new Date(tail[i].created_at).getTime() - new Date(tail[i - 1].created_at).getTime()) / 1000;
      if (dt > 0) d.push(dt);
    }
    if (!d.length) return null;
    d.sort((x, y) => x - y);
    return d[Math.floor(d.length / 2)];
  })();
  const bleState = ble?.status.state ?? 'idle';
  const statusTitle = isBle
    ? ble?.isStreaming
      ? 'Streaming from BioAmp_Sleep'
      : bleState === 'connecting' || bleState === 'connected'
      ? 'Connecting to the mask…'
      : bleState === 'scanning'
      ? 'Scanning for the mask…'
      : bleState === 'error'
      ? 'Connection problem'
      : 'Bluetooth idle'
    : isPolling
    ? 'Live cloud stream'
    : 'Stream paused';
  const statusDetail = isBle
    ? ble?.isStreaming
      ? `${ble.status.receivedHz > 0 ? `~${ble.status.receivedHz.toFixed(0)} Hz` : 'Waiting for samples'} · ${ble.status.sampleCount.toLocaleString()} samples`
      : bleState === 'connecting' || bleState === 'connected'
      ? ble?.status.message ?? 'Setting up the data stream'
      : bleState === 'error'
      ? 'See the message in the Bluetooth card above'
      : 'Scan and connect to the mask to start streaming'
    : `${cadenceSec ? `One sample every ~${cadenceSec.toFixed(1)}s` : 'ThingSpeak channel'} · latest #${latestFeed?.entry_id ?? '—'}`;

  return (
    <div id="eeg-monitor-view" className="space-y-4">
      {/* Phase 1 BLE connection controls (Bluetooth source only) */}
      {isBle && ble && <BleConnectBar ble={ble} />}

      {/* 1. MONITOR CONTROL CARD */}
      <div className="surface p-4 space-y-4 select-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`mt-0.5 h-9 w-9 shrink-0 rounded-md flex items-center justify-center ring-1 ${
                live ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-amber-50 text-amber-600 ring-amber-100'
              }`}
            >
              {isBle ? <Bluetooth className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-[#0B1220] truncate">{statusTitle}</span>
                {live && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
              <div className="text-[12px] text-[#64748B] mt-0.5 line-clamp-2">{statusDetail}</div>
            </div>
          </div>

          {!isBle && (
            <button
              id="btn-monitor-pause-resume"
              onClick={() => setIsPolling(!isPolling)}
              className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium bg-white text-[#334155] ring-1 ring-[#0F172A]/10 shadow-2xs hover:text-[#0B1220] hover:bg-[#F8FAFC] transition-colors"
            >
              {isPolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPolling ? 'Pause' : 'Resume'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2.5">
            <span className="eyebrow">Source</span>
            <Segmented<DataSourceMode>
              ariaLabel="Data source"
              value={dataSource}
              onChange={v => onDataSourceChange?.(v)}
              options={[
                { value: 'thingspeak', label: 'Cloud', icon: Cloud },
                { value: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
              ]}
            />
          </div>

          <div className="flex items-center gap-2.5 min-w-0">
            <span className="eyebrow">Window</span>
            <div className="overflow-x-auto -mx-1 px-1">
              {!isBle ? (
                <Segmented<number>
                  ariaLabel="Samples to load"
                  size="sm"
                  value={windowSamples}
                  onChange={setWindowSamples}
                  options={[
                    { value: 100, label: '100' },
                    { value: 300, label: '300' },
                    { value: 600, label: '600' },
                    { value: 1200, label: '1.2k' },
                    { value: 0, label: 'All' },
                  ]}
                />
              ) : (
                <Segmented<number>
                  ariaLabel="Seconds to show"
                  size="sm"
                  value={bleWindowSec}
                  onChange={setBleWindowSec}
                  options={[
                    { value: 5, label: '5s' },
                    { value: 10, label: '10s' },
                    { value: 30, label: '30s' },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE WAVEFORM CENTERPIECE (Full-Width, High-Precision Canvas Workspace) */}
      <div className="w-full">
        <EEGWaveformCanvas
          key={dataSource /* fresh zoom/hover state per source */}
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
            <Sliders className="w-3.5 h-3.5 text-[#4F46E5]" />
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
                    ? 'bg-white border-[#CBD5E1] hover:border-[#4F46E5] shadow-2xs'
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
                    <Eye className="w-3 h-3 text-[#4F46E5] shrink-0" />
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
            <Activity className="w-3.5 h-3.5 text-[#4F46E5]" />
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
