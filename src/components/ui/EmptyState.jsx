import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action, size = 'md' }) {
  const sizes = {
    sm: { py: 32, iconSize: 36, iconWrap: 44 },
    md: { py: 48, iconSize: 24, iconWrap: 52 },
    lg: { py: 64, iconSize: 28, iconWrap: 60 },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: `${s.py}px 24px`,
      textAlign: 'center',
    }}>
      {Icon && (
        <div style={{
          width: s.iconWrap, height: s.iconWrap,
          borderRadius: 16, background: 'var(--zinc-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, border: '1px solid var(--border)',
          color: 'var(--text-tertiary)',
        }}>
          <Icon size={s.iconSize} strokeWidth={1.5} />
        </div>
      )}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginBottom: 20, maxWidth: 300, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
