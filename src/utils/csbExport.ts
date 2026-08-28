import { ThingSpeakFeedItem, ThingSpeakChannel } from '../types';

/**
 * Escapes a field value for consistent machine-readable CSB output.
 */
function escapeCsbValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a Channel Structured Biosignal (.csb) formatted string.
 * Includes a comprehensive metadata/header section followed by
 * full machine-readable raw biosignal telemetry records.
 */
export function generateCsbString(
  feeds: ThingSpeakFeedItem[],
  channel?: ThingSpeakChannel
): string {
  const channelId = channel?.id ?? '3469764';
  const channelName = channel?.name ?? 'SLEEP MONITORING';
  const exportTimestamp = new Date().toISOString();

  const recordingStart = feeds.length > 0 ? feeds[0].created_at : 'N/A';
  const recordingEnd = feeds.length > 0 ? feeds[feeds.length - 1].created_at : 'N/A';
  const totalRecords = feeds.length;

  const f1Label = channel?.field1 || 'Primary EEG Activity';
  const f2Label = channel?.field2 || 'EOG Activity';
  const f3Label = channel?.field3 || 'Eye Movement Events';
  const f4Label = channel?.field4 || 'EEG Artifacts';
  const f5Label = channel?.field5 || 'Hardware Clock Samples';
  const f6Label = channel?.field6 || 'Elapsed Recording Time';

  const lines: string[] = [];

  // ==============================================================================
  // METADATA / HEADER SECTION
  // ==============================================================================
  lines.push('# ==============================================================================');
  lines.push('# CHANNEL STRUCTURED BIOSIGNAL (CSB) TELEMETRY ARCHIVE');
  lines.push('# Specification: CSB-v1.0 (Raw Biosignal Telemetry Machine-Readable Standard)');
  lines.push('# ==============================================================================');
  lines.push(`# Channel ID: ${channelId}`);
  lines.push(`# Channel Name: ${channelName}`);
  lines.push(`# Export Timestamp: ${exportTimestamp}`);
  lines.push(`# Recording Start: ${recordingStart}`);
  lines.push(`# Recording End: ${recordingEnd}`);
  lines.push(`# Total Records: ${totalRecords}`);
  lines.push('# Hardware ADC Source: Texas Instruments ADS1299 (24-bit Low-Noise Delta-Sigma)');
  lines.push('# Telemetry Bus Engine: ThingSpeak Cloud RESTful Telemetry');
  lines.push('# Available Fields:');
  lines.push(`#   - field1: ${f1Label} [µV]`);
  lines.push(`#   - field2: ${f2Label} [µV]`);
  lines.push(`#   - field3: ${f3Label} [events / count]`);
  lines.push(`#   - field4: ${f4Label} [flags / count]`);
  lines.push(`#   - field5: ${f5Label} [samples / tick]`);
  lines.push(`#   - field6: ${f6Label} [seconds]`);
  lines.push('# Data Formatting: Non-downsampled, raw telemetry preservation');
  lines.push('# Encoding: UTF-8 CRLF Plaintext Raw Stream');
  lines.push('# ==============================================================================');
  lines.push('[HEADER_METADATA_END]');

  // Field Header Row
  const headers = [
    'entry_id',
    'created_at',
    'field1',
    'field2',
    'field3',
    'field4',
    'field5',
    'field6',
  ];
  lines.push(headers.map(escapeCsbValue).join(','));

  // Record Data Rows (preserving raw values without alteration or downsampling)
  for (const feed of feeds) {
    const row = [
      feed.entry_id,
      feed.created_at,
      feed.field1 ?? '',
      feed.field2 ?? '',
      feed.field3 ?? '',
      feed.field4 ?? '',
      feed.field5 ?? '',
      feed.field6 ?? '',
    ];
    lines.push(row.map(escapeCsbValue).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the CSB telemetry file with the required .csb extension.
 * Filename format: EEG_Channel_<channelId>_YYYY-MM-DD.csb
 */
export function downloadCsbFile(
  feeds: ThingSpeakFeedItem[],
  channel?: ThingSpeakChannel,
  customSuffix?: string
): void {
  const csbContent = generateCsbString(feeds, channel);
  const blob = new Blob([csbContent], { type: 'application/octet-stream;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const channelId = channel?.id ?? 3469764;
  const today = new Date().toISOString().split('T')[0];
  const suffix = customSuffix ? `_${customSuffix}` : '';
  const filename = `EEG_Channel_${channelId}_${today}${suffix}.csb`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
