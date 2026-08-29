import { ThingSpeakFeedItem, ChannelStatistics, DerivedSamplingInfo, ChannelFieldDefinition } from '../types';

/**
 * Calculates descriptive statistics for a specific channel field without modifying raw data.
 */
export function calculateFieldStats(
  feeds: ThingSpeakFeedItem[],
  fieldKey: string,
  label: string
): ChannelStatistics {
  let count = 0;
  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  let latest: number | null = null;
  const values: number[] = [];

  for (let i = 0; i < feeds.length; i++) {
    const rawVal = (feeds[i] as any)[fieldKey];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        values.push(num);
        count++;
        sum += num;
        if (min === null || num < min) min = num;
        if (max === null || num > max) max = num;
        latest = num;
      }
    }
  }

  if (count === 0) {
    return {
      fieldKey,
      label,
      count: 0,
      min: null,
      max: null,
      mean: null,
      stdDev: null,
      latest: null,
    };
  }

  const mean = sum / count;

  let varianceSum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mean;
    varianceSum += diff * diff;
  }
  const variance = count > 1 ? varianceSum / (count - 1) : 0;
  const stdDev = Math.sqrt(variance);

  return {
    fieldKey,
    label,
    count,
    min,
    max,
    mean: Number(mean.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    latest,
  };
}

/**
 * Computes descriptive statistics for all configured channels.
 */
export function calculateAllStats(
  feeds: ThingSpeakFeedItem[],
  channels: ChannelFieldDefinition[]
): Record<string, ChannelStatistics> {
  const result: Record<string, ChannelStatistics> = {};
  for (const ch of channels) {
    result[ch.fieldKey] = calculateFieldStats(feeds, ch.fieldKey, ch.label);
  }
  return result;
}

/**
 * Derives sampling information strictly from available telemetry data.
 * Does not invent an assumed EEG rate if it cannot be verified.
 */
export function deriveSamplingInformation(feeds: ThingSpeakFeedItem[]): DerivedSamplingInfo {
  if (!feeds || feeds.length === 0) {
    return {
      totalSamplesReported: null,
      recordingTimeSeconds: null,
      derivedSamplingRateHz: null,
      telemetryIntervalSeconds: null,
      telemetryRateHz: null,
      isReliablyDerived: false,
      notes: 'No telemetry samples available to calculate sampling metrics.',
    };
  }

  // 1. Calculate ThingSpeak packet upload interval
  let telemetryIntervalSeconds: number | null = null;
  let telemetryRateHz: number | null = null;

  if (feeds.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(feeds.length, 100); i++) {
      const t1 = new Date(feeds[i - 1].created_at).getTime();
      const t2 = new Date(feeds[i].created_at).getTime();
      const diffSec = (t2 - t1) / 1000;
      if (diffSec > 0 && diffSec < 3600) {
        intervals.push(diffSec);
      }
    }

    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      telemetryIntervalSeconds = Number(medianInterval.toFixed(2));
      telemetryRateHz = Number((1 / medianInterval).toFixed(4));
    }
  }

  // 2. Check if field5 is 'Total Samples' and field6 is 'Recording Time'
  let latestTotalSamples: number | null = null;
  let latestRecordingTime: number | null = null;

  for (let i = feeds.length - 1; i >= 0; i--) {
    const f5 = feeds[i].field5;
    const f6 = feeds[i].field6;
    if (f5 && !latestTotalSamples) {
      const num = parseFloat(f5);
      if (!isNaN(num)) latestTotalSamples = num;
    }
    if (f6 && !latestRecordingTime) {
      const num = parseFloat(f6);
      if (!isNaN(num)) latestRecordingTime = num;
    }
    if (latestTotalSamples && latestRecordingTime) break;
  }

  let derivedSamplingRateHz: number | null = null;
  let isReliablyDerived = false;
  let notes = '';

  if (latestTotalSamples && latestRecordingTime && latestRecordingTime > 0) {
    const rate = latestTotalSamples / latestRecordingTime;
    derivedSamplingRateHz = Number(rate.toFixed(2));
    isReliablyDerived = true;
    notes = `Derived hardware sampling rate of ${derivedSamplingRateHz} Hz based on ${latestTotalSamples.toLocaleString()} cumulative samples acquired over ${latestRecordingTime} seconds (Field 5 / Field 6). Telemetry reporting cadence to ThingSpeak is ${telemetryIntervalSeconds ?? '20'}s.`;
  } else if (telemetryIntervalSeconds) {
    notes = `Telemetry packet update cadence is ${telemetryIntervalSeconds}s (~${telemetryRateHz} Hz). Internal hardware sampling frequency cannot be determined without raw sample clock headers.`;
  } else {
    notes = 'Insufficient timestamps to derive transmission rate.';
  }

  return {
    totalSamplesReported: latestTotalSamples,
    recordingTimeSeconds: latestRecordingTime,
    derivedSamplingRateHz,
    telemetryIntervalSeconds,
    telemetryRateHz,
    isReliablyDerived,
    notes,
  };
}

/**
 * High-performance min-max decimation algorithm to downsample large datasets
 * for responsive canvas rendering while strictly preserving waveform peaks and troughs.
 */
export function decimateWaveformForCanvas(
  feeds: ThingSpeakFeedItem[],
  targetBuckets: number = 1000
): {
  indices: number[];
  timestamps: string[];
  timesMs: number[];
  values: Record<string, (number | null)[]>;
} {
  if (!feeds || feeds.length === 0) {
    return { indices: [], timestamps: [], timesMs: [], values: {} };
  }

  const n = feeds.length;
  const fieldKeys = ['field1', 'field2', 'field3', 'field4', 'field5', 'field6'] as const;

  // If data fits comfortably within canvas pixel width, return raw points
  if (n <= targetBuckets) {
    const indices: number[] = [];
    const timestamps: string[] = [];
    const timesMs: number[] = [];
    const values: Record<string, (number | null)[]> = {};

    for (const key of fieldKeys) {
      values[key] = [];
    }

    for (let i = 0; i < n; i++) {
      indices.push(feeds[i].entry_id);
      timestamps.push(feeds[i].created_at);
      timesMs.push(new Date(feeds[i].created_at).getTime());
      for (const key of fieldKeys) {
        const val = feeds[i][key];
        values[key].push(val !== undefined && val !== null && val !== '' ? parseFloat(val) : null);
      }
    }

    return { indices, timestamps, timesMs, values };
  }

  // When n > targetBuckets, use bucket-based min-max decimation to preserve peaks and troughs
  const bucketSize = n / (targetBuckets / 2);
  const selectedIndices = new Set<number>();
  selectedIndices.add(0);
  selectedIndices.add(n - 1);

  for (let b = 0; b < targetBuckets / 2; b++) {
    const startIdx = Math.floor(b * bucketSize);
    const endIdx = Math.min(Math.floor((b + 1) * bucketSize), n);
    if (startIdx >= endIdx) continue;

    for (const key of fieldKeys) {
      let minIdx = startIdx;
      let maxIdx = startIdx;
      let minVal = Infinity;
      let maxVal = -Infinity;

      for (let i = startIdx; i < endIdx; i++) {
        const raw = feeds[i][key];
        if (raw !== undefined && raw !== null && raw !== '') {
          const val = parseFloat(raw);
          if (!isNaN(val)) {
            if (val < minVal) {
              minVal = val;
              minIdx = i;
            }
            if (val > maxVal) {
              maxVal = val;
              maxIdx = i;
            }
          }
        }
      }

      if (minVal !== Infinity) selectedIndices.add(minIdx);
      if (maxVal !== -Infinity) selectedIndices.add(maxIdx);
    }
  }

  // Sort selected indices to preserve chronological order
  const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);

  const indices: number[] = [];
  const timestamps: string[] = [];
  const timesMs: number[] = [];
  const values: Record<string, (number | null)[]> = {};

  for (const key of fieldKeys) {
    values[key] = [];
  }

  for (const idx of sortedIndices) {
    const item = feeds[idx];
    indices.push(item.entry_id);
    timestamps.push(item.created_at);
    timesMs.push(new Date(item.created_at).getTime());
    for (const key of fieldKeys) {
      const val = item[key];
      values[key].push(val !== undefined && val !== null && val !== '' ? parseFloat(val) : null);
    }
  }

  return { indices, timestamps, timesMs, values };
}

/**
 * Formats seconds into human-readable duration (e.g. "1h 4m 30s").
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Formats an ISO date into formatted UTC and Local time strings.
 */
export function formatDateTime(isoString: string, mode: 'utc' | 'local' = 'utc'): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    if (mode === 'utc') {
      return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}
