import React, { useState, useMemo } from 'react';
import {
  FileText, Search, Plus, X, CreditCard, Printer,
  CheckCircle2, AlertTriangle, Clock, TrendingUp,
  Trash2, Receipt, Inbox, CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import InvoiceViewer from '../components/invoice/InvoiceViewer';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, formatTableDateTime, formatModalDateTime, today } from '../utils/helpers';

const PAY_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'credit',        label: 'Credit' },
];

const STATUS_CFG = {
  paid:    { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Paid' },
  partial: { bg: '#FEFCE8', fg: '#CA8A04', border: '#FDE047', label: 'Partial' },
  unpaid:  { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Unpaid' },
  voided:  { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Voided' },
};

function StatusBadge({ status, small }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unpaid;
  return (
    <span style={{ fontSize: small ? 10 : 11, fontWeight: 700, padding: small ? '2px 7px' : '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function PayBar({ paid, total }) {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  return (
    <div style={{ height: 3, borderRadius: 99, background: '#E4E4E7', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16A34A' : '#F59E0B', borderRadius: 99 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
export default function Invoices() {
  const { state, recordPayment, deleteInvoice } = useApp();
  const { invoices, customers, salesReturns, settings } = state;
  const sym = settings?.currencySymbol || '₹';
  const navigate = useNavigate();

  /* ── Date helpers ── */
  const todayStr = today();

  /* ── Filters ── */
  const [activeTab, setActiveTab]         = useState('today');
  const [datePreset, setDatePreset]       = useState('today');
  const [fromDate, setFromDate]           = useState(todayStr);
  const [toDate, setToDate]               = useState(todayStr);
  const [search, setSearch]               = useState('');
  const [customerFilter, setCustFilter]   = useState('');
  const [payMethodFilter, setMethodFilter] = useState('');
  const [returnFilter, setReturnFilter]   = useState('');

  /* ── Quick date preset ── */
  const applyPreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setFromDate(todayStr); setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const s = y.toISOString().slice(0, 10);
      setFromDate(s); setToDate(s);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      setFromDate(d.toISOString().slice(0, 10)); setToDate(todayStr);
    } else if (preset === 'month') {
      setFromDate(`${todayStr.slice(0, 7)}-01`); setToDate(todayStr);
    }
    // 'custom' and 'all': leave fromDate/toDate for user to adjust
  };

  /* ── Selection / modals ── */
  const [selectedId, setSelected]       = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [slipOpen, setSlipOpen]         = useState(false);
  const [deleteId, setDeleteId]         = useState(null);
  const [payModal, setPayModal]         = useState(false);
  const [payForm, setPayForm]           = useState({ amount: '', method: 'cash', reference: '', notes: '' });
  const [payErrors, setPayErrors]       = useState({});

  /* ── KPI: based on effective date range ── */
  const kpiInvoices = useMemo(() => {
    let list = [...invoices];
    if (activeTab === 'today' || datePreset === 'today') {
      list = list.filter(inv => (inv.date || '').slice(0, 10) === todayStr);
    } else if (datePreset !== 'all') {
      list = list.filter(inv => {
        const d = (inv.date || '').slice(0, 10);
        return d >= fromDate && d <= toDate;
      });
    }
    return list;
  }, [invoices, activeTab, datePreset, todayStr, fromDate, toDate]);

  const todayInvoices  = useMemo(() => invoices.filter(inv => (inv.date || '').slice(0, 10) === todayStr), [invoices, todayStr]);
  const todayRetAmt    = useMemo(() => salesReturns.filter(r => (r.date || '').slice(0, 10) === todayStr).reduce((s, r) => s + (r.totalAmount || 0), 0), [salesReturns, todayStr]);
  const rangeRetAmt    = useMemo(() => salesReturns.filter(r => { const d = (r.date || '').slice(0, 10); return d >= fromDate && d <= toDate; }).reduce((s, r) => s + (r.totalAmount || 0), 0), [salesReturns, fromDate, toDate]);

  const kpi = useMemo(() => {
    const isToday   = activeTab === 'today' || datePreset === 'today';
    const retAmt    = isToday ? todayRetAmt : rangeRetAmt;
    const todaySales = todayInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0) - todayRetAmt;
    const totalInv   = kpiInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0) - retAmt;
    const collected  = kpiInvoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
    const overdue    = invoices.reduce((s, inv) => {
      if (['unpaid', 'partial'].includes(inv.paymentStatus) && inv.dueDate && inv.dueDate < todayStr) {
        return s + (inv.balanceAmount || 0);
      }
      return s;
    }, 0);
    return { todaySales, totalInv, collected, overdue };
  }, [todayInvoices, todayRetAmt, kpiInvoices, rangeRetAmt, invoices, todayStr, activeTab, datePreset]);

  /* ── Filtered invoice list — date filter FIXED ── */
  const filtered = useMemo(() => {
    let list = invoices.filter(inv => inv.status !== 'voided');

    // 1. Date filter — applies to ALL status tabs
    if (activeTab === 'today') {
      // 'today' tab: always pinned to today regardless of preset
      list = list.filter(inv => (inv.date || '').slice(0, 10) === todayStr);
    } else if (datePreset === 'today') {
      list = list.filter(inv => (inv.date || '').slice(0, 10) === todayStr);
    } else if (datePreset !== 'all') {
      // yesterday / week / month / custom — apply date range
      list = list.filter(inv => {
        const d = (inv.date || '').slice(0, 10);
        return d >= fromDate && d <= toDate;
      });
    }
    // datePreset === 'all': no date filter at all

    // 2. Status filter
    if (activeTab === 'paid')     list = list.filter(inv => inv.paymentStatus === 'paid');
    if (activeTab === 'partial')  list = list.filter(inv => inv.paymentStatus === 'partial');
    if (activeTab === 'unpaid')   list = list.filter(inv => inv.paymentStatus === 'unpaid');
    if (activeTab === 'overdue')  list = list.filter(inv =>
      ['unpaid', 'partial'].includes(inv.paymentStatus) && inv.dueDate && inv.dueDate < todayStr
    );
    if (activeTab === 'returned') list = list.filter(inv => inv.returnStatus && inv.returnStatus !== 'none');

    // 3. Other filters
    if (customerFilter)  list = list.filter(inv => inv.customerId === customerFilter);
    if (payMethodFilter) list = list.filter(inv => inv.paymentMethod === payMethodFilter);
    if (returnFilter === 'returned') list = list.filter(inv => inv.returnStatus && inv.returnStatus !== 'none');
    if (returnFilter === 'none')     list = list.filter(inv => !inv.returnStatus || inv.returnStatus === 'none');

    // 4. Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(inv =>
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (customers.find(c => c.id === inv.customerId)?.name || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [invoices, activeTab, datePreset, fromDate, toDate, search, customerFilter, payMethodFilter, returnFilter, todayStr, customers]);

  const selInvoice  = invoices.find(inv => inv.id === selectedId) || null;
  const selCustomer = selInvoice ? customers.find(c => c.id === selInvoice.customerId) : null;

  /* ── Payment modal ── */
  const openInvoiceModal = (id) => {
    setSelected(id);
    setSlipOpen(false);
    setInvoiceModal(true);
  };

  const openPayModal = () => {
    if (!selInvoice) return;
    setPayForm({ amount: (selInvoice.balanceAmount || 0).toFixed(2), method: 'cash', reference: '', notes: '' });
    setPayErrors({});
    setPayModal(true);
  };

  const handlePay = async () => {
    const errs = {};
    const amt = parseFloat(payForm.amount);
    if (!payForm.amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
    if (selInvoice && amt > (selInvoice.balanceAmount || 0) + 0.01) errs.amount = `Max: ${formatCurrency(selInvoice.balanceAmount, sym)}`;
    if (Object.keys(errs).length) { setPayErrors(errs); return; }
    await recordPayment(selectedId, { amount: amt, method: payForm.method, reference: payForm.reference, notes: payForm.notes, date: todayStr });
    setPayModal(false);
  };

  const handleDelete = async () => {
    await deleteInvoice(deleteId);
    if (selectedId === deleteId) setSelected(null);
    setDeleteId(null);
  };

  /* ── Tab config ── */
  const TABS = [
    { value: 'today',    label: 'Today',    icon: CalendarDays },
    { value: 'paid',     label: 'Paid',     icon: CheckCircle2 },
    { value: 'partial',  label: 'Partial',  icon: Clock },
    { value: 'unpaid',   label: 'Unpaid',   icon: AlertTriangle },
    { value: 'overdue',  label: 'Overdue',  icon: AlertTriangle },
    { value: 'returned', label: 'Returned', icon: Receipt },
    { value: 'all',      label: 'All',      icon: FileText },
  ];

  const hasFilters = search || customerFilter || payMethodFilter || returnFilter;

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, padding: '16px 24px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} color="var(--brand)" /> Invoices</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} shown</p>
          </div>
          <button onClick={() => navigate('/billing')} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.5} /> New Invoice
          </button>
        </div>

        {/* KPI strip */}
        <div className="kpi-strip" style={{ marginBottom: 12 }}>
          {[
            { label: "Today's Sales",   value: formatCurrency(kpi.todaySales, sym),  fg: '#4F46E5', bg: '#EEF2FF',  icon: TrendingUp },
            { label: 'Period Invoiced', value: formatCurrency(kpi.totalInv, sym),    fg: '#1D4ED8', bg: '#EFF6FF',  icon: FileText },
            { label: 'Collected',       value: formatCurrency(kpi.collected, sym),   fg: '#16A34A', bg: '#F0FDF4',  icon: CheckCircle2 },
            { label: 'Overdue Balance', value: formatCurrency(kpi.overdue, sym),     fg: kpi.overdue > 0 ? '#DC2626' : '#16A34A', bg: kpi.overdue > 0 ? '#FEF2F2' : '#F0FDF4', icon: AlertTriangle },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} style={{ background: card.bg, borderRadius: 10, padding: '10px 14px', border: `1px solid ${card.fg}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Icon size={12} color={card.fg} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: card.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: card.fg }}>{card.value}</div>
              </div>
            );
          })}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.value;
            return (
              <button key={tab.value} onClick={() => {
                setActiveTab(tab.value);
                if (tab.value === 'all')   applyPreset('all');
                if (tab.value === 'today') applyPreset('today');
              }} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '8px 14px', fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Icon size={12} strokeWidth={active ? 2.5 : 2} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div style={{ flexShrink: 0, padding: '8px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 140px', minWidth: 120 }}>
          <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Invoice #, customer…" style={{ width: '100%', paddingLeft: 27, paddingRight: 8, height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
        </div>
        <select value={customerFilter} onChange={e => setCustFilter(e.target.value)} style={fltSel}>
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={payMethodFilter} onChange={e => setMethodFilter(e.target.value)} style={fltSel}>
          <option value="">All Methods</option>
          {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={returnFilter} onChange={e => setReturnFilter(e.target.value)} style={fltSel}>
          <option value="">Any Return</option>
          <option value="returned">Has Returns</option>
          <option value="none">No Returns</option>
        </select>

        {/* Date preset buttons — hidden on 'today' tab */}
        {activeTab !== 'today' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { key: 'today',     label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week',      label: 'This Week' },
              { key: 'month',     label: 'This Month' },
              { key: 'custom',    label: 'Custom' },
              { key: 'all',       label: 'All Time' },
            ].map(p => (
              <button key={p.key} onClick={() => {
                applyPreset(p.key);
                if (p.key === 'all') setActiveTab('all');
              }} style={{ height: 28, padding: '0 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6, cursor: 'pointer', background: datePreset === p.key ? 'var(--brand)' : 'var(--canvas)', color: datePreset === p.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${datePreset === p.key ? 'var(--brand)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...fltSel, paddingLeft: 8, height: 28 }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>–</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...fltSel, paddingLeft: 8, height: 28 }} />
              </>
            )}
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setSearch(''); setCustFilter(''); setMethodFilter(''); setReturnFilter(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── Workspace ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: professional data table */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Inbox size={40} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No invoices</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {activeTab === 'today' ? 'No invoices today — create one to get started' : 'No invoices match the current filters'}
              </div>
              {activeTab === 'today' && (
                <button onClick={() => navigate('/billing')} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Plus size={14} /> Create Invoice
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--canvas)', position: 'sticky', top: 0, zIndex: 10 }}>
                  {[
                    ['Invoice #', 'left'],
                    ['Invoice Date', 'left'],
                    ['Customer', 'left'],
                    ['Items', 'right'],
                    ['Method', 'left'],
                    ['Grand Total', 'right'],
                    ['Paid', 'right'],
                    ['Balance', 'right'],
                    ['Status', 'left'],
                    ['Return', 'left'],
                    ['', 'center'],
                  ].map(([h, align]) => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: align, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const cust  = customers.find(c => c.id === inv.customerId);
                  const isSel = inv.id === selectedId;
                  const hasRet = inv.returnStatus && inv.returnStatus !== 'none';
                  const method = PAY_METHODS.find(m => m.value === inv.paymentMethod)?.label || inv.paymentMethod || '—';
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openInvoiceModal(inv.id)}
                      style={{ cursor: 'pointer', background: isSel ? 'var(--brand-faint)' : 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', borderLeft: isSel ? '3px solid var(--brand)' : '3px solid transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--canvas)'; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface)'; }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: isSel ? 'var(--brand)' : 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {formatDate(inv.date || inv.createdAt)}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(inv.items || []).length}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{method}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(inv.grandTotal || 0, sym)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16A34A', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(inv.paidAmount || 0, sym)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: (inv.balanceAmount || 0) > 0 ? '#DC2626' : '#16A34A', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(inv.balanceAmount || 0, sym)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={inv.paymentStatus} small />
                        {inv.paymentStatus === 'partial' && (
                          <PayBar paid={inv.paidAmount || 0} total={inv.grandTotal || 0} />
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {hasRet ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', whiteSpace: 'nowrap' }}>
                            {inv.returnStatus === 'full' ? 'Full Return' : 'Partial'}
                          </span>
                        ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {inv.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => { openInvoiceModal(inv.id); setTimeout(openPayModal, 0); }}
                              title="Record Payment"
                              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-faint)', color: 'var(--brand)', border: '1px solid var(--brand-light)', borderRadius: 6, cursor: 'pointer' }}
                            >
                              <CreditCard size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            title="Void Invoice (reverses stock)"
                            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ══════ INVOICE DETAIL MODAL ══════ */}
      <Modal
        open={invoiceModal && !!selInvoice}
        onClose={() => { setInvoiceModal(false); setSelected(null); setSlipOpen(false); }}
        title={selInvoice ? selInvoice.invoiceNumber : ''}
        size="lg"
      >
        {selInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {slipOpen ? (
              /* ── SLIP VIEW ── */
              <>
                <button
                  onClick={() => setSlipOpen(false)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', marginBottom: 14, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, alignSelf: 'flex-start', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >← Back to Details</button>
                <InvoiceViewer invoice={selInvoice} customer={selCustomer} settings={settings} />
              </>
            ) : (
              /* ── DETAILS VIEW ── */
              <>
                {/* Action bar */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusBadge status={selInvoice.paymentStatus} />
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setSlipOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--brand-faint)', color: 'var(--brand)', border: '1.5px solid var(--brand-light)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                  ><Receipt size={12} /> Preview Invoice Slip</button>
                  {selInvoice.paymentStatus !== 'paid' && (
                    <button onClick={openPayModal} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <CreditCard size={12} /> Record Payment
                    </button>
                  )}
                  <button onClick={() => { setDeleteId(selInvoice.id); setInvoiceModal(false); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
                    <Trash2 size={12} /> Void
                  </button>
                </div>

                {/* KPI strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Grand Total', value: formatCurrency(selInvoice.grandTotal || 0, sym), fg: '#4F46E5', bg: '#EEF2FF' },
                    { label: 'Paid',        value: formatCurrency(selInvoice.paidAmount || 0, sym),  fg: '#16A34A', bg: '#F0FDF4' },
                    { label: 'Balance',     value: formatCurrency(selInvoice.balanceAmount || 0, sym), fg: (selInvoice.balanceAmount || 0) > 0 ? '#DC2626' : '#16A34A', bg: (selInvoice.balanceAmount || 0) > 0 ? '#FEF2F2' : '#F0FDF4' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 9, padding: '9px 12px', border: `1px solid ${k.fg}22` }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: k.fg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: k.fg, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Customer + meta grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, padding: '12px 14px', background: 'var(--canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Customer</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{selCustomer?.name || selInvoice.customerName || 'Walk-in'}</div>
                    {selCustomer?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{selCustomer.phone}</div>}
                    {selCustomer?.email && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selCustomer.email}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Invoice Info</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Date</span>
                        <span style={{ fontWeight: 600 }}>{formatModalDateTime(selInvoice.date, selInvoice.createdAt)}</span>
                      </div>
                      {selInvoice.dueDate && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>Due</span>
                          <span style={{ fontWeight: 600, color: selInvoice.dueDate < todayStr && selInvoice.paymentStatus !== 'paid' ? '#DC2626' : 'inherit' }}>{formatDate(selInvoice.dueDate)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Method</span>
                        <span style={{ fontWeight: 600 }}>{PAY_METHODS.find(m => m.value === selInvoice.paymentMethod)?.label || selInvoice.paymentMethod || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items table */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Items · {(selInvoice.items || []).length}</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--canvas)' }}>
                          {[['Product', 'left'], ['Qty', 'right'], ['Unit', 'right'], ['Disc', 'right'], ['Tax', 'right'], ['Total', 'right']].map(([h, a]) => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: a, fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selInvoice.items || []).map((item, i) => {
                          const lineNet   = Math.max(0, (item.unitPrice || 0) * (item.quantity || 0) - (item.discount || 0));
                          const lineTax   = lineNet * (item.taxPercent || 0) / 100;
                          const lineTotal = lineNet + lineTax;
                          return (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--canvas)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(item.unitPrice || 0, sym)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (item.discount || 0) > 0 ? '#16A34A' : 'var(--text-tertiary)' }}>{(item.discount || 0) > 0 ? `−${formatCurrency(item.discount, sym)}` : '—'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{(item.taxPercent || 0) > 0 ? `${item.taxPercent}%` : '—'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(lineTotal, sym)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial summary */}
                <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      <span>Subtotal</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(selInvoice.subtotal || 0, sym)}</span>
                    </div>
                    {(selInvoice.itemDiscounts || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#16A34A' }}>
                        <span>Discount</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{formatCurrency(selInvoice.itemDiscounts, sym)}</span>
                      </div>
                    )}
                    {(selInvoice.taxAmount || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        <span>Tax</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(selInvoice.taxAmount, sym)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', borderTop: '2px solid var(--border)', paddingTop: 8, marginTop: 3 }}>
                      <span>Grand Total</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--brand)' }}>{formatCurrency(selInvoice.grandTotal || 0, sym)}</span>
                    </div>
                  </div>
                </div>

                {/* Return status */}
                {selInvoice.returnStatus && selInvoice.returnStatus !== 'none' && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Receipt size={14} color="#DC2626" />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#DC2626' }}>{selInvoice.returnStatus === 'full' ? 'Full Return' : 'Partial Return'}</div>
                      <div style={{ fontSize: 11, color: '#991B1B', marginTop: 1 }}>Stock restocked. See Sales Returns for details.</div>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                {selInvoice.payments?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Payment History</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                      {selInvoice.payments.map((pmt, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--surface)' : 'var(--canvas)' }}>
                          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDateTime(pmt.date)}</span>
                            <span style={{ background: 'var(--border)', borderRadius: 5, padding: '1px 7px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{PAY_METHODS.find(m => m.value === pmt.method)?.label || pmt.method}</span>
                            {pmt.reference && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{pmt.reference}</span>}
                          </div>
                          <span style={{ fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(pmt.amount, sym)}</span>
                        </div>
                      ))}
                    </div>
                    {selInvoice.paymentStatus !== 'paid' && (
                      <div style={{ marginTop: 5, display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Balance: <strong style={{ marginLeft: 5, color: '#DC2626' }}>{formatCurrency(selInvoice.balanceAmount || 0, sym)}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selInvoice.notes && (
                  <div style={{ marginBottom: 4, padding: '10px 14px', background: 'var(--canvas)', borderRadius: 9, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selInvoice.notes}</div>
                  </div>
                )}

              </>
            )}
          </div>
        )}
      </Modal>

      {/* ═══════════════ RECORD PAYMENT MODAL ═══════════════ */}
      <Modal
        open={payModal}
        onClose={() => setPayModal(false)}
        title={`Record Payment — ${selInvoice?.invoiceNumber || ''}`}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setPayModal(false)} style={cancelBtn}>Cancel</button>
            <button onClick={handlePay} style={primaryBtn}>Record Payment</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selInvoice && (
            <div style={{ background: 'var(--brand-faint)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{selCustomer?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Balance due</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--brand)' }}>{formatCurrency(selInvoice.balanceAmount || 0, sym)}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Amount *" error={payErrors.amount}>
              <Input type="number" min="0" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} error={!!payErrors.amount} />
            </FormField>
            <FormField label="Method">
              <Select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Reference / Transaction ID">
            <Input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="UTR, cheque no, etc." />
          </FormField>
          <FormField label="Notes">
            <Textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ═══════════════ CONFIRM DELETE ═══════════════ */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Void Invoice"
        message="This will void the invoice and reverse all stock deductions. The invoice will be hidden from all lists. This cannot be undone."
        confirmLabel="Void Invoice"
      />
    </div>
  );
}

/* ── Shared styles ─────────────────────────────────────────────────────────── */
const fltSel = {
  height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7,
  background: 'var(--canvas)', color: 'var(--text-primary)', padding: '0 8px', cursor: 'pointer',
};

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
};

const cancelBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1.5px solid var(--border)', cursor: 'pointer',
};
