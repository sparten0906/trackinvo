import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const maxW = { sm: 400, md: 520, lg: 680, xl: 880, full: 1100 }[size] ?? 520;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        className="animate-fadeIn"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="animate-slideUp"
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          width: '100%', maxWidth: maxW,
          maxHeight: 'calc(100dvh - 32px)',
          background: 'var(--surface)',
          borderRadius: 20,
          boxShadow: '0 32px 64px rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)', transition: 'all 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--canvas)',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
