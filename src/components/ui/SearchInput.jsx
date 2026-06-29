import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search…', style = {} }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <Search
        size={14}
        style={{
          position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)', pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
        style={{ paddingLeft: 32, paddingRight: value ? 30 : 10 }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)',
            width: 18, height: 18, borderRadius: 5,
            border: 'none', background: 'var(--zinc-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-tertiary)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--zinc-300)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--zinc-200)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
