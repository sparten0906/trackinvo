import {
  formatDate, formatDateOnly, formatDateTime,
  formatDateTimeSplit, formatTime,
  formatBusinessDateTime, formatTableDateTime,
  hasTime,
} from '../../utils/dateTime.js';

/**
 * Reusable date/time display for TrackInvo.
 *
 * Props:
 *   value        — primary date value (ISO timestamp or YYYY-MM-DD)
 *   fallback     — fallback value when primary is missing or date-only
 *   label        — optional text label shown above the value
 *   mode         — "business" | "audit" | "dateOnly" | "datetime" | "auto"
 *   layout       — "inline" | "table" | "stacked" | "detail" | "timeline"
 *
 * mode rules:
 *   "business"  — use formatTableDateTime(value, fallback): show business date + time from fallback
 *   "audit"     — always formatDateTime(value): for Created On / Updated On rows
 *   "dateOnly"  — always formatDate(value): for due dates, expected delivery, PO date
 *   "datetime"  — always formatDateTime(value): for full timestamps
 *   "auto"      — formatDateTime if has time, formatDate if date-only
 */
export default function DateTimeDisplay({
  value,
  fallback,
  label,
  mode = 'auto',
  layout = 'inline',
}) {
  // ── Compute display strings ──────────────────────────────────────────────────
  let displayDate = '—';
  let displayTime = '';

  if (mode === 'dateOnly') {
    displayDate = formatDate(value || fallback);
  } else if (mode === 'audit' || mode === 'datetime') {
    const v = value || fallback;
    const dt = formatDateTimeSplit(v);
    displayDate = dt.date;
    displayTime = dt.time;
  } else if (mode === 'business') {
    // Use business date as the date line, fallback (createdAt) for the time line
    const dt = formatTableDateTime(value, fallback);
    displayDate = dt.date;
    displayTime = dt.time;
  } else {
    // auto: show time if the value is a full timestamp, date-only otherwise
    const v = value || fallback;
    const dt = formatDateTimeSplit(v);
    displayDate = dt.date;
    displayTime = dt.time;
  }

  // ── Table layout (two-line stacked for table cells) ──────────────────────────
  if (layout === 'table') {
    if (displayDate === '—' && !displayTime) {
      return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
    }
    return (
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {displayDate}
        </div>
        {displayTime && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap' }}>
            {displayTime}
          </div>
        )}
      </div>
    );
  }

  // ── Detail layout (labelled block for modals / panels) ───────────────────────
  if (layout === 'detail' || layout === 'stacked') {
    const singleLine = displayTime
      ? `${displayDate} • ${displayTime}`
      : displayDate;
    return (
      <div>
        {label && (
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3,
          }}>
            {label}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {singleLine}
        </div>
      </div>
    );
  }

  // ── Timeline layout (compact single line) ────────────────────────────────────
  if (layout === 'timeline') {
    const singleLine = displayTime ? `${displayDate} • ${displayTime}` : displayDate;
    return (
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {singleLine}
      </span>
    );
  }

  // ── Inline (default) ─────────────────────────────────────────────────────────
  const singleLine = displayTime ? `${displayDate} • ${displayTime}` : displayDate;
  if (!label) {
    return (
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {singleLine}
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{label}:</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{singleLine}</span>
    </div>
  );
}
