import { formatDate, formatDateTime, formatDateTimeSplit, formatTime } from '../../utils/dateTime.js';

/**
 * Reusable date/time display component for TrackInvo.
 *
 * Props:
 *   value   — ISO timestamp or YYYY-MM-DD string
 *   type    — "datetime" | "date" | "time"   (default: "datetime")
 *   layout  — "table" | "detail" | "inline" | "timeline"  (default: "inline")
 *   label   — optional label shown above the value (used in "detail" layout)
 */
export default function DateTimeDisplay({ value, type = 'datetime', layout = 'inline', label }) {
  if (!value) {
    if (layout === 'detail' && label) {
      return (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            {label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>—</div>
        </div>
      );
    }
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  }

  const formatted =
    type === 'date' ? formatDate(value) :
    type === 'time' ? formatTime(value) :
    formatDateTime(value);

  // ── Table layout: two-line stacked for table cells ────────────────────────
  if (layout === 'table') {
    const { date, time } = formatDateTimeSplit(value);
    return (
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {date}
        </div>
        {type !== 'date' && time && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {time}
          </div>
        )}
      </div>
    );
  }

  // ── Detail layout: labelled block for modals / detail panels ─────────────
  if (layout === 'detail') {
    return (
      <div>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            {label}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {formatted}
        </div>
      </div>
    );
  }

  // ── Timeline layout: compact single line ──────────────────────────────────
  if (layout === 'timeline') {
    return (
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {formatted}
      </span>
    );
  }

  // ── Inline (default): single-line span ────────────────────────────────────
  return (
    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      {formatted}
    </span>
  );
}
