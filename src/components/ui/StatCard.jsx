import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, subtitle, icon: Icon, accentColor = 'var(--brand)', trend }) {
  return (
    <div className="card" style={{ padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
      {/* Top accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accentColor, borderRadius: '16px 16px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10,
          }}>
            {title}
          </p>
          <p className="num" style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
            color: 'var(--text-primary)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div style={{
            flexShrink: 0, width: 40, height: 40, borderRadius: 12,
            background: accentColor + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} style={{ color: accentColor }} strokeWidth={2} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 14, paddingTop: 12,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {trend >= 0
            ? <TrendingUp size={13} style={{ color: 'var(--success)' }} />
            : <TrendingDown size={13} style={{ color: 'var(--error)' }} />
          }
          <span className="num" style={{
            fontSize: 12, fontWeight: 700,
            color: trend >= 0 ? 'var(--success)' : 'var(--error)',
          }}>
            {trend >= 0 ? '+' : ''}{Math.abs(trend)}%
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>vs last month</span>
        </div>
      )}
    </div>
  );
}
