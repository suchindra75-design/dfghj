import { FeedsResponse, StatusResponse, ThingSpeakFeedItem } from '../types';

export interface FetchFeedsParams {
  all?: boolean;
  results?: number;
  start?: string;
  end?: string;
}

export async function fetchChannelStatus(): Promise<StatusResponse> {
  const response = await fetch('/api/eeg/status', {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch status (HTTP ${response.status})`);
  }
  return response.json();
}

export async function fetchAllFeeds(params: FetchFeedsParams = { all: true }): Promise<FeedsResponse> {
  const query = new URLSearchParams();
  if (params.all) query.set('all', 'true');
  if (params.results) query.set('results', String(params.results));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);

  const response = await fetch(`/api/eeg/feeds?${query.toString()}`, {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch EEG data (HTTP ${response.status})`);
  }

  return response.json();
}

export async function fetchLatestFeed(): Promise<{ success: boolean; latest: ThingSpeakFeedItem; lastEntryId: number; channelUpdatedAt: string }> {
  const response = await fetch('/api/eeg/latest', {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch latest feed (HTTP ${response.status})`);
  }

  return response.json();
}

export function getServerCsvExportUrl(params: { start?: string; end?: string } = {}): string {
  const query = new URLSearchParams();
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  return `/api/eeg/csv?${query.toString()}`;
}
