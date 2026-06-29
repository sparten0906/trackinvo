import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}
      className="sm:flex-row">
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
        Showing <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{from}–{to}</strong> of <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{total}</strong>
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={{
            width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', transition: 'all 0.12s',
            opacity: page === 1 ? 0.4 : 1, pointerEvents: page === 1 ? 'none' : 'auto',
          }}
          onMouseEnter={e => { if (page !== 1) { e.currentTarget.style.background = 'var(--zinc-50)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} style={{ padding: '0 4px', fontSize: 13, color: 'var(--text-tertiary)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                width: 30, height: 30, borderRadius: 7, border: `1px solid ${p === page ? 'var(--brand)' : 'var(--border)'}`,
                background: p === page ? 'var(--brand)' : 'var(--surface)',
                color: p === page ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: p === page ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.12s', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={{
            width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', transition: 'all 0.12s',
            opacity: page === totalPages ? 0.4 : 1, pointerEvents: page === totalPages ? 'none' : 'auto',
          }}
          onMouseEnter={e => { if (page !== totalPages) { e.currentTarget.style.background = 'var(--zinc-50)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
