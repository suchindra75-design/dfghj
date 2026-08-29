import { FeedsResponse, StatusResponse, ThingSpeakFeedItem } from '../types';

export interface FetchFeedsParams {
  all?: boolean;
  results?: number;
  start?: string;
  end?: string;
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

export async function fetchChannelStatus(): Promise<StatusResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/eeg/status`;
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch status from ${url} (HTTP ${response.status})`);
    }
    return response.json();
  } catch (err: any) {
    if (err?.message && !err.message.includes(url)) {
      throw new Error(`Unable to connect to EEG Workstation at ${url}: ${err.message}`);
    }
    throw err;
  }
}

export async function fetchAllFeeds(params: FetchFeedsParams = { all: true }): Promise<FeedsResponse> {
  const query = new URLSearchParams();
  if (params.all) query.set('all', 'true');
  if (params.results) query.set('results', String(params.results));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/eeg/feeds?${query.toString()}`;
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch EEG data from ${baseUrl} (HTTP ${response.status})`);
    }

    return response.json();
  } catch (err: any) {
    if (err?.message && !err.message.includes(baseUrl)) {
      throw new Error(`Unable to connect to EEG Workstation backend at ${baseUrl}: ${err.message}`);
    }
    throw err;
  }
}

export async function fetchLatestFeed(): Promise<{ success: boolean; latest: ThingSpeakFeedItem; lastEntryId: number; channelUpdatedAt: string }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/eeg/latest`;
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch latest feed from ${url} (HTTP ${response.status})`);
    }

    return response.json();
  } catch (err: any) {
    if (err?.message && !err.message.includes(url)) {
      throw new Error(`Unable to connect to latest feed at ${url}: ${err.message}`);
    }
    throw err;
  }
}

export function getServerCsvExportUrl(params: { start?: string; end?: string } = {}): string {
  const query = new URLSearchParams();
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/eeg/csv?${query.toString()}`;
}
