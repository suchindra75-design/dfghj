import React from 'react';
import { ActiveTab, ThingSpeakChannel } from '../types';
import {
  Activity,
  BarChart3,
  Database,
  Download,
  FileText,
  Radio,
  RefreshCw,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  channel: ThingSpeakChannel | null;
  totalRecords: number;
  isPolling: boolean;
  setIsPolling: (polling: boolean) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onQuickCsvDownload: () => void;
  onQuickPdfReport: () => void;
  apiKeyConfigured: boolean;
  connectionStatus: 'connected' | 'loading' | 'error' | 'paused';
  lastUpdated: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  channel,
  totalRecords,
  isPolling,
  setIsPolling,
  isLoading,
  onRefresh,
  onQuickCsvDownload,
  onQuickPdfReport,
  apiKeyConfigured,
  connectionStatus,
  lastUpdated,
}) => {
  const tabs = [
    { id: 'overview' as ActiveTab, label: 'Overview', icon: BarChart3 },
    { id: 'monitor' as ActiveTab, label: 'EEG Monitor', icon: Radio },
    { id: 'historical' as ActiveTab, label: 'Historical Data', icon: Activity },
    { id: 'table' as ActiveTab, label: 'Data Table', icon: Database },
    { id: 'export' as ActiveTab, label: 'Export & Reports', icon: Download },
  ];

  return (
    <header id="main-header" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0]">
      {/* Top Banner: Status & System Diagnostics */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs">
        {/* Left: Branding & Channel Identifier */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
            <span className="font-semibold text-[#0F172A] tracking-tight text-xs sm:text-sm flex items-center gap-1.5 font-mono">
              EEG SCIENTIFIC WORKSTATION
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[#475569] font-mono text-[11px] bg-white px-2.5 py-0.5 rounded border border-[#E2E8F0]">
            <span className="text-[#2563EB] font-medium">CH #{channel?.id ?? '3469764'}</span>
            <span className="text-[#CBD5E1]">&bull;</span>
            <span className="text-[#334155] truncate max-w-[140px] font-medium">{channel?.name ?? 'SLEEP MONITORING'}</span>
            <a
              href={`https://thingspeak.mathworks.com/channels/${channel?.id ?? '3469764'}/private_show`}
              target="_blank"
              rel="noreferrer"
              className="text-[#94A3B8] hover:text-[#2563EB] transition-colors ml-0.5"
              title="Open ThingSpeak Channel in new tab"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right: Live Stream & Connection State */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-[#E2E8F0]">
            {connectionStatus === 'connected' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[#16A34A] font-medium">Online</span>
              </>
            )}
            {connectionStatus === 'loading' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
                <span className="text-[#2563EB] font-medium">Syncing</span>
              </>
            )}
            {connectionStatus === 'paused' && (
              <>
                <Pause className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-[#D97706] font-medium">Paused</span>
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                <span className="text-[#DC2626] font-medium">Error</span>
              </>
            )}
          </div>

          {/* Record Count */}
          <div className="hidden md:flex items-center gap-1 text-[#64748B]">
            <Database className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Records:</span>
            <strong className="text-[#0F172A]">{totalRecords.toLocaleString()}</strong>
          </div>

          {/* Last Update Time */}
          {lastUpdated && (
            <div className="hidden lg:flex items-center gap-1 text-[#64748B]">
              <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>{lastUpdated.substring(11, 19)} UTC</span>
            </div>
          )}

          {/* Live Polling Toggle */}
          <button
            id="btn-live-stream-toggle"
            onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors font-medium ${
              isPolling
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title={isPolling ? 'Live telemetry updates are running (every 15s)' : 'Resume live telemetry stream'}
          >
            {isPolling ? <Pause className="w-3 h-3 text-emerald-600" /> : <Play className="w-3 h-3 text-amber-600" />}
            <span>{isPolling ? 'Live' : 'Paused'}</span>
          </button>

          {/* Refresh Action */}
          <button
            id="btn-refresh-telemetry"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] transition-colors disabled:opacity-50"
            title="Fetch latest dataset from ThingSpeak"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs & Action Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 md:px-6 py-2.5 gap-3 bg-white">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium text-xs whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Export Actions */}
        <div className="flex items-center gap-2">
          <button
            id="btn-quick-csv"
            onClick={onQuickCsvDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] border border-[#E2E8F0] text-xs font-mono font-medium transition-colors shadow-xs"
            title="Instant CSV export of dataset"
          >
            <Download className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Download CSV</span>
          </button>

          <button
            id="btn-quick-pdf"
            onClick={onQuickPdfReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-xs font-mono transition-all shadow-xs"
            title="Generate & print scientific PDF report"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>Generate PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
