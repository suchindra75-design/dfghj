import React, { useState, useMemo } from 'react';
import {
  ThingSpeakChannel,
  ThingSpeakFeedItem,
  ChannelStatistics,
  DerivedSamplingInfo,
  ChannelFieldDefinition,
} from '../types';
import { downloadCsvFile } from '../utils/csvExport';
import { downloadCsbFile } from '../utils/csbExport';
import { generatePdfReport } from '../utils/pdfExport';
import { formatDuration, formatDateTime } from '../utils/eegCalculations';
import {
  Download,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  Database,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  FileCode2,
  Cpu,
  Clock,
  Activity,
  BarChart2,
  Loader2,
  Filter,
  Check,
  Sliders,
  FileCheck2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExportViewProps {
  channel: ThingSpeakChannel | null;
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  stats: Record<string, ChannelStatistics>;
  samplingInfo: DerivedSamplingInfo;
}

type DatasetScope = 'complete' | 'filtered' | 'custom';
type FilteredSubtype = 'artifacts' | 'eyemovements' | 'elevated' | 'recent300';

type ExportFormatTab = 'all' | 'csv' | 'csb' | 'pdf';

type CsvProgressState = 'idle' | 'preparing' | 'generating' | 'ready';
type CsbProgressState = 'idle' | 'preparing' | 'generating' | 'ready';
type PdfProgressState =
  | 'idle'
  | 'analyzing'
  | 'waveforms'
  | 'statistics'
  | 'building'
  | 'ready';

export const ExportView: React.FC<ExportViewProps> = ({
  channel,
  feeds,
  channels,
  stats,
  samplingInfo,
}) => {
  const [activeFormatTab, setActiveFormatTab] = useState<ExportFormatTab>('all');

  // CSV Configuration
  const [csvScope, setCsvScope] = useState<DatasetScope>('complete');
  const [csvFilteredType, setCsvFilteredType] = useState<FilteredSubtype>('recent300');
  const [csvCustomStart, setCsvCustomStart] = useState<string>(
    feeds.length > 0 ? feeds[0].created_at.substring(0, 16) : ''
  );
  const [csvCustomEnd, setCsvCustomEnd] = useState<string>(
    feeds.length > 0 ? feeds[feeds.length - 1].created_at.substring(0, 16) : ''
  );
  const [csvProgress, setCsvProgress] = useState<CsvProgressState>('idle');

  // CSB Configuration
  const [csbScope, setCsbScope] = useState<DatasetScope>('complete');
  const [csbFilteredType, setCsbFilteredType] = useState<FilteredSubtype>('recent300');
  const [csbCustomStart, setCsbCustomStart] = useState<string>(
    feeds.length > 0 ? feeds[0].created_at.substring(0, 16) : ''
  );
  const [csbCustomEnd, setCsbCustomEnd] = useState<string>(
    feeds.length > 0 ? feeds[feeds.length - 1].created_at.substring(0, 16) : ''
  );
  const [csbProgress, setCsbProgress] = useState<CsbProgressState>('idle');

  // PDF Configuration
  const [pdfScope, setPdfScope] = useState<DatasetScope>('complete');
  const [pdfFilteredType, setPdfFilteredType] = useState<FilteredSubtype>('recent300');
  const [pdfCustomStart, setPdfCustomStart] = useState<string>(
    feeds.length > 0 ? feeds[0].created_at.substring(0, 16) : ''
  );
  const [pdfCustomEnd, setPdfCustomEnd] = useState<string>(
    feeds.length > 0 ? feeds[feeds.length - 1].created_at.substring(0, 16) : ''
  );
  const [pdfTitle, setPdfTitle] = useState<string>('EEG Scientific Data Report');
  const [pdfLabName, setPdfLabName] = useState<string>('Biosignal Telemetry Laboratory');
  const [pdfNotes, setPdfNotes] = useState<string>(
    'Telemetry packet stream recorded from ThingSpeak Channel 3469764 (SLEEP MONITORING). Unfiltered raw data preserved for engineering signal analysis. Not intended for clinical diagnostic purposes.'
  );
  const [pdfProgress, setPdfProgress] = useState<PdfProgressState>('idle');
  const [pdfStatusMessage, setPdfStatusMessage] = useState<string | null>(null);

  // Compute CSV feeds based on options
  const csvSelectedData = useMemo(() => {
    if (csvScope === 'complete') {
      return { feedsToExport: feeds, label: 'Complete Dataset' };
    }
    if (csvScope === 'filtered') {
      if (csvFilteredType === 'artifacts') {
        const f = feeds.filter(item => item.field4 && parseFloat(item.field4) > 0);
        return { feedsToExport: f, label: 'Artifact Flagged Records' };
      }
      if (csvFilteredType === 'eyemovements') {
        const f = feeds.filter(item => item.field3 && parseFloat(item.field3) > 0);
        return { feedsToExport: f, label: 'Eye Movement Events' };
      }
      if (csvFilteredType === 'elevated') {
        const f = feeds.filter(item => item.field1 && Math.abs(parseFloat(item.field1)) >= 15);
        return { feedsToExport: f, label: 'High Voltage Activity' };
      }
      return { feedsToExport: feeds.slice(-300), label: 'Recent 300 Telemetry Records' };
    }
    // Custom range
    let filtered = feeds;
    if (csvCustomStart) {
      const sMs = new Date(csvCustomStart).getTime();
      if (!isNaN(sMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() >= sMs);
    }
    if (csvCustomEnd) {
      const eMs = new Date(csvCustomEnd).getTime();
      if (!isNaN(eMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() <= eMs);
    }
    return { feedsToExport: filtered, label: 'Custom Range Telemetry' };
  }, [feeds, csvScope, csvFilteredType, csvCustomStart, csvCustomEnd]);

  // Compute CSB feeds based on options
  const csbSelectedData = useMemo(() => {
    if (csbScope === 'complete') {
      return { feedsToExport: feeds, label: 'Complete Dataset' };
    }
    if (csbScope === 'filtered') {
      if (csbFilteredType === 'artifacts') {
        const f = feeds.filter(item => item.field4 && parseFloat(item.field4) > 0);
        return { feedsToExport: f, label: 'Artifact Flagged Records' };
      }
      if (csbFilteredType === 'eyemovements') {
        const f = feeds.filter(item => item.field3 && parseFloat(item.field3) > 0);
        return { feedsToExport: f, label: 'Eye Movement Events' };
      }
      if (csbFilteredType === 'elevated') {
        const f = feeds.filter(item => item.field1 && Math.abs(parseFloat(item.field1)) >= 15);
        return { feedsToExport: f, label: 'High Voltage Activity' };
      }
      return { feedsToExport: feeds.slice(-300), label: 'Recent 300 Telemetry Records' };
    }
    // Custom range
    let filtered = feeds;
    if (csbCustomStart) {
      const sMs = new Date(csbCustomStart).getTime();
      if (!isNaN(sMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() >= sMs);
    }
    if (csbCustomEnd) {
      const eMs = new Date(csbCustomEnd).getTime();
      if (!isNaN(eMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() <= eMs);
    }
    return { feedsToExport: filtered, label: 'Custom Range Telemetry' };
  }, [feeds, csbScope, csbFilteredType, csbCustomStart, csbCustomEnd]);

  // Compute PDF feeds based on options
  const pdfSelectedData = useMemo(() => {
    if (pdfScope === 'complete') {
      return { feedsToExport: feeds, label: 'Complete Dataset' };
    }
    if (pdfScope === 'filtered') {
      if (pdfFilteredType === 'artifacts') {
        const f = feeds.filter(item => item.field4 && parseFloat(item.field4) > 0);
        return { feedsToExport: f, label: 'Artifact Flagged Records' };
      }
      if (pdfFilteredType === 'eyemovements') {
        const f = feeds.filter(item => item.field3 && parseFloat(item.field3) > 0);
        return { feedsToExport: f, label: 'Eye Movement Events' };
      }
      if (pdfFilteredType === 'elevated') {
        const f = feeds.filter(item => item.field1 && Math.abs(parseFloat(item.field1)) >= 15);
        return { feedsToExport: f, label: 'High Voltage Activity' };
      }
      return { feedsToExport: feeds.slice(-300), label: 'Recent 300 Telemetry Records' };
    }
    // Custom range
    let filtered = feeds;
    if (pdfCustomStart) {
      const sMs = new Date(pdfCustomStart).getTime();
      if (!isNaN(sMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() >= sMs);
    }
    if (pdfCustomEnd) {
      const eMs = new Date(pdfCustomEnd).getTime();
      if (!isNaN(eMs)) filtered = filtered.filter(f => new Date(f.created_at).getTime() <= eMs);
    }
    return { feedsToExport: filtered, label: 'Custom Range Telemetry' };
  }, [feeds, pdfScope, pdfFilteredType, pdfCustomStart, pdfCustomEnd]);

  // Handle CSV Download with staged progress indicator
  const handleDownloadCsv = async () => {
    if (csvProgress !== 'idle' && csvProgress !== 'ready') return;

    // Stage 1: Preparing data
    setCsvProgress('preparing');
    await new Promise(r => setTimeout(r, 450));

    // Stage 2: Generating CSV
    setCsvProgress('generating');
    await new Promise(r => setTimeout(r, 550));

    // Execute generation
    const suffix =
      csvScope === 'complete'
        ? ''
        : csvScope === 'filtered'
        ? `Filtered_${csvFilteredType}`
        : 'Custom_Range';

    downloadCsvFile(csvSelectedData.feedsToExport, channel || undefined, suffix || undefined);

    // Stage 3: Download ready
    setCsvProgress('ready');
    setTimeout(() => {
      setCsvProgress('idle');
    }, 4000);
  };

  // Handle CSB Download with staged progress flow
  const handleDownloadCsb = async () => {
    if (csbProgress !== 'idle' && csbProgress !== 'ready') return;

    // Stage 1: Preparing data
    setCsbProgress('preparing');
    await new Promise(r => setTimeout(r, 450));

    // Stage 2: Generating CSB
    setCsbProgress('generating');
    await new Promise(r => setTimeout(r, 550));

    // Execute generation
    const suffix =
      csbScope === 'complete'
        ? ''
        : csbScope === 'filtered'
        ? `Filtered_${csbFilteredType}`
        : 'Custom_Range';

    downloadCsbFile(csbSelectedData.feedsToExport, channel || undefined, suffix || undefined);

    // Stage 3: Download ready
    setCsbProgress('ready');
    setTimeout(() => {
      setCsbProgress('idle');
    }, 4000);
  };

  // Handle PDF Generation with staged sequence
  const handleGeneratePdf = async () => {
    if (pdfProgress !== 'idle' && pdfProgress !== 'ready') return;
    setPdfStatusMessage(null);

    try {
      // 1. Analyzing EEG data
      setPdfProgress('analyzing');
      await new Promise(r => setTimeout(r, 500));

      // 2. Generating waveform
      setPdfProgress('waveforms');
      await new Promise(r => setTimeout(r, 600));

      // 3. Calculating statistics
      setPdfProgress('statistics');
      await new Promise(r => setTimeout(r, 500));

      // 4. Building report
      setPdfProgress('building');
      await new Promise(r => setTimeout(r, 500));

      // Build document
      await generatePdfReport(
        pdfSelectedData.feedsToExport,
        channel || undefined,
        stats,
        samplingInfo,
        {
          title: pdfTitle,
          authorOrFacility: pdfLabName,
          notes: pdfNotes,
        }
      );

      // 5. Report ready
      setPdfProgress('ready');
      setPdfStatusMessage('EEG Scientific Report generated and downloaded.');
      setTimeout(() => {
        setPdfProgress('idle');
        setPdfStatusMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error('PDF Generation error:', err);
      setPdfProgress('idle');
      alert(`Report compilation failed: ${err?.message || 'Error creating document'}`);
    }
  };

  const channelIdStr = channel?.id ? String(channel.id) : '3469764';
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div id="export-reports-view" className="space-y-5 max-w-[1700px] mx-auto select-none">
      {/* 1. COMPACT RESEARCH WORKSPACE HEADER & NON-CLINICAL NOTICE */}
      <div className="bg-white border border-[#E2E8F0] rounded-md p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#0F172A] tracking-tight font-mono uppercase">
              Scientific Reports & Data Export Center
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748B]">
            <span>Channel #{channelIdStr}</span>
            <span className="text-[#CBD5E1]">&bull;</span>
            <span className="text-[#0F172A] font-semibold">{feeds.length.toLocaleString()} records captured</span>
          </div>
        </div>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Export raw telemetry records in standard RFC 4180 <strong>CSV</strong> format, structured biosignal <strong>CSB</strong> archive format with complete metadata headers, or compile a multi-page biomedical <strong>PDF</strong> scientific report with high-resolution vector waveform figures.
        </p>

        {/* Format Selector Pills on small screens or for focused viewing */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#F1F5F9]">
          <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded border border-[#E2E8F0] text-xs font-mono">
            <span className="px-1.5 text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">View:</span>
            {[
              { id: 'all', label: 'All Formats (3)' },
              { id: 'csv', label: 'CSV' },
              { id: 'csb', label: 'CSB' },
              { id: 'pdf', label: 'PDF' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFormatTab(tab.id as ExportFormatTab)}
                className={`px-2.5 py-1 rounded text-xs transition-all duration-150 ${
                  activeFormatTab === tab.id
                    ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            <span>Live Stream Capture Active During Export</span>
          </div>
        </div>

        {/* Clinical Disclaimer Notice */}
        <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2 text-[11px] text-[#475569] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
          <span>
            <strong className="text-[#0F172A]">Non-Clinical Engineering & Research Notice:</strong> Telemetry data exports (CSV, CSB) and generated scientific PDF reports are intended strictly for hardware verification, academic research, and signal processing workflows. They do not constitute clinical diagnostic findings.
          </span>
        </div>
      </div>

      {/* 2. THREE-SUITE SCIENTIFIC CONTROL GRID (CSV, CSB, PDF) */}
      <div className={`grid gap-5 ${
        activeFormatTab === 'all'
          ? 'grid-cols-1 lg:grid-cols-3'
          : 'grid-cols-1'
      }`}>
        {/* ========================================================================= */}
        {/* 1. CSV DATASET EXPORT */}
        {/* ========================================================================= */}
        {(activeFormatTab === 'all' || activeFormatTab === 'csv') && (
          <div className="bg-white border border-[#E2E8F0] rounded-md p-4 sm:p-5 space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#0F172A] text-xs font-mono tracking-tight uppercase">
                    CSV Export
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2563EB] font-mono text-[10px] font-semibold">
                  RFC 4180 CSV
                </span>
              </div>

              {/* Options */}
              <div className="space-y-2 text-xs font-mono">
                <span className="text-[#64748B] text-[11px] font-semibold block uppercase">
                  Dataset Scope:
                </span>

                {/* Option 1: Complete */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csvScope === 'complete'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csvScope"
                    checked={csvScope === 'complete'}
                    onChange={() => setCsvScope('complete')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Complete Dataset</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {feeds.length.toLocaleString()} entries
                      </span>
                    </div>
                    <span className="text-[#64748B] text-[11px] block">
                      All telemetry records from #{feeds[0]?.entry_id ?? 1} to #{feeds[feeds.length - 1]?.entry_id ?? feeds.length}
                    </span>
                  </div>
                </label>

                {/* Option 2: Filtered */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csvScope === 'filtered'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csvScope"
                    checked={csvScope === 'filtered'}
                    onChange={() => setCsvScope('filtered')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Filtered Dataset</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {csvSelectedData.feedsToExport.length.toLocaleString()} matches
                      </span>
                    </div>
                    <span className="text-[#64748B] text-[11px] block">
                      Subset based on signal research criteria:
                    </span>

                    {csvScope === 'filtered' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {[
                          { id: 'recent300', label: 'Recent 300 Feeds' },
                          { id: 'artifacts', label: 'Artifact Flags (> 0)' },
                          { id: 'eyemovements', label: 'Eye Moves (> 0)' },
                          { id: 'elevated', label: 'High EEG (|V| ≥ 15µV)' },
                        ].map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setCsvFilteredType(sub.id as FilteredSubtype)}
                            className={`px-2 py-1 rounded text-[11px] text-left border transition-all ${
                              csvFilteredType === sub.id
                                ? 'bg-[#2563EB] text-white border-[#2563EB] font-semibold shadow-2xs'
                                : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 3: Custom Range */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csvScope === 'custom'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csvScope"
                    checked={csvScope === 'custom'}
                    onChange={() => setCsvScope('custom')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Custom Range</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {csvSelectedData.feedsToExport.length.toLocaleString()} matching
                      </span>
                    </div>

                    {csvScope === 'custom' && (
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            Start Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={csvCustomStart}
                            onChange={e => setCsvCustomStart(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            End Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={csvCustomEnd}
                            onChange={e => setCsvCustomEnd(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Details Box */}
              <div className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px] font-mono text-[#64748B]">
                <div className="flex justify-between">
                  <span>Target:</span>
                  <strong className="text-[#0F172A]">{csvSelectedData.feedsToExport.length.toLocaleString()} records</strong>
                </div>
                <div className="flex justify-between">
                  <span>Output:</span>
                  <span className="text-[#0F172A]">EEG_Channel_{channelIdStr}_{todayStr}.csv</span>
                </div>
              </div>
            </div>

            {/* CSV Action Section */}
            <div className="space-y-2.5 pt-2">
              {csvProgress !== 'idle' && (
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[#2563EB] font-semibold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      {csvProgress === 'ready' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>
                        {csvProgress === 'preparing' && 'Preparing data...'}
                        {csvProgress === 'generating' && 'Generating CSV...'}
                        {csvProgress === 'ready' && 'Download ready!'}
                      </span>
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      {csvProgress === 'preparing' && 'Step 1 of 3'}
                      {csvProgress === 'generating' && 'Step 2 of 3'}
                      {csvProgress === 'ready' && 'Ready'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[#2563EB] transition-all duration-300 ${
                        csvProgress === 'preparing'
                          ? 'w-1/3'
                          : csvProgress === 'generating'
                          ? 'w-2/3'
                          : 'w-full bg-emerald-600'
                      }`}
                    />
                  </div>
                </div>
              )}

              <button
                id="btn-download-csv"
                onClick={handleDownloadCsv}
                disabled={csvSelectedData.feedsToExport.length === 0 || (csvProgress !== 'idle' && csvProgress !== 'ready')}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-mono font-semibold transition-all duration-150 active:scale-98 shadow-2xs"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV ({csvSelectedData.feedsToExport.length.toLocaleString()})</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. CSB DATASET EXPORT (NEW CSB OPTION) */}
        {/* ========================================================================= */}
        {(activeFormatTab === 'all' || activeFormatTab === 'csb') && (
          <div className="bg-white border border-[#E2E8F0] rounded-md p-4 sm:p-5 space-y-4 shadow-2xs flex flex-col justify-between ring-1 ring-emerald-500/20">
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-[#0F172A] text-xs font-mono tracking-tight uppercase">
                    Download CSB
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-semibold">
                  CSB v1.0 • RAW TELEMETRY
                </span>
              </div>

              {/* Options */}
              <div className="space-y-2 text-xs font-mono">
                <span className="text-[#64748B] text-[11px] font-semibold block uppercase">
                  CSB Dataset Scope:
                </span>

                {/* Option 1: Complete */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csbScope === 'complete'
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csbScope"
                    checked={csbScope === 'complete'}
                    onChange={() => setCsbScope('complete')}
                    className="mt-0.5 text-emerald-600 focus:ring-0"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Complete Dataset</span>
                      <span className="text-emerald-700 font-mono text-[10px] font-medium">
                        {feeds.length.toLocaleString()} entries
                      </span>
                    </div>
                    <span className="text-[#64748B] text-[11px] block">
                      Full raw capture with comprehensive telemetry metadata header
                    </span>
                  </div>
                </label>

                {/* Option 2: Filtered */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csbScope === 'filtered'
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csbScope"
                    checked={csbScope === 'filtered'}
                    onChange={() => setCsbScope('filtered')}
                    className="mt-0.5 text-emerald-600 focus:ring-0"
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Filtered Dataset</span>
                      <span className="text-emerald-700 font-mono text-[10px] font-medium">
                        {csbSelectedData.feedsToExport.length.toLocaleString()} matches
                      </span>
                    </div>
                    <span className="text-[#64748B] text-[11px] block">
                      Export specific signal condition records in .csb structure:
                    </span>

                    {csbScope === 'filtered' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {[
                          { id: 'recent300', label: 'Recent 300 Feeds' },
                          { id: 'artifacts', label: 'Artifact Flags (> 0)' },
                          { id: 'eyemovements', label: 'Eye Moves (> 0)' },
                          { id: 'elevated', label: 'High EEG (|V| ≥ 15µV)' },
                        ].map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setCsbFilteredType(sub.id as FilteredSubtype)}
                            className={`px-2 py-1 rounded text-[11px] text-left border transition-all ${
                              csbFilteredType === sub.id
                                ? 'bg-emerald-700 text-white border-emerald-700 font-semibold shadow-2xs'
                                : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 3: Custom Range */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    csbScope === 'custom'
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="csbScope"
                    checked={csbScope === 'custom'}
                    onChange={() => setCsbScope('custom')}
                    className="mt-0.5 text-emerald-600 focus:ring-0"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Custom Date/Time Range</span>
                      <span className="text-emerald-700 font-mono text-[10px] font-medium">
                        {csbSelectedData.feedsToExport.length.toLocaleString()} matching
                      </span>
                    </div>

                    {csbScope === 'custom' && (
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            Start Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={csbCustomStart}
                            onChange={e => setCsbCustomStart(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            End Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={csbCustomEnd}
                            onChange={e => setCsbCustomEnd(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* CSB Metadata & Structure Preview */}
              <div className="p-2.5 rounded bg-emerald-50/50 border border-emerald-200 space-y-1 text-[11px] font-mono text-[#475569]">
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-950">CSB Header:</span>
                  <span className="text-emerald-800">Channel ID, Name, Range, Fields</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Records:</span>
                  <strong className="text-[#0F172A]">{csbSelectedData.feedsToExport.length.toLocaleString()} uncompressed points</strong>
                </div>
                <div className="flex justify-between">
                  <span>Output File:</span>
                  <span className="text-emerald-900 font-semibold truncate">EEG_Channel_{channelIdStr}_{todayStr}.csb</span>
                </div>
              </div>
            </div>

            {/* CSB Action Section */}
            <div className="space-y-2.5 pt-2">
              {/* CSB PROGRESS FLOW: Preparing data → Generating CSB → Download ready */}
              {csbProgress !== 'idle' && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-800 font-semibold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      {csbProgress === 'ready' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                      )}
                      <span>
                        {csbProgress === 'preparing' && 'Preparing data...'}
                        {csbProgress === 'generating' && 'Generating CSB...'}
                        {csbProgress === 'ready' && 'Download ready!'}
                      </span>
                    </span>
                    <span className="text-[10px] text-emerald-700">
                      {csbProgress === 'preparing' && 'Step 1 of 3'}
                      {csbProgress === 'generating' && 'Step 2 of 3'}
                      {csbProgress === 'ready' && 'Ready'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-emerald-600 transition-all duration-300 ${
                        csbProgress === 'preparing'
                          ? 'w-1/3'
                          : csbProgress === 'generating'
                          ? 'w-2/3'
                          : 'w-full bg-emerald-700'
                      }`}
                    />
                  </div>
                </div>
              )}

              <button
                id="btn-download-csb"
                onClick={handleDownloadCsb}
                disabled={csbSelectedData.feedsToExport.length === 0 || (csbProgress !== 'idle' && csbProgress !== 'ready')}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-mono font-semibold transition-all duration-150 active:scale-98 shadow-2xs"
              >
                <Download className="w-4 h-4" />
                <span>Download CSB ({csbSelectedData.feedsToExport.length.toLocaleString()})</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. PDF SCIENTIFIC REPORT GENERATION */}
        {/* ========================================================================= */}
        {(activeFormatTab === 'all' || activeFormatTab === 'pdf') && (
          <div className="bg-white border border-[#E2E8F0] rounded-md p-4 sm:p-5 space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#0F172A] text-xs font-mono tracking-tight uppercase">
                    PDF Scientific Report
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2563EB] font-mono text-[10px] font-semibold">
                  MULTI-PAGE PDF
                </span>
              </div>

              {/* Options */}
              <div className="space-y-2 text-xs font-mono">
                <span className="text-[#64748B] text-[11px] font-semibold block uppercase">
                  Report Scope:
                </span>

                {/* Option 1: Complete */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    pdfScope === 'complete'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdfScope"
                    checked={pdfScope === 'complete'}
                    onChange={() => setPdfScope('complete')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Complete Recording</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {feeds.length.toLocaleString()} records
                      </span>
                    </div>
                    <span className="text-[#64748B] text-[11px] block">
                      Multi-page scientific report (~6–10 pages): Executive summary, stats, macro overview, stacked waveforms, research notes
                    </span>
                  </div>
                </label>

                {/* Option 2: Filtered */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    pdfScope === 'filtered'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdfScope"
                    checked={pdfScope === 'filtered'}
                    onChange={() => setPdfScope('filtered')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Filtered Subset</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {pdfSelectedData.feedsToExport.length.toLocaleString()} matching
                      </span>
                    </div>

                    {pdfScope === 'filtered' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {[
                          { id: 'recent300', label: 'Recent 300 Feeds' },
                          { id: 'artifacts', label: 'Artifact Flags (> 0)' },
                          { id: 'eyemovements', label: 'Eye Moves (> 0)' },
                          { id: 'elevated', label: 'High EEG (|V| ≥ 15µV)' },
                        ].map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setPdfFilteredType(sub.id as FilteredSubtype)}
                            className={`px-2 py-1 rounded text-[11px] text-left border transition-all ${
                              pdfFilteredType === sub.id
                                ? 'bg-[#2563EB] text-white border-[#2563EB] font-semibold shadow-2xs'
                                : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 3: Custom Range */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-all duration-150 ${
                    pdfScope === 'custom'
                      ? 'border-[#2563EB] bg-blue-50/30'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdfScope"
                    checked={pdfScope === 'custom'}
                    onChange={() => setPdfScope('custom')}
                    className="mt-0.5 text-[#2563EB] focus:ring-0"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0F172A] font-semibold text-xs">Custom Range</span>
                      <span className="text-[#2563EB] font-mono text-[10px] font-medium">
                        {pdfSelectedData.feedsToExport.length.toLocaleString()} matching
                      </span>
                    </div>

                    {pdfScope === 'custom' && (
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            Start Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={pdfCustomStart}
                            onChange={e => setPdfCustomStart(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block mb-0.5 font-semibold">
                            End Timestamp (UTC):
                          </span>
                          <input
                            type="datetime-local"
                            value={pdfCustomEnd}
                            onChange={e => setPdfCustomEnd(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Lab & Title Inputs */}
              <div className="space-y-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[#64748B] text-[10px] font-semibold block mb-0.5 uppercase">
                    Facility / Laboratory:
                  </span>
                  <input
                    type="text"
                    value={pdfLabName}
                    onChange={e => setPdfLabName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-mono shadow-2xs focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* PDF Generation Sequence & Action Button */}
            <div className="space-y-2.5 pt-2">
              {pdfProgress !== 'idle' && (
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[#2563EB] font-semibold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      {pdfProgress === 'ready' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>
                        {pdfProgress === 'analyzing' && 'Analyzing EEG data...'}
                        {pdfProgress === 'waveforms' && 'Generating waveform plots...'}
                        {pdfProgress === 'statistics' && 'Calculating statistics...'}
                        {pdfProgress === 'building' && 'Building report document...'}
                        {pdfProgress === 'ready' && 'Report ready!'}
                      </span>
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      {pdfProgress === 'analyzing' && 'Step 1 of 4'}
                      {pdfProgress === 'waveforms' && 'Step 2 of 4'}
                      {pdfProgress === 'statistics' && 'Step 3 of 4'}
                      {pdfProgress === 'building' && 'Step 4 of 4'}
                      {pdfProgress === 'ready' && 'Complete'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[#2563EB] transition-all duration-300 ${
                        pdfProgress === 'analyzing'
                          ? 'w-1/4'
                          : pdfProgress === 'waveforms'
                          ? 'w-2/4'
                          : pdfProgress === 'statistics'
                          ? 'w-3/4'
                          : pdfProgress === 'building'
                          ? 'w-11/12'
                          : 'w-full bg-emerald-600'
                      }`}
                    />
                  </div>
                </div>
              )}

              {pdfStatusMessage && (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{pdfStatusMessage}</span>
                </div>
              )}

              <button
                id="btn-generate-pdf"
                onClick={handleGeneratePdf}
                disabled={pdfSelectedData.feedsToExport.length === 0 || (pdfProgress !== 'idle' && pdfProgress !== 'ready')}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-mono font-semibold transition-all duration-150 active:scale-98 shadow-2xs"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>
                  Generate PDF ({pdfSelectedData.feedsToExport.length.toLocaleString()})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
