import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Confirm Delete',
  message,
  confirmLabel = 'Delete',
  variant = 'danger',
}) {
  const isDanger = variant === 'danger';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className={isDanger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {isDanger ? <Trash2 size={13} /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '4px 0' }}>
        <div style={{
          flexShrink: 0,
          width: 40, height: 40, borderRadius: 12,
          background: isDanger ? 'var(--error-bg)' : 'var(--warning-bg)',
          border: `1px solid ${isDanger ? 'var(--error-border)' : 'var(--warning-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDanger
            ? <Trash2 size={18} style={{ color: 'var(--error)' }} />
            : <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
          }
        </div>
        <p style={{
          fontSize: 13.5, lineHeight: 1.6,
          color: 'var(--text-secondary)',
          marginTop: 8,
        }}>
          {message || 'Are you sure you want to delete this? This action cannot be undone.'}
        </p>
      </div>
    </Modal>
  );
}
