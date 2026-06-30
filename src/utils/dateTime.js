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

// ─── Type detection ────────────────────────────────────────────────────────────

/**
 * Returns true if value contains a time component (is not a pure YYYY-MM-DD date).
 * Use to decide whether to show time or just date.
 */
export const hasTime = (value) => {
  if (!value) return false;
  return !_isDateOnly(value);
};

// ─── Core formatters ──────────────────────────────────────────────────────────

/**
 * "15 Jul 2026"
 * Safe for both ISO timestamps and pure YYYY-MM-DD strings.
 * Date-only strings are formatted without timezone conversion to prevent day-shift bugs.
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
 * Explicit alias for fields that are always date-only strings (due date, PO date, etc.)
 * Parses components directly — zero timezone math.
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
 * For date-only stored values (YYYY-MM-DD), falls back to current system time.
 */
export const formatDateTime = (value, tz) => {
  if (!value) return '—';
  if (_isDateOnly(value)) {
    return `${formatDate(value)} • ${formatTime(new Date(), tz)}`;
  }
  const p = _parts(value, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }, tz);
  if (!p) return '—';
  return `${p.day} ${p.month} ${p.year} • ${p.hour}:${p.minute} ${_ampm(p)}`;
};

/**
 * "15 Jul • 10:45 AM" — compact, omits year.
 */
export const formatDateTimeShort = (value, tz) => {
  if (!value) return '—';
  if (_isDateOnly(value)) {
    return `${formatDate(value).replace(/\s\d{4}$/, '')} • ${formatTime(new Date(), tz)}`;
  }
  const p = _parts(value, {
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }, tz);
  if (!p) return '—';
  return `${p.day} ${p.month} • ${p.hour}:${p.minute} ${_ampm(p)}`;
};

/**
 * { date: "15 Jul 2026", time: "10:45 AM" }
 * For date-only stored values, falls back to current system time.
 */
export const formatDateTimeSplit = (value, tz) => {
  if (!value) return { date: '—', time: '' };
  if (_isDateOnly(value)) {
    return { date: formatDate(value), time: formatTime(new Date(), tz) };
  }
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

// ─── Business date helpers ─────────────────────────────────────────────────────

/**
 * Smart formatter for business date fields that may or may not have a time component.
 *
 * Priority: primaryValue (e.g. order_date_time || order_date) → fallbackValue (e.g. created_at)
 *
 * - If primary has time → formatDateTime(primary)
 * - If primary is date-only → formatDate(primary)  [no fake time]
 * - If primary is empty → use fallback with same logic
 * - If fallback has time → formatDateTime(fallback)
 * - If all empty → "—"
 */
export const formatBusinessDateTime = (primaryValue, fallbackValue) => {
  const val = primaryValue || fallbackValue;
  if (!val) return '—';
  return hasTime(val) ? formatDateTime(val) : formatDate(val);
};

/**
 * Same as formatBusinessDateTime but returns { date, time } for stacked two-line display.
 * time is '' when the selected value is date-only.
 */
export const formatBusinessDateTimeSplit = (primaryValue, fallbackValue) => {
  const val = primaryValue || fallbackValue;
  if (!val) return { date: '—', time: '' };
  return formatDateTimeSplit(val);
};

/**
 * Table cell formatter: picks the best available timestamp value and returns { date, time }.
 * Optimised for transaction tables — always shows time when a timestamp is available.
 *
 * @param {string} businessDate  — YYYY-MM-DD user-selected business date (invoice date, PO date, etc.)
 * @param {string} createdAt     — ISO timestamp when the record was saved
 */
export const formatTableDateTime = (businessDate, createdAt) => {
  if (businessDate && hasTime(businessDate)) return formatDateTimeSplit(businessDate);
  if (businessDate && _isDateOnly(businessDate)) {
    const datePart = formatDate(businessDate);
    // Use real timestamp if available; fall back to current system time
    const timePart = (createdAt && hasTime(createdAt)) ? formatTime(createdAt) : formatTime(new Date());
    return { date: datePart, time: timePart };
  }
  if (createdAt && hasTime(createdAt)) return formatDateTimeSplit(createdAt);
  // Both values are date-only — use business/createdAt date + current system time
  return { date: formatDate(createdAt || businessDate), time: formatTime(new Date()) };
};

/**
 * Mobile two-line format — alias for formatDateTimeSplit.
 * Caller renders date on line 1, time on line 2 (or hides time if empty).
 */
export const formatMobileDateTime = (value, tz) => formatDateTimeSplit(value, tz);

/**
 * Detail modal / panel single-line format:  "15 Jul 2026 • 10:45 AM"
 *
 * Uses the business date for the date part and createdAt for the time part,
 * combined onto one line with " • " separator.
 * If businessDate already contains a time component, that time is used directly.
 * If there is no time source, returns date only.
 *
 * Use this everywhere a business date should be displayed with time in a modal or panel.
 *
 * @param {string} businessDate  — YYYY-MM-DD or ISO timestamp (invoice date, PO date, etc.)
 * @param {string} createdAt     — ISO timestamp providing the time component when businessDate is date-only
 */
export const formatModalDateTime = (businessDate, createdAt) => {
  const { date, time } = formatTableDateTime(businessDate, createdAt);
  return time ? `${date} • ${time}` : date;
};

// ─── Input / filter helpers ───────────────────────────────────────────────────

/**
 * "2026-07-15" — YYYY-MM-DD for <input type="date">.
 * Safe for both ISO timestamps and pure YYYY-MM-DD strings.
 */
export const formatDateForInput = (value, tz) => {
  if (!value) return '';
  if (_isDateOnly(value)) return String(value).slice(0, 10);
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
 * UTC ISO string for 00:00:00.000 local time on localDateStr ("YYYY-MM-DD").
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
 * UTC ISO string for 23:59:59.999 local time on localDateStr ("YYYY-MM-DD").
 */
export const endOfLocalDay = (localDateStr, tz) => {
  const start = startOfLocalDay(localDateStr, tz);
  if (!start) return null;
  return new Date(new Date(start).getTime() + 86_400_000 - 1).toISOString();
};

/**
 * Converts a UI date-range pair (YYYY-MM-DD) to UTC ISO boundaries for Supabase queries.
 * @returns {{ from: string|null, to: string|null }}
 */
export const toLocalDateRange = (fromDate, toDate) => ({
  from: fromDate ? startOfLocalDay(fromDate) : null,
  to:   toDate   ? endOfLocalDay(toDate)     : null,
});

/**
 * Returns true if a record's date falls within the local date range.
 * Handles both ISO timestamps and YYYY-MM-DD strings.
 */
export const isWithinLocalDateRange = (recordDate, fromLocalDate, toLocalDate, tz) => {
  if (!recordDate) return false;
  const localDate = formatDateForInput(recordDate, tz);
  if (!localDate) return false;
  if (fromLocalDate && localDate < fromLocalDate) return false;
  if (toLocalDate   && localDate > toLocalDate)   return false;
  return true;
};
