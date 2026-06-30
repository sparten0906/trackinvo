import React, { useState, useMemo } from 'react';
import {
  Plus, Search, X, RotateCcw, Receipt, Inbox,
  Eye, DollarSign, AlertTriangle, Clock, PackageCheck,
  CheckCircle2, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, formatTableDateTime, formatModalDateTime } from '../utils/helpers';

// ─── Config ────────────────────────────────────────────────────────────────────

const COND_META = {
  good:          { label: 'Good',          stockType: 'sellable' },
  damaged:       { label: 'Damaged',       stockType: 'damaged'  },
  defective:     { label: 'Defective',     stockType: 'damaged'  },
  used:          { label: 'Used',          stockType: 'damaged'  },
  not_resellable:{ label: 'Not Resellable',stockType: 'damaged'  },
};

const STATUS_CFG = {
  completed: { bg: '#F0FDF4', fg: '#16A34A', bdr: '#BBF7D0', label: 'Completed' },
  draft:     { bg: '#FEFCE8', fg: '#CA8A04', bdr: '#FEF08A', label: 'Pending'   },
  cancelled: { bg: '#F4F4F5', fg: '#71717A', bdr: '#D4D4D8', label: 'Cancelled' },
};

const REFUND_LABELS = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', credit_note: 'Credit Note',
  upi: 'UPI', store_credit: 'Store Credit', no_refund: 'No Refund',
};

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function getReturnType(items = []) {
  if (!items.length) return { label: '—', bg: '#F4F4F5', fg: '#71717A' };
  const hasSellable = items.some(i => (COND_META[i.condition] || COND_META.good).stockType === 'sellable');
  const hasDamaged  = items.some(i => (COND_META[i.condition] || COND_META.good).stockType === 'damaged');
  if (hasSellable && hasDamaged) return { label: 'Mixed',      bg: '#FEFCE8', fg: '#CA8A04' };
  if (hasSellable)               return { label: 'Resellable', bg: '#F0FDF4', fg: '#16A34A' };
  return                                { label: 'Damaged',    bg: '#FEF2F2', fg: '#DC2626' };
}

function getStockImpact(items = []) {
  let sellable = 0, damaged = 0;
  items.forEach(i => {
    const qty = Number(i.returnQty || 0);
    if ((COND_META[i.condition] || COND_META.good).stockType === 'sellable') sellable += qty;
    else damaged += qty;
  });
  return { sellable, damaged };
}

// ─── Small shared components ────────────────────────────────────────────────────

function Pill({ bg, fg, bdr, children }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color: fg, border: `1px solid ${bdr || bg}`, whiteSpace: 'nowrap', lineHeight: 1.6 }}>
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.completed;
  return <Pill bg={c.bg} fg={c.fg} bdr={c.bdr}>{c.label}</Pill>;
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={iconColor} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Return Detail Drawer ──────────────────────────────────────────────────────

const DRAWER_TABS = ['Overview', 'Items', 'Timeline'];

function DetailModal({ ret, sym, onClose }) {
  const [tab, setTab] = useState('Overview');
  if (!ret) return null;

  const type   = getReturnType(ret.items);
  const impact = getStockImpact(ret.items);

  const condColor = {
    good:          { bg: '#F0FDF4', fg: '#16A34A', bdr: '#BBF7D0', label: 'Good'          },
    damaged:       { bg: '#FEF2F2', fg: '#DC2626', bdr: '#FECACA', label: 'Damaged'       },
    defective:     { bg: '#FFF7ED', fg: '#EA580C', bdr: '#FED7AA', label: 'Defective'     },
    used:          { bg: '#F5F3FF', fg: '#7C3AED', bdr: '#DDD6FE', label: 'Used'          },
    not_resellable:{ bg: '#F4F4F5', fg: '#71717A', bdr: '#D4D4D8', label: 'Not Resellable'},
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', background: 'rgba(15,15,20,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 660,
        maxHeight: 'calc(100vh - 40px)',
        background: 'var(--surface)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Modal header ── */}
        <div style={{ flexShrink: 0, padding: '18px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Return number + badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <RotateCcw size={14} color="#E11D48" />
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Menlo, Consolas, monospace', letterSpacing: '0.01em' }}>
                    {ret.returnNumber || '—'}
                  </span>
                </div>
                <StatusPill status={ret.status || 'completed'} />
                <Pill bg={type.bg} fg={type.fg}>{type.label}</Pill>
              </div>
              {/* Sub-info */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{ret.customerName || '—'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Invoice <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontWeight: 700, color: 'var(--brand)' }}>{ret.invoiceNumber || '—'}</span></span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* KPI summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { lbl: 'Total Refund', val: formatCurrency(ret.totalAmount || 0, sym), clr: 'var(--brand)',        bg: 'var(--brand-faint)', bdr: 'var(--brand-light, #c7d2fe)' },
              { lbl: 'Products',     val: (ret.items || []).length,                  clr: 'var(--text-primary)', bg: 'var(--canvas)',       bdr: 'var(--border)'              },
              { lbl: 'Total Units',  val: (ret.items || []).reduce((s, i) => s + Number(i.returnQty || 0), 0), clr: 'var(--text-primary)', bg: 'var(--canvas)', bdr: 'var(--border)' },
            ].map(({ lbl, val, clr, bg, bdr }) => (
              <div key={lbl} style={{ padding: '10px 13px', borderRadius: 9, background: bg, border: `1px solid ${bdr}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: clr, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginLeft: -22, marginRight: -22, paddingLeft: 22 }}>
            {DRAWER_TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? 'var(--brand)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${tab === t ? 'var(--brand)' : 'transparent'}`,
                marginBottom: -1, whiteSpace: 'nowrap',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 22px' }}>

          {tab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Return details grid */}
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Return Information
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  {[
                    ['Return No.',   ret.returnNumber || '—'],
                    ['Invoice',      ret.invoiceNumber || '—'],
                    ['Customer',     ret.customerName  || '—'],
                    ['Return Date',  formatModalDateTime(ret.date, ret.createdAt)],
                    ['Refund Via',   REFUND_LABELS[ret.refundMode || ret.refundMethod] || '—'],
                    ['Reason',       ret.reason || '—'],
                  ].map(([k, v], i) => (
                    <div key={k} style={{ padding: '10px 14px', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock impact */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Stock Impact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Sellable Stock Returned', qty: impact.sellable, bg: '#F0FDF4', fg: '#16A34A', bdr: '#BBF7D0', icon: '↑' },
                    { label: 'Damaged Stock Added',     qty: impact.damaged,  bg: '#FEF2F2', fg: '#DC2626', bdr: '#FECACA', icon: '⚠' },
                  ].map(({ label, qty, bg, fg, bdr, icon }) => (
                    <div key={label} style={{ padding: '12px 14px', borderRadius: 9, background: qty > 0 ? bg : 'var(--canvas)', border: `1px solid ${qty > 0 ? bdr : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: qty > 0 ? fg : 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: qty > 0 ? fg : 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>+{qty}</div>
                      </div>
                      <span style={{ fontSize: 22, opacity: qty > 0 ? 0.3 : 0.15 }}>{icon}</span>
                    </div>
                  ))}
                </div>
              </div>

              {ret.notes && (
                <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Notes</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{ret.notes}</p>
                </div>
              )}

              {/* Audit section */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Audit</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Created On</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{formatDateTime(ret.createdAt)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'Items' && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)' }}>
                    {['Product', 'Qty', 'Condition', 'Refund'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ret.items || []).map((it, idx) => {
                    const c = condColor[it.condition] || condColor.good;
                    return (
                      <tr key={idx} style={{ borderBottom: idx < (ret.items.length - 1) ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{it.productName}</div>
                          {it.sku && <div style={{ fontSize: 11, fontFamily: 'Menlo, Consolas, monospace', color: 'var(--text-tertiary)', marginTop: 1 }}>{it.sku}</div>}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{it.returnQty}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <Pill bg={c.bg} fg={c.fg} bdr={c.bdr}>{c.label}</Pill>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(Number(it.returnQty || 0) * Number(it.unitPrice || 0), sym)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--canvas)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3} style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 13 }}>Total Refund</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 900, color: 'var(--brand)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(ret.totalAmount || 0, sym)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {tab === 'Timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 4 }}>
              {[
                { label: 'Return Created',   desc: `Against invoice ${ret.invoiceNumber}`,   done: true,                        clr: 'var(--brand)'  },
                { label: 'Items Inspected',  desc: `${(ret.items||[]).length} product(s) reviewed`, done: true,                 clr: '#7C3AED'       },
                { label: 'Stock Updated',    desc: `+${impact.sellable} sellable, +${impact.damaged} damaged`, done: ret.status === 'completed', clr: '#16A34A' },
                { label: 'Refund Processed', desc: `${formatCurrency(ret.totalAmount||0, sym)} via ${REFUND_LABELS[ret.refundMode || ret.refundMethod] || 'Cash'}`, done: ret.status === 'completed', clr: '#D97706' },
              ].map((ev, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < arr.length - 1 ? 20 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ev.done ? ev.clr : 'var(--border)', marginTop: 3, flexShrink: 0, boxShadow: ev.done ? `0 0 0 3px ${ev.clr}22` : 'none' }} />
                    {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 5 }} />}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: ev.done ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{ev.label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>{ev.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Modal footer ── */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 22px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 20px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--canvas)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const fSel = { height: 30, padding: '0 28px 0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: `var(--canvas) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717A' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E") no-repeat right 6px center / 16px 16px`, color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' };

export default function SalesReturns() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { salesReturns = [], stockTransactions = [], settings } = state;
  const sym = settings?.currencySymbol || '₹';

  const [search,    setSearch]    = useState('');
  const [statusFlt, setStatusFlt] = useState('all');
  const [typeFlt,   setTypeFlt]   = useState('all');
  const [activeRet, setActiveRet] = useState(null);

  // KPIs
  const kpis = useMemo(() => {
    const active = salesReturns.filter(r => r.status !== 'cancelled');
    let refund = 0, sell = 0, dmg = 0, pending = 0;
    active.forEach(r => {
      refund += Number(r.totalAmount || 0);
      const imp = getStockImpact(r.items);
      sell += imp.sellable; dmg += imp.damaged;
      if (r.status === 'draft') pending++;
    });
    return { total: salesReturns.length, refund, sell, dmg, pending };
  }, [salesReturns]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return salesReturns
      .filter(r => {
        if (statusFlt !== 'all' && (r.status || 'completed') !== statusFlt) return false;
        if (typeFlt !== 'all') {
          const t = getReturnType(r.items).label.toLowerCase();
          if (typeFlt !== t) return false;
        }
        if (!q) return true;
        return (r.returnNumber || '').toLowerCase().includes(q) ||
               (r.invoiceNumber || '').toLowerCase().includes(q) ||
               (r.customerName  || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
  }, [salesReturns, search, statusFlt, typeFlt]);

  const hasFilter = search || statusFlt !== 'all' || typeFlt !== 'all';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }} className="animate-fadeIn">

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><RotateCcw size={20} color="#E11D48" /> Sales Returns</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Manage customer returns, refunds and stock impact.</p>
          </div>
          <button
            onClick={() => navigate('/sales-returns/new')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            <Plus size={14} strokeWidth={2.5} /> New Return
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: 260 }}>
            <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Return no., invoice, customer…"
              style={{ width: '100%', paddingLeft: 27, height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <select value={statusFlt} onChange={e => setStatusFlt(e.target.value)} style={fSel}>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="draft">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={typeFlt} onChange={e => setTypeFlt(e.target.value)} style={fSel}>
            <option value="all">All Types</option>
            <option value="resellable">Resellable</option>
            <option value="mixed">Mixed</option>
            <option value="damaged">Damaged</option>
          </select>
          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setStatusFlt('all'); setTypeFlt('all'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 28px' }}>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
          <KpiCard icon={RotateCcw}     label="Total Returns"     value={kpis.total}                         iconBg="#FFF1F2" iconColor="#E11D48" />
          <KpiCard icon={DollarSign}    label="Total Refunded"    value={formatCurrency(kpis.refund, sym)}   iconBg="var(--brand-faint)" iconColor="var(--brand)" />
          <KpiCard icon={PackageCheck}  label="Sellable Returned" value={`${kpis.sell} units`}               iconBg="#F0FDF4" iconColor="#16A34A" />
          <KpiCard icon={AlertTriangle} label="Damaged Stock"     value={`${kpis.dmg} units`}                iconBg="#FEF2F2" iconColor="#DC2626" />
          <KpiCard icon={Clock}         label="Pending"           value={kpis.pending}                       iconBg="#FEFCE8" iconColor="#CA8A04" />
        </div>

        {/* Table card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

          {/* Table toolbar */}
          <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Return History</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} of {salesReturns.length} records</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--zinc-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: 'var(--text-tertiary)' }}>
                <Inbox size={22} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5 }}>
                {salesReturns.length === 0 ? 'No returns yet' : 'No results found'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 260, marginBottom: 18 }}>
                {salesReturns.length === 0 ? 'Create your first return from a customer invoice.' : 'Try adjusting the search or filter.'}
              </div>
              {salesReturns.length === 0 && (
                <button onClick={() => navigate('/sales-returns/new')} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Plus size={13} /> New Return
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)' }}>
                    {['Return No.', 'Invoice', 'Customer', 'Return Date', 'Items', 'Refund', 'Method', 'Status', 'Type', ''].map((h, i) => (
                      <th key={h + i} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ret, idx) => {
                    const type   = getReturnType(ret.items);
                    const isLast = idx === filtered.length - 1;
                    return (
                      <tr
                        key={ret.id}
                        onClick={() => setActiveRet(ret)}
                        style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--zinc-50)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                      >
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)', fontFamily: 'Menlo, Consolas, monospace' }}>{ret.returnNumber || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12.5, fontFamily: 'Menlo, Consolas, monospace', color: 'var(--text-secondary)' }}>{ret.invoiceNumber || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 16px', maxWidth: 160 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ret.customerName || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          {(() => { const dt = formatTableDateTime(ret.date || ret.returnDate, ret.createdAt); return <><div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{dt.date}</div>{dt.time && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{dt.time}</div>}</>; })()}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                          {(ret.items || []).length}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatCurrency(ret.totalAmount || 0, sym)}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {REFUND_LABELS[ret.refundMode || ret.refundMethod] || '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <StatusPill status={ret.status || 'completed'} />
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Pill bg={type.bg} fg={type.fg}>{type.label}</Pill>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Eye size={14} color="var(--text-tertiary)" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {activeRet && (
        <DetailModal ret={activeRet} sym={sym} onClose={() => setActiveRet(null)} />
      )}
    </div>
  );
}
