import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActiveTab,
  DataSourceMode,
  TimeDisplayMode,
  ThingSpeakChannel,
  ThingSpeakFeedItem,
  ChannelFieldDefinition,
} from './types';
import { fetchAllFeeds, fetchLatestFeed } from './services/api';
import { useBleEeg } from './hooks/useBleEeg';
import { calculateAllStats, deriveSamplingInformation } from './utils/eegCalculations';
import { downloadCsvFile } from './utils/csvExport';
import { downloadCsbFile } from './utils/csbExport';
import { generatePdfReport } from './utils/pdfExport';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { OverviewView } from './components/OverviewView';
import { EEGMonitorView } from './components/EEGMonitorView';
import { HistoricalView } from './components/HistoricalView';
import { DataTable } from './components/DataTable';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';
import { ErrorAlert } from './components/ErrorAlert';
import { EEGLoadingState } from './components/EEGLoadingState';
import { Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MAX_FEEDS_IN_MEMORY = 100_000;

/** Exports are always chronological, independent of any on-screen sort order. */
const chronological = (list: ThingSpeakFeedItem[]) => [...list].sort((a, b) => a.entry_id - b.entry_id);

/** Surface async export failures instead of leaving unhandled rejections. */
function reportExportFailure(what: string, task: Promise<unknown>) {
  task.catch(err => {
    console.error(`${what} failed:`, err);
    window.alert(`${what} failed: ${err?.message || err}`);
  });
}

const INITIAL_CHANNELS: ChannelFieldDefinition[] = [
  {
    fieldKey: 'field1',
    label: 'EEG ACTIVITY',
    color: '#0F172A', // Professional Dark Clinical Waveform
    unit: 'µV',
    description: 'Primary Electroencephalography Voltage Amplitude',
    visible: true,
    isNumeric: true,
  },
  {
    fieldKey: 'field2',
    label: 'EOG Activity',
    color: '#0D9488', // Clinical Teal
    unit: 'µV',
    description: 'Electrooculography Signal Amplitude',
    visible: true,
    isNumeric: true,
  },
  {
    fieldKey: 'field3',
    label: 'Eye Movements',
    color: '#D97706', // Precision Amber
    unit: 'events',
    description: 'Ocular Movement Detection Frequency',
    visible: true,
    isNumeric: true,
  },
  {
    fieldKey: 'field4',
    label: 'EEG Artifacts',
    color: '#DC2626', // Clinical Crimson Red
    unit: 'flags',
    description: 'Electrode / Motion Artifact Indicators',
    visible: true,
    isNumeric: true,
  },
  {
    fieldKey: 'field5',
    label: 'Total Samples',
    color: '#6366F1', // Indigo / Slate Violet
    unit: 'count',
    description: 'Cumulative Hardware Acquisition Sample Clock',
    visible: false,
    isNumeric: true,
  },
  {
    fieldKey: 'field6',
    label: 'Recording Time',
    color: '#475569', // Steel Slate
    unit: 'sec',
    description: 'Cumulative Hardware Elapsed Seconds',
    visible: false,
    isNumeric: true,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [channel, setChannel] = useState<ThingSpeakChannel | null>(null);
  const [feeds, setFeeds] = useState<ThingSpeakFeedItem[]>([]);
  const [channels, setChannels] = useState<ChannelFieldDefinition[]>(INITIAL_CHANNELS);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>(() => {
    const saved = localStorage.getItem('eeg_time_display_mode');
    return saved === 'utc' ? 'utc' : 'local';
  });

  const handleSetTimeDisplayMode = useCallback((mode: TimeDisplayMode) => {
    setTimeDisplayMode(mode);
    localStorage.setItem('eeg_time_display_mode', mode);
  }, []);

  // Phase 1 BLE: separate Bluetooth source. Default remains ThingSpeak.
  // `feeds` (ThingSpeak) loading/polling below is unchanged.
  const [dataSource, setDataSource] = useState<DataSourceMode>('thingspeak');
  const ble = useBleEeg();

  // Load initial dataset
  const loadData = useCallback(async (showLoadingSpinner: boolean = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setError(null);

    try {
      const data = await fetchAllFeeds({ all: true });
      if (data.channel) {
        setChannel(data.channel);
        // Sync channel field labels if ThingSpeak provided custom names
        setChannels(prev =>
          prev.map(ch => {
            const remoteName = (data.channel as any)[ch.fieldKey];
            if (remoteName && typeof remoteName === 'string' && remoteName.trim()) {
              return { ...ch, label: remoteName.trim() };
            }
            return ch;
          })
        );
      }

      if (Array.isArray(data.feeds)) {
        setFeeds(data.feeds);
        if (data.feeds.length > 0) {
          setLastUpdated(data.feeds[data.feeds.length - 1].created_at);
        }
      }

      setApiKeyConfigured(Boolean(data.apiKeyConfigured));
    } catch (err: any) {
      console.error('Failed to load ThingSpeak feeds:', err);
      setError(err?.message || 'Failed to connect to ThingSpeak Channel 3469764.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Live polling (every 15 seconds)
  useEffect(() => {
    if (!isPolling) return;

    const intervalId = setInterval(async () => {
      try {
        const latestResult = await fetchLatestFeed();
        if (latestResult.latest) {
          const newFeed = latestResult.latest;
          setFeeds(prev => {
            if (prev.length === 0) return [newFeed];
            const last = prev[prev.length - 1];
            if (last.entry_id === newFeed.entry_id) {
              return prev;
            }
            // Append; cap memory well above the server's MAX_RECORDS so polling
            // never silently discards history the initial load returned.
            const updated = [...prev, newFeed];
            return updated.length > MAX_FEEDS_IN_MEMORY ? updated.slice(-MAX_FEEDS_IN_MEMORY) : updated;
          });
          setLastUpdated(newFeed.created_at);
        }
      } catch (pollErr) {
        console.warn('Background telemetry poll failed (transient):', pollErr);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [isPolling]);

  // Derived statistics for all channels
  const stats = useMemo(() => {
    return calculateAllStats(feeds, channels);
  }, [feeds, channels]);

  // Derived sampling information
  const samplingInfo = useMemo(() => {
    return deriveSamplingInformation(feeds);
  }, [feeds]);

  // Handle visibility toggle of channels
  const handleToggleChannel = useCallback((fieldKey: string) => {
    setChannels(prev =>
      prev.map(ch => (ch.fieldKey === fieldKey ? { ...ch, visible: !ch.visible } : ch))
    );
  }, []);

  // Quick CSV export
  const handleQuickCsv = useCallback(() => {
    if (feeds.length === 0) return;
    reportExportFailure('CSV export', downloadCsvFile(feeds, channel || undefined));
  }, [feeds, channel]);

  // Quick CSB export
  const handleQuickCsb = useCallback(() => {
    if (feeds.length === 0) return;
    reportExportFailure('CSB export', downloadCsbFile(feeds, channel || undefined));
  }, [feeds, channel]);

  // Quick PDF export
  const handleQuickPdf = useCallback(() => {
    if (feeds.length === 0) return;
    reportExportFailure(
      'PDF report',
      generatePdfReport(feeds, channel || undefined, stats, samplingInfo, {
        title: 'EEG TELEMETRY SCIENTIFIC WORKSTATION REPORT',
        authorOrFacility: 'ThingSpeak Channel 3469764 Stream',
        notes: 'Automated telemetry synchronization and multi-channel signal statistics summary.',
        timeDisplayMode,
      })
    );
  }, [channel, feeds, stats, samplingInfo, timeDisplayMode]);

  // Filtered CSV download (always written oldest → newest, whatever the table sort)
  const handleDownloadCsvRange = useCallback(
    (filteredFeeds: ThingSpeakFeedItem[], label: string) => {
      const sanitized = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      reportExportFailure('CSV export', downloadCsvFile(chronological(filteredFeeds), channel || undefined, sanitized));
    },
    [channel]
  );

  // Filtered CSB download (always written oldest → newest, whatever the table sort)
  const handleDownloadCsbRange = useCallback(
    (filteredFeeds: ThingSpeakFeedItem[], label: string) => {
      const sanitized = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      reportExportFailure('CSB export', downloadCsbFile(chronological(filteredFeeds), channel || undefined, sanitized));
    },
    [channel]
  );

  const connectionStatus = error
    ? 'error'
    : isLoading && feeds.length === 0
      ? 'loading'
      : isPolling
        ? 'connected'
        : 'paused';

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-[#0F172A] font-sans antialiased pt-safe pb-safe pl-safe pr-safe">
      {/* DESKTOP WORKSTATION SIDEBAR */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSelectTab}
          channel={channel}
          totalRecords={feeds.length}
          isPolling={isPolling}
        />
      </div>

      {/* MOBILE DRAWER NAVIGATION */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="relative w-64 bg-white h-full z-10 shadow-2xl flex flex-col pt-safe pb-safe">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#2563EB]" />
                <span className="font-mono font-bold text-xs text-[#0F172A]">
                  BRAINMATRIX
                </span>
              </div>
              <button
                onClick={() => setIsMobileNavOpen(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              activeTab={activeTab}
              setActiveTab={handleSelectTab}
              channel={channel}
              totalRecords={feeds.length}
              isPolling={isPolling}
            />
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#FFFFFF]">
        {/* COMPACT TOP HEADER */}
        <TopHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          channel={channel}
          totalRecords={feeds.length}
          isPolling={isPolling}
          setIsPolling={setIsPolling}
          isLoading={isLoading}
          onRefresh={() => loadData(false)}
          onQuickCsvDownload={handleQuickCsv}
          onQuickCsbDownload={handleQuickCsb}
          onQuickPdfReport={handleQuickPdf}
          connectionStatus={connectionStatus}
          lastUpdated={lastUpdated}
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          timeDisplayMode={timeDisplayMode}
          setTimeDisplayMode={handleSetTimeDisplayMode}
        />

        {/* SCROLLABLE MAIN CONTENT AREA */}
        <main
          id="main-content-scrollable"
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 space-y-4 md:space-y-5 bg-[#FFFFFF]"
        >
          {/* Error Alert Banner */}
          {error && (
            <ErrorAlert
              error={error}
              onRetry={() => loadData(true)}
              onDismiss={() => setError(null)}
              apiKeyConfigured={apiKeyConfigured}
            />
          )}

          {/* Initial Loading Screen with Subtle Clinical EEG Waveform Animation */}
          {isLoading && feeds.length === 0 ? (
            <EEGLoadingState
              message="Synchronizing EEG telemetry..."
              subtext="Calibrating baseline voltage and streaming telemetry packets from Channel 3469764"
              channelId={channel?.id ? String(channel.id) : '3469764'}
            />
          ) : (
            <div className="max-w-[1700px] mx-auto space-y-4 md:space-y-5">
              {/* TAB VIEWS WITH PRECISE MEDICAL PAGE TRANSITIONS */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === 'overview' && (
                    <OverviewView
                      channel={channel}
                      feeds={feeds}
                      channels={channels}
                      stats={stats}
                      samplingInfo={samplingInfo}
                      apiKeyConfigured={apiKeyConfigured}
                      onNavigateTab={setActiveTab}
                      onToggleChannel={handleToggleChannel}
                      onDownloadCsv={handleQuickCsv}
                      onDownloadCsb={handleQuickCsb}
                      onGeneratePdf={handleQuickPdf}
                      connectionStatus={connectionStatus}
                      isPolling={isPolling}
                      lastUpdated={lastUpdated}
                      timeDisplayMode={timeDisplayMode}
                    />
                  )}

                  {activeTab === 'monitor' && (
                    <EEGMonitorView
                      channel={channel}
                      feeds={feeds}
                      channels={channels}
                      isPolling={isPolling}
                      setIsPolling={setIsPolling}
                      onToggleChannel={handleToggleChannel}
                      lastUpdated={lastUpdated}
                      timeDisplayMode={timeDisplayMode}
                      dataSource={dataSource}
                      onDataSourceChange={setDataSource}
                      bleFeeds={ble.bleFeeds}
                      ble={ble}
                    />
                  )}

                  {activeTab === 'historical' && (
                    <HistoricalView
                      channel={channel}
                      feeds={feeds}
                      channels={channels}
                      onDownloadCsvRange={handleDownloadCsvRange}
                      onDownloadCsbRange={handleDownloadCsbRange}
                      onToggleChannel={handleToggleChannel}
                      timeDisplayMode={timeDisplayMode}
                    />
                  )}

                  {activeTab === 'table' && (
                    <DataTable
                      channel={channel}
                      feeds={feeds}
                      channels={channels}
                      onDownloadCsvFiltered={handleDownloadCsvRange}
                      onDownloadCsbFiltered={handleDownloadCsbRange}
                      timeDisplayMode={timeDisplayMode}
                    />
                  )}

                  {activeTab === 'export' && (
                    <ExportView
                      channel={channel}
                      feeds={feeds}
                      channels={channels}
                      stats={stats}
                      samplingInfo={samplingInfo}
                      timeDisplayMode={timeDisplayMode}
                    />
                  )}

                  {activeTab === 'settings' && (
                    <SettingsView
                      channel={channel}
                      channels={channels}
                      onToggleChannel={handleToggleChannel}
                      apiKeyConfigured={apiKeyConfigured}
                      totalRecords={feeds.length}
                      timeDisplayMode={timeDisplayMode}
                      setTimeDisplayMode={handleSetTimeDisplayMode}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </main>

        {/* MOBILE BOTTOM NAVIGATION */}
        <BottomNav activeTab={activeTab} setActiveTab={handleSelectTab} />

        {/* COMPACT WORKSTATION STATUS FOOTER (Hidden on mobile to prioritize screen space) */}
        <footer className="hidden md:flex h-8 bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 md:px-6 items-center justify-between text-[11px] font-mono text-[#64748B] shrink-0 select-none">
          <div className="flex items-center gap-3 truncate">
            <span>ThingSpeak Channel ID: <strong className="text-[#0F172A] font-semibold">3469764</strong></span>
            <span className="text-[#CBD5E1]">&bull;</span>
            <span className="hidden sm:inline">Telemetry: <strong className="text-[#16A34A] font-semibold">100% Raw Unmodified</strong></span>
            <span className="hidden lg:inline text-[#CBD5E1]">&bull;</span>
            <span className="hidden lg:inline">API Route: <strong className="text-[#2563EB] font-semibold">/api/eeg/feeds</strong></span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span>Scientific Specification</span>
            <span className="text-[#CBD5E1]">&bull;</span>
            <span className="text-[#94A3B8]">v2.4</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
