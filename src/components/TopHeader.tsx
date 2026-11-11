import React from 'react';
import { ActiveTab, ThingSpeakChannel, TimeDisplayMode } from '../types';
import {
  Clock,
  RefreshCw,
  Pause,
  Play,
  Download,
  FileText,
  Menu,
  X,
} from 'lucide-react';
import { formatDateTime } from '../utils/eegCalculations';

interface TopHeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  channel: ThingSpeakChannel | null;
  totalRecords: number;
  isPolling: boolean;
  setIsPolling: (polling: boolean) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onQuickCsvDownload: () => void;
  onQuickCsbDownload?: () => void;
  onQuickPdfReport: () => void;
  connectionStatus: 'connected' | 'loading' | 'error' | 'paused';
  lastUpdated: string | null;
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (open: boolean) => void;
  timeDisplayMode?: TimeDisplayMode;
  setTimeDisplayMode?: (mode: TimeDisplayMode) => void;
}

const TAB_METADATA: Record<ActiveTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview',
    subtitle: 'Recording summary and live signal',
  },
  monitor: {
    title: 'Live EEG',
    subtitle: 'Real-time oscilloscope · ThingSpeak or Bluetooth',
  },
  historical: {
    title: 'Historical Data',
    subtitle: 'Browse, zoom and compare past recordings',
  },
  table: {
    title: 'Data Table',
    subtitle: 'Every stored packet — search, sort, export',
  },
  export: {
    title: 'Reports',
    subtitle: 'CSV, CSB archives and PDF reports',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Channels, display and connection info',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  channel,
  totalRecords,
  isPolling,
  setIsPolling,
  isLoading,
  onRefresh,
  onQuickCsvDownload,
  onQuickCsbDownload,
  onQuickPdfReport,
  connectionStatus,
  lastUpdated,
  isMobileNavOpen,
  setIsMobileNavOpen,
  timeDisplayMode = 'utc',
  setTimeDisplayMode,
}) => {
  const currentMeta = TAB_METADATA[activeTab] || TAB_METADATA.overview;

  const isLive = isPolling && connectionStatus !== 'error';

  return (
    <header
      id="top-header"
      className="glass sticky top-0 h-14 border-b border-[#0F172A]/[0.06] px-3 sm:px-4 md:px-6 flex items-center justify-between gap-3 shrink-0 z-20"
    >
      {/* Left: Mobile Nav Toggle & Current View Meta */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="md:hidden -ml-1 h-9 w-9 flex items-center justify-center rounded-md text-[#475569] hover:text-[#0B1220] hover:bg-[#0F172A]/[0.04]"
          aria-label="Toggle navigation menu"
        >
          {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0 leading-tight">
          <h1 className="text-[15px] font-semibold text-[#0B1220] tracking-tight truncate">
            {currentMeta.title}
          </h1>
          <p className="hidden sm:block text-[11.5px] text-[#64748B] truncate">{currentMeta.subtitle}</p>
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {lastUpdated && (
          <div
            className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] text-[#64748B] bg-white/70 ring-1 ring-[#0F172A]/[0.06]"
            title={`${totalRecords.toLocaleString()} records`}
          >
            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="font-mono text-[#0B1220]">{formatDateTime(lastUpdated, timeDisplayMode)}</span>
          </div>
        )}

        {/* Live toggle */}
        <button
          id="btn-header-stream-toggle"
          onClick={() => setIsPolling(!isPolling)}
          className={`flex items-center gap-2 h-8 px-2.5 sm:px-3 rounded-full text-[12px] font-medium ring-1 transition-colors ${
            isLive
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100/70'
              : 'bg-white text-[#64748B] ring-[#0F172A]/10 hover:text-[#0B1220]'
          }`}
          title={isPolling ? 'Live sync on — tap to pause' : 'Sync paused — tap to resume'}
        >
          <span className="relative flex h-2 w-2">
            {isLive && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span className="hidden sm:inline">{isPolling ? 'Live' : 'Paused'}</span>
          {isPolling ? <Pause className="w-3 h-3 opacity-70" /> : <Play className="w-3 h-3 opacity-70" />}
        </button>

        {/* Refresh */}
        <button
          id="btn-header-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 w-8 flex items-center justify-center rounded-md bg-white text-[#475569] ring-1 ring-[#0F172A]/10 shadow-2xs hover:text-[#0B1220] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40"
          title="Refresh data from ThingSpeak"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#4F46E5]' : ''}`} />
        </button>

        {/* Quick exports */}
        <div className="hidden md:flex items-center h-8 rounded-md bg-white ring-1 ring-[#0F172A]/10 shadow-2xs overflow-hidden text-[12px] font-medium text-[#334155]">
          <button
            id="btn-header-quick-csv"
            onClick={onQuickCsvDownload}
            className="flex items-center gap-1.5 h-full px-2.5 hover:bg-[#F8FAFC] hover:text-[#0B1220] transition-colors"
            title="Download full CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
            CSV
          </button>
          {onQuickCsbDownload && (
            <button
              id="btn-header-quick-csb"
              onClick={onQuickCsbDownload}
              className="flex items-center gap-1.5 h-full px-2.5 border-l border-[#0F172A]/[0.08] hover:bg-[#F8FAFC] hover:text-[#0B1220] transition-colors"
              title="Download full CSB archive"
            >
              <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
              CSB
            </button>
          )}
        </div>

        <button
          id="btn-header-quick-pdf"
          onClick={onQuickPdfReport}
          className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md brand-gradient text-white text-[12px] font-semibold shadow-sm ring-1 ring-[#4338CA]/40 hover:brightness-110 active:brightness-95 transition"
          title="Generate PDF report"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF Report
        </button>
      </div>
    </header>
  );
};
