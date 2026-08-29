import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ThingSpeakFeedItem, ChannelFieldDefinition } from '../types';
import { decimateWaveformForCanvas, formatDateTime } from '../utils/eegCalculations';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  Sliders,
  ChevronDown,
  Activity,
  Clock,
  Crosshair,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EEGWaveformCanvasProps {
  feeds: ThingSpeakFeedItem[];
  channels: ChannelFieldDefinition[];
  height?: number;
  initialMode?: 'stacked' | 'overlay';
  showControls?: boolean;
  gain?: number;
  onGainChange?: (gain: number) => void;
  onToggleChannel?: (fieldKey: string) => void;
}

export interface CanvasLayoutMetrics {
  isMobile: boolean;
  isTablet: boolean;
  labelWidth: number;
  yAxisWidth: number;
  gutter: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  canvasH: number;
  plotW: number;
  plotH: number;
}

/**
 * Dynamically computes collision-free responsive layout metrics for the EEG canvas.
 * - Dedicated Channel Label Area: fixed-width, responsive [0 ... labelWidth]
 * - Dedicated Y-Axis Area: scale bracket and numeric values [labelWidth ... padLeft]
 * - Dedicated Waveform Area: strictly [padLeft ... width - padRight]
 */
export function getCanvasLayoutMetrics(width: number, height: number): CanvasLayoutMetrics {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Dedicated Channel Label Column
  // Mobile: 100px-125px; Tablet: 145px-180px; Desktop: 180px-230px
  const labelWidth = isMobile
    ? Math.max(92, Math.min(125, Math.floor(width * 0.22)))
    : isTablet
    ? Math.max(145, Math.min(180, Math.floor(width * 0.17)))
    : Math.max(175, Math.min(230, Math.floor(width * 0.16)));

  // Dedicated Y-Axis Scale Column (for calibration bracket, ticks and scale values)
  const yAxisWidth = isMobile ? 44 : 54;
  const gutter = 8;

  // Waveform start X (strictly separated from labels and Y-axis)
  const padLeft = labelWidth + yAxisWidth + gutter;
  const padRight = isMobile ? 16 : 24;
  const padTop = 26;
  const padBottom = 42;

  const canvasH = isMobile ? Math.min(height, 380) : height;
  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, canvasH - padTop - padBottom);

  return {
    isMobile,
    isTablet,
    labelWidth,
    yAxisWidth,
    gutter,
    padLeft,
    padRight,
    padTop,
    padBottom,
    canvasH,
    plotW,
    plotH,
  };
}

/**
 * Wraps text into lines based on canvas context font and maximum width.
 * Prevents truncating channel names.
 */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        // Last line: append remaining text
        const remaining = words.slice(i).join(' ');
        lines.push(remaining);
        currentLine = '';
        break;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [text];
}

export const EEGWaveformCanvas: React.FC<EEGWaveformCanvasProps> = ({
  feeds,
  channels,
  height = 540,
  initialMode = 'stacked',
  showControls = true,
  gain: externalGain,
  onGainChange,
  onToggleChannel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelDropdownRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'stacked' | 'overlay'>(initialMode);
  const [internalGain, setInternalGain] = useState<number>(1);
  const currentGain = externalGain !== undefined ? externalGain : internalGain;

  // Active time window preset (e.g. 'all', '30s', '2m', '5m', '15m')
  const [activeWindowPreset, setActiveWindowPreset] = useState<string>('all');

  // Channel dropdown popover toggle
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState<boolean>(false);

  // Zoom & Pan state (range index in feeds)
  const [viewRange, setViewRange] = useState<{ startIdx: number; endIdx: number }>({
    startIdx: 0,
    endIdx: Math.max(0, feeds.length - 1),
  });

  const isFullRangeRef = useRef(true);

  // Channel transition weights for smooth 300ms transitions
  const channelAlphasRef = useRef<Record<string, number>>({});
  const animFrameRef = useRef<number | null>(null);

  // Initialize alphas
  useEffect(() => {
    channels.forEach(ch => {
      if (channelAlphasRef.current[ch.fieldKey] === undefined) {
        channelAlphasRef.current[ch.fieldKey] = ch.visible ? 1 : 0;
      }
    });
  }, [channels]);

  // Close channel dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        channelDropdownRef.current &&
        !channelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsChannelDropdownOpen(false);
      }
    };
    if (isChannelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChannelDropdownOpen]);

  // Keep viewRange synced when feeds length changes
  useEffect(() => {
    if (feeds.length > 0) {
      setViewRange(prev => {
        if (isFullRangeRef.current || prev.endIdx === 0) {
          return { startIdx: 0, endIdx: feeds.length - 1 };
        }
        return {
          startIdx: Math.min(prev.startIdx, Math.max(0, feeds.length - 2)),
          endIdx: Math.min(prev.endIdx, feeds.length - 1),
        };
      });
    }
  }, [feeds.length]);

  // Hover Crosshair state
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    feedItem: ThingSpeakFeedItem;
    feedIdx: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartRange, setDragStartRange] = useState<{ startIdx: number; endIdx: number }>({
    startIdx: 0,
    endIdx: 0,
  });

  // Touch gesture state (1-finger pan, 2-finger pinch)
  const touchStateRef = useRef<{
    isPinching: boolean;
    initialDistance: number;
    initialSpan: number;
    initialCenter: number;
    lastTouchX: number;
    touchStartTime: number;
    touchStartX: number;
  }>({
    isPinching: false,
    initialDistance: 0,
    initialSpan: 0,
    initialCenter: 0,
    lastTouchX: 0,
    touchStartTime: 0,
    touchStartX: 0,
  });

  // Responsive height calculation for mobile
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Slice feeds based on view range
  const visibleFeeds = useMemo(() => {
    if (!feeds || feeds.length === 0) return [];
    const start = Math.max(0, Math.min(viewRange.startIdx, feeds.length - 1));
    const end = Math.max(start + 1, Math.min(viewRange.endIdx + 1, feeds.length));
    return feeds.slice(start, end);
  }, [feeds, viewRange]);

  // Downsample visible feeds for high-performance canvas rendering (cap at 1400 buckets)
  const decimated = useMemo(() => {
    return decimateWaveformForCanvas(visibleFeeds, 1400);
  }, [visibleFeeds]);

  // Most recent feed for idle inspection display
  const latestFeed = feeds.length > 0 ? feeds[feeds.length - 1] : null;

  // Draw on canvas with Clinical Grade Aesthetic and smooth channel alpha interpolation
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const layout = getCanvasLayoutMetrics(width, height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(layout.canvasH * dpr);
    ctx.scale(dpr, dpr);

    // 1. Pure Clinical White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, layout.canvasH);

    // Filter channels with non-zero alpha weight
    const renderingChannels = channels.filter(ch => {
      const alpha = channelAlphasRef.current[ch.fieldKey] ?? (ch.visible ? 1 : 0);
      return alpha > 0.01;
    });

    if (decimated.indices.length === 0 || renderingChannels.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        'No active channels selected or no data points in this time window.',
        width / 2,
        layout.canvasH / 2
      );
      return;
    }

    const nPoints = decimated.indices.length;

    // 2. Vertical Grid & Reticle within Waveform Plot Area
    const vStepPx = layout.isMobile ? 100 : 140;
    const numVLines = Math.floor(layout.plotW / vStepPx);
    ctx.lineWidth = 1;
    for (let i = 1; i <= numVLines; i++) {
      const vx = layout.padLeft + (i / (numVLines + 1)) * layout.plotW;
      ctx.strokeStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(vx, layout.padTop);
      ctx.lineTo(vx, layout.padTop + layout.plotH);
      ctx.stroke();
    }

    // 3. Render Modes: Stacked Montage vs Overlay
    if (mode === 'stacked') {
      const totalWeight = renderingChannels.reduce((sum, ch) => {
        return sum + (channelAlphasRef.current[ch.fieldKey] ?? 1);
      }, 0) || 1;

      let currentTop = layout.padTop;

      // Draw subtle vertical dividing column borders:
      // A) Line separating Channel Labels from Y-Axis
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(layout.labelWidth, layout.padTop);
      ctx.lineTo(layout.labelWidth, layout.padTop + layout.plotH);
      ctx.stroke();

      // B) Line marking start of Waveform area
      ctx.strokeStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.moveTo(layout.padLeft, layout.padTop);
      ctx.lineTo(layout.padLeft, layout.padTop + layout.plotH);
      ctx.stroke();

      renderingChannels.forEach((ch) => {
        const alpha = channelAlphasRef.current[ch.fieldKey] ?? 1;
        const rawTrackH = (layout.plotH / totalWeight) * alpha;
        const trackTop = currentTop;
        const trackBottom = trackTop + rawTrackH;
        const trackMid = trackTop + rawTrackH / 2;
        currentTop += rawTrackH;

        if (rawTrackH < 12 || alpha <= 0.02) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        // Track Horizontal Separator across the entire chart
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, trackBottom);
        ctx.lineTo(width - layout.padRight, trackBottom);
        ctx.stroke();

        // Baseline (zero-reference dotted axis) within Waveform area
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(layout.padLeft, trackMid);
        ctx.lineTo(width - layout.padRight, trackMid);
        ctx.stroke();
        ctx.setLineDash([]);

        // Calculate min/max for this channel
        const rawVals = decimated.values[ch.fieldKey] || [];
        let cMin = Infinity;
        let cMax = -Infinity;
        for (let i = 0; i < rawVals.length; i++) {
          const v = rawVals[i];
          if (v !== null && !isNaN(v)) {
            if (v < cMin) cMin = v;
            if (v > cMax) cMax = v;
          }
        }

        if (cMin === Infinity) {
          cMin = -10;
          cMax = 10;
        }
        if (cMin === cMax) {
          cMin -= 1;
          cMax += 1;
        }

        const span = (cMax - cMin) / currentGain;
        const midVal = (cMin + cMax) / 2;

        const isPrimaryEEG = ch.fieldKey === 'field1';
        const traceColor = isPrimaryEEG ? '#0F172A' : ch.color;

        // =========================================================================
        // ZONE 1: FIXED-WIDTH CHANNEL LABEL AREA [0 ... labelWidth]
        // =========================================================================
        // Channel color pip
        const pipH = Math.min(20, Math.max(12, rawTrackH * 0.45));
        ctx.fillStyle = traceColor;
        ctx.fillRect(8, trackMid - pipH / 2, 3.5, pipH);

        // Channel title (wrapped to prevent truncation and avoid collision)
        ctx.fillStyle = '#0F172A';
        ctx.font = layout.isMobile
          ? 'bold 9.5px JetBrains Mono, monospace'
          : 'bold 10.5px JetBrains Mono, monospace';
        ctx.textAlign = 'left';

        const maxTitleWidth = layout.labelWidth - 20;
        const titleLines = wrapTextLines(ctx, ch.label, maxTitleWidth, 2);

        if (titleLines.length === 1) {
          ctx.fillText(titleLines[0], 16, trackMid - 3);
        } else {
          ctx.fillText(titleLines[0], 16, trackMid - 8);
          ctx.fillText(titleLines[1], 16, trackMid + 3);
        }

        // Channel Metadata & unit (field1 • µV)
        ctx.fillStyle = '#64748B';
        ctx.font = '8.5px JetBrains Mono, monospace';
        const metaY = trackMid + (titleLines.length > 1 ? 14 : 9);
        if (metaY < trackBottom - 2) {
          ctx.fillText(`${ch.fieldKey} • ${ch.unit}`, 16, metaY);
        }

        // =========================================================================
        // ZONE 2: FIXED-WIDTH Y-AXIS SCALE AREA [labelWidth ... padLeft]
        // =========================================================================
        // Increased vertical padding inside each track to prevent adjacent waveforms collision
        const trackPlotPadY = Math.max(6, Math.min(14, rawTrackH * 0.12));
        const bracketX = layout.padLeft - 6;

        // Calibration scale tick bracket
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Top tick
        ctx.moveTo(bracketX - 3, trackTop + trackPlotPadY);
        ctx.lineTo(bracketX, trackTop + trackPlotPadY);
        // Vertical bracket spine
        ctx.lineTo(bracketX, trackBottom - trackPlotPadY);
        // Bottom tick
        ctx.lineTo(bracketX - 3, trackBottom - trackPlotPadY);
        // Center mid tick
        ctx.moveTo(bracketX - 3, trackMid);
        ctx.lineTo(bracketX, trackMid);
        ctx.stroke();

        // Track Y-scale numeric ticks (+Peak, 0, -Peak) - strictly right aligned within Y-axis area
        ctx.fillStyle = '#64748B';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        const textRightX = layout.padLeft - 10;
        ctx.fillText(cMax.toFixed(1), textRightX, trackTop + trackPlotPadY + 4);
        ctx.fillText(cMin.toFixed(1), textRightX, trackBottom - trackPlotPadY - 1);

        // =========================================================================
        // ZONE 3: DEDICATED CLIPPED WAVEFORM AREA [padLeft ... width - padRight]
        // =========================================================================
        ctx.save();
        // Clip strictly within waveform bounding box so signals never bleed into labels or Y-axis
        ctx.beginPath();
        ctx.rect(layout.padLeft, trackTop + 1, layout.plotW, rawTrackH - 2);
        ctx.clip();

        // Draw Clinical Waveform Trace
        ctx.strokeStyle = traceColor;
        ctx.lineWidth = isPrimaryEEG ? 1.5 : 1.3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let hasStarted = false;
        let hoverPointY: number | null = null;
        const amplitudeScale = (rawTrackH / 2 - trackPlotPadY) * 0.88;

        for (let i = 0; i < nPoints; i++) {
          const v = rawVals[i];
          if (v === null || isNaN(v)) continue;

          const x = layout.padLeft + (i / Math.max(1, nPoints - 1)) * layout.plotW;
          const normalized = (v - midVal) / (span || 1);
          const y = trackMid - normalized * amplitudeScale;
          const clampedY = Math.max(trackTop + 2, Math.min(trackBottom - 2, y));

          if (!hasStarted) {
            ctx.moveTo(x, clampedY);
            hasStarted = true;
          } else {
            ctx.lineTo(x, clampedY);
          }

          if (
            hoverInfo &&
            Math.abs(x - hoverInfo.x) <= Math.max(2, layout.plotW / Math.max(1, nPoints))
          ) {
            hoverPointY = clampedY;
          }
        }
        ctx.stroke();

        // Draw precision point on waveform at crosshair position
        if (hoverInfo && hoverPointY !== null) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = traceColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hoverInfo.x, hoverPointY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore(); // Restore clipping
        ctx.restore(); // Restore track alpha
      });
    } else {
      // 4. OVERLAY MODE
      let gMin = Infinity;
      let gMax = -Infinity;

      renderingChannels.forEach(ch => {
        const vals = decimated.values[ch.fieldKey] || [];
        for (let i = 0; i < vals.length; i++) {
          const v = vals[i];
          if (v !== null && !isNaN(v)) {
            if (v < gMin) gMin = v;
            if (v > gMax) gMax = v;
          }
        }
      });

      if (gMin === Infinity) {
        gMin = -10;
        gMax = 10;
      }
      if (gMin === gMax) {
        gMin -= 1;
        gMax += 1;
      }

      const gSpan = (gMax - gMin) / currentGain;
      const gMid = (gMin + gMax) / 2;

      // Divider line separating Left column from Waveform
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(layout.labelWidth, layout.padTop);
      ctx.lineTo(layout.labelWidth, layout.padTop + layout.plotH);
      ctx.stroke();

      // Draw horizontal grid lines across waveform
      const gridSteps = 6;
      for (let s = 0; s <= gridSteps; s++) {
        const gy = layout.padTop + (layout.plotH * s) / gridSteps;
        const isCenter = s === Math.round(gridSteps / 2);

        ctx.strokeStyle = isCenter ? '#CBD5E1' : '#F8FAFC';
        ctx.lineWidth = 1;
        if (isCenter) ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(layout.padLeft, gy);
        ctx.lineTo(width - layout.padRight, gy);
        ctx.stroke();
        if (isCenter) ctx.setLineDash([]);

        const gridVal = gMax - (gSpan * s) / gridSteps;
        ctx.fillStyle = '#64748B';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(gridVal.toFixed(1), layout.padLeft - 10, gy + 3);
      }

      // Draw overlay waveforms clipped strictly within waveform area
      ctx.save();
      ctx.beginPath();
      ctx.rect(layout.padLeft, layout.padTop, layout.plotW, layout.plotH);
      ctx.clip();

      renderingChannels.forEach(ch => {
        const alpha = channelAlphasRef.current[ch.fieldKey] ?? 1;
        if (alpha <= 0.02) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        const vals = decimated.values[ch.fieldKey] || [];
        const isPrimaryEEG = ch.fieldKey === 'field1';
        const traceColor = isPrimaryEEG ? '#0F172A' : ch.color;

        ctx.strokeStyle = traceColor;
        ctx.lineWidth = isPrimaryEEG ? 1.6 : 1.3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let hasStarted = false;
        let hoverPointY: number | null = null;

        for (let i = 0; i < nPoints; i++) {
          const v = vals[i];
          if (v === null || isNaN(v)) continue;

          const x = layout.padLeft + (i / Math.max(1, nPoints - 1)) * layout.plotW;
          const y = layout.padTop + layout.plotH / 2 - ((v - gMid) / (gSpan || 1)) * (layout.plotH * 0.44);
          const clampedY = Math.max(layout.padTop + 2, Math.min(layout.padTop + layout.plotH - 2, y));

          if (!hasStarted) {
            ctx.moveTo(x, clampedY);
            hasStarted = true;
          } else {
            ctx.lineTo(x, clampedY);
          }

          if (
            hoverInfo &&
            Math.abs(x - hoverInfo.x) <= Math.max(2, layout.plotW / Math.max(1, nPoints))
          ) {
            hoverPointY = clampedY;
          }
        }
        ctx.stroke();

        // Dot at crosshair
        if (hoverInfo && hoverPointY !== null) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = traceColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hoverInfo.x, hoverPointY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      });

      ctx.restore(); // restore overlay clip

      // Overlay Channel Legend (in dedicated left column)
      let legY = layout.padTop + 6;
      renderingChannels.forEach((ch) => {
        const isPrimary = ch.fieldKey === 'field1';
        const color = isPrimary ? '#0F172A' : ch.color;
        if (legY + 22 <= layout.padTop + layout.plotH) {
          ctx.fillStyle = color;
          ctx.fillRect(8, legY + 2, 3, 14);
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 9.5px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          const titleLines = wrapTextLines(ctx, ch.label, layout.labelWidth - 20, 1);
          ctx.fillText(titleLines[0] || ch.label, 16, legY + 10);
          ctx.fillStyle = '#64748B';
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillText(`${ch.fieldKey} • ${ch.unit}`, 16, legY + 20);
          legY += 28;
        }
      });
    }

    // 5. Time Axis (Bottom X-axis)
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.padLeft, layout.padTop + layout.plotH);
    ctx.lineTo(width - layout.padRight, layout.padTop + layout.plotH);
    ctx.stroke();

    let fontSize = 9;
    ctx.font = `${fontSize}px JetBrains Mono, monospace`;
    const sampleStr = "00:00:00 UTC";
    let labelW = ctx.measureText(sampleStr).width;
    const minSpacing = 16;
    const sidePadding = 8;
    
    let firstTx = layout.padLeft + labelW / 2 + sidePadding;
    let lastTx = (width - layout.padRight) - labelW / 2 - sidePadding;
    
    if (lastTx < firstTx) {
       fontSize = 7;
       ctx.font = `${fontSize}px JetBrains Mono, monospace`;
       labelW = ctx.measureText(sampleStr).width;
       firstTx = layout.padLeft + labelW / 2 + sidePadding;
       lastTx = (width - layout.padRight) - labelW / 2 - sidePadding;
    }

    let txPositions: number[] = [];
    if (lastTx <= firstTx) {
      txPositions = [ layout.padLeft + layout.plotW / 2 ];
    } else {
      const availableSpace = lastTx - firstTx;
      let intervals = Math.floor(availableSpace / (labelW + minSpacing));
      const maxAllowedIntervals = layout.isMobile ? 3 : 6;
      if (intervals > maxAllowedIntervals) intervals = maxAllowedIntervals;
      if (intervals < 1) intervals = 1;
      
      for (let i = 0; i <= intervals; i++) {
        txPositions.push(firstTx + (availableSpace * i) / intervals);
      }
    }

    for (const tx of txPositions) {
      ctx.strokeStyle = '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(tx, layout.padTop + layout.plotH);
      ctx.lineTo(tx, layout.padTop + layout.plotH + 4);
      ctx.stroke();

      const normalizedX = Math.max(0, Math.min(1, (tx - layout.padLeft) / layout.plotW));
      const sampleIdx = Math.floor(normalizedX * (decimated.timestamps.length - 1));
      const timeStr = decimated.timestamps[sampleIdx];
      
      if (timeStr) {
        ctx.fillStyle = '#64748B';
        ctx.font = `${fontSize}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(timeStr.substring(11, 19) + ' UTC', tx, layout.padTop + layout.plotH + 16);
      }
    }

    // 6. Timebase Annotation (Bottom Right)
    if (!layout.isMobile) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `Timebase: ~20s/sample • Window: ${visibleFeeds.length} samples`,
        width - layout.padRight - 2,
        layout.padTop + layout.plotH + 30
      );
    }

    // 7. Interactive Crosshair Line
    if (hoverInfo && hoverInfo.x >= layout.padLeft && hoverInfo.x <= width - layout.padRight) {
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverInfo.x, layout.padTop);
      ctx.lineTo(hoverInfo.x, layout.padTop + layout.plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      const hoverTime = hoverInfo.feedItem.created_at.substring(11, 19) + ' UTC';
      const badgeW = 76;
      const badgeX = Math.max(
        layout.padLeft,
        Math.min(hoverInfo.x - badgeW / 2, width - layout.padRight - badgeW)
      );

      ctx.fillStyle = '#2563EB';
      ctx.fillRect(badgeX, layout.padTop + layout.plotH + 2, badgeW, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hoverTime, badgeX + badgeW / 2, layout.padTop + layout.plotH + 12);
    }
  }, [decimated, channels, mode, currentGain, height, hoverInfo, latestFeed]);

  // Channel alpha transition loop (300ms smooth animation)
  useEffect(() => {
    let startTime: number | null = null;
    const duration = 300;
    const initialAlphas: Record<string, number> = { ...channelAlphasRef.current };
    const targetAlphas: Record<string, number> = {};

    channels.forEach(ch => {
      targetAlphas[ch.fieldKey] = ch.visible ? 1 : 0;
      if (initialAlphas[ch.fieldKey] === undefined) {
        initialAlphas[ch.fieldKey] = ch.visible ? 1 : 0;
      }
    });

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      let isStillAnimating = false;

      channels.forEach(ch => {
        const start = initialAlphas[ch.fieldKey] ?? 0;
        const target = targetAlphas[ch.fieldKey] ?? 0;
        const current = start + (target - start) * ease;
        channelAlphasRef.current[ch.fieldKey] = current;

        if (Math.abs(current - target) > 0.005 && progress < 1) {
          isStillAnimating = true;
        } else if (progress >= 1) {
          channelAlphasRef.current[ch.fieldKey] = target;
        }
      });

      draw();

      if (isStillAnimating && progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [channels, draw]);

  // ResizeObserver for clean responsive redraw
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animFrame: number;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => draw());
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrame);
    };
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse Interaction handlers for Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    isFullRangeRef.current = false;
    setDragStartX(e.clientX);
    setDragStartRange({ ...viewRange });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const layout = getCanvasLayoutMetrics(rect.width, height);

    // Drag to pan
    if (isDragging && feeds.length > 1) {
      const deltaX = e.clientX - dragStartX;
      const rangeSpan = dragStartRange.endIdx - dragStartRange.startIdx;
      const indexShift = Math.round((-deltaX / layout.plotW) * rangeSpan);

      let newStart = dragStartRange.startIdx + indexShift;
      let newEnd = dragStartRange.endIdx + indexShift;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd >= feeds.length) {
        const excess = newEnd - (feeds.length - 1);
        newStart = Math.max(0, newStart - excess);
        newEnd = feeds.length - 1;
      }

      setViewRange({ startIdx: newStart, endIdx: newEnd });
      setActiveWindowPreset('custom');
      return;
    }

    // Hover crosshair
    if (mouseX >= layout.padLeft && mouseX <= rect.width - layout.padRight && visibleFeeds.length > 0) {
      const ratio = (mouseX - layout.padLeft) / layout.plotW;
      const feedIdx = Math.min(
        visibleFeeds.length - 1,
        Math.max(0, Math.round(ratio * (visibleFeeds.length - 1)))
      );
      setHoverInfo({
        x: mouseX,
        y: mouseY,
        feedItem: visibleFeeds[feedIdx],
        feedIdx,
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for Mobile 1-finger Pan & 2-finger Pinch Zoom & Tap Inspect
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 1) {
      // Single touch pan or tap
      const touch = e.touches[0];
      const clientX = touch.clientX;

      touchStateRef.current = {
        isPinching: false,
        initialDistance: 0,
        initialSpan: viewRange.endIdx - viewRange.startIdx,
        initialCenter: Math.round((viewRange.startIdx + viewRange.endIdx) / 2),
        lastTouchX: clientX,
        touchStartTime: Date.now(),
        touchStartX: clientX,
      };

      setIsDragging(true);
      isFullRangeRef.current = false;
      setDragStartX(clientX);
      setDragStartRange({ ...viewRange });
    } else if (e.touches.length >= 2) {
      // 2-finger pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      touchStateRef.current = {
        isPinching: true,
        initialDistance: Math.max(10, dist),
        initialSpan: viewRange.endIdx - viewRange.startIdx,
        initialCenter: Math.round((viewRange.startIdx + viewRange.endIdx) / 2),
        lastTouchX: (t1.clientX + t2.clientX) / 2,
        touchStartTime: Date.now(),
        touchStartX: (t1.clientX + t2.clientX) / 2,
      };

      setIsDragging(false);
      isFullRangeRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || feeds.length <= 1) return;

    const rect = canvas.getBoundingClientRect();
    const layout = getCanvasLayoutMetrics(rect.width, height);

    if (e.touches.length === 1 && !touchStateRef.current.isPinching) {
      const touch = e.touches[0];
      const clientX = touch.clientX;
      const deltaX = clientX - dragStartX;
      const rangeSpan = dragStartRange.endIdx - dragStartRange.startIdx;
      const indexShift = Math.round((-deltaX / layout.plotW) * rangeSpan);

      let newStart = dragStartRange.startIdx + indexShift;
      let newEnd = dragStartRange.endIdx + indexShift;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd >= feeds.length) {
        const excess = newEnd - (feeds.length - 1);
        newStart = Math.max(0, newStart - excess);
        newEnd = feeds.length - 1;
      }

      setViewRange({ startIdx: newStart, endIdx: newEnd });
      setActiveWindowPreset('custom');
    } else if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const initialDist = touchStateRef.current.initialDistance || currentDist;

      if (initialDist > 0) {
        const scale = initialDist / Math.max(10, currentDist);
        const newSpan = Math.max(
          10,
          Math.min(feeds.length - 1, Math.round(touchStateRef.current.initialSpan * scale))
        );
        const center = touchStateRef.current.initialCenter;

        let newStart = Math.max(0, center - Math.floor(newSpan / 2));
        let newEnd = Math.min(feeds.length - 1, newStart + newSpan);

        if (newEnd >= feeds.length - 1) {
          newStart = Math.max(0, feeds.length - 1 - newSpan);
        }

        setViewRange({ startIdx: newStart, endIdx: newEnd });
        setActiveWindowPreset('custom');
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    setIsDragging(false);

    // Check if it was a quick tap (< 250ms and < 8px movement) to inspect
    const state = touchStateRef.current;
    const duration = Date.now() - state.touchStartTime;

    if (canvas && duration < 250 && !state.isPinching && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const moveDist = Math.abs(touch.clientX - state.touchStartX);
      if (moveDist < 10) {
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const layout = getCanvasLayoutMetrics(rect.width, height);

        if (touchX >= layout.padLeft && touchX <= rect.width - layout.padRight && visibleFeeds.length > 0) {
          const ratio = (touchX - layout.padLeft) / layout.plotW;
          const feedIdx = Math.min(
            visibleFeeds.length - 1,
            Math.max(0, Math.round(ratio * (visibleFeeds.length - 1)))
          );
          setHoverInfo({
            x: touchX,
            y: touchY,
            feedItem: visibleFeeds[feedIdx],
            feedIdx,
          });
        }
      }
    }

    touchStateRef.current.isPinching = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (feeds.length <= 1) return;

    const zoomFactor = e.deltaY > 0 ? 1.25 : 0.8;
    zoomAt(zoomFactor);
  };

  const zoomAt = (factor: number) => {
    isFullRangeRef.current = false;
    setActiveWindowPreset('custom');
    const currentSpan = viewRange.endIdx - viewRange.startIdx;
    const newSpan = Math.max(10, Math.min(feeds.length - 1, Math.round(currentSpan * factor)));
    const center = Math.round((viewRange.startIdx + viewRange.endIdx) / 2);

    let newStart = Math.max(0, center - Math.floor(newSpan / 2));
    let newEnd = Math.min(feeds.length - 1, newStart + newSpan);

    if (newEnd >= feeds.length - 1) {
      newStart = Math.max(0, feeds.length - 1 - newSpan);
    }

    setViewRange({ startIdx: newStart, endIdx: newEnd });
  };

  const resetZoom = () => {
    isFullRangeRef.current = true;
    setActiveWindowPreset('all');
    setViewRange({ startIdx: 0, endIdx: Math.max(0, feeds.length - 1) });
    setInternalGain(1);
    onGainChange?.(1);
  };

  const setTimePreset = (samplesCount: number, presetKey: string) => {
    if (feeds.length === 0) return;
    isFullRangeRef.current = false;
    setActiveWindowPreset(presetKey);
    const end = feeds.length - 1;
    const start = Math.max(0, end - samplesCount);
    setViewRange({ startIdx: start, endIdx: end });
  };

  const currentInspectItem = hoverInfo ? hoverInfo.feedItem : latestFeed;
  const activeChannels = channels.filter(c => c.visible);

  return (
    <div
      id="eeg-waveform-container"
      className="relative flex flex-col w-full bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-xs"
    >
      {/* 1. COMPACT WAVEFORM TOOLBAR */}
      {showControls && (
        <div
          id="waveform-toolbar"
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-mono select-none"
        >
          {/* Left Group: Display Mode & Channels */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Display Mode: Stacked Montage vs Overlay */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-semibold">MODE:</span>
              <div className="flex rounded bg-white p-0.5 border border-[#CBD5E1] shadow-2xs">
                <button
                  id="btn-mode-stacked"
                  onClick={() => setMode('stacked')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                    mode === 'stacked'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                  title="Stacked Montage Strip (Independent channel tracks)"
                >
                  <Layers className="w-3 h-3" />
                  <span>Montage Stack</span>
                </button>
                <button
                  id="btn-mode-overlay"
                  onClick={() => setMode('overlay')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                    mode === 'overlay'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                  title="Overlaid Multi-Channel Coordinate System"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Overlay</span>
                </button>
              </div>
            </div>

            {/* Channels Selector Popover */}
            <div className="relative" ref={channelDropdownRef}>
              <button
                id="btn-toolbar-channels"
                onClick={() => setIsChannelDropdownOpen(!isChannelDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-[11px] font-medium shadow-2xs transition-all duration-200 active:scale-95"
                title="Toggle Active Telemetry Channels"
              >
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span>
                  Channels ({activeChannels.length}/{channels.length})
                </span>
                <ChevronDown className="w-3 h-3 text-[#64748B]" />
              </button>

              {/* Channel Dropdown Popover with smooth Animation */}
              <AnimatePresence>
                {isChannelDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 top-full mt-1 w-64 bg-white border border-[#CBD5E1] rounded-md shadow-lg p-2 z-40 space-y-1"
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[#E2E8F0] px-1 text-[10px] text-[#64748B] font-semibold uppercase">
                      <span>SELECT CHANNELS</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            channels.forEach(ch => {
                              if (!ch.visible) onToggleChannel?.(ch.fieldKey);
                            });
                          }}
                          className="text-[#2563EB] hover:underline"
                        >
                          All
                        </button>
                        <span>&bull;</span>
                        <button
                          onClick={() => {
                            channels.forEach(ch => {
                              const isPrimary =
                                ch.fieldKey === 'field1' || ch.fieldKey === 'field2';
                              if (ch.visible !== isPrimary) onToggleChannel?.(ch.fieldKey);
                            });
                          }}
                          className="text-[#2563EB] hover:underline"
                        >
                          EEG Only
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5 max-h-56 overflow-y-auto">
                      {channels.map(ch => (
                        <button
                          key={ch.fieldKey}
                          onClick={() => onToggleChannel?.(ch.fieldKey)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors text-[11px] ${
                            ch.visible
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] font-medium'
                              : 'text-[#64748B] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                              style={{
                                backgroundColor:
                                  ch.fieldKey === 'field1' ? '#0F172A' : ch.color,
                              }}
                            />
                            <span className="truncate">{ch.label}</span>
                            <span className="text-[9px] text-[#94A3B8]">({ch.fieldKey})</span>
                          </div>
                          {ch.visible ? (
                            <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                          ) : (
                            <span className="text-[9px] text-[#94A3B8] uppercase">Off</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center Group: Time Range Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#64748B] text-[10px] uppercase font-semibold">RANGE:</span>
            <div className="flex rounded bg-white p-0.5 border border-[#CBD5E1] shadow-2xs">
              {[
                { label: '30s', samples: 30, key: '30s' },
                { label: '2m', samples: 60, key: '2m' },
                { label: '5m', samples: 150, key: '5m' },
                { label: '15m', samples: 450, key: '15m' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setTimePreset(p.samples, p.key)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-all duration-150 active:scale-95 ${
                    activeWindowPreset === p.key
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={resetZoom}
                className={`px-2 py-0.5 rounded text-[11px] transition-all duration-150 active:scale-95 ${
                  activeWindowPreset === 'all'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                All ({feeds.length})
              </button>
            </div>
          </div>

          {/* Right Group: Zoom & Reset */}
          <div className="flex items-center gap-2">
            {/* Gain Selector */}
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#CBD5E1] shadow-2xs">
              <span className="text-[#64748B] text-[10px] uppercase font-semibold">GAIN:</span>
              {[0.5, 1, 2, 5].map(g => (
                <button
                  key={g}
                  onClick={() => {
                    setInternalGain(g);
                    onGainChange?.(g);
                  }}
                  className={`px-1.5 py-0.2 rounded text-[10px] transition-all duration-150 ${
                    currentGain === g
                      ? 'bg-[#0F172A] text-white font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {g}x
                </button>
              ))}
            </div>

            {/* Zoom In / Out Buttons */}
            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded border border-[#CBD5E1] shadow-2xs">
              <button
                id="btn-zoom-in"
                onClick={() => zoomAt(0.7)}
                className="p-1 rounded text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-150 active:scale-90"
                title="Zoom In (or mouse wheel)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                id="btn-zoom-out"
                onClick={() => zoomAt(1.4)}
                className="p-1 rounded text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-150 active:scale-90"
                title="Zoom Out (or mouse wheel)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset Button */}
            <button
              id="btn-reset-view"
              onClick={resetZoom}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-[11px] font-medium shadow-2xs transition-all duration-150 active:scale-95"
              title="Reset Zoom, Gain & Window to Full Dataset"
            >
              <RotateCcw className="w-3 h-3 text-[#64748B]" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. DOCKED CLINICAL TELEMETRY HUD */}
      <div
        id="waveform-hud"
        className="h-7 px-3 bg-[#FFFFFF] border-b border-[#E2E8F0] flex items-center justify-between text-[11px] font-mono select-none overflow-x-auto"
      >
        <div className="flex items-center gap-3 shrink-0">
          {hoverInfo ? (
            <div className="flex items-center gap-1.5 text-[#2563EB] font-semibold">
              <Crosshair className="w-3.5 h-3.5 animate-pulse text-[#2563EB]" />
              <span>INSPECTING ENTRY #{hoverInfo.feedItem.entry_id}</span>
              <span className="text-[#94A3B8] font-normal">&bull;</span>
              <span className="text-[#64748B] font-normal">
                {hoverInfo.feedItem.created_at.substring(0, 19).replace('T', ' ')} UTC
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#0F172A] font-medium">
              <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>LATEST PACKET #{latestFeed?.entry_id ?? '—'}</span>
              <span className="text-[#94A3B8] font-normal">&bull;</span>
              <span className="text-[#64748B] font-normal">
                {latestFeed ? latestFeed.created_at.substring(11, 19) + ' UTC' : '—'}
              </span>
            </div>
          )}
        </div>

        {/* Channel Values Strip */}
        <div className="flex items-center gap-3 shrink-0 text-[10px]">
          {activeChannels.map(ch => {
            const rawVal = currentInspectItem
              ? (currentInspectItem as any)[ch.fieldKey]
              : null;
            const numVal = rawVal !== null && rawVal !== undefined ? parseFloat(rawVal) : null;
            const formatted =
              numVal !== null && !isNaN(numVal) ? numVal.toFixed(2) : rawVal ?? '—';
            const isPrimary = ch.fieldKey === 'field1';

            return (
              <div key={ch.fieldKey} className="flex items-center gap-1 transition-opacity duration-200">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isPrimary ? '#0F172A' : ch.color }}
                />
                <span className="text-[#64748B]">{ch.label.substring(0, 8)}:</span>
                <span
                  className={`font-semibold ${
                    isPrimary ? 'text-[#0F172A]' : 'text-[#334155]'
                  }`}
                >
                  {formatted} {ch.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MAIN WAVEFORM CANVAS VIEWPORT */}
      <div
        ref={containerRef}
        className="relative w-full cursor-crosshair select-none bg-white overflow-hidden touch-none"
        style={{ height: `${containerWidth < 640 ? Math.min(height, 380) : height}px` }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoverInfo(null);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onWheel={handleWheel}
          className="w-full h-full block touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-1.5 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[11px] font-mono text-[#64748B]">
        <div className="flex items-center gap-2 sm:gap-3">
          <span>
            Window: <strong className="text-[#0F172A]">{visibleFeeds.length.toLocaleString()}</strong> of{' '}
            {feeds.length.toLocaleString()} points
          </span>
          <span className="hidden sm:inline text-[#CBD5E1]">&bull;</span>
          <span className="hidden sm:inline">
            Span: #{visibleFeeds[0]?.entry_id ?? 0} &rarr; #{visibleFeeds[visibleFeeds.length - 1]?.entry_id ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {visibleFeeds.length > 1400 ? (
            <span className="text-[#0F172A] bg-[#F1F5F9] px-1.5 py-0.2 rounded border border-[#E2E8F0] text-[10px]">
              Decimated (Raw data preserved)
            </span>
          ) : (
            <span className="text-[#16A34A] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px] font-medium">
              1:1 Full Sample Density
            </span>
          )}
          <span className="text-[#CBD5E1]">&bull;</span>
          <span className="hidden md:inline text-[#94A3B8]">Drag: Pan | Wheel: Zoom</span>
        </div>
      </div>
    </div>
  );
};
