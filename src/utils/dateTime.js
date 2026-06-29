// ─── TrackInvo Global Date/Time Utility ───────────────────────────────────────
// Single source of truth for all date/time formatting.
// All display times use the business timezone (default: Asia/Kolkata).
// Never format UTC directly — always convert through Intl.DateTimeFormat.

const DEFAULT_TZ = 'Asia/Kolkata';
let _tz = DEFAULT_TZ;

/** Call once on app boot (and on timezone setting change) to set the business TZ. */
export const setAppTimezone = (tz) => { _tz = tz || DEFAULT_TZ; };
export const getAppTimezone = () => _tz;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Pure YYYY-MM-DD string (no time component) — must NOT be parsed through timezone math
// because new Date("YYYY-MM-DD") = UTC midnight, which shifts the day in timezones behind UTC.
const _isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const _parse = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const _parts = (value, options, tz) => {
  const d = _parse(value);
  if (!d) return null;
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz || _tz, ...options })
      .formatToParts(d)
      .map(p => [p.type, p.value])
  );
};

const _ampm = (p) => (p.dayPeriod || '').toUpperCase();

// ─── Public formatters ────────────────────────────────────────────────────────

/**
 * "15 Jul 2026"
 * Safe for both ISO timestamps and pure YYYY-MM-DD strings.
 * Date-only strings are formatted without timezone conversion to avoid day-shift bugs.
 */
export const formatDate = (value, tz) => {
  if (!value) return '—';
  if (_isDateOnly(value)) {
    const [y, m, d] = value.split('-');
    return `${parseInt(d)} ${_MONTHS[parseInt(m) - 1]} ${y}`;
  }
  const p = _parts(value, { day: 'numeric', month: 'short', year: 'numeric' }, tz);
  return p ? `${p.day} ${p.month} ${p.year}` : '—';
};

/**
 * "15 Jul 2026"
 * Explicit alias for date-only fields — always treats value as a local date string.
 * Use for: due date, PO date, invoice date, expected delivery date.
 */
export const formatDateOnly = (value) => {
  if (!value) return '—';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${parseInt(m[3])} ${_MONTHS[parseInt(m[2]) - 1]} ${m[1]}`;
  return formatDate(value);
};

/**
 * "10:45 AM"
 * Converts ISO timestamp to local time in the business timezone.
 */
export const formatTime = (value, tz) => {
  const p = _parts(value, { hour: 'numeric', minute: '2-digit', hour12: true }, tz);
  return p ? `${p.hour}:${p.minute} ${_ampm(p)}` : '—';
};

/**
 * "15 Jul 2026 • 10:45 AM"
 * Primary display format for all system timestamps (createdAt, updatedAt, etc.).
 * For pure YYYY-MM-DD values, falls back to date-only display (no fake time).
 */
export const formatDateTime = (value, tz) => {
  if (!value) return '—';
  if (_isDateOnly(value)) return formatDate(value); // No fake time for date-only fields
  const p = _parts(value, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }, tz);
  if (!p) return '—';
  return `${p.day} ${p.month} ${p.year} • ${p.hour}:${p.minute} ${_ampm(p)}`;
};

/**
 * "15 Jul • 10:45 AM" — compact, omits year.
 * Use in tight spaces like timeline pills or compact cards.
 */
export const formatDateTimeShort = (value, tz) => {
  if (!value) return '—';
  if (_isDateOnly(value)) return formatDate(value);
  const p = _parts(value, {
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }, tz);
  if (!p) return '—';
  return `${p.day} ${p.month} • ${p.hour}:${p.minute} ${_ampm(p)}`;
};

/**
 * { date: "15 Jul 2026", time: "10:45 AM" }
 * For stacked two-line display in table cells.
 * For date-only values, time is empty string.
 */
export const formatDateTimeSplit = (value, tz) => {
  if (!value) return { date: '—', time: '' };
  if (_isDateOnly(value)) return { date: formatDate(value), time: '' };
  const p = _parts(value, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }, tz);
  if (!p) return { date: '—', time: '' };
  return {
    date: `${p.day} ${p.month} ${p.year}`,
    time: `${p.hour}:${p.minute} ${_ampm(p)}`,
  };
};

/**
 * "2026-07-15" — YYYY-MM-DD for <input type="date">.
 * Safe for both ISO timestamps and pure YYYY-MM-DD strings.
 * Date-only strings are returned as-is (no timezone conversion).
 */
export const formatDateForInput = (value, tz) => {
  if (!value) return '';
  if (_isDateOnly(value)) return String(value).slice(0, 10); // Already correct, no conversion needed
  const d = _parse(value);
  if (!d) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || _tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
};

/** Today's date as "YYYY-MM-DD" in the business timezone. */
export const getTodayLocalDate = (tz) => formatDateForInput(new Date(), tz);

// ─── Local-day range helpers ──────────────────────────────────────────────────

// Timezone offset in milliseconds (positive = east of UTC) at moment d.
const _offsetMs = (tz, d) => {
  const opts = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(d).map(x => [x.type, x.value])
  );
  const h = p.hour === '24' ? 0 : parseInt(p.hour);
  const localAsUtc = Date.UTC(
    parseInt(p.year), parseInt(p.month) - 1, parseInt(p.day),
    h, parseInt(p.minute), parseInt(p.second)
  );
  return localAsUtc - d.getTime();
};

/**
 * Returns UTC ISO string for 00:00:00.000 local time on localDateStr ("YYYY-MM-DD").
 * Example (IST +5:30): startOfLocalDay("2026-07-15") → "2026-07-14T18:30:00.000Z"
 */
export const startOfLocalDay = (localDateStr, tz) => {
  if (!localDateStr) return null;
  const timezone = tz || _tz;
  const [y, m, d] = localDateStr.split('-').map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = _offsetMs(timezone, utcMidnight);
  return new Date(utcMidnight.getTime() - offset).toISOString();
};

/**
 * Returns UTC ISO string for 23:59:59.999 local time on localDateStr ("YYYY-MM-DD").
 * Example (IST +5:30): endOfLocalDay("2026-07-15") → "2026-07-15T18:29:59.999Z"
 */
export const endOfLocalDay = (localDateStr, tz) => {
  const start = startOfLocalDay(localDateStr, tz);
  if (!start) return null;
  return new Date(new Date(start).getTime() + 86_400_000 - 1).toISOString();
};

/**
 * Converts a UI date-range pair (YYYY-MM-DD strings) to UTC ISO boundaries.
 * Use for Supabase .gte() / .lte() queries.
 *
 * @returns {{ from: string|null, to: string|null }}
 */
export const toLocalDateRange = (fromDate, toDate) => ({
  from: fromDate ? startOfLocalDay(fromDate) : null,
  to:   toDate   ? endOfLocalDay(toDate)     : null,
});

/**
 * Returns true if a record's date falls within the given local date range.
 *
 * @param {string} recordDate    — ISO timestamp or YYYY-MM-DD from the record
 * @param {string} fromLocalDate — YYYY-MM-DD filter start (inclusive), or null/''
 * @param {string} toLocalDate   — YYYY-MM-DD filter end   (inclusive), or null/''
 */
export const isWithinLocalDateRange = (recordDate, fromLocalDate, toLocalDate, tz) => {
  if (!recordDate) return false;
  const localDate = formatDateForInput(recordDate, tz);
  if (!localDate) return false;
  if (fromLocalDate && localDate < fromLocalDate) return false;
  if (toLocalDate   && localDate > toLocalDate)   return false;
  return true;
};
