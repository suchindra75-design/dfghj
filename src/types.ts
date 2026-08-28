export interface ThingSpeakChannel {
  id: number;
  name: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  created_at: string;
  updated_at: string;
  last_entry_id: number;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
}

export interface ThingSpeakFeedItem {
  entry_id: number;
  created_at: string;
  field1?: string | null;
  field2?: string | null;
  field3?: string | null;
  field4?: string | null;
  field5?: string | null;
  field6?: string | null;
  field7?: string | null;
  field8?: string | null;
}

export interface ChannelFieldDefinition {
  fieldKey: `field${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  label: string;
  color: string;
  unit: string;
  description: string;
  visible: boolean;
  isNumeric: boolean;
}

export interface ChannelStatistics {
  fieldKey: string;
  label: string;
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  stdDev: number | null;
  latest: number | null;
}

export interface DerivedSamplingInfo {
  totalSamplesReported: number | null;
  recordingTimeSeconds: number | null;
  derivedSamplingRateHz: number | null;
  telemetryIntervalSeconds: number | null;
  telemetryRateHz: number | null;
  isReliablyDerived: boolean;
  notes: string;
}

export interface FeedsResponse {
  success: boolean;
  channel: ThingSpeakChannel;
  feeds: ThingSpeakFeedItem[];
  totalCount: number;
  isComplete: boolean;
  apiKeyConfigured: boolean;
  error?: string;
  fetchedAt: string;
}

export interface StatusResponse {
  success: boolean;
  channelId: number;
  channelName: string;
  lastEntryId: number;
  lastUpdatedAt: string;
  apiKeyConfigured: boolean;
  fieldNames: Record<string, string>;
  isAccessible: boolean;
  error?: string;
}

export type ActiveTab = 'overview' | 'monitor' | 'historical' | 'table' | 'export' | 'settings';

export interface DataFilterOptions {
  searchQuery: string;
  startDate: string; // ISO string or YYYY-MM-DDTHH:mm
  endDate: string;
  minEntryId?: number;
  maxEntryId?: number;
  selectedFields: string[];
}

export interface ChartDownsamplePoint {
  timeMs: number;
  isoTime: string;
  entryId: number;
  values: Record<string, number | null>;
}
