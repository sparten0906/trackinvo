// ─── Return Processing Desk ───────────────────────────────────────────────────
// 4-panel professional ERP workstation. Each panel owns one responsibility
// in the real return business process.

import React, { useState, useMemo } from 'react';
import {
  Search, CheckCircle2, AlertTriangle, XCircle, Package,
  Minus, Plus, RotateCcw, User, Phone, Receipt, Inbox, X,
  CreditCard, Banknote, Wallet, TrendingUp, TrendingDown,
  History, ArrowRight, Layers, FileText, Activity,
  Circle, MoreHorizontal, Clock, Star, ChevronDown,
  ShieldCheck, Hash, Zap, Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import { formatCurrency, formatDate, today, calcSalesReturnTotals } from '../utils/helpers';
import toast from 'react-hot-toast';

// ─── INSPECTION CONDITIONS ────────────────────────────────────────────────────

const CONDITIONS = [
  {
    id: 'good',
    label: 'Accept Return',
    sub: '+ Sellable Stock',
    Icon: CheckCircle2,
    clr: '#15803D', bg: '#DCFCE7', bdr: '#86EFAC', activeBg: '#16A34A',
    stockType: 'sellable',
    cardBdr: '#86EFAC',
  },
  {
    id: 'damaged',
    label: 'Damaged',
    sub: '+ Damaged Stock',
    Icon: AlertTriangle,
    clr: '#B91C1C', bg: '#FEE2E2', bdr: '#FCA5A5', activeBg: '#DC2626',
    stockType: 'damaged',
    cardBdr: '#FCA5A5',
  },
  {
    id: 'defective',
    label: 'Defective',
    sub: '+ Damaged Stock',
    Icon: XCircle,
    clr: '#C2410C', bg: '#FFEDD5', bdr: '#FED7AA', activeBg: '#EA580C',
    stockType: 'damaged',
    cardBdr: '#FED7AA',
  },
  {
    id: 'used',
    label: 'Used / Worn',
    sub: '+ Damaged Stock',
    Icon: Package,
    clr: '#6D28D9', bg: '#EDE9FE', bdr: '#C4B5FD', activeBg: '#7C3AED',
    stockType: 'damaged',
    cardBdr: '#C4B5FD',
  },
  {
    id: 'not_resellable',
    label: 'Not Resellable',
    sub: '+ Damaged Stock',
    Icon: RotateCcw,
    clr: '#52525B', bg: '#F4F4F5', bdr: '#D4D4D8', activeBg: '#71717A',
    stockType: 'damaged',
    cardBdr: '#D4D4D8',
  },
];
const COND = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

const RETURN_REASONS = [
  { id: 'quality_issue',         label: 'Quality Issue' },
  { id: 'wrong_item',            label: 'Wrong Item Delivered' },
  { id: 'damaged_in_transit',    label: 'Damaged in Transit' },
  { id: 'defective',             label: 'Defective / Not Working' },
  { id: 'customer_changed_mind', label: 'Customer Changed Mind' },
  { id: 'expired',               label: 'Expired / Past Shelf Life' },
  { id: 'not_as_described',      label: 'Not As Described' },
  { id: 'other',                 label: 'Other' },
];

const REFUND_METHODS = [
  { id: 'cash',          label: 'Cash',        Icon: Banknote  },
  { id: 'bank_transfer', label: 'Bank',         Icon: CreditCard },
  { id: 'credit_note',   label: 'Credit Note',  Icon: Receipt   },
  { id: 'upi',           label: 'UPI',          Icon: Zap       },
  { id: 'store_credit',  label: 'Store Credit', Icon: Star      },
  { id: 'no_refund',     label: 'No Refund',    Icon: X         },
];

const SR_STATUS_CFG = {
  completed: { bg: '#F0FDF4', fg: '#16A34A', border: '#86EFAC', label: 'Completed' },
  draft:     { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A', label: 'Draft' },
  cancelled: { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Cancelled' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildReturnedMap(salesReturns, invoiceId) {
  const map = {};
  salesReturns
    .filter(r => r.invoiceId === invoiceId && r.status !== 'cancelled')
    .forEach(r => (r.items || []).forEach(it => {
      map[it.productId] = (map[it.productId] || 0) + Number(it.returnQty || 0);
    }));
  return map;
}

function makeItemRow(invItem, returnedMap) {
  const invoiceQty   = Number(invItem.quantity || 0);
  const alreadyGone  = returnedMap[invItem.productId] || 0;
  return {
    productId:      invItem.productId,
    productName:    invItem.productName || invItem.name || '',
    sku:            invItem.sku || '',
    invoiceQty,
    alreadyReturned: alreadyGone,
    maxReturn:      Math.max(0, invoiceQty - alreadyGone),
    returnQty:      0,
    condition:      'good',
    reason:         'quality_issue',
    notes:          '',
    unitPrice:      Number(invItem.unitPrice || invItem.price || invItem.sellingPrice || 0),
    taxPercent:     Number(invItem.taxPercent || 0),
    discount:       Number(invItem.discount || 0),
  };
}

// ─── SMALL SHARED UI ─────────────────────────────────────────────────────────

function SRStatusBadge({ status }) {
  const cfg = SR_STATUS_CFG[status] || SR_STATUS_CFG.completed;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

function PanelLabel({ children }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {children}
    </div>
  );
}

// ─── CONDITION BUTTON ─────────────────────────────────────────────────────────

function CondBtn({ cond, selected, onClick }) {
  const { Icon } = cond;
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 0, padding: '9px 4px 7px',
      border: `2px solid ${selected ? cond.activeBg : cond.bdr}`,
      borderRadius: 10, cursor: 'pointer', textAlign: 'center',
      background: selected ? cond.activeBg : cond.bg,
      color: selected ? '#fff' : cond.clr,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      transition: 'all 0.13s ease',
    }}>
      <Icon size={14} strokeWidth={selected ? 2.5 : 2} />
      <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{cond.label}</div>
      <div style={{ fontSize: 8.5, opacity: selected ? 0.85 : 0.65, lineHeight: 1.1 }}>{cond.sub}</div>
    </button>
  );
}

// ─── INSPECTION CARD (one per invoice line) ───────────────────────────────────

function InspectionCard({ item, onChange, sym }) {
  const cond    = COND[item.condition] || CONDITIONS[0];
  const hasQty  = item.returnQty > 0;
  const value   = item.returnQty * item.unitPrice;
  const bump    = (d) => onChange({ returnQty: Math.max(0, Math.min(item.maxReturn, item.returnQty + d)) });
  const isSell  = cond.stockType === 'sellable';

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${hasQty ? cond.cardBdr : '#E2E8F0'}`,
      borderLeft: `4px solid ${hasQty ? cond.activeBg : '#CBD5E1'}`,
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'border-color 0.15s, border-left-color 0.15s',
      opacity: item.maxReturn === 0 ? 0.5 : 1,
    }}>
      {/* ── Product header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 5, lineHeight: 1.2 }}>
            {item.productName}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.sku && (
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', background: '#F1F5F9', color: '#475569', padding: '1px 7px', borderRadius: 4, border: '1px solid #E2E8F0', letterSpacing: '0.03em' }}>
                {item.sku}
              </span>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748B' }}>
              <span>Invoice <strong style={{ color: '#0F172A' }}>{item.invoiceQty}</strong></span>
              {item.alreadyReturned > 0 && (
                <span style={{ color: '#D97706', fontWeight: 600 }}>Already returned: {item.alreadyReturned}</span>
              )}
              <span>Available <strong style={{ color: item.maxReturn === 0 ? '#DC2626' : '#0F172A' }}>{item.maxReturn}</strong></span>
            </div>
          </div>
        </div>
        {hasQty && (
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: cond.clr, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(value, sym)}
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
              {item.returnQty} × {formatCurrency(item.unitPrice, sym)}
            </div>
          </div>
        )}
      </div>

      {item.maxReturn === 0 ? (
        <div style={{ textAlign: 'center', padding: '10px', background: '#FEF2F2', borderRadius: 8, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
          All units have already been returned
        </div>
      ) : (
        <>
          {/* ── Quantity stepper ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', width: 90, flexShrink: 0 }}>Return Qty</div>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 9, overflow: 'hidden', background: '#FAFAFA' }}>
              <button onClick={() => bump(-1)} disabled={item.returnQty <= 0}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: item.returnQty <= 0 ? 'default' : 'pointer', color: item.returnQty <= 0 ? '#CBD5E1' : '#475569' }}>
                <Minus size={12} strokeWidth={2.5} />
              </button>
              <div style={{ width: 52, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: hasQty ? '#2563EB' : '#94A3B8', borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', fontVariantNumeric: 'tabular-nums' }}>
                {item.returnQty}
              </div>
              <button onClick={() => bump(1)} disabled={item.returnQty >= item.maxReturn}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: item.returnQty >= item.maxReturn ? 'default' : 'pointer', color: item.returnQty >= item.maxReturn ? '#CBD5E1' : '#475569' }}>
                <Plus size={12} strokeWidth={2.5} />
              </button>
            </div>
            <button onClick={() => onChange({ returnQty: item.maxReturn })}
              style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
              Return All
            </button>
            {hasQty && (
              <button onClick={() => onChange({ returnQty: 0 })}
                style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>

          {/* ── Condition selector (always visible so user can inspect before setting qty) ── */}
          <div style={{ marginBottom: hasQty ? 14 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Inspection Result
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {CONDITIONS.map(c => (
                <CondBtn key={c.id} cond={c} selected={item.condition === c.id} onClick={() => onChange({ condition: c.id })} />
              ))}
            </div>
          </div>

          {/* ── Reason + Notes + Live impact (only when qty > 0) ── */}
          {hasQty && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Return Reason</label>
                  <div style={{ position: 'relative' }}>
                    <select value={item.reason} onChange={e => onChange({ reason: e.target.value })}
                      style={{ width: '100%', height: 33, padding: '0 28px 0 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, background: '#FAFAFA', color: '#0F172A', boxSizing: 'border-box', appearance: 'none' }}>
                      {RETURN_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Inspection Notes</label>
                  <input value={item.notes} onChange={e => onChange({ notes: e.target.value })}
                    placeholder="Describe the condition..."
                    style={{ width: '100%', height: 33, padding: '0 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, background: '#FAFAFA', color: '#0F172A', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* ── Live stock impact ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '9px 12px', borderRadius: 9, background: isSell ? '#F0FDF4' : '#F8FAFC', border: `1.5px solid ${isSell ? '#86EFAC' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <TrendingUp size={13} color={isSell ? '#16A34A' : '#CBD5E1'} strokeWidth={2.5} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isSell ? '#166534' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sellable Stock</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: isSell ? '#16A34A' : '#CBD5E1', lineHeight: 1 }}>+{isSell ? item.returnQty : 0}</div>
                  </div>
                </div>
                <div style={{ padding: '9px 12px', borderRadius: 9, background: !isSell ? '#FEF2F2' : '#F8FAFC', border: `1.5px solid ${!isSell ? '#FCA5A5' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <TrendingDown size={13} color={!isSell ? '#DC2626' : '#CBD5E1'} strokeWidth={2.5} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: !isSell ? '#991B1B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Damaged Stock</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: !isSell ? '#DC2626' : '#CBD5E1', lineHeight: 1 }}>+{!isSell ? item.returnQty : 0}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── INVOICE CARD ─────────────────────────────────────────────────────────────

function InvoiceCard({ inv, selected, onClick, sym, salesReturns }) {
  const payReturns = salesReturns.filter(r => r.invoiceId === inv.id && r.status !== 'cancelled');
  const PS = {
    paid:    { fg: '#16A34A', bg: '#F0FDF4', bdr: '#86EFAC',  label: 'Paid'    },
    partial: { fg: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A',  label: 'Partial' },
    unpaid:  { fg: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA',  label: 'Unpaid'  },
  };
  const ps = PS[inv.paymentStatus] || PS.unpaid;

  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '11px 13px',
      border: `1.5px solid ${selected ? '#2563EB' : '#E2E8F0'}`,
      borderRadius: 10, marginBottom: 6,
      background: selected ? '#EFF6FF' : '#fff',
      cursor: 'pointer',
      transition: 'all 0.13s ease',
      boxShadow: selected ? '0 0 0 2px #BFDBFE' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: selected ? '#1D4ED8' : '#0F172A', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
          {inv.invoiceNumber}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
          {formatCurrency(inv.grandTotal || inv.totalAmount || 0, sym)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 5 }}>
        {inv.customerName || 'Unknown Customer'}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>{formatDate(inv.date || inv.createdAt)}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: ps.bg, color: ps.fg, border: `1px solid ${ps.bdr}` }}>{ps.label}</span>
        {payReturns.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#EEF2FF', color: '#4338CA' }}>
            {payReturns.length} return{payReturns.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

function Timeline({ invoice, activeItems, stockImpact }) {
  const paid = invoice && (invoice.paymentStatus === 'paid' || Number(invoice.paidAmount) > 0);
  const hasItems = activeItems.length > 0;

  const events = [
    {
      label: 'Invoice Created',
      sub:   invoice ? invoice.invoiceNumber : '—',
      date:  invoice ? formatDate(invoice.date || invoice.createdAt) : null,
      done:  true,
    },
    ...(paid ? [{
      label: 'Payment Received',
      sub:   invoice.paymentStatus === 'paid' ? 'Fully paid' : 'Partial payment',
      date:  null,
      done:  true,
    }] : []),
    {
      label:  'Return Processing',
      sub:    hasItems ? `${activeItems.length} item${activeItems.length !== 1 ? 's' : ''} selected` : 'Awaiting inspection',
      date:   null,
      active: true,
    },
    {
      label: 'Stock Update',
      sub:   hasItems
        ? `+${stockImpact.sellable} sellable · +${stockImpact.damaged} damaged`
        : 'Pending item selection',
      date:  null,
      ready: hasItems,
    },
    {
      label: 'Return Complete',
      sub:   'Refund issued · Records saved',
      date:  null,
    },
  ];

  return (
    <div>
      {events.map((ev, i) => {
        const isLast  = i === events.length - 1;
        const dotClr  = ev.done ? '#16A34A' : ev.active ? '#2563EB' : ev.ready ? '#D97706' : '#CBD5E1';
        const dotSize = ev.active ? 14 : 10;
        return (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
              <div style={{
                width: dotSize, height: dotSize, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: dotClr,
                boxShadow: ev.active ? `0 0 0 3px ${dotClr}30` : 'none',
              }} />
              {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 22, background: ev.done ? '#86EFAC' : '#E2E8F0', marginTop: 3, marginBottom: 3 }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ev.done ? '#166534' : ev.active ? '#1D4ED8' : ev.ready ? '#92400E' : '#94A3B8' }}>
                {ev.label}
              </div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1, lineHeight: 1.4 }}>{ev.sub}</div>
              {ev.date && <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{ev.date}</div>}
              {ev.active && <div style={{ fontSize: 9.5, color: '#2563EB', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Now</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── HISTORY DETAIL MODAL ─────────────────────────────────────────────────────

function HistoryDetailModal({ ret, sym, onClose, onEdit }) {
  if (!ret) return null;
  const refundLabel = REFUND_METHODS.find(r => r.id === (ret.refundMode || ret.refundMethod || 'cash'))?.label || ret.refundMode || '—';
  return (
    <Modal open={!!ret} onClose={onClose} title={`${ret.returnNumber || 'Return'} — Details`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Invoice',        ret.invoiceNumber || '—'],
            ['Customer',       ret.customerName || '—'],
            ['Return Date',    formatDate(ret.date || ret.returnDate || ret.createdAt)],
            ['Refund Method',  refundLabel],
            ['Total Refund',   formatCurrency(ret.totalAmount || ret.totalRefund || 0, sym)],
            ['Status',         '__status__'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
              {v === '__status__'
                ? <SRStatusBadge status={ret.status || 'completed'} />
                : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: k === 'Invoice' ? 'monospace' : 'inherit' }}>{v}</div>}
            </div>
          ))}
        </div>
        {/* Items */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, background: 'var(--canvas)' }}>Returned Items</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--canvas)' }}>
                {['Product', 'Qty', 'Condition', 'Reason', 'Unit Price', 'Total'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: i > 1 ? 'center' : 'left', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(ret.items || []).map((it, i) => {
                const c = COND[it.condition] || CONDITIONS[0];
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{it.productName}</div>
                      {it.sku && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{it.sku}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{it.returnQty}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: c.bg, color: c.clr, border: `1px solid ${c.bdr}` }}>{c.label}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
                      {RETURN_REASONS.find(r => r.id === it.reason)?.label || it.reason || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(it.unitPrice || 0, sym)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(Number(it.returnQty || 0) * Number(it.unitPrice || 0), sym)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ret.notes && (
          <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ret.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SalesReturns() {
  const { state, addSalesReturn, updateSalesReturn } = useApp();
  const { invoices = [], salesReturns = [], customers = [], settings } = state;
  const sym = settings?.currencySymbol || '₹';

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('desk');

  // ── Invoice search & selection ──
  const [invSearch, setInvSearch]           = useState('');
  const [selectedInvId, setSelectedInvId]   = useState(null);
  const [returnItems, setReturnItems]       = useState([]);

  // ── Return settings ──
  const [refundMode, setRefundMode] = useState('cash');
  const [notes, setNotes]           = useState('');
  const [returnDate, setReturnDate] = useState(today());

  // ── UI ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [successData, setSuccessData]   = useState(null);

  // ── History ──
  const [histSearch, setHistSearch]     = useState('');
  const [histStatus, setHistStatus]     = useState('all');
  const [detailId, setDetailId]         = useState(null);
  const [editModal, setEditModal]       = useState(false);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});

  // ─── Computed ───────────────────────────────────────────────────────────────

  const selectedInv = invoices.find(inv => inv.id === selectedInvId) || null;
  const customer    = selectedInv ? customers.find(c => c.id === selectedInv.customerId) : null;

  const filteredInvoices = useMemo(() => {
    const q = invSearch.toLowerCase().trim();
    const eligible = invoices.filter(inv => (inv.items || []).length > 0);
    if (!q) return eligible.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 25);
    return eligible.filter(inv =>
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.customerName  || '').toLowerCase().includes(q) ||
      (customers.find(c => c.id === inv.customerId)?.phone || '').includes(q)
    ).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
  }, [invoices, customers, invSearch]);

  const activeItems = useMemo(() => returnItems.filter(it => it.returnQty > 0), [returnItems]);

  const stockImpact = useMemo(() => {
    let sellable = 0, damaged = 0;
    activeItems.forEach(it => {
      if ((COND[it.condition] || CONDITIONS[0]).stockType === 'sellable') sellable += it.returnQty;
      else damaged += it.returnQty;
    });
    return { sellable, damaged };
  }, [activeItems]);

  const { total: calcTotal } = useMemo(() => calcSalesReturnTotals(activeItems), [activeItems]);
  const refundAmount = calcTotal;
  const canComplete  = !!selectedInv && activeItems.length > 0 && !isSubmitting;

  const prevReturns = useMemo(() =>
    selectedInv ? salesReturns.filter(r => r.invoiceId === selectedInv.id && r.status !== 'cancelled') : []
  , [salesReturns, selectedInv]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectInv = (inv) => {
    const retMap = buildReturnedMap(salesReturns, inv.id);
    setSelectedInvId(inv.id);
    setReturnItems((inv.items || []).map(it => makeItemRow(it, retMap)));
    setRefundMode('cash');
    setNotes('');
    setReturnDate(today());
  };

  const updateItem = (productId, updates) =>
    setReturnItems(prev => prev.map(it => it.productId === productId ? { ...it, ...updates } : it));

  const handleReset = () => {
    setSelectedInvId(null);
    setReturnItems([]);
    setNotes('');
    setRefundMode('cash');
    setReturnDate(today());
    setShowSuccess(false);
    setSuccessData(null);
  };

  const handleComplete = async () => {
    if (!canComplete) return;
    setIsSubmitting(true);
    try {
      const topReason = activeItems[0]?.reason || 'quality_issue';
      const goodQty    = activeItems.filter(it => (COND[it.condition] || CONDITIONS[0]).stockType === 'sellable').reduce((s, it) => s + it.returnQty, 0);
      const damagedQty = activeItems.reduce((s, it) => s + it.returnQty, 0) - goodQty;

      addSalesReturn({
        invoiceId:    selectedInv.id,
        invoiceNumber: selectedInv.invoiceNumber,
        customerId:   selectedInv.customerId,
        customerName: selectedInv.customerName,
        date:         returnDate,
        reason:       topReason,
        refundMode,
        notes,
        totalAmount:  refundAmount,
        items: activeItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          sku:         it.sku,
          returnQty:   it.returnQty,
          condition:   it.condition,
          reason:      it.reason,
          unitPrice:   it.unitPrice,
          taxPercent:  it.taxPercent,
          discount:    it.discount,
          notes:       it.notes,
        })),
      });

      setSuccessData({ invoiceNumber: selectedInv.invoiceNumber, customerName: selectedInv.customerName, refundAmount, refundMode, goodQty, damagedQty });
      setShowSuccess(true);
      handleReset();
    } catch {
      toast.error('Failed to complete return. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // History
  const historyDetail = salesReturns.find(r => r.id === detailId) || null;

  const filteredHistory = useMemo(() => {
    let list = [...salesReturns];
    if (histStatus !== 'all') list = list.filter(r => r.status === histStatus);
    if (histSearch) {
      const q = histSearch.toLowerCase();
      list = list.filter(r =>
        (r.returnNumber  || '').toLowerCase().includes(q) ||
        (r.customerName  || '').toLowerCase().includes(q) ||
        (r.invoiceNumber || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [salesReturns, histStatus, histSearch]);

  const openEdit = (ret) => {
    setEditId(ret.id);
    setEditForm({ reason: ret.reason || 'quality_issue', refundMode: ret.refundMode || 'cash', notes: ret.notes || '', date: ret.date || ret.returnDate || today() });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    await updateSalesReturn(editId, { reason: editForm.reason, refundMode: editForm.refundMode, notes: editForm.notes, date: editForm.date });
    setEditModal(false);
    toast.success('Return updated');
  };

  const refundMethodLabel = (id) => REFUND_METHODS.find(m => m.id === id)?.label || id || '—';

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ━━━ WORKSTATION HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flexShrink: 0, height: 54, background: '#0F172A', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <RotateCcw size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Return Processing Desk</div>
            <div style={{ fontSize: 9.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 1 }}>Sales Returns · TrackInvo</div>
          </div>
        </div>

        {/* Live indicator */}
        {activeItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#1E3A5F', borderRadius: 99, border: '1px solid #2563EB' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 11, color: '#93C5FD', fontWeight: 700 }}>
              {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} · {formatCurrency(refundAmount, sym)}
            </span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#1E293B', borderRadius: 8, padding: 3, gap: 2 }}>
          {[
            { id: 'desk',    label: 'Processing Desk', Icon: Layers   },
            { id: 'history', label: 'Return History',  Icon: History  },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
              borderRadius: 6, border: 'none',
              background: activeTab === id ? '#fff' : 'transparent',
              color: activeTab === id ? '#0F172A' : '#64748B',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              transition: 'all 0.13s',
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ━━━ PROCESSING DESK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'desk' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ─── PANEL 1 · Invoice Explorer ─────────────────────────────── */}
          <div style={{ width: 282, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1.5px solid #E2E8F0', overflow: 'hidden' }}>

            {/* Panel label */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
              <PanelLabel>Invoice Explorer</PanelLabel>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  placeholder="Invoice, customer, phone..."
                  style={{ width: '100%', height: 34, padding: '0 28px 0 30px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 12.5, background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
                {invSearch && (
                  <button onClick={() => setInvSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Invoice list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
              {filteredInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 10px', color: '#94A3B8' }}>
                  <Inbox size={28} strokeWidth={1} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                  <div style={{ fontSize: 12 }}>No invoices found</div>
                </div>
              ) : filteredInvoices.map(inv => (
                <InvoiceCard key={inv.id} inv={inv} selected={selectedInvId === inv.id} onClick={() => handleSelectInv(inv)} sym={sym} salesReturns={salesReturns} />
              ))}
            </div>

            {/* Customer profile */}
            {selectedInv && (
              <div style={{ flexShrink: 0, borderTop: '1.5px solid #E2E8F0', padding: '12px 14px', background: '#F8FAFC' }}>
                <PanelLabel>Customer</PanelLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={15} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{selectedInv.customerName}</div>
                    {customer?.phone && (
                      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Phone size={10} /> {customer.phone}
                      </div>
                    )}
                  </div>
                </div>
                {[
                  ['Invoice',    selectedInv.invoiceNumber, true,  '#1D4ED8'],
                  ['Total',      formatCurrency(selectedInv.grandTotal || 0, sym), false, '#0F172A'],
                  ['Past Returns', prevReturns.length > 0 ? `${prevReturns.length} return(s)` : 'None', false, prevReturns.length > 0 ? '#D97706' : '#16A34A'],
                  ['Date', formatDate(selectedInv.date || selectedInv.createdAt), false, '#64748B'],
                ].map(([k, v, mono, clr]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11.5 }}>
                    <span style={{ color: '#94A3B8', fontWeight: 500 }}>{k}</span>
                    <span style={{ fontWeight: 700, color: clr, fontFamily: mono ? 'monospace' : 'inherit' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── PANEL 2 · Product Inspection Desk ──────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F1F5F9', overflow: 'hidden' }}>

            <div style={{ flexShrink: 0, padding: '11px 18px', background: '#fff', borderBottom: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <PanelLabel>Product Inspection Desk</PanelLabel>
              {selectedInv && (
                <>
                  <div style={{ width: 1, height: 12, background: '#E2E8F0' }} />
                  <span style={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>{selectedInv.invoiceNumber}</span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>· {(selectedInv.items || []).length} items</span>
                </>
              )}
              <div style={{ flex: 1 }} />
              {activeItems.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
                  {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} queued
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
              {!selectedInv ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 24px' }}>
                  <div style={{ width: 88, height: 88, borderRadius: 24, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Receipt size={40} strokeWidth={1} color="#94A3B8" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#334155', marginBottom: 8 }}>No Invoice Selected</div>
                  <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 300, lineHeight: 1.6 }}>
                    Search and select an invoice from the left panel to begin the return inspection process.
                  </div>
                  <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#2563EB' }}>
                    <ArrowRight size={13} style={{ transform: 'scaleX(-1)' }} />
                    Start by searching an invoice on the left
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760, margin: '0 auto' }}>
                  {returnItems.map(item => (
                    <InspectionCard
                      key={item.productId}
                      item={item}
                      onChange={updates => updateItem(item.productId, updates)}
                      sym={sym}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── PANEL 3 · Return Summary ────────────────────────────────── */}
          <div style={{ width: 278, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1.5px solid #E2E8F0', overflow: 'hidden' }}>

            <div style={{ flexShrink: 0, padding: '11px 14px', borderBottom: '1px solid #F1F5F9' }}>
              <PanelLabel>Return Summary</PanelLabel>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

              {/* Refund amount */}
              <div style={{ borderRadius: 12, padding: '16px', marginBottom: 14, textAlign: 'center', background: canComplete ? 'linear-gradient(135deg, #EFF6FF, #EDE9FE)' : '#F8FAFC', border: `1px solid ${canComplete ? '#BFDBFE' : '#E2E8F0'}` }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: canComplete ? '#1D4ED8' : '#94A3B8', marginBottom: 5 }}>Refund Amount</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: canComplete ? '#1D4ED8' : '#CBD5E1', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(refundAmount, sym)}
                </div>
                {activeItems.length > 0 && (
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 5 }}>
                    {activeItems.reduce((s, i) => s + i.returnQty, 0)} unit{activeItems.reduce((s, i) => s + i.returnQty, 0) !== 1 ? 's' : ''} · {activeItems.length} product{activeItems.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Refund method */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 8 }}>Refund Method</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                  {REFUND_METHODS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setRefundMode(id)} style={{
                      padding: '8px 4px 7px', borderRadius: 9, cursor: 'pointer',
                      border: `1.5px solid ${refundMode === id ? '#2563EB' : '#E2E8F0'}`,
                      background: refundMode === id ? '#EFF6FF' : '#FAFAFA',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                      <Icon size={13} color={refundMode === id ? '#2563EB' : '#94A3B8'} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: refundMode === id ? '#1D4ED8' : '#64748B' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inventory impact */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 8 }}>Inventory Impact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Sellable Stock', qty: stockImpact.sellable, Icon: TrendingUp, activeClr: '#16A34A', activeBg: '#F0FDF4', activeBdr: '#86EFAC', textClr: '#166534' },
                    { label: 'Damaged Stock',  qty: stockImpact.damaged,  Icon: TrendingDown, activeClr: '#DC2626', activeBg: '#FEF2F2', activeBdr: '#FCA5A5', textClr: '#991B1B' },
                  ].map(({ label, qty, Icon, activeClr, activeBg, activeBdr, textClr }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 9, background: qty > 0 ? activeBg : '#F8FAFC', border: `1.5px solid ${qty > 0 ? activeBdr : '#E2E8F0'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={13} color={qty > 0 ? activeClr : '#CBD5E1'} strokeWidth={2.5} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: qty > 0 ? textClr : '#94A3B8' }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 900, color: qty > 0 ? activeClr : '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>+{qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Return date */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 6 }}>Return Date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                  style={{ width: '100%', height: 33, padding: '0 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, background: '#FAFAFA', color: '#0F172A', boxSizing: 'border-box' }} />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 6 }}>
                <label style={{ display: 'block', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 6 }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Return notes, customer remarks..."
                  style={{ width: '100%', padding: '8px 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, background: '#FAFAFA', color: '#0F172A', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Complete + Cancel */}
            <div style={{ flexShrink: 0, padding: '12px 14px', borderTop: '1.5px solid #E2E8F0', background: '#fff' }}>
              <button onClick={handleComplete} disabled={!canComplete}
                style={{ width: '100%', height: 44, borderRadius: 11, border: 'none', cursor: canComplete ? 'pointer' : 'default', fontSize: 14, fontWeight: 800, letterSpacing: '0.01em', marginBottom: 7, background: canComplete ? 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)' : '#E2E8F0', color: canComplete ? '#fff' : '#94A3B8', transition: 'all 0.15s', boxShadow: canComplete ? '0 4px 14px #2563EB40' : 'none' }}>
                {isSubmitting ? 'Processing...' : 'Complete Return'}
              </button>
              <button onClick={handleReset}
                style={{ width: '100%', height: 32, borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                Cancel / Reset Desk
              </button>
            </div>
          </div>

          {/* ─── PANEL 4 · Activity Timeline ────────────────────────────── */}
          <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderLeft: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
              <PanelLabel>Activity</PanelLabel>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
              {!selectedInv ? (
                <div style={{ textAlign: 'center', padding: '20px 8px', fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5 }}>
                  Select an invoice to see the activity timeline
                </div>
              ) : (
                <Timeline invoice={selectedInv} activeItems={activeItems} stockImpact={stockImpact} />
              )}
            </div>
          </div>

        </div>
      )}

      {/* ━━━ HISTORY TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'history' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* History header */}
          <div style={{ flexShrink: 0, padding: '12px 24px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ position: 'relative', width: 300 }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search return no, customer, invoice..."
                  style={{ width: '100%', height: 34, padding: '0 10px 0 30px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'completed', label: 'Completed' },
                { id: 'draft', label: 'Draft' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setHistStatus(tab.id)}
                  style={{ height: 36, padding: '0 16px', background: 'transparent', border: 'none', borderBottom: `2.5px solid ${histStatus === tab.id ? 'var(--brand)' : 'transparent'}`, cursor: 'pointer', fontSize: 13, fontWeight: histStatus === tab.id ? 700 : 500, color: histStatus === tab.id ? 'var(--brand)' : 'var(--text-tertiary)' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* History list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Inbox size={40} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>No returns found</p>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: 'var(--canvas)' }}>
                        {['Return No', 'Invoice', 'Customer', 'Date', 'Items', 'Refund', 'Method', 'Status'].map((h, i) => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: i > 3 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(ret => (
                        <tr key={ret.id} onClick={() => setDetailId(ret.id)}
                          style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ret.returnNumber || '—'}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{ret.invoiceNumber || '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{ret.customerName || '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{formatDate(ret.date || ret.returnDate || ret.createdAt)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{(ret.items || []).length}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#1D4ED8' }}>{formatCurrency(ret.totalAmount || ret.totalRefund || 0, sym)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>{refundMethodLabel(ret.refundMode || ret.refundMethod)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><SRStatusBadge status={ret.status || 'completed'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Detail modal */}
          <HistoryDetailModal ret={historyDetail} sym={sym} onClose={() => setDetailId(null)} onEdit={openEdit} />

          {/* Edit modal */}
          {editModal && (
            <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Return" size="sm"
              footer={
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditModal(false)} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  <button onClick={handleSaveEdit} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save</button>
                </div>
              }>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Return Date</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Refund Method</label>
                  <select value={editForm.refundMode} onChange={e => setEditForm(f => ({ ...f, refundMode: e.target.value }))}
                    style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    {REFUND_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ━━━ SUCCESS OVERLAY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showSuccess && successData && (
        <Modal open={showSuccess} onClose={() => setShowSuccess(false)} title="" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 8px 8px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', border: '2.5px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={30} color="#16A34A" strokeWidth={2.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', marginBottom: 5 }}>Return Processed</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                {successData.invoiceNumber} · {successData.customerName}
              </div>
            </div>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Refund Amount',  successData.refundMode === 'no_refund' ? 'No Refund' : formatCurrency(successData.refundAmount, sym)],
                ['Method',         refundMethodLabel(successData.refundMode)],
                ['Sellable Stock', `+${successData.goodQty} unit${successData.goodQty !== 1 ? 's' : ''}`],
                ['Damaged Stock',  `+${successData.damagedQty} unit${successData.damagedQty !== 1 ? 's' : ''}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '11px 14px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button onClick={() => { setShowSuccess(false); setActiveTab('history'); }}
                style={{ flex: 1, height: 38, borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                View History
              </button>
              <button onClick={() => setShowSuccess(false)}
                style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #2563EB, #4F46E5)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                Process Next Return
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
