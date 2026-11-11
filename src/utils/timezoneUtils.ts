import { TimeDisplayMode } from '../types';

/**
 * Safely parses any UTC timestamp string (e.g. "2026-09-03T18:50:24Z", "2026-09-03 18:50:24", "2026-09-03 18:50:24 UTC")
 * into a Date object representing the exact UTC instant.
 * Ensures timestamps lacking 'Z' or formatted with spaces are not misparsed by JavaScript Date as local time.
 */
export function parseUtcDate(isoString: string | null | undefined): Date {
  if (!isoString) return new Date(NaN);
  let s = String(isoString).trim();
  if (s.endsWith(' UTC')) s = s.slice(0, -4).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T');
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
  return new Date(s);
}

/**
 * Converts a UTC ISO string (e.g. "2026-08-25T15:17:48.000Z" or "2026-08-25T15:17:48Z")
 * into a local wall-clock datetime string formatted as "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
 */
export function utcToLocalDatetimeLocalString(utcIsoString: string): string {
  if (!utcIsoString) return '';
  const d = parseUtcDate(utcIsoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a local wall-clock datetime-local string (e.g. "2026-08-25T02:00")
 * into an explicit UTC ISO string (e.g. "2026-08-24T20:30:00.000Z" in UTC+05:30).
 * Does NOT simply append "Z" (which would incorrectly reinterpret local time as UTC).
 */
export function localDatetimeToUtcIso(localDatetimeStr: string): string {
  if (!localDatetimeStr) return '';
  const d = new Date(localDatetimeStr);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Inclusive upper bound (ms) for a minute-precision datetime-local *end* value.
 * "14:05" covers every record up to 14:05:59.999, so the final minute of a
 * recording is never silently dropped. Returns NaN for empty/invalid input.
 */
export function localDatetimeEndToUtcMs(localDatetimeStr: string): number {
  if (!localDatetimeStr) return NaN;
  const ms = new Date(localDatetimeStr).getTime();
  if (isNaN(ms)) return NaN;
  // datetime-local inputs carry seconds only when step < 60; widen minute-precision values.
  return /T\d{2}:\d{2}$/.test(localDatetimeStr) ? ms + 59_999 : ms;
}

/**
 * Calculates the local "Today" range (00:00:00.000 to 23:59:59.999 local time),
 * and returns both the UTC ISO strings for API filtering and local datetime-local strings.
 */
export function getLocalTodayRange(): {
  startUtcIso: string;
  endUtcIso: string;
  startLocal: string;
  endLocal: string;
} {
  const now = new Date();
  const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    startUtcIso: localStart.toISOString(),
    endUtcIso: localEnd.toISOString(),
    startLocal: utcToLocalDatetimeLocalString(localStart.toISOString()),
    endLocal: utcToLocalDatetimeLocalString(localEnd.toISOString()),
  };
}

/**
 * Calculates the local "Last 24 Hours" range,
 * and returns both UTC ISO strings and local datetime-local strings.
 */
export function getLocalLast24hRange(): {
  startUtcIso: string;
  endUtcIso: string;
  startLocal: string;
  endLocal: string;
} {
  const now = new Date();
  const localStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    startUtcIso: localStart.toISOString(),
    endUtcIso: now.toISOString(),
    startLocal: utcToLocalDatetimeLocalString(localStart.toISOString()),
    endLocal: utcToLocalDatetimeLocalString(now.toISOString()),
  };
}
