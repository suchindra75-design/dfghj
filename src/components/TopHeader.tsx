import React from 'react';
import { ActiveTab, ThingSpeakChannel } from '../types';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Pause,
  Play,
  Download,
  FileText,
  Menu,
  X,
  Database,
} from 'lucide-react';

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
}

const TAB_METADATA: Record<ActiveTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview',
    subtitle: 'System Telemetry & Multi-Channel Health Summary',
  },
  monitor: {
    title: 'Live EEG Monitor',
    subtitle: 'High-Speed Real-Time Oscilloscope & Channel Inspector',
  },
  historical: {
    title: 'Historical Data',
    subtitle: 'Timeline Navigation, Window Zoom & Signal Comparison',
  },
  table: {
    title: 'Data Table',
    subtitle: 'Raw Telemetry Packet Logs, Search & Multi-Column Sorting',
  },
  export: {
    title: 'Reports & Export',
    subtitle: 'RFC 4180 CSV, Biosignal CSB & Scientific PDF Generator',
  },
  settings: {
    title: 'Workstation Settings',
    subtitle: 'Channel Configuration, Hardware Parameters & Protocol Info',
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
}) => {
  const currentMeta = TAB_METADATA[activeTab] || {
    title: 'Workstation',
    subtitle: 'EEG Signal Analysis',
  };

  return (
    <header
      id="top-header"
      className="h-14 bg-white border-b border-[#E2E8F0] px-4 md:px-6 flex items-center justify-between gap-3 shrink-0 z-20"
    >
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="md:hidden p-1.5 rounded text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
          aria-label="Toggle navigation menu"
        >
          {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-[#0F172A] tracking-tight truncate">
              {currentMeta.title}
            </h1>
            <span className="hidden sm:inline text-[#CBD5E1]">&bull;</span>
            <span className="hidden sm:inline text-xs text-[#64748B] font-mono truncate">
              {currentMeta.subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Right: ThingSpeak Status, Last Sync, Controls */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono shrink-0">
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
          {connectionStatus === 'connected' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-[#16A34A] font-semibold text-[11px] hidden sm:inline">
                ThingSpeak Online
              </span>
              <span className="text-[#16A34A] font-semibold text-[11px] sm:hidden">Online</span>
            </>
          )}
          {connectionStatus === 'loading' && (
            <>
              <RefreshCw className="w-3 h-3 text-[#2563EB] animate-spin" />
              <span className="text-[#2563EB] font-semibold text-[11px]">Syncing</span>
            </>
          )}
          {connectionStatus === 'paused' && (
            <>
              <Pause className="w-3 h-3 text-[#D97706]" />
              <span className="text-[#D97706] font-semibold text-[11px]">Paused</span>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <AlertCircle className="w-3 h-3 text-[#DC2626]" />
              <span className="text-[#DC2626] font-semibold text-[11px]">Error</span>
            </>
          )}
        </div>

        {/* Last Synchronized Time */}
        {lastUpdated && (
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#64748B] px-2 py-1 bg-white border border-[#E2E8F0] rounded">
            <Clock className="w-3 h-3 text-[#94A3B8]" />
            <span>Sync: <strong className="text-[#0F172A]">{lastUpdated.substring(11, 19)} UTC</strong></span>
          </div>
        )}

        {/* Total Records Counter */}
        <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#64748B]">
          <Database className="w-3 h-3 text-[#94A3B8]" />
          <span>{totalRecords.toLocaleString()} pts</span>
        </div>

        {/* Live Feed Toggle */}
        <button
          id="btn-header-stream-toggle"
          onClick={() => setIsPolling(!isPolling)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs border font-medium transition-colors ${
            isPolling
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
              : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
          }`}
          title={isPolling ? 'Live telemetry stream active (15s poll)' : 'Stream is paused'}
        >
          {isPolling ? <Pause className="w-3 h-3 text-emerald-600" /> : <Play className="w-3 h-3 text-amber-600" />}
          <span className="hidden sm:inline">{isPolling ? 'Live Stream' : 'Stream Paused'}</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          id="btn-header-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-medium transition-colors shadow-2xs disabled:opacity-40"
          title="Force refresh data from ThingSpeak"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#2563EB]' : 'text-[#64748B]'}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Quick CSV Export */}
        <button
          id="btn-header-quick-csv"
          onClick={onQuickCsvDownload}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#334155] hover:text-[#0F172A] font-medium transition-colors"
          title="Download Full CSV (RFC 4180)"
        >
          <Download className="w-3.5 h-3.5 text-[#64748B]" />
          <span>CSV</span>
        </button>

        {/* Quick CSB Export */}
        {onQuickCsbDownload && (
          <button
            id="btn-header-quick-csb"
            onClick={onQuickCsbDownload}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium transition-colors"
            title="Download Full CSB (Raw Biosignal Archive)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSB</span>
          </button>
        )}

        {/* Quick PDF Report */}
        <button
          id="btn-header-quick-pdf"
          onClick={onQuickPdfReport}
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded bg-[#2563EB] hover:bg-blue-700 text-white font-medium transition-colors shadow-2xs"
          title="Generate PDF Report"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF Report</span>
        </button>
      </div>
    </header>
  );
};
