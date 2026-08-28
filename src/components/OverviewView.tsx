import React from 'react';
import {
  ThingSpeakChannel,
  ThingSpeakFeedItem,
  ChannelStatistics,
  DerivedSamplingInfo,
  ChannelFieldDefinition,
  ActiveTab,
} from '../types';
import { formatDuration, formatDateTime } from '../utils/eegCalculations';
import { EEGWaveformCanvas } from './EEGWaveformCanvas';
import { AnimatedNumber } from './AnimatedNumber';
import {
  Activity,
  Radio,
  ChevronRight,
  Download,
  FileText,
  TrendingUp,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { motion } from 'motion/react';

interface OverviewViewProps {
  channel: ThingSpeakChannel | null;
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  stats: Record<string, ChannelStatistics>;
  samplingInfo: DerivedSamplingInfo;
  apiKeyConfigured: boolean;
  onNavigateTab: (tab: ActiveTab) => void;
  onToggleChannel: (fieldKey: string) => void;
  onDownloadCsv: () => void;
  onDownloadCsb?: () => void;
  onGeneratePdf: () => void;
  connectionStatus?: 'connected' | 'loading' | 'error' | 'paused';
  isPolling?: boolean;
  lastUpdated?: string | null;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  channel,
  feeds,
  channels,
  stats,
  samplingInfo,
  onNavigateTab,
  onToggleChannel,
  onDownloadCsv,
  onDownloadCsb,
  onGeneratePdf,
  connectionStatus = 'connected',
  isPolling = true,
  lastUpdated,
}) => {
  const latestFeed = feeds.length > 0 ? feeds[feeds.length - 1] : null;
  const firstFeed = feeds.length > 0 ? feeds[0] : null;

  const durationSec =
    samplingInfo.recordingTimeSeconds ??
    (firstFeed && latestFeed
      ? Math.round(
          (new Date(latestFeed.created_at).getTime() -
            new Date(firstFeed.created_at).getTime()) /
            1000
        )
      : 0);

  const activeChannelsCount = channels.filter(ch => ch.visible).length;
  const eegValNum = latestFeed?.field1 ? parseFloat(latestFeed.field1) : null;
  const eogValNum = latestFeed?.field2 ? parseFloat(latestFeed.field2) : null;

  // Format last synchronization timestamp
  const syncTimeStr = latestFeed
    ? formatDateTime(latestFeed.created_at, 'utc')
    : lastUpdated
    ? formatDateTime(lastUpdated, 'utc')
    : '—';

  return (
    <div id="overview-view" className="space-y-6 max-w-[1600px] mx-auto select-none">
      {/* 1. HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-3 border-b border-[#E2E8F0]"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            EEG Monitoring
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 font-normal">
            Real-time telemetry overview
          </p>
        </div>

        {/* CONNECTION STATUS: Small dot, calm indicator */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            {connectionStatus === 'error' ? (
              <span className="flex items-center gap-1.5 text-[#DC2626] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                <span>Connection unavailable</span>
              </span>
            ) : connectionStatus === 'loading' ? (
              <span className="flex items-center gap-1.5 text-[#D97706] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                <span>Synchronizing</span>
              </span>
            ) : isPolling ? (
              <span className="flex items-center gap-1.5 text-[#16A34A] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#64748B] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                <span>Polling Paused</span>
              </span>
            )}
          </div>

          <span className="text-[#CBD5E1]">&bull;</span>
          <span className="text-[#64748B]">
            CH #{channel?.id || '3469764'}
          </span>
        </div>
      </motion.div>

      {/* 2. COMPACT STATISTICS AREA (Typography and generous whitespace, prominent but not oversized numbers) */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6 py-2 border-b border-[#F1F5F9]"
      >
        {/* Total Samples */}
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block">
            Total Samples
          </span>
          <div className="text-xl font-bold font-mono text-[#0F172A] tracking-tight">
            <AnimatedNumber value={feeds.length} decimals={0} />
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block">
            Telemetry entries
          </span>
        </div>

        {/* Recording Duration */}
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block">
            Recording Duration
          </span>
          <div className="text-xl font-bold font-mono text-[#0F172A] tracking-tight">
            {formatDuration(durationSec)}
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block">
            <AnimatedNumber value={durationSec} decimals={0} suffix="s total elapsed" />
          </span>
        </div>

        {/* Active Channels */}
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block">
            Active Channels
          </span>
          <div className="text-xl font-bold font-mono text-[#0F172A] tracking-tight">
            <span>{activeChannelsCount}</span>
            <span className="text-sm font-normal text-[#94A3B8] font-mono"> / {channels.length}</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block">
            Montage enabled
          </span>
        </div>

        {/* Latest Reading */}
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block">
            Latest Reading
          </span>
          <div className="text-xl font-bold font-mono text-[#0F172A] tracking-tight">
            {eegValNum !== null && !isNaN(eegValNum) ? (
              <AnimatedNumber value={eegValNum} decimals={2} suffix=" µV" />
            ) : (
              '—'
            )}
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block truncate">
            {latestFeed ? `Entry #${latestFeed.entry_id}` : 'Awaiting data'}
          </span>
        </div>

        {/* Last Synchronization */}
        <div className="space-y-0.5 col-span-2 md:col-span-1">
          <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider block">
            Last Synchronization
          </span>
          <div className="text-base font-semibold font-mono text-[#0F172A] tracking-tight pt-0.5 truncate">
            {latestFeed ? latestFeed.created_at.substring(11, 19) + ' UTC' : '—'}
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block truncate">
            {latestFeed ? latestFeed.created_at.substring(0, 10) : '—'}
          </span>
        </div>
      </motion.div>

      {/* 3. MAIN AREA: EEG WAVEFORM (PRIORITY 1) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold font-mono text-[#0F172A] tracking-wider uppercase">
              EEG Telemetry Stream
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('monitor')}
            className="text-xs text-[#2563EB] hover:text-blue-800 font-mono font-medium flex items-center gap-1 transition-all duration-150 active:scale-95"
          >
            <span>Live Monitor Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dedicated High-Precision Clinical Canvas */}
        <div className="w-full">
          <EEGWaveformCanvas
            feeds={feeds.slice(-250)}
            channels={channels}
            height={380}
            initialMode="stacked"
            showControls={true}
            onToggleChannel={onToggleChannel}
          />
        </div>
      </motion.div>

      {/* 4. CURRENT RECORDING INFORMATION & TELEMETRY SUMMARY (PRIORITY 2) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1"
      >
        {/* Active Packet Channels Breakdown */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-mono font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#2563EB]" />
              Current Telemetry Packet (Entry #{latestFeed?.entry_id ?? '—'})
            </span>
            <span className="text-[11px] font-mono text-[#64748B]">
              {syncTimeStr}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {/* Field 1: EEG Activity */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#0F172A] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F172A]" />
                  EEG ACTIVITY
                </span>
                <span>[µV]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {eegValNum !== null && !isNaN(eegValNum) ? (
                  <AnimatedNumber value={eegValNum} decimals={2} />
                ) : (
                  latestFeed?.field1 ?? '—'
                )}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Mean: {stats['field1']?.mean?.toFixed(2) ?? '—'} µV
              </div>
            </div>

            {/* Field 2: EOG Activity */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#0D9488] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                  EOG Activity
                </span>
                <span>[µV]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {eogValNum !== null && !isNaN(eogValNum) ? (
                  <AnimatedNumber value={eogValNum} decimals={2} />
                ) : (
                  latestFeed?.field2 ?? '—'
                )}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Mean: {stats['field2']?.mean?.toFixed(2) ?? '—'} µV
              </div>
            </div>

            {/* Field 3: Eye Movements */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#D97706] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                  Eye Movements
                </span>
                <span>[events]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {latestFeed?.field3 ?? '—'}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Total events: {stats['field3']?.max?.toFixed(0) ?? '—'}
              </div>
            </div>

            {/* Field 4: EEG Artifacts */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#DC2626] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                  EEG Artifacts
                </span>
                <span>[flags]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {latestFeed?.field4 ?? '—'}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Artifact count: {stats['field4']?.count ?? '—'}
              </div>
            </div>

            {/* Field 5: Hardware Sample Counter */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#6366F1] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                  Hardware Clock
                </span>
                <span>[samples]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {latestFeed?.field5 ? Number(latestFeed.field5).toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Rate: {samplingInfo.derivedSamplingRateHz ? `${samplingInfo.derivedSamplingRateHz.toFixed(1)} Hz` : '~20s packet'}
              </div>
            </div>

            {/* Field 6: Elapsed Time */}
            <div className="p-2.5 rounded border border-[#E2E8F0] bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#475569] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#475569]" />
                  Hardware Time
                </span>
                <span>[sec]</span>
              </div>
              <div className="text-base font-bold font-mono text-[#0F172A]">
                {latestFeed?.field6 ? `${latestFeed.field6}s` : '—'}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                Span: {formatDuration(Number(latestFeed?.field6) || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operations & Session Metadata */}
        <div className="space-y-2.5">
          <span className="text-xs font-mono font-semibold text-[#0F172A] uppercase tracking-wider block pb-1">
            Session Actions & Export
          </span>

          <div className="p-3.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                id="btn-overview-csv"
                onClick={onDownloadCsv}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded bg-white hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] text-[11px] font-mono font-medium transition-all duration-150 active:scale-95 shadow-2xs"
                title="Download CSV (RFC 4180)"
              >
                <Download className="w-3.5 h-3.5 text-[#64748B]" />
                <span>CSV</span>
              </button>
              <button
                id="btn-overview-csb"
                onClick={onDownloadCsb}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-mono font-medium transition-all duration-150 active:scale-95 shadow-2xs"
                title="Download CSB Biosignal Archive"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>CSB</span>
              </button>
              <button
                id="btn-overview-pdf"
                onClick={onGeneratePdf}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-mono font-medium transition-all duration-150 active:scale-95 shadow-2xs"
                title="Generate Multi-Page PDF Report"
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                <span>PDF</span>
              </button>
            </div>

            <button
              onClick={() => onNavigateTab('table')}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-white hover:bg-[#F1F5F9] text-[#334155] hover:text-[#0F172A] border border-[#E2E8F0] text-xs font-mono font-medium transition-all duration-150 active:scale-95"
            >
              <Database className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Full Data Logs ({feeds.length.toLocaleString()})</span>
            </button>

            <div className="pt-2 border-t border-[#E2E8F0] text-[11px] font-mono text-[#64748B] space-y-1">
              <div className="flex justify-between">
                <span>ThingSpeak ID:</span>
                <strong className="text-[#0F172A]">{channel?.id || '3469764'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cadence:</span>
                <span className="text-[#0F172A]">
                  {samplingInfo.telemetryIntervalSeconds ? `~${samplingInfo.telemetryIntervalSeconds}s` : '~20s'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Integrity:</span>
                <span className="text-[#16A34A] font-medium">100% Raw</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 5. CHANNEL DESCRIPTIVE STATISTICS (PRIORITY 3) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3 pt-1"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-mono font-bold text-[#0F172A] uppercase tracking-wider">
              Channel Descriptive Statistics (N = {feeds.length.toLocaleString()})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">
            All Channels
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {channels.map(ch => {
            const st = stats[ch.fieldKey];
            const isPrimary = ch.fieldKey === 'field1';
            const traceColor = isPrimary ? '#0F172A' : ch.color;

            return (
              <div
                key={ch.fieldKey}
                className="p-3 rounded border border-[#E2E8F0] bg-white space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-1.5">
                  <span
                    style={{ color: traceColor }}
                    className="font-mono text-xs font-semibold truncate"
                  >
                    {ch.label}
                  </span>
                  <button
                    onClick={() => onToggleChannel(ch.fieldKey)}
                    className={`text-[9px] font-mono px-1 py-0.5 rounded border transition-all duration-150 active:scale-95 ${
                      ch.visible
                        ? 'bg-blue-50 text-[#2563EB] border-blue-200 font-medium'
                        : 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]'
                    }`}
                  >
                    {ch.visible ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Mean:</span>
                    <strong className="text-[#0F172A]">
                      {st?.mean !== null && st?.mean !== undefined ? (
                        <AnimatedNumber value={st.mean} decimals={2} />
                      ) : (
                        '—'
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Std Dev:</span>
                    <strong className="text-[#0F172A]">
                      {st?.stdDev !== null && st?.stdDev !== undefined ? (
                        <AnimatedNumber value={st.stdDev} decimals={2} />
                      ) : (
                        '—'
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Min / Max:</span>
                    <span className="text-[#0F172A] font-medium text-[10px]">
                      {st?.min?.toFixed(1) ?? '—'} / {st?.max?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* 6. TECHNICAL METHODOLOGY & COMPLIANCE (PRIORITY 4 - SECONDARY INFORMATION) */}
      <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
          <span className="font-semibold text-[#0F172A] tracking-tight">
            Telemetry Sampling & Non-Clinical Integrity Note
          </span>
        </div>
        <p className="text-[#64748B] text-[11px] leading-relaxed">
          {samplingInfo.notes}
        </p>
      </div>
    </div>
  );
};
