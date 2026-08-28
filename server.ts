import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID || '3469764';
const READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY || '';

interface ThingSpeakFeedItem {
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

interface ThingSpeakChannelMeta {
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

// In-memory cache to respect ThingSpeak rate limits (15s minimum update cadence on free tier)
let cachedFeeds: ThingSpeakFeedItem[] = [];
let cachedChannel: ThingSpeakChannelMeta | null = null;
let lastFeedsFetchTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache

/**
 * Builds ThingSpeak REST API URL with API Key if available.
 * Keeps READ_API_KEY strictly server-side.
 */
function buildThingSpeakUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`https://api.thingspeak.com/channels/${CHANNEL_ID}/${endpoint}`);
  if (READ_API_KEY) {
    url.searchParams.set('api_key', READ_API_KEY);
  }
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }
  return url.toString();
}

/**
 * Batches requests to ThingSpeak to retrieve complete datasets if the channel exceeds 8000 entries.
 */
async function fetchAllFeedsFromThingSpeak(): Promise<{ channel: ThingSpeakChannelMeta; feeds: ThingSpeakFeedItem[] }> {
  // First fetch up to 8000 results
  const firstUrl = buildThingSpeakUrl('feeds.json', { results: 8000 });
  const resp = await fetch(firstUrl, {
    headers: { 'Accept': 'application/json' }
  });

  if (!resp.ok) {
    let msg = `ThingSpeak API returned HTTP ${resp.status} (${resp.statusText})`;
    if (resp.status === 404) {
      msg = `Channel ${CHANNEL_ID} not found. Please verify the Channel ID.`;
    } else if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
      msg = `Channel ${CHANNEL_ID} is private. Please ensure a valid THINGSPEAK_READ_API_KEY is configured in environment settings.`;
    }
    throw new Error(msg);
  }

  const data = await resp.json();

  // ThingSpeak returns -1 or empty object on authentication failure for private channels
  if (data === -1 || (typeof data === 'object' && data.error)) {
    throw new Error(`ThingSpeak authentication rejected for Channel ${CHANNEL_ID}. Check THINGSPEAK_READ_API_KEY.`);
  }

  if (!data.channel || !Array.isArray(data.feeds)) {
    throw new Error(`Invalid response schema from ThingSpeak Channel ${CHANNEL_ID}`);
  }

  const channelMeta: ThingSpeakChannelMeta = data.channel;
  let allFeeds: ThingSpeakFeedItem[] = data.feeds;

  // If there are more entries remaining (last_entry_id > latest retrieved entry_id), batch fetch
  const lastEntryId = channelMeta.last_entry_id;
  let maxLoop = 5; // safety cap to prevent runaway requests
  while (allFeeds.length > 0 && allFeeds[allFeeds.length - 1].entry_id < lastEntryId && maxLoop > 0) {
    maxLoop--;
    const lastTimestamp = allFeeds[allFeeds.length - 1].created_at;
    // Add 1 second to start parameter to avoid duplicate record
    const nextStartDate = new Date(new Date(lastTimestamp).getTime() + 1000).toISOString();
    const nextUrl = buildThingSpeakUrl('feeds.json', { start: nextStartDate, results: 8000 });

    try {
      const nextResp = await fetch(nextUrl, { headers: { 'Accept': 'application/json' } });
      if (!nextResp.ok) break;
      const nextData = await nextResp.json();
      if (!nextData || !Array.isArray(nextData.feeds) || nextData.feeds.length === 0) break;
      allFeeds = allFeeds.concat(nextData.feeds);
    } catch {
      break;
    }
  }

  // Deduplicate and ensure ascending chronological order by entry_id
  const seenIds = new Set<number>();
  const uniqueFeeds: ThingSpeakFeedItem[] = [];
  for (const item of allFeeds) {
    if (!seenIds.has(item.entry_id)) {
      seenIds.add(item.entry_id);
      uniqueFeeds.push(item);
    }
  }
  uniqueFeeds.sort((a, b) => a.entry_id - b.entry_id);

  return { channel: channelMeta, feeds: uniqueFeeds };
}

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', channelId: CHANNEL_ID, hasApiKey: Boolean(READ_API_KEY) });
  });

  // Channel Status & Verification endpoint
  app.get('/api/eeg/status', async (req: Request, res: Response) => {
    try {
      const testUrl = buildThingSpeakUrl('feeds.json', { results: 1 });
      const resp = await fetch(testUrl, { headers: { 'Accept': 'application/json' } });

      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          channelId: Number(CHANNEL_ID),
          apiKeyConfigured: Boolean(READ_API_KEY),
          isAccessible: false,
          error: `ThingSpeak HTTP ${resp.status}: ${resp.statusText}. Private channels require a valid THINGSPEAK_READ_API_KEY.`,
        });
      }

      const data = await resp.json();
      if (data === -1) {
        return res.status(403).json({
          success: false,
          channelId: Number(CHANNEL_ID),
          apiKeyConfigured: Boolean(READ_API_KEY),
          isAccessible: false,
          error: 'ThingSpeak returned authentication failure (-1). Please verify THINGSPEAK_READ_API_KEY.',
        });
      }

      const ch = data.channel || {};
      const fieldNames: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) {
        const k = `field${i}` as keyof ThingSpeakChannelMeta;
        if (ch[k]) {
          fieldNames[k] = ch[k] as string;
        }
      }

      return res.json({
        success: true,
        channelId: Number(CHANNEL_ID),
        channelName: ch.name || 'EEG Channel',
        lastEntryId: ch.last_entry_id || 0,
        lastUpdatedAt: ch.updated_at || '',
        apiKeyConfigured: Boolean(READ_API_KEY),
        fieldNames,
        isAccessible: true,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        channelId: Number(CHANNEL_ID),
        apiKeyConfigured: Boolean(READ_API_KEY),
        isAccessible: false,
        error: err?.message || 'Failed to connect to ThingSpeak API.',
      });
    }
  });

  // Get Feeds with batching, date filtering, and cache protection
  app.get('/api/eeg/feeds', async (req: Request, res: Response) => {
    try {
      const now = Date.now();
      const isForceRefresh = req.query.force === 'true';
      const startDate = req.query.start as string | undefined;
      const endDate = req.query.end as string | undefined;
      const resultsParam = req.query.results ? parseInt(req.query.results as string, 10) : undefined;

      // Use cache if within TTL and not a custom date filter
      let channel = cachedChannel;
      let feeds = cachedFeeds;

      if (!channel || feeds.length === 0 || isForceRefresh || (now - lastFeedsFetchTime > CACHE_TTL_MS)) {
        const fetched = await fetchAllFeedsFromThingSpeak();
        cachedChannel = fetched.channel;
        cachedFeeds = fetched.feeds;
        lastFeedsFetchTime = now;
        channel = cachedChannel;
        feeds = cachedFeeds;
      }

      // Filter feeds if date range or result count is specified
      let filteredFeeds = feeds;

      if (startDate) {
        const startMs = new Date(startDate).getTime();
        if (!isNaN(startMs)) {
          filteredFeeds = filteredFeeds.filter(f => new Date(f.created_at).getTime() >= startMs);
        }
      }

      if (endDate) {
        const endMs = new Date(endDate).getTime();
        if (!isNaN(endMs)) {
          filteredFeeds = filteredFeeds.filter(f => new Date(f.created_at).getTime() <= endMs);
        }
      }

      if (resultsParam && resultsParam > 0 && resultsParam < filteredFeeds.length) {
        // Return latest N records
        filteredFeeds = filteredFeeds.slice(-resultsParam);
      }

      return res.json({
        success: true,
        channel,
        feeds: filteredFeeds,
        totalCount: filteredFeeds.length,
        isComplete: true,
        apiKeyConfigured: Boolean(READ_API_KEY),
        fetchedAt: new Date(lastFeedsFetchTime).toISOString(),
      });
    } catch (err: any) {
      console.error('Error fetching ThingSpeak feeds:', err);
      return res.status(502).json({
        success: false,
        error: err?.message || 'Unable to retrieve feeds from ThingSpeak.',
        apiKeyConfigured: Boolean(READ_API_KEY),
      });
    }
  });

  // Latest single feed for low-overhead real-time polling
  app.get('/api/eeg/latest', async (req: Request, res: Response) => {
    try {
      const url = buildThingSpeakUrl('feeds.json', { results: 1 });
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: `ThingSpeak HTTP ${resp.status}` });
      }
      const data = await resp.json();
      if (!data || !data.feeds || data.feeds.length === 0) {
        return res.status(404).json({ success: false, error: 'No recent feed available' });
      }
      const latest = data.feeds[0];
      return res.json({
        success: true,
        latest,
        lastEntryId: data.channel?.last_entry_id || latest.entry_id,
        channelUpdatedAt: data.channel?.updated_at || latest.created_at,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Error fetching latest reading' });
    }
  });

  // Server-side CSV Export
  app.get('/api/eeg/csv', async (req: Request, res: Response) => {
    try {
      const fetched = await fetchAllFeedsFromThingSpeak();
      const { channel, feeds } = fetched;

      let filteredFeeds = feeds;
      const startDate = req.query.start as string | undefined;
      const endDate = req.query.end as string | undefined;

      if (startDate) {
        const startMs = new Date(startDate).getTime();
        if (!isNaN(startMs)) {
          filteredFeeds = filteredFeeds.filter(f => new Date(f.created_at).getTime() >= startMs);
        }
      }
      if (endDate) {
        const endMs = new Date(endDate).getTime();
        if (!isNaN(endMs)) {
          filteredFeeds = filteredFeeds.filter(f => new Date(f.created_at).getTime() <= endMs);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const filename = `EEG_Channel_${CHANNEL_ID}_${today}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // RFC 4180 Escaping helper
      const esc = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const f1 = channel?.field1 ? `field1_${channel.field1.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field1';
      const f2 = channel?.field2 ? `field2_${channel.field2.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field2';
      const f3 = channel?.field3 ? `field3_${channel.field3.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field3';
      const f4 = channel?.field4 ? `field4_${channel.field4.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field4';
      const f5 = channel?.field5 ? `field5_${channel.field5.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field5';
      const f6 = channel?.field6 ? `field6_${channel.field6.replace(/[^a-zA-Z0-9_]/g, '_')}` : 'field6';

      const lines: string[] = [];
      lines.push(`# ThingSpeak Channel ID: ${channel?.id ?? CHANNEL_ID}`);
      lines.push(`# Channel Name: ${channel?.name ?? 'SLEEP MONITORING'}`);
      lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
      lines.push(`# Total Samples: ${filteredFeeds.length}`);
      lines.push(['entry_id', 'created_at', f1, f2, f3, f4, f5, f6].map(esc).join(','));

      for (const feed of filteredFeeds) {
        lines.push([
          feed.entry_id,
          feed.created_at,
          feed.field1 ?? '',
          feed.field2 ?? '',
          feed.field3 ?? '',
          feed.field4 ?? '',
          feed.field5 ?? '',
          feed.field6 ?? '',
        ].map(esc).join(','));
      }

      return res.send(lines.join('\r\n'));
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      return res.status(500).send(`Failed to generate CSV export: ${err?.message || 'Server error'}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scientific EEG Workstation Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
