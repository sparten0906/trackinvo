import React from 'react';

export function FormField({ label, error, hint, required: req, children }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {req && <span style={{ color: 'var(--error)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="field-hint">{hint}</p>
      )}
      {error && (
        <p className="field-error">{error}</p>
      )}
    </div>
  );
}

export function Input({ error, ...props }) {
  return (
    <input
      className="input"
      style={error ? { borderColor: 'var(--error)', boxShadow: '0 0 0 3px var(--error-bg)' } : {}}
      {...props}
    />
  );
}

export function Select({ error, children, ...props }) {
  return (
    <select
      className="select"
      style={error ? { borderColor: 'var(--error)', boxShadow: '0 0 0 3px var(--error-bg)' } : {}}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ error, ...props }) {
  return (
    <textarea
      className="textarea"
      style={error ? { borderColor: 'var(--error)', boxShadow: '0 0 0 3px var(--error-bg)' } : {}}
      rows={3}
      {...props}
    />
  );
}
