import React from 'react';

/* Reusable colored icon badge for use on light backgrounds (dashboard, cards, etc.) */

const COLORS = {
  blue:    { bg: '#EFF6FF', icon: '#2563EB' },
  indigo:  { bg: '#EEF2FF', icon: '#4F46E5' },
  emerald: { bg: '#ECFDF5', icon: '#059669' },
  teal:    { bg: '#F0FDFA', icon: '#0D9488' },
  violet:  { bg: '#F5F3FF', icon: '#7C3AED' },
  amber:   { bg: '#FFFBEB', icon: '#D97706' },
  sky:     { bg: '#F0F9FF', icon: '#0284C7' },
  orange:  { bg: '#FFF7ED', icon: '#EA580C' },
  purple:  { bg: '#FAF5FF', icon: '#9333EA' },
  cyan:    { bg: '#ECFEFF', icon: '#0891B2' },
  rose:    { bg: '#FFF1F2', icon: '#E11D48' },
  red:     { bg: '#FEF2F2', icon: '#DC2626' },
  slate:   { bg: '#F1F5F9', icon: '#475569' },
  green:   { bg: '#F0FDF4', icon: '#16A34A' },
  yellow:  { bg: '#FEFCE8', icon: '#CA8A04' },
};

const SIZES = {
  xs:  { box: 24, icon: 12, radius: 6  },
  sm:  { box: 28, icon: 14, radius: 7  },
  md:  { box: 36, icon: 18, radius: 9  },
  lg:  { box: 44, icon: 22, radius: 11 },
  xl:  { box: 56, icon: 28, radius: 13 },
  '2xl': { box: 68, icon: 34, radius: 15 },
};

export default function IconBadge({ icon: Icon, color = 'indigo', size = 'md', style: extraStyle, strokeWidth = 1.75 }) {
  const c = COLORS[color] || COLORS.indigo;
  const s = SIZES[size]   || SIZES.md;
  return (
    <div style={{
      width: s.box, height: s.box,
      borderRadius: s.radius,
      background: c.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...extraStyle,
    }}>
      <Icon size={s.icon} style={{ color: c.icon }} strokeWidth={strokeWidth} />
    </div>
  );
}
