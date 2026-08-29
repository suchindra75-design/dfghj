import { ThingSpeakFeedItem, ThingSpeakChannel } from '../types';
import { Capacitor } from '@capacitor/core';
import { saveAndShareFile } from './capacitorFile';

/**
 * Escapes a field for RFC 4180 compliant CSV output.
 */
function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC 4180 compliant CSV text from ThingSpeak feeds and channel metadata.
 */
export function generateCsvString(
  feeds: ThingSpeakFeedItem[],
  channel?: ThingSpeakChannel
): string {
  // Build header row with readable field labels if available
  const f1 = channel?.field1 ? `field1_${channel.field1.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field1';
  const f2 = channel?.field2 ? `field2_${channel.field2.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field2';
  const f3 = channel?.field3 ? `field3_${channel.field3.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field3';
  const f4 = channel?.field4 ? `field4_${channel.field4.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field4';
  const f5 = channel?.field5 ? `field5_${channel.field5.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field5';
  const f6 = channel?.field6 ? `field6_${channel.field6.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field6';

  const headers = ['entry_id', 'created_at', f1, f2, f3, f4, f5, f6];
  const lines: string[] = [];

  // Metadata comments (optional, widely used in research CSVs)
  lines.push(`# ThingSpeak Channel ID: ${channel?.id ?? '3469764'}`);
  lines.push(`# Channel Name: ${channel?.name ?? 'SLEEP MONITORING'}`);
  lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
  lines.push(`# Total Records Exported: ${feeds.length}`);
  lines.push(headers.map(escapeCsvValue).join(','));

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
    lines.push(row.map(escapeCsvValue).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the CSV data.
 */
export async function downloadCsvFile(
  feeds: ThingSpeakFeedItem[],
  channel?: ThingSpeakChannel,
  customSuffix?: string
): Promise<void> {
  const csvContent = generateCsvString(feeds, channel);
  const channelId = channel?.id ?? 3469764;
  const today = new Date().toISOString().split('T')[0];
  const suffix = customSuffix ? `_${customSuffix}` : '';
  const filename = `EEG_Channel_${channelId}_${today}${suffix}.csv`;
  // Native handling for Capacitor
  if (Capacitor.isNative) {
    // Save and share via native file system
    await saveAndShareFile(csvContent, filename, 'text/csv');
    return;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);


  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
