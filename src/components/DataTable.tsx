import React, { useState, useMemo, useCallback } from 'react';
import { ThingSpeakFeedItem, ChannelFieldDefinition, ThingSpeakChannel } from '../types';
import { formatDateTime } from '../utils/eegCalculations';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Clock,
  Layers,
  AlertTriangle,
  X,
  Database,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DataTableProps {
  channel: ThingSpeakChannel | null;
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  onDownloadCsvFiltered: (filtered: ThingSpeakFeedItem[], label: string) => void;
  onDownloadCsbFiltered?: (filtered: ThingSpeakFeedItem[], label: string) => void;
}

type SortField =
  | 'entry_id'
  | 'created_at'
  | 'field1'
  | 'field2'
  | 'field3'
  | 'field4'
  | 'field5'
  | 'field6';

type SortOrder = 'asc' | 'desc';

type QuickRangeOption = '30s' | '5m' | '15m' | 'all';

type DisplayMode = 'all' | 'artifacts' | 'eyemovements' | 'elevated_eeg';

export const DataTable: React.FC<DataTableProps> = ({
  channel,
  feeds,
  channels,
  onDownloadCsvFiltered,
  onDownloadCsbFiltered,
}) => {
  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('entry_id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // default to latest records first

  // Pagination & Page Size
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageJumperVal, setPageJumperVal] = useState<string>('');

  // Filtering Controls
  const [quickRange, setQuickRange] = useState<QuickRangeOption>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const [minEegVal, setMinEegVal] = useState<string>('');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);

  // Compute latest timestamp in the dataset for relative Quick Range calculations
  const latestTimestamp = useMemo(() => {
    if (feeds.length === 0) return Date.now();
    const last = feeds[feeds.length - 1];
    const parsed = new Date(last.created_at).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }, [feeds]);

  // Main Filtering Logic
  const filteredFeeds = useMemo(() => {
    let result = feeds;

    // 1. Quick Range Filtering
    if (quickRange !== 'all') {
      let durationMs = 0;
      if (quickRange === '30s') durationMs = 30 * 1000;
      else if (quickRange === '5m') durationMs = 5 * 60 * 1000;
      else if (quickRange === '15m') durationMs = 15 * 60 * 1000;

      const threshold = latestTimestamp - durationMs;
      result = result.filter(item => {
        const t = new Date(item.created_at).getTime();
        return t >= threshold;
      });
    }

    // 2. Custom Date/Time Range
    if (customStart) {
      const startTime = new Date(customStart).getTime();
      if (!isNaN(startTime)) {
        result = result.filter(item => new Date(item.created_at).getTime() >= startTime);
      }
    }
    if (customEnd) {
      const endTime = new Date(customEnd).getTime();
      if (!isNaN(endTime)) {
        result = result.filter(item => new Date(item.created_at).getTime() <= endTime);
      }
    }

    // 3. Display Mode Filter
    if (displayMode === 'artifacts') {
      result = result.filter(item => item.field4 && parseFloat(item.field4) > 0);
    } else if (displayMode === 'eyemovements') {
      result = result.filter(item => item.field3 && parseFloat(item.field3) > 0);
    } else if (displayMode === 'elevated_eeg') {
      result = result.filter(item => item.field1 && Math.abs(parseFloat(item.field1)) >= 15);
    }

    // 4. Min EEG Filter
    if (minEegVal !== '') {
      const minNum = parseFloat(minEegVal);
      if (!isNaN(minNum)) {
        result = result.filter(item => item.field1 && parseFloat(item.field1) >= minNum);
      }
    }

    // 5. Channel Focus / Non-empty Filter
    if (selectedChannelFilter !== 'all') {
      result = result.filter(item => {
        const val = (item as any)[selectedChannelFilter];
        return val !== null && val !== undefined && val !== '';
      });
    }

    // 6. Text Search (Across Entry ID, Timestamp, and Channel Values)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        return (
          String(item.entry_id).includes(q) ||
          item.created_at.toLowerCase().includes(q) ||
          (item.field1 && item.field1.toLowerCase().includes(q)) ||
          (item.field2 && item.field2.toLowerCase().includes(q)) ||
          (item.field3 && item.field3.toLowerCase().includes(q)) ||
          (item.field4 && item.field4.toLowerCase().includes(q)) ||
          (item.field5 && item.field5.toLowerCase().includes(q)) ||
          (item.field6 && item.field6.toLowerCase().includes(q))
        );
      });
    }

    // 7. Multi-column Sorting
    return [...result].sort((a, b) => {
      const valA: any = a[sortField];
      const valB: any = b[sortField];

      if (sortField === 'entry_id') {
        return sortOrder === 'asc' ? a.entry_id - b.entry_id : b.entry_id - a.entry_id;
      }
      if (sortField === 'created_at') {
        const tA = new Date(a.created_at).getTime();
        const tB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      }

      // Numeric comparison
      const numA = valA !== undefined && valA !== null ? parseFloat(valA) : -Infinity;
      const numB = valB !== undefined && valB !== null ? parseFloat(valB) : -Infinity;

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      // String comparison fallback
      const strA = String(valA || '');
      const strB = String(valB || '');
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [
    feeds,
    quickRange,
    latestTimestamp,
    customStart,
    customEnd,
    displayMode,
    minEegVal,
    selectedChannelFilter,
    searchQuery,
    sortField,
    sortOrder,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredFeeds.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedFeeds = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredFeeds.slice(start, start + pageSize);
  }, [filteredFeeds, validCurrentPage, pageSize]);

  // Sort toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setQuickRange('all');
    setCustomStart('');
    setCustomEnd('');
    setSelectedChannelFilter('all');
    setDisplayMode('all');
    setMinEegVal('');
    setCurrentPage(1);
    setPageJumperVal('');
  };

  // Page Jumper submission
  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageJumperVal, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
    setPageJumperVal('');
  };

  // Check if any filter is active
  const isAnyFilterActive =
    searchQuery.trim() !== '' ||
    quickRange !== 'all' ||
    customStart !== '' ||
    customEnd !== '' ||
    selectedChannelFilter !== 'all' ||
    displayMode !== 'all' ||
    minEegVal !== '';

  // Render Sort direction icons
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#94A3B8] opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#2563EB]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#2563EB]" />
    );
  };

  // Dynamic filter key for smooth subtle transition
  const transitionKey = `${quickRange}-${displayMode}-${selectedChannelFilter}-${validCurrentPage}-${sortField}-${sortOrder}`;

  return (
    <div id="data-table-view" className="space-y-4 max-w-[1700px] mx-auto select-none overflow-x-hidden">
      {/* 1. COMPACT CLINICAL FILTER TOOLBAR (Unified scientific control bar) */}
      <div className="bg-white border border-[#E2E8F0] rounded-md p-3 sm:p-3.5 space-y-3 shadow-2xs">
        {/* Top Control Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Quick Range Tabs */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded border border-[#E2E8F0] text-xs font-mono overflow-x-auto">
            <span className="px-1.5 text-[10px] text-[#64748B] uppercase tracking-wider font-semibold shrink-0">
              Range:
            </span>
            {(
              [
                { id: '30s', label: '30s' },
                { id: '5m', label: '5m' },
                { id: '15m', label: '15m' },
                { id: 'all', label: 'All' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setQuickRange(opt.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 sm:py-1 rounded text-xs min-h-[36px] sm:min-h-0 transition-all duration-150 ${
                  quickRange === opt.id
                    ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search Box & Mobile Filter Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-table-search"
                type="text"
                placeholder="Search ID, time, value..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-2 sm:py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-mono placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono border transition-all min-h-[38px] ${
                isMobileFiltersOpen || isAnyFilterActive
                  ? 'bg-blue-50 text-[#2563EB] border-[#2563EB] font-semibold'
                  : 'bg-white text-[#475569] border-[#CBD5E1]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {isAnyFilterActive && (
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel on Mobile / Always visible on Desktop */}
        <div className={`space-y-3 pt-2.5 border-t border-[#F1F5F9] ${isMobileFiltersOpen ? 'block' : 'hidden sm:block'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Channel Selector */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-[#64748B] text-[11px] font-medium hidden sm:inline">Channel:</span>
                <select
                  value={selectedChannelFilter}
                  onChange={e => {
                    setSelectedChannelFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-mono focus:outline-none focus:border-[#2563EB] shadow-2xs"
                >
                  <option value="all">All Channels</option>
                  {channels.map(ch => (
                    <option key={ch.fieldKey} value={ch.fieldKey}>
                      {ch.label} ({ch.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Mode Selector */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-[#64748B] text-[11px] font-medium hidden sm:inline">Mode:</span>
                <select
                  value={displayMode}
                  onChange={e => {
                    setDisplayMode(e.target.value as DisplayMode);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-mono focus:outline-none focus:border-[#2563EB] shadow-2xs"
                >
                  <option value="all">Standard Telemetry</option>
                  <option value="artifacts">Artifacts (Field 4 &gt; 0)</option>
                  <option value="eyemovements">Eye Moves (Field 3 &gt; 0)</option>
                  <option value="elevated_eeg">High Voltage (|EEG| &ge; 15 µV)</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range & Min EEG */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-[#64748B] w-full sm:w-auto">
                <Calendar className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={e => {
                    setCustomStart(e.target.value);
                    setQuickRange('all');
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:outline-none focus:border-[#2563EB]"
                />
                <span className="text-[#94A3B8]">to</span>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={e => {
                    setCustomEnd(e.target.value);
                    setQuickRange('all');
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] shadow-2xs focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[#64748B] text-[11px] font-medium">Min EEG:</span>
                <input
                  type="number"
                  placeholder="µV"
                  value={minEegVal}
                  onChange={e => {
                    setMinEegVal(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-16 px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs shadow-2xs focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Reset & Export Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0">
              {isAnyFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-[#64748B] hover:text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] transition-all duration-150 active:scale-95 text-xs font-medium min-h-[36px] sm:min-h-0"
                  title="Reset all filters to default"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}

              <button
                id="btn-export-table-filtered"
                onClick={() => onDownloadCsvFiltered(filteredFeeds, 'Filtered_Telemetry_Logs')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] text-xs font-mono font-medium transition-all duration-150 active:scale-95 shadow-2xs min-h-[36px] sm:min-h-0"
                title="Export Filtered Logs as CSV (RFC 4180)"
              >
                <Download className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Export CSV ({filteredFeeds.length.toLocaleString()})</span>
              </button>

              {onDownloadCsbFiltered && (
                <button
                  id="btn-export-table-csb"
                  onClick={() => onDownloadCsbFiltered(filteredFeeds, 'Filtered_Telemetry_Logs')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-medium transition-all duration-150 active:scale-95 shadow-2xs min-h-[36px] sm:min-h-0"
                  title="Export Filtered Logs as CSB Biosignal Archive"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSB ({filteredFeeds.length.toLocaleString()})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry Match Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-[#64748B] pt-1 border-t border-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-[#0F172A]">{filteredFeeds.length.toLocaleString()}</strong> of{' '}
              {feeds.length.toLocaleString()} records
            </span>
            {isAnyFilterActive && (
              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-[#2563EB] border border-blue-200 text-[10px] font-semibold">
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Sort: <strong className="text-[#0F172A]">{sortField.toUpperCase()}</strong> ({sortOrder.toUpperCase()})
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <div className="sm:hidden flex items-center justify-between text-[11px] font-mono text-[#64748B] px-1">
        <span className="flex items-center gap-1 text-[#2563EB] font-medium">
          Swipe horizontally for full channel data &rarr;
        </span>
        <span>6 Channels</span>
      </div>

      {/* 2. MAIN SCIENTIFIC TABLE CONTAINER (White background, sticky header, subtle horizontal borders, compact rows, excellent alignment) */}
      <div className="w-full overflow-x-auto rounded-md border border-[#E2E8F0] bg-white shadow-2xs">
        <table className="w-full text-left text-xs font-mono border-collapse min-w-[940px]">
          {/* STICKY TABLE HEADER */}
          <thead className="sticky top-0 bg-[#F8FAFC] text-[#475569] border-b border-[#E2E8F0] z-10 select-none shadow-2xs">
            <tr>
              {/* ENTRY ID (Visually secondary) */}
              <th
                onClick={() => handleSort('entry_id')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-[#64748B] group w-24"
              >
                <div className="flex items-center gap-1">
                  <span>Entry ID</span>
                  {renderSortIcon('entry_id')}
                </div>
              </th>

              {/* TIMESTAMP (UTC & Readable) */}
              <th
                onClick={() => handleSort('created_at')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-[#475569] group min-w-[190px]"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Timestamp (UTC)</span>
                  {renderSortIcon('created_at')}
                </div>
              </th>

              {/* FIELD 1: EEG ACTIVITY (Primary Voltage) - Right aligned numerical */}
              <th
                onClick={() => handleSort('field1')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#0F172A]">EEG ACTIVITY</span>
                  <span className="text-[10px] text-[#64748B] font-normal">[µV]</span>
                  {renderSortIcon('field1')}
                </div>
              </th>

              {/* FIELD 2: EOG Activity - Right aligned numerical */}
              <th
                onClick={() => handleSort('field2')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#0D9488]">EOG Activity</span>
                  <span className="text-[10px] text-[#64748B] font-normal">[µV]</span>
                  {renderSortIcon('field2')}
                </div>
              </th>

              {/* FIELD 3: Eye Movements - Right aligned numerical */}
              <th
                onClick={() => handleSort('field3')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#D97706]">Eye Moves</span>
                  <span className="text-[10px] text-[#64748B] font-normal">[ev]</span>
                  {renderSortIcon('field3')}
                </div>
              </th>

              {/* FIELD 4: EEG Artifacts - Right aligned numerical */}
              <th
                onClick={() => handleSort('field4')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#DC2626]">Artifacts</span>
                  <span className="text-[10px] text-[#64748B] font-normal">[flags]</span>
                  {renderSortIcon('field4')}
                </div>
              </th>

              {/* FIELD 5: Total Samples - Right aligned numerical */}
              <th
                onClick={() => handleSort('field5')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#6366F1]">Clock Samples</span>
                  {renderSortIcon('field5')}
                </div>
              </th>

              {/* FIELD 6: Recording Time - Right aligned numerical */}
              <th
                onClick={() => handleSort('field6')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors whitespace-nowrap font-semibold text-right group"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[#475569]">Rec Time</span>
                  <span className="text-[10px] text-[#64748B] font-normal">[s]</span>
                  {renderSortIcon('field6')}
                </div>
              </th>
            </tr>
          </thead>

          {/* TABLE BODY WITH SUBTLE TRANSITION */}
          <tbody key={transitionKey} className="divide-y divide-[#F1F5F9] bg-white">
            {paginatedFeeds.length > 0 ? (
              paginatedFeeds.map(item => {
                const artifacts = item.field4 ? parseFloat(item.field4) : 0;
                const eyeMoves = item.field3 ? parseFloat(item.field3) : 0;
                const eegNum = item.field1 ? parseFloat(item.field1) : null;
                const eogNum = item.field2 ? parseFloat(item.field2) : null;
                const hasArtifact = !isNaN(artifacts) && artifacts > 0;
                const hasEyeMove = !isNaN(eyeMoves) && eyeMoves > 0;

                return (
                  <tr
                    key={item.entry_id}
                    className={`transition-colors text-[#0F172A] ${
                      hasArtifact
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Entry ID: Visually secondary */}
                    <td className="py-2 px-3.5 text-[#64748B] text-[11px] font-mono whitespace-nowrap">
                      #{item.entry_id}
                    </td>

                    {/* Timestamp: Highly readable date and time */}
                    <td className="py-2 px-3.5 text-[#334155] whitespace-nowrap">
                      <span className="text-[#64748B] text-[11px]">
                        {item.created_at.substring(0, 10)}{' '}
                      </span>
                      <span className="text-[#0F172A] font-semibold text-xs">
                        {item.created_at.substring(11, 19)}
                      </span>
                      <span className="text-[#94A3B8] text-[10px] ml-1">UTC</span>
                    </td>

                    {/* EEG Activity (Right aligned numerical) */}
                    <td className="py-2 px-3.5 text-right font-semibold text-[#0F172A]">
                      {eegNum !== null && !isNaN(eegNum) ? (
                        <span className={Math.abs(eegNum) > 15 ? 'text-blue-700 font-bold' : ''}>
                          {eegNum.toFixed(2)}
                        </span>
                      ) : (
                        item.field1 ?? '—'
                      )}
                    </td>

                    {/* EOG Activity (Right aligned numerical) */}
                    <td className="py-2 px-3.5 text-right text-[#0D9488] font-medium">
                      {eogNum !== null && !isNaN(eogNum) ? eogNum.toFixed(2) : item.field2 ?? '—'}
                    </td>

                    {/* Eye Movements (Right aligned numerical + highlighted badge if > 0) */}
                    <td className="py-2 px-3.5 text-right">
                      {hasEyeMove ? (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                          {item.field3}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] text-[11px]">{item.field3 ?? '0'}</span>
                      )}
                    </td>

                    {/* Artifact Highlighting (Right aligned numerical + medical crimson badge if > 0) */}
                    <td className="py-2 px-3.5 text-right">
                      {hasArtifact ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          <span>{item.field4}</span>
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] text-[11px]">{item.field4 ?? '0'}</span>
                      )}
                    </td>

                    {/* Total Samples (Right aligned numerical) */}
                    <td className="py-2 px-3.5 text-right text-[#64748B] text-[11px]">
                      {item.field5 ? Number(item.field5).toLocaleString() : '—'}
                    </td>

                    {/* Recording Time (Right aligned numerical) */}
                    <td className="py-2 px-3.5 text-right text-[#475569] text-[11px]">
                      {item.field6 ? `${item.field6}s` : '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-14 text-center text-[#64748B]">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Database className="w-6 h-6 text-[#94A3B8]" />
                    <p className="text-xs font-mono font-medium text-[#475569]">
                      No telemetry entries match your current search and filter criteria.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-[#2563EB] hover:underline font-mono font-medium pt-1"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3. PAGINATION & PAGE JUMPER FOOTER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono shadow-2xs">
        {/* Left: Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[#64748B] text-[11px] font-medium">Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs shadow-2xs focus:outline-none focus:border-[#2563EB]"
          >
            {[15, 25, 50, 100, 250, 500].map(sz => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
          <span className="text-[#64748B] text-[11px] hidden sm:inline">
            Showing {(validCurrentPage - 1) * pageSize + 1} &ndash;{' '}
            {Math.min(validCurrentPage * pageSize, filteredFeeds.length).toLocaleString()} of{' '}
            {filteredFeeds.length.toLocaleString()}
          </span>
        </div>

        {/* Center: Page Jumper */}
        <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1.5">
          <span className="text-[#64748B] text-[11px]">Go to page:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder={String(validCurrentPage)}
            value={pageJumperVal}
            onChange={e => setPageJumperVal(e.target.value)}
            className="w-14 px-2 py-0.8 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs text-center shadow-2xs focus:outline-none focus:border-[#2563EB]"
          />
          <button
            type="submit"
            className="px-2 py-0.8 rounded bg-white hover:bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] text-[11px] font-medium shadow-2xs transition-colors"
          >
            Go
          </button>
        </form>

        {/* Right: Page Navigation buttons */}
        <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2E8F0]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage <= 1}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] disabled:opacity-30 disabled:pointer-events-none shadow-2xs transition-colors active:scale-95"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validCurrentPage <= 1}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] disabled:opacity-30 disabled:pointer-events-none shadow-2xs transition-colors active:scale-95"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <span className="px-2 sm:px-3 py-1 text-[#0F172A] font-semibold text-xs text-center">
            {validCurrentPage} / {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validCurrentPage >= totalPages}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] disabled:opacity-30 disabled:pointer-events-none shadow-2xs transition-colors active:scale-95"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage >= totalPages}
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] disabled:opacity-30 disabled:pointer-events-none shadow-2xs transition-colors active:scale-95"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
