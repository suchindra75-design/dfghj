import React, { useState, useMemo } from 'react';
import {
  ThingSpeakFeedItem,
  ChannelFieldDefinition,
  ThingSpeakChannel,
  ChannelStatistics,
  TimeDisplayMode,
} from '../types';
import { EEGWaveformCanvas } from './EEGWaveformCanvas';
import { calculateFieldStats, formatDuration, formatDateTime } from '../utils/eegCalculations';
import {
  utcToLocalDatetimeLocalString,
  localDatetimeToUtcIso,
  getLocalTodayRange,
  getLocalLast24hRange,
} from '../utils/timezoneUtils';
import {
  Calendar,
  Filter,
  RotateCcw,
  GitCompare,
  TrendingUp,
  Download,
  Layers,
  Search,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HistoricalViewProps {
  channel: ThingSpeakChannel | null;
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  onDownloadCsvRange: (filteredFeeds: ThingSpeakFeedItem[], label: string) => void;
  onDownloadCsbRange?: (filteredFeeds: ThingSpeakFeedItem[], label: string) => void;
  onToggleChannel?: (fieldKey: string) => void;
  timeDisplayMode?: TimeDisplayMode;
}

export const HistoricalView: React.FC<HistoricalViewProps> = ({
  channel,
  feeds,
  channels,
  onDownloadCsvRange,
  onDownloadCsbRange,
  onToggleChannel,
  timeDisplayMode = 'utc',
}) => {
  // Start / End filter strings in Local datetime-local format ("YYYY-MM-DDTHH:mm")
  const initialStartDate = feeds.length > 0 ? utcToLocalDatetimeLocalString(feeds[0].created_at) : '';
  const initialEndDate = feeds.length > 0 ? utcToLocalDatetimeLocalString(feeds[feeds.length - 1].created_at) : '';

  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);

  // Dual-channel comparison selection
  const [compareChA, setCompareChA] = useState<string>('field1');
  const [compareChB, setCompareChB] = useState<string>('field2');

  // Filtered feeds by converting local datetime-local input values to explicit UTC ISO strings
  const filteredFeeds = useMemo(() => {
    if (!feeds || feeds.length === 0) return [];
    let list = feeds;

    if (startDate) {
      const startUtcIso = localDatetimeToUtcIso(startDate);
      const sMs = new Date(startUtcIso).getTime();
      if (!isNaN(sMs)) {
        list = list.filter(f => new Date(f.created_at).getTime() >= sMs);
      }
    }

    if (endDate) {
      const endUtcIso = localDatetimeToUtcIso(endDate);
      const eMs = new Date(endUtcIso).getTime();
      if (!isNaN(eMs)) {
        list = list.filter(f => new Date(f.created_at).getTime() <= eMs);
      }
    }

    return list;
  }, [feeds, startDate, endDate]);

  // Statistics for filtered range
  const filteredStatsA = useMemo(() => {
    const ch = channels.find(c => c.fieldKey === compareChA);
    return calculateFieldStats(filteredFeeds, compareChA, ch?.label || compareChA);
  }, [filteredFeeds, compareChA, channels]);

  const filteredStatsB = useMemo(() => {
    const ch = channels.find(c => c.fieldKey === compareChB);
    return calculateFieldStats(filteredFeeds, compareChB, ch?.label || compareChB);
  }, [filteredFeeds, compareChB, channels]);

  // Quick Range Presets
  const applyPreset = (preset: 'all' | 'today' | 'last24h' | 'first100' | 'last100') => {
    if (feeds.length === 0 && preset !== 'today' && preset !== 'last24h') return;

    if (preset === 'all') {
      setStartDate(utcToLocalDatetimeLocalString(feeds[0].created_at));
      setEndDate(utcToLocalDatetimeLocalString(feeds[feeds.length - 1].created_at));
    } else if (preset === 'today') {
      const todayRange = getLocalTodayRange();
      setStartDate(todayRange.startLocal);
      setEndDate(todayRange.endLocal);
    } else if (preset === 'last24h') {
      const last24hRange = getLocalLast24hRange();
      setStartDate(last24hRange.startLocal);
      setEndDate(last24hRange.endLocal);
    } else if (preset === 'first100') {
      setStartDate(utcToLocalDatetimeLocalString(feeds[0].created_at));
      const endSample = feeds[Math.min(100, feeds.length - 1)];
      setEndDate(utcToLocalDatetimeLocalString(endSample.created_at));
    } else if (preset === 'last100') {
      const startSample = feeds[Math.max(0, feeds.length - 100)];
      setStartDate(utcToLocalDatetimeLocalString(startSample.created_at));
      setEndDate(utcToLocalDatetimeLocalString(feeds[feeds.length - 1].created_at));
    }
  };

  return (
    <div id="historical-view" className="space-y-5">
      {/* Date & Time Filtering Control Panel */}
      <div className="p-4 rounded-lg bg-white border border-[#E2E8F0] space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#0F172A] tracking-tight">
              HISTORICAL TIMELINE FILTER & RANGE ANALYSIS
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#64748B] font-medium">PRESETS:</span>
            <button
              onClick={() => applyPreset('all')}
              className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 text-[11px] font-semibold transition-colors"
            >
              Full Dataset ({feeds.length})
            </button>
            <button
              onClick={() => applyPreset('today')}
              className="px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] border border-[#CBD5E1] text-[11px] font-medium transition-colors shadow-2xs"
            >
              Today (Local)
            </button>
            <button
              onClick={() => applyPreset('last24h')}
              className="px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] border border-[#CBD5E1] text-[11px] font-medium transition-colors shadow-2xs"
            >
              Last 24h
            </button>
            <button
              onClick={() => applyPreset('first100')}
              className="px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] border border-[#CBD5E1] text-[11px] font-medium transition-colors shadow-2xs"
            >
              First 100
            </button>
            <button
              onClick={() => applyPreset('last100')}
              className="px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] border border-[#CBD5E1] text-[11px] font-medium transition-colors shadow-2xs"
            >
              Last 100
            </button>
          </div>
        </div>

        {/* Date Inputs & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="space-y-1">
            <label className="text-[#64748B] font-medium">START TIME (LOCAL):</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] focus:outline-none focus:border-[#2563EB] text-xs font-mono shadow-2xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#64748B] font-medium">END TIME (LOCAL):</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] focus:outline-none focus:border-[#2563EB] text-xs font-mono shadow-2xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#64748B] font-medium">SELECTED RECORD SPAN:</label>
            <div className="px-3 py-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#2563EB] font-semibold flex items-center justify-between">
              <span>{filteredFeeds.length.toLocaleString()} Samples</span>
              <span className="text-[10px] text-[#64748B]">
                {((filteredFeeds.length / Math.max(1, feeds.length)) * 100).toFixed(1)}% of total
              </span>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              id="btn-historical-export-csv"
              onClick={() => onDownloadCsvRange(filteredFeeds, 'Selected_Range')}
              disabled={filteredFeeds.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] font-mono text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
              title="Export Selected Range as CSV (RFC 4180)"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Export CSV</span>
            </button>

            {onDownloadCsbRange && (
              <button
                id="btn-historical-export-csb"
                onClick={() => onDownloadCsbRange(filteredFeeds, 'Selected_Range')}
                disabled={filteredFeeds.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
                title="Export Selected Range as Binary CSB"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export CSB</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Waveform Visualization Workspace */}
      <div className="p-4 rounded-lg bg-white border border-[#E2E8F0] space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#0F172A] tracking-tight">
              TIMELINE WAVEFORM VISUALIZATION ({filteredFeeds.length} SAMPLES)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#64748B]">
            <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>
              Timeline: {filteredFeeds[0] ? formatDateTime(filteredFeeds[0].created_at, timeDisplayMode) : '—'} &rarr;{' '}
              {filteredFeeds[filteredFeeds.length - 1]
                ? formatDateTime(filteredFeeds[filteredFeeds.length - 1].created_at, timeDisplayMode)
                : '—'}
            </span>
          </div>
          <span className="text-xs font-mono text-[#2563EB] font-medium">
            Interactive Drag to Pan &bull; Wheel to Zoom
          </span>
        </div>

        <EEGWaveformCanvas
          feeds={filteredFeeds}
          channels={channels}
          height={500}
          initialMode="stacked"
          showControls={true}
          onToggleChannel={onToggleChannel}
          timeDisplayMode={timeDisplayMode}
        />
      </div>

      {/* Channel Comparison Section */}
      <div className="p-4 rounded-lg bg-white border border-[#E2E8F0] space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#0F172A] tracking-tight">
              DUAL-CHANNEL COMPARISON & CORRELATION INSPECTOR
            </h3>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#1D4ED8] font-semibold">CHANNEL A:</span>
              <select
                value={compareChA}
                onChange={e => setCompareChA(e.target.value)}
                className="px-2.5 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-medium shadow-2xs focus:border-[#2563EB] focus:outline-none"
              >
                {channels.map(c => (
                  <option key={c.fieldKey} value={c.fieldKey}>
                    {c.label} ({c.fieldKey})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[#94A3B8]">vs</span>

            <div className="flex items-center gap-1.5">
              <span className="text-[#0D9488] font-semibold">CHANNEL B:</span>
              <select
                value={compareChB}
                onChange={e => setCompareChB(e.target.value)}
                className="px-2.5 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-medium shadow-2xs focus:border-[#2563EB] focus:outline-none"
              >
                {channels.map(c => (
                  <option key={c.fieldKey} value={c.fieldKey}>
                    {c.label} ({c.fieldKey})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dual Comparison Stats Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Channel A Stats */}
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="font-mono text-xs font-semibold text-[#1D4ED8]">
                {filteredStatsA.label} ({filteredStatsA.fieldKey})
              </span>
              <span className="text-[11px] font-mono text-[#64748B]">
                {filteredStatsA.count.toLocaleString()} samples
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-1">
              <div>
                <span className="text-[#64748B] block text-[10px]">MIN</span>
                <strong className="text-[#0F172A]">{filteredStatsA.min ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">MAX</span>
                <strong className="text-[#0F172A]">{filteredStatsA.max ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">MEAN</span>
                <strong className="text-[#1D4ED8]">{filteredStatsA.mean ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">STD DEV</span>
                <strong className="text-[#0F172A]">{filteredStatsA.stdDev ?? '—'}</strong>
              </div>
            </div>
          </div>

          {/* Channel B Stats */}
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="font-mono text-xs font-semibold text-[#0D9488]">
                {filteredStatsB.label} ({filteredStatsB.fieldKey})
              </span>
              <span className="text-[11px] font-mono text-[#64748B]">
                {filteredStatsB.count.toLocaleString()} samples
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-1">
              <div>
                <span className="text-[#64748B] block text-[10px]">MIN</span>
                <strong className="text-[#0F172A]">{filteredStatsB.min ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">MAX</span>
                <strong className="text-[#0F172A]">{filteredStatsB.max ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">MEAN</span>
                <strong className="text-[#0D9488]">{filteredStatsB.mean ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">STD DEV</span>
                <strong className="text-[#0F172A]">{filteredStatsB.stdDev ?? '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Dual Channel Overlaid Waveform Plot */}
        <div className="pt-2">
          <span className="text-xs font-mono text-[#64748B] font-medium mb-2 block">
            SUPERIMPOSED WAVEFORM OVERLAY ({filteredStatsA.label} & {filteredStatsB.label}):
          </span>
          <EEGWaveformCanvas
            feeds={filteredFeeds.slice(-300)}
            channels={channels.map(c => ({
              ...c,
              visible: c.fieldKey === compareChA || c.fieldKey === compareChB,
            }))}
            height={260}
            initialMode="overlay"
            showControls={false}
          />
        </div>
      </div>
    </div>
  );
};
