import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
// Load environment variables from .env only in development mode
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const getChannelId = () => process.env.THINGSPEAK_CHANNEL_ID || '3469764';
const getReadApiKey = () => process.env.THINGSPEAK_READ_API_KEY || '';

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

// ---------------------------------------------------------------------------
// Tunables (all overridable through environment variables)
// ---------------------------------------------------------------------------
const THINGSPEAK_PAGE_SIZE = 8000; // ThingSpeak hard maximum per request
/** Upper bound on records pulled per refresh (protects memory, quota and mobile clients). */
const MAX_RECORDS = Math.max(THINGSPEAK_PAGE_SIZE, Number(process.env.MAX_RECORDS) || 48000);
const FEEDS_CACHE_TTL_MS = 10_000;
/** `?force=true` can only bypass the cache once the cached copy is at least this old. */
const FORCE_REFRESH_MIN_AGE_MS = 5_000;
const LATEST_CACHE_TTL_MS = 5_000;
const STATUS_CACHE_TTL_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 120; // requests per IP per window

/**
 * Builds ThingSpeak REST API URL with API Key if available.
 * Keeps READ_API_KEY strictly server-side.
 */
function buildThingSpeakUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  const channelId = getChannelId();
  const readApiKey = getReadApiKey();
  const url = new URL(`https://api.thingspeak.com/channels/${channelId}/${endpoint}`);
  if (readApiKey) {
    url.searchParams.set('api_key', readApiKey);
  }
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }
  return url.toString();
}

/** ThingSpeak expects `YYYY-MM-DD HH:NN:SS` (UTC unless a timezone param is sent). */
function toThingSpeakDate(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function channelHttpError(status: number, statusText: string): Error {
  if (status === 404) return new Error(`Channel ${getChannelId()} not found. Please verify the Channel ID.`);
  if (status === 400 || status === 401 || status === 403) {
    return new Error(`Channel ${getChannelId()} is private. Please ensure a valid THINGSPEAK_READ_API_KEY is configured in environment settings.`);
  }
  return new Error(`ThingSpeak API returned HTTP ${status} (${statusText})`);
}

async function fetchThingSpeakPage(params: Record<string, string | number>): Promise<{ channel: ThingSpeakChannelMeta; feeds: ThingSpeakFeedItem[] }> {
  const resp = await fetch(buildThingSpeakUrl('feeds.json', params), { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw channelHttpError(resp.status, resp.statusText);
  const data = await resp.json();
  // ThingSpeak returns -1 or { error } on authentication failure for private channels
  if (data === -1 || (typeof data === 'object' && data?.error)) {
    throw new Error(`ThingSpeak authentication rejected for Channel ${getChannelId()}. Check THINGSPEAK_READ_API_KEY.`);
  }
  if (!data?.channel || !Array.isArray(data.feeds)) {
    throw new Error(`Invalid response schema from ThingSpeak Channel ${getChannelId()}`);
  }
  return { channel: data.channel, feeds: data.feeds };
}

interface FeedsSnapshot {
  channel: ThingSpeakChannelMeta;
  feeds: ThingSpeakFeedItem[];
  /** True only when paging reached the first record of the channel (not truncated by MAX_RECORDS). */
  isComplete: boolean;
  fetchedAt: number;
}

/**
 * Retrieves the channel history, newest first, paging backwards in time.
 *
 * `feeds.json?results=N` always returns the N *most recent* entries, so older
 * data has to be requested with an `end` bound set to the oldest timestamp
 * already received. `end` is inclusive and timestamps have 1 s resolution, so
 * pages overlap by design and are de-duplicated on entry_id.
 */
async function fetchAllFeedsFromThingSpeak(): Promise<FeedsSnapshot> {
  const first = await fetchThingSpeakPage({ results: THINGSPEAK_PAGE_SIZE });
  const byId = new Map<number, ThingSpeakFeedItem>();
  for (const f of first.feeds) byId.set(f.entry_id, f);

  let isComplete = first.feeds.length < THINGSPEAK_PAGE_SIZE;
  let oldest = first.feeds[0];

  while (!isComplete && oldest && byId.size < MAX_RECORDS) {
    if (oldest.entry_id <= 1) {
      isComplete = true;
      break;
    }
    const remaining = MAX_RECORDS - byId.size;
    const page = await fetchThingSpeakPage({
      end: toThingSpeakDate(new Date(oldest.created_at).getTime()),
      results: Math.min(THINGSPEAK_PAGE_SIZE, remaining + 50), // +50 absorbs the overlap
    });
    let added = 0;
    for (const f of page.feeds) {
      if (!byId.has(f.entry_id)) {
        byId.set(f.entry_id, f);
        added++;
      }
    }
    if (page.feeds.length < THINGSPEAK_PAGE_SIZE || added === 0) {
      isComplete = page.feeds.length < THINGSPEAK_PAGE_SIZE;
      if (added === 0) isComplete = true; // nothing older exists
      break;
    }
    oldest = page.feeds[0];
  }

  let feeds = [...byId.values()].sort((a, b) => a.entry_id - b.entry_id);
  if (feeds.length > MAX_RECORDS) {
    feeds = feeds.slice(-MAX_RECORDS);
    isComplete = false;
  }
  return { channel: first.channel, feeds, isComplete, fetchedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Caches with in-flight de-duplication (concurrent callers share one upstream request)
// ---------------------------------------------------------------------------
function createCachedLoader<T>(ttlMs: number, load: () => Promise<T>) {
  let value: T | null = null;
  let loadedAt = 0;
  let inflight: Promise<T> | null = null;
  return {
    async get(opts: { force?: boolean } = {}): Promise<T> {
      const age = Date.now() - loadedAt;
      const fresh = value !== null && age < ttlMs;
      const forceAllowed = opts.force && age >= FORCE_REFRESH_MIN_AGE_MS;
      if (fresh && !forceAllowed) return value as T;
      if (!inflight) {
        inflight = load()
          .then(v => {
            value = v;
            loadedAt = Date.now();
            return v;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
  };
}

const feedsCache = createCachedLoader(FEEDS_CACHE_TTL_MS, fetchAllFeedsFromThingSpeak);
const latestCache = createCachedLoader(LATEST_CACHE_TTL_MS, () => fetchThingSpeakPage({ results: 1 }));
const statusCache = createCachedLoader(STATUS_CACHE_TTL_MS, () => fetchThingSpeakPage({ results: 1 }));

function filterByDateRange(feeds: ThingSpeakFeedItem[], start?: string, end?: string): ThingSpeakFeedItem[] {
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  if (isNaN(startMs) && isNaN(endMs)) return feeds;
  return feeds.filter(f => {
    const t = new Date(f.created_at).getTime();
    if (!isNaN(startMs) && t < startMs) return false;
    if (!isNaN(endMs) && t > endMs) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// CORS allowlist + per-IP rate limiting
// ---------------------------------------------------------------------------
/**
 * Origins allowed to call the API from a browser. Native Capacitor builds use
 * CapacitorHttp (native networking, no CORS), and the web build is served from
 * this same server, so the defaults only cover WebView and local dev origins.
 * Add deployed web origins via ALLOWED_ORIGINS (comma-separated).
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
];
const allowedOrigins = new Set(
  [...DEFAULT_ALLOWED_ORIGINS, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
);

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, b] of rateBuckets) if (b.windowStart < cutoff) rateBuckets.delete(ip);
}, RATE_LIMIT_WINDOW_MS).unref();

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  // Render (and most PaaS) terminate TLS one proxy hop in front of the app;
  // trust exactly that hop so req.ip is the real client for rate limiting.
  app.set('trust proxy', 1);

  // CORS: reflect only allowlisted origins (never '*').
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
    }
    next();
  });

  // Per-IP fixed-window rate limit on the API.
  app.use('/api', (req: Request, res: Response, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let bucket = rateBuckets.get(ip);
    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      rateBuckets.set(ip, bucket);
    }
    bucket.count++;
    if (bucket.count > RATE_LIMIT_MAX) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    }
    next();
  });

  // Health endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Channel Status & Verification endpoint
  app.get('/api/eeg/status', async (req: Request, res: Response) => {
    try {
      const { channel: ch } = await statusCache.get();
      const fieldNames: Record<string, string> = {};
      for (let i = 1; i <= 8; i++) {
        const k = `field${i}` as keyof ThingSpeakChannelMeta;
        if (ch[k]) {
          fieldNames[k] = ch[k] as string;
        }
      }

      return res.json({
        success: true,
        channelId: Number(getChannelId()),
        channelName: ch.name || 'EEG Channel',
        lastEntryId: ch.last_entry_id || 0,
        lastUpdatedAt: ch.updated_at || '',
        apiKeyConfigured: Boolean(getReadApiKey()),
        fieldNames,
        isAccessible: true,
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        channelId: Number(getChannelId()),
        apiKeyConfigured: Boolean(getReadApiKey()),
        isAccessible: false,
        error: err?.message || 'Failed to connect to ThingSpeak API.',
      });
    }
  });

  // Full history (paged + cached), optionally filtered by date range / latest N
  app.get('/api/eeg/feeds', async (req: Request, res: Response) => {
    try {
      const snapshot = await feedsCache.get({ force: req.query.force === 'true' });
      let filteredFeeds = filterByDateRange(
        snapshot.feeds,
        req.query.start as string | undefined,
        req.query.end as string | undefined
      );

      const resultsParam = req.query.results ? parseInt(req.query.results as string, 10) : undefined;
      if (resultsParam && resultsParam > 0 && resultsParam < filteredFeeds.length) {
        // Return latest N records
        filteredFeeds = filteredFeeds.slice(-resultsParam);
      }

      return res.json({
        success: true,
        channel: snapshot.channel,
        feeds: filteredFeeds,
        totalCount: filteredFeeds.length,
        isComplete: snapshot.isComplete,
        maxRecords: MAX_RECORDS,
        apiKeyConfigured: Boolean(getReadApiKey()),
        fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
      });
    } catch (err: any) {
      console.error('Error fetching ThingSpeak feeds:', err);
      return res.status(502).json({
        success: false,
        error: err?.message || 'Unable to retrieve feeds from ThingSpeak.',
        apiKeyConfigured: Boolean(getReadApiKey()),
      });
    }
  });

  // Latest single feed for low-overhead real-time polling
  app.get('/api/eeg/latest', async (req: Request, res: Response) => {
    try {
      const data = await latestCache.get();
      if (data.feeds.length === 0) {
        return res.status(404).json({ success: false, error: 'No recent feed available' });
      }
      const latest = data.feeds[data.feeds.length - 1];
      return res.json({
        success: true,
        latest,
        lastEntryId: data.channel?.last_entry_id || latest.entry_id,
        channelUpdatedAt: data.channel?.updated_at || latest.created_at,
      });
    } catch (err: any) {
      return res.status(502).json({ success: false, error: err?.message || 'Error fetching latest reading' });
    }
  });

  // Server-side CSV Export (served from the shared cache)
  app.get('/api/eeg/csv', async (req: Request, res: Response) => {
    try {
      const { channel, feeds, isComplete } = await feedsCache.get();
      const filteredFeeds = filterByDateRange(
        feeds,
        req.query.start as string | undefined,
        req.query.end as string | undefined
      );

      const today = new Date().toISOString().split('T')[0];
      const filename = `EEG_Channel_${getChannelId()}_${today}.csv`;

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

      const header = (key: keyof ThingSpeakChannelMeta) => {
        const name = channel?.[key];
        return typeof name === 'string' && name ? `${key}_${name.replace(/[^a-zA-Z0-9_]/g, '_')}` : key;
      };

      const lines: string[] = [];
      lines.push(`# ThingSpeak Channel ID: ${channel?.id ?? getChannelId()}`);
      lines.push(`# Channel Name: ${channel?.name ?? 'SLEEP MONITORING'}`);
      lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
      lines.push(`# Total Samples: ${filteredFeeds.length}`);
      if (!isComplete) {
        lines.push(`# NOTE: history truncated to the most recent ${MAX_RECORDS} records`);
      }
      lines.push(['entry_id', 'created_at', ...(['field1', 'field2', 'field3', 'field4', 'field5', 'field6'] as const).map(header)].map(esc).join(','));

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
      return res.status(502).send(`Failed to generate CSV export: ${err?.message || 'Server error'}`);
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
