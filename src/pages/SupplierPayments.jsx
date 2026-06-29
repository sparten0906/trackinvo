import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Wallet, Search, X, Plus, Trash2, Edit3, Download, Inbox,
  Banknote, Smartphone, Building2, CreditCard, FileCheck, MoreHorizontal,
  AlertCircle, CheckCircle2, Clock, TrendingDown, ShoppingCart, ReceiptText,
  ArrowUpRight, ChevronDown, ChevronUp, Calendar, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, today } from '../utils/helpers';
import Modal from '../components/ui/Modal';
import PayableReceiptViewer from '../components/payables/PayableReceiptViewer';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAY_MODES = [
  { value: 'cash',          label: 'Cash',          icon: Banknote        },
  { value: 'upi',           label: 'UPI',           icon: Smartphone      },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2       },
  { value: 'card',          label: 'Card',          icon: CreditCard      },
  { value: 'cheque',        label: 'Cheque',        icon: FileCheck       },
  { value: 'other',         label: 'Other',         icon: MoreHorizontal  },
];

const GPBL_CATEGORIES = [
  { value: 'rent',           label: 'Rent'                },
  { value: 'utilities',      label: 'Utilities'           },
  { value: 'salary',         label: 'Salary'              },
  { value: 'freight',        label: 'Freight'             },
  { value: 'transport',      label: 'Transport'           },
  { value: 'repair',         label: 'Repair & Maintenance'},
  { value: 'office_expense', label: 'Office Expense'      },
  { value: 'miscellaneous',  label: 'Miscellaneous'       },
  { value: 'other',          label: 'Other'               },
];

const STATUS_CFG = {
  unpaid:  { label: 'Unpaid',   bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  partial: { label: 'Partial',  bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  paid:    { label: 'Paid',     bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0' },
  overdue: { label: 'Overdue',  bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' },
};

const TYPE_CFG = {
  purchase_order:   { label: 'Purchase Order',   short: 'PO',   bg: 'rgba(139,92,246,0.1)', fg: '#7C3AED' },
  general_purchase: { label: 'General Purchase', short: 'GP',   bg: 'rgba(59,130,246,0.1)', fg: '#2563EB' },
  general_payable:  { label: 'General Payable',  short: 'GPBL', bg: 'rgba(20,184,166,0.1)', fg: '#0D9488' },
};

const PAYABLE_PO_STATUSES = new Set(['approved', 'partially_received', 'fully_received', 'closed']);

const mkPayForm = () => ({ paymentAmount: '', paymentDate: today(), paymentMode: 'cash', transactionReference: '', notes: '' });
const mkGpblForm = () => ({ payableName: '', payableCategory: 'miscellaneous', vendorName: '', totalAmount: '', dueDate: '', notes: '' });

// ─── Atoms ──────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.unpaid;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const c = TYPE_CFG[type] || TYPE_CFG.general_payable;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', background: c.bg, color: c.fg }}>
      {c.short}
    </span>
  );
}

function PayModeChip({ mode }) {
  const m = PAY_MODES.find(p => p.value === mode);
  if (!m) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{mode || '—'}</span>;
  const Icon = m.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
      <Icon size={11} />{m.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }) {
  const palettes = {
    indigo: ['rgba(99,102,241,0.09)',  '#6366F1'],
    green:  ['rgba(34,197,94,0.09)',   '#22C55E'],
    amber:  ['rgba(245,158,11,0.09)',  '#F59E0B'],
    red:    ['rgba(239,68,68,0.09)',   '#EF4444'],
    purple: ['rgba(139,92,246,0.09)', '#7C3AED'],
    teal:   ['rgba(20,184,166,0.09)', '#14B8A6'],
  };
  const [bg, fg] = palettes[color] || palettes.indigo;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color: fg }} />
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// ─── Payment Form ────────────────────────────────────────────────────────────────

function PaymentForm({ outstanding, sym, form, setForm, errors, saving, onSave, onCancel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Amount *</label>
          <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 8, border: `1.5px solid ${errors.paymentAmount ? '#EF4444' : 'var(--border)'}`, background: 'var(--canvas)', overflow: 'hidden' }}>
            <span style={{ padding: '0 4px 0 10px', color: 'var(--text-secondary)', fontSize: 13, flexShrink: 0, userSelect: 'none', lineHeight: '36px' }}>{sym}</span>
            <input type="number" step="0.01" min="0.01" value={form.paymentAmount}
              onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))}
              placeholder={outstanding.toFixed(2)}
              style={{ flex: 1, height: '100%', padding: '0 8px 0 2px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, outline: 'none', minWidth: 0 }} />
          </div>
          {errors.paymentAmount && <p style={{ fontSize: 11, color: '#EF4444', margin: '3px 0 0' }}>{errors.paymentAmount}</p>}
          {outstanding > 0 && (
            <button type="button" onClick={() => setForm(f => ({ ...f, paymentAmount: outstanding.toFixed(2) }))}
              style={{ marginTop: 3, fontSize: 11, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
              Pay full ({formatCurrency(outstanding, sym)})
            </button>
          )}
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date *</label>
          <input type="date" value={form.paymentDate}
            onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: `1.5px solid ${errors.paymentDate ? '#EF4444' : 'var(--border)'}`, background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }} />
          {errors.paymentDate && <p style={{ fontSize: 11, color: '#EF4444', margin: '3px 0 0' }}>{errors.paymentDate}</p>}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Payment Mode *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PAY_MODES.map(m => {
            const Icon = m.icon; const sel = form.paymentMode === m.value;
            return (
              <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, paymentMode: m.value }))}
                style={{ height: 32, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${sel ? '#6366F1' : 'var(--border)'}`, background: sel ? 'rgba(99,102,241,0.08)' : 'var(--canvas)', color: sel ? '#6366F1' : 'var(--text-secondary)', fontSize: 12, fontWeight: sel ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon size={12} />{m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Transaction / Ref. No. (optional)</label>
          <input placeholder="Cheque no., UTR…" value={form.transactionReference}
            onChange={e => setForm(f => ({ ...f, transactionReference: e.target.value }))}
            style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
          <input placeholder="Any notes…" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel}
          style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={onSave} disabled={saving}
          style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
          <Plus size={14} />{saving ? 'Saving…' : 'Save Payment'}
        </button>
      </div>
    </div>
  );
}

// ─── Payment History List ─────────────────────────────────────────────────────

function PaymentHistory({ payments, sym, onDelete, onReceipt }) {
  if (!payments.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', color: 'var(--text-secondary)', gap: 5 }}>
        <Inbox size={22} strokeWidth={1.3} />
        <span style={{ fontSize: 12.5 }}>No payments recorded yet</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {payments.map((pmt, i) => (
        <div key={pmt.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--canvas)', border: '1px solid var(--border)' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A' }}>{i + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{formatCurrency(pmt.paymentAmount, sym)}</span>
              <PayModeChip mode={pmt.paymentMode} />
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{formatDate(pmt.paymentDate)}</span>
            </div>
            {pmt.transactionReference && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>Ref: {pmt.transactionReference}</div>}
            {pmt.notes && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{pmt.notes}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {onReceipt && (
              <button onClick={() => onReceipt(pmt)} title="View receipt"
                style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ReceiptText size={11} />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(pmt.id)} title="Delete payment"
                style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function Payables() {
  const {
    state,
    addSupplierPayment, deleteSupplierPayment, setPaymentDueDate,
    addGeneralPayable, updateGeneralPayable, deleteGeneralPayable,
    addGeneralPayablePayment, deleteGeneralPayablePayment,
    addPayableCategory,
  } = useApp();
  const {
    purchases = [], purchaseOrders = [], supplierPayments = [],
    purchaseReturns = [], generalPayables = [], payableCategories = [], settings,
  } = state;

  const sym      = settings?.currency?.symbol || settings?.currency || '₹';
  const todayStr = today();

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // ── Detail modal ───────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId]     = useState(null);
  const [showPayForm, setShowPayForm]   = useState(false);
  const [payForm, setPayForm]           = useState(mkPayForm());
  const [payErrors, setPayErrors]       = useState({});
  const [paySaving, setPaySaving]       = useState(false);
  const [editDueDate, setEditDueDate]   = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');

  // ── Receipt viewer ─────────────────────────────────────────────────────────────
  const [receiptData, setReceiptData]   = useState(null);
  const [showReceipt, setShowReceipt]   = useState(false);

  // ── Delete targets ─────────────────────────────────────────────────────────────
  const [deletePayTarget, setDeletePayTarget] = useState(null); // { paymentId, payableId? }
  const [deleteGpblId, setDeleteGpblId]       = useState(null);

  // ── Add / Edit General Payable ─────────────────────────────────────────────────
  const [gpblModal, setGpblModal]   = useState(false);
  const [editGpbl, setEditGpbl]     = useState(null);
  const [gpblForm, setGpblForm]     = useState(mkGpblForm());
  const [gpblErrors, setGpblErrors] = useState({});
  const [gpblSaving, setGpblSaving] = useState(false);

  // ── Category combobox state ──────────────────────────────────────────────────
  const [catSearch, setCatSearch]   = useState('');
  const [catOpen, setCatOpen]       = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat]   = useState(false);

  // Close category dropdown on outside click
  useEffect(() => {
    if (!catOpen) return;
    const handler = () => setCatOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  // Merged default + custom categories
  const allPayableCategories = useMemo(() => [
    ...GPBL_CATEGORIES,
    ...(payableCategories || []).map(c => ({ value: c.name, label: c.name })),
  ], [payableCategories]);

  const getCatLabel = val =>
    allPayableCategories.find(c => c.value === val)?.label || val || 'Miscellaneous';

  const filteredCats = useMemo(() => {
    const q = catSearch.toLowerCase();
    return q ? allPayableCategories.filter(c => c.label.toLowerCase().includes(q)) : allPayableCategories;
  }, [allPayableCategories, catSearch]);

  // ─── Build unified payables list ──────────────────────────────────────────────

  const payables = useMemo(() => {
    // Map supplierPayments by sourceId
    const spayMap = {};
    supplierPayments.forEach(p => {
      if (!p.sourceId) return;
      if (!spayMap[p.sourceId]) spayMap[p.sourceId] = [];
      spayMap[p.sourceId].push(p);
    });

    // Map return credits by sourceId
    const returnMap = {};
    purchaseReturns.forEach(r => {
      const srcId = r.purchaseId || r.purchaseOrderId;
      if (!srcId) return;
      if (!['accepted_by_supplier', 'completed'].includes(r.status)) return;
      returnMap[srcId] = (returnMap[srcId] || 0) + Number(r.totalAmount || 0);
    });

    const rows = [];

    // Purchase Orders
    purchaseOrders.forEach(po => {
      if (!PAYABLE_PO_STATUSES.has(po.status)) return;
      const pmts       = (spayMap[po.id] || []).slice().sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
      const paidAmount = pmts.reduce((s, p) => s + Number(p.paymentAmount || 0), 0);
      const returnCred = returnMap[po.id] || 0;
      const totalAmount = Number(
        po.grandTotal || po.totalAmount ||
        (po.items || []).reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitCost || it.unitPrice || 0), 0)
      );
      const balance = Math.max(0, totalAmount - paidAmount - returnCred);
      // Closed PO: only show if there is a balance or payment history
      if (po.status === 'closed' && balance === 0 && pmts.length === 0) return;
      let status = balance === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      if (status !== 'paid' && po.dueDate && po.dueDate < todayStr) status = 'overdue';
      rows.push({
        id: po.id, rowType: 'purchase_order',
        displayName: po.poNumber || po.id,
        vendor: po.supplierName || '—',
        date: po.orderDate || (po.createdAt || '').slice(0, 10),
        dueDate: po.dueDate || '',
        totalAmount, paidAmount, returnCred, balance, status,
        payments: pmts,
        lastPaymentDate: pmts[0]?.paymentDate || '',
        lastPaymentMode: pmts[0]?.paymentMode || '',
        source: po,
      });
    });

    // General Purchases
    purchases.forEach(p => {
      if (['voided', 'cancelled'].includes(p.fulfillmentStatus)) return;
      const pmts       = (spayMap[p.id] || []).slice().sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
      const paidAmount = pmts.reduce((s, x) => s + Number(x.paymentAmount || 0), 0);
      const returnCred = returnMap[p.id] || 0;
      const totalAmount = Number(p.grandTotal || 0);
      const balance = Math.max(0, totalAmount - paidAmount - returnCred);
      let status = balance === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      if (status !== 'paid' && p.dueDate && p.dueDate < todayStr) status = 'overdue';
      rows.push({
        id: p.id, rowType: 'general_purchase',
        displayName: p.gpNumber || p.purchaseNumber || p.id,
        vendor: p.supplierName || '—',
        date: p.date || (p.createdAt || '').slice(0, 10),
        dueDate: p.dueDate || '',
        totalAmount, paidAmount, returnCred, balance, status,
        payments: pmts,
        lastPaymentDate: pmts[0]?.paymentDate || '',
        lastPaymentMode: pmts[0]?.paymentMode || '',
        source: p,
      });
    });

    // General Payables (manually added)
    generalPayables.forEach(gpbl => {
      const pmts       = (gpbl.payments || []).slice().sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
      const paidAmount = pmts.reduce((s, p) => s + Number(p.paymentAmount || 0), 0);
      const totalAmount = Number(gpbl.totalAmount || 0);
      const balance = Math.max(0, totalAmount - paidAmount);
      let status = balance === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      if (status !== 'paid' && gpbl.dueDate && gpbl.dueDate < todayStr) status = 'overdue';
      rows.push({
        id: gpbl.id, rowType: 'general_payable',
        displayName: gpbl.payableName || 'Unnamed',
        vendor: gpbl.vendorName || '—',
        date: gpbl.createdAt || '',
        dueDate: gpbl.dueDate || '',
        totalAmount, paidAmount, balance, returnCred: 0, status,
        payments: pmts,
        lastPaymentDate: pmts[0]?.paymentDate || '',
        lastPaymentMode: pmts[0]?.paymentMode || '',
        source: gpbl,
      });
    });

    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [purchases, purchaseOrders, supplierPayments, purchaseReturns, generalPayables, todayStr]);

  // ── KPI stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const purchase = payables.filter(r => r.rowType !== 'general_payable');
    const general  = payables.filter(r => r.rowType === 'general_payable');
    return {
      totalPayable:   payables.reduce((s, r) => s + r.totalAmount, 0),
      totalPaid:      payables.reduce((s, r) => s + r.paidAmount, 0),
      outstanding:    payables.reduce((s, r) => s + r.balance, 0),
      overdue:        payables.filter(r => r.status === 'overdue').reduce((s, r) => s + r.balance, 0),
      purchaseCount:  purchase.filter(r => r.balance > 0).length,
      purchaseTotal:  purchase.reduce((s, r) => s + r.balance, 0),
      generalCount:   general.length,
      generalTotal:   general.reduce((s, r) => s + r.balance, 0),
    };
  }, [payables]);

  // ── Filtered list ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return payables.filter(r => {
      if (q && !r.displayName.toLowerCase().includes(q) && !r.vendor.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && r.rowType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (dateFrom && r.date && r.date < dateFrom) return false;
      if (dateTo && r.date && r.date > dateTo) return false;
      return true;
    });
  }, [payables, search, typeFilter, statusFilter, dateFrom, dateTo]);

  const hasFilter = search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  // ── Live selected row (reactive to payments) ──────────────────────────────────

  const selectedRow = useMemo(() =>
    selectedId ? (payables.find(r => r.id === selectedId) || null) : null,
    [payables, selectedId]
  );

  // ── Receipt helpers ───────────────────────────────────────────────────────────

  const getNextReceiptNumber = useCallback(() => {
    const existing = [
      ...(supplierPayments || []).map(p => p.receiptNumber),
      ...(generalPayables || []).flatMap(g => (g.payments || []).map(p => p.receiptNumber)),
    ].filter(Boolean);
    const nums = existing.map(n => parseInt((n || '').split('-').pop() || '0', 10)).filter(n => !isNaN(n) && n > 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `PAY-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
  }, [supplierPayments, generalPayables]);

  const buildReceiptData = useCallback((row, payment, prevPaid, curPaid, balAfter) => {
    const s = settings || {};
    const addr = [s.businessAddress, s.businessCity, s.businessState].filter(Boolean).join(', ');
    return {
      businessName:         s.businessName || '',
      businessAddress:      addr,
      businessPhone:        s.businessPhone || '',
      businessEmail:        s.businessEmail || '',
      businessGST:          s.gstin || s.taxNumber || '',
      logoUrl:              s.logoUrl || '',
      receiptNumber:        payment.receiptNumber || '',
      paymentDate:          payment.paymentDate || '',
      payableType:          TYPE_CFG[row.rowType]?.label || row.rowType,
      referenceNo:          row.displayName,
      paidTo:               row.vendor !== '—' ? row.vendor : '',
      payableName:          row.displayName,
      paymentMode:          payment.paymentMode || '',
      transactionReference: payment.transactionReference || '',
      notes:                payment.notes || '',
      totalPayable:         row.totalAmount,
      prevPaidAmount:       prevPaid,
      currentPaidAmount:    curPaid,
      balanceAmount:        balAfter,
      paymentStatus:        balAfter === 0 ? 'paid' : (prevPaid + curPaid > 0 ? 'partial' : 'unpaid'),
      sym,
    };
  }, [settings, sym]);

  const handleViewReceipt = useCallback((payment) => {
    if (!selectedRow) return;
    const sorted = [...selectedRow.payments].sort((a, b) =>
      (a.paymentDate || '').localeCompare(b.paymentDate || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
    );
    const idx     = sorted.findIndex(p => p.id === payment.id);
    const prevPaid = idx > 0 ? sorted.slice(0, idx).reduce((s, p) => s + Number(p.paymentAmount || 0), 0) : 0;
    const curPaid  = Number(payment.paymentAmount || 0);
    const balAfter = Math.max(0, selectedRow.totalAmount - prevPaid - curPaid);
    setReceiptData(buildReceiptData(selectedRow, payment, prevPaid, curPaid, balAfter));
    setShowReceipt(true);
  }, [selectedRow, buildReceiptData]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const openDetail = useCallback((row) => {
    setSelectedId(row.id);
    setShowPayForm(row.balance > 0);
    setPayForm(mkPayForm());
    setPayErrors({});
    setEditDueDate(false);
    setDueDateInput(row.dueDate || '');
  }, []);

  const closeDetail = () => {
    setSelectedId(null);
    setShowPayForm(false);
    setEditDueDate(false);
  };

  const validatePay = (form, outstanding) => {
    const errs = {};
    const amt = Number(form.paymentAmount);
    if (!amt || amt <= 0) errs.paymentAmount = 'Enter a valid amount';
    else if (amt > outstanding + 0.01) errs.paymentAmount = `Cannot exceed outstanding (${formatCurrency(outstanding, sym)})`;
    if (!form.paymentDate) errs.paymentDate = 'Date required';
    return errs;
  };

  const handleSavePayment = async () => {
    if (!selectedRow) return;
    const errs = validatePay(payForm, selectedRow.balance);
    if (Object.keys(errs).length) { setPayErrors(errs); return; }

    const receiptNum = getNextReceiptNumber();
    const prevPaid   = selectedRow.paidAmount;
    const curPaid    = Number(payForm.paymentAmount);
    const balAfter   = Math.max(0, selectedRow.balance - curPaid);

    setPaySaving(true);
    if (selectedRow.rowType === 'general_payable') {
      await addGeneralPayablePayment(selectedRow.id, {
        paymentAmount:        curPaid,
        paymentDate:          payForm.paymentDate,
        paymentMode:          payForm.paymentMode,
        transactionReference: payForm.transactionReference,
        notes:                payForm.notes,
        receiptNumber:        receiptNum,
      });
    } else {
      await addSupplierPayment({
        supplierId:           selectedRow.source?.supplierId || '',
        supplierName:         selectedRow.vendor,
        sourceType:           selectedRow.rowType,
        sourceId:             selectedRow.id,
        sourceReferenceNo:    selectedRow.displayName,
        grandTotal:           selectedRow.totalAmount,
        paymentAmount:        curPaid,
        paymentDate:          payForm.paymentDate,
        paymentMode:          payForm.paymentMode,
        transactionReference: payForm.transactionReference,
        notes:                payForm.notes,
        receiptNumber:        receiptNum,
      });
    }
    setPaySaving(false);
    setPayForm(mkPayForm());
    setPayErrors({});
    setShowPayForm(false);

    // Open receipt immediately after saving
    const syntheticPayment = {
      receiptNumber:        receiptNum,
      paymentDate:          payForm.paymentDate,
      paymentMode:          payForm.paymentMode,
      transactionReference: payForm.transactionReference,
      notes:                payForm.notes,
    };
    setReceiptData(buildReceiptData(selectedRow, syntheticPayment, prevPaid, curPaid, balAfter));
    setShowReceipt(true);
  };

  const handleDeletePayment = async () => {
    if (!deletePayTarget) return;
    if (deletePayTarget.payableId) {
      await deleteGeneralPayablePayment(deletePayTarget.payableId, deletePayTarget.paymentId);
    } else {
      await deleteSupplierPayment(deletePayTarget.paymentId);
    }
    setDeletePayTarget(null);
  };

  const handleSaveDueDate = async () => {
    if (!selectedRow) return;
    if (selectedRow.rowType === 'general_payable') {
      await updateGeneralPayable({ ...selectedRow.source, dueDate: dueDateInput });
    } else {
      await setPaymentDueDate(selectedRow.rowType, selectedRow.id, dueDateInput);
    }
    setEditDueDate(false);
  };

  // ── General Payable modal handlers ────────────────────────────────────────────

  const openAddGpbl = () => {
    setEditGpbl(null); setGpblForm(mkGpblForm()); setGpblErrors({}); setGpblModal(true);
  };
  const openEditGpbl = (row) => {
    setEditGpbl(row.source);
    setGpblForm({
      payableName:     row.source.payableName || '',
      payableCategory: row.source.payableCategory || 'miscellaneous',
      vendorName:      row.source.vendorName || '',
      totalAmount:     String(row.source.totalAmount || ''),
      dueDate:         row.source.dueDate || '',
      notes:           row.source.notes || '',
    });
    setGpblErrors({}); setGpblModal(true);
  };

  const handleSaveGpbl = async () => {
    const errs = {};
    if (!gpblForm.payableName.trim()) errs.payableName = 'Name is required';
    if (!gpblForm.totalAmount || Number(gpblForm.totalAmount) <= 0) errs.totalAmount = 'Enter a valid amount';
    if (Object.keys(errs).length) { setGpblErrors(errs); return; }
    setGpblSaving(true);
    const data = {
      payableName:     gpblForm.payableName.trim(),
      payableCategory: gpblForm.payableCategory,
      vendorName:      gpblForm.vendorName.trim(),
      totalAmount:     Number(gpblForm.totalAmount),
      dueDate:         gpblForm.dueDate,
      notes:           gpblForm.notes.trim(),
    };
    if (editGpbl) {
      await updateGeneralPayable({ ...editGpbl, ...data });
    } else {
      await addGeneralPayable(data);
    }
    setGpblSaving(false);
    setGpblModal(false);
  };

  const handleDeleteGpbl = async () => {
    if (!deleteGpblId) return;
    await deleteGeneralPayable(deleteGpblId);
    setDeleteGpblId(null);
    closeDetail();
  };

  // ── Export CSV ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [
      ['Type', 'Name/Reference', 'Vendor/Supplier', 'Date', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Status'],
      ...filtered.map(r => [
        TYPE_CFG[r.rowType]?.label, r.displayName, r.vendor,
        formatDate(r.date), formatDate(r.dueDate),
        r.totalAmount.toFixed(2), r.paidAmount.toFixed(2), r.balance.toFixed(2), r.status,
      ]),
    ];
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payables-${todayStr}.csv`; a.click();
  };

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fadeIn" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={16} style={{ color: '#F59E0B' }} />
              </div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>Payables</h1>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, paddingLeft: 38 }}>
              {payables.filter(r => r.balance > 0).length} outstanding · {payables.length} total records
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={handleExport}
              style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} /> Export
            </button>
            <button onClick={openAddGpbl}
              style={{ height: 34, padding: '0 13px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add General Payable
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(145px,1fr))', gap: 8 }}>
          <KpiCard icon={TrendingDown}  label="Total Payable"     value={formatCurrency(stats.totalPayable, sym)}  color="indigo" />
          <KpiCard icon={CheckCircle2}  label="Total Paid"        value={formatCurrency(stats.totalPaid, sym)}     color="green"  />
          <KpiCard icon={AlertCircle}   label="Outstanding"       value={formatCurrency(stats.outstanding, sym)}   color="amber"  />
          <KpiCard icon={Clock}         label="Overdue"           value={formatCurrency(stats.overdue, sym)}       color="red"    sub={stats.overdue > 0 ? 'Past due date' : 'None overdue'} />
          <KpiCard icon={ShoppingCart}  label="Purchase Payables" value={formatCurrency(stats.purchaseTotal, sym)} color="purple" sub={`${stats.purchaseCount} with balance`} />
          <KpiCard icon={ReceiptText}   label="General Payables"  value={formatCurrency(stats.generalTotal, sym)}  color="teal"   sub={`${stats.generalCount} record${stats.generalCount !== 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 130, maxWidth: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input placeholder="Search name, vendor…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: 32, padding: '0 8px 0 28px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12.5, minWidth: 155, cursor: 'pointer' }}>
          <option value="all">All Types</option>
          <option value="purchase_order">Purchase Order</option>
          <option value="general_purchase">General Purchase</option>
          <option value="general_payable">General Payable</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12.5, minWidth: 120, cursor: 'pointer' }}>
          <option value="all">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date"
          style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12, minWidth: 130 }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date"
          style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12, minWidth: 130 }} />
        {hasFilter && (
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}
            style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={12} /> Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12, color: 'var(--text-secondary)' }}>
            <Inbox size={40} strokeWidth={1.2} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>No payables found</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
              {hasFilter
                ? 'Try adjusting your filters.'
                : 'Purchase Orders and General Purchases appear automatically. Add General Payables for other expenses.'}
            </div>
            {!hasFilter && (
              <button onClick={openAddGpbl} style={{ marginTop: 4, height: 36, padding: '0 16px', borderRadius: 9, border: 'none', background: '#0D9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Add General Payable
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="hide-on-mobile" style={{ minWidth: 940 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                    {['Type', 'Name / Reference', 'Vendor / Supplier', 'Date', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Status', 'Last Payment', ''].map((h, i) => (
                      <th key={i} style={{ padding: '9px 10px', textAlign: i >= 5 && i <= 7 ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={row.id} onClick={() => openDetail(row)}
                      style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--canvas)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--surface)' : 'var(--canvas)'}
                    >
                      <td style={{ padding: '10px 10px' }}><TypeBadge type={row.rowType} /></td>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text)', maxWidth: 175, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.displayName}>{row.displayName}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.vendor !== '—' ? row.vendor : <span style={{ color: 'var(--border)' }}>—</span>}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(row.date)}</td>
                      <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', color: row.dueDate && row.dueDate < todayStr && row.balance > 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                        {row.dueDate ? formatDate(row.dueDate) : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{formatCurrency(row.totalAmount, sym)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: row.paidAmount > 0 ? '#16A34A' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.paidAmount > 0 ? formatCurrency(row.paidAmount, sym) : '—'}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#DC2626' : '#16A34A', whiteSpace: 'nowrap' }}>{formatCurrency(row.balance, sym)}</td>
                      <td style={{ padding: '10px 10px' }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {row.lastPaymentDate
                          ? <><div style={{ color: 'var(--text-secondary)' }}>{formatDate(row.lastPaymentDate)}</div><PayModeChip mode={row.lastPaymentMode} /></>
                          : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => openDetail(row)}
                          style={{ height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <ArrowUpRight size={12} />{row.balance > 0 ? 'Pay' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="show-on-mobile">
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(row => (
                  <div key={row.id} onClick={() => openDetail(row)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <TypeBadge type={row.rowType} />
                          <StatusBadge status={row.status} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{row.displayName}</div>
                        {row.vendor !== '—' && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{row.vendor}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { lbl: 'TOTAL', val: formatCurrency(row.totalAmount, sym), clr: 'var(--text)' },
                        { lbl: 'PAID',  val: row.paidAmount > 0 ? formatCurrency(row.paidAmount, sym) : '—', clr: '#16A34A' },
                        { lbl: 'DUE',   val: formatCurrency(row.balance, sym), clr: row.balance > 0 ? '#DC2626' : '#16A34A' },
                      ].map(({ lbl, val, clr }) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>{lbl}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: clr }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {row.dueDate && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: row.dueDate < todayStr && row.balance > 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                        Due: {formatDate(row.dueDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════ */}
      {selectedRow && (
        <Modal open={!!selectedRow} onClose={closeDetail} title={selectedRow.displayName} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Row meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TypeBadge type={selectedRow.rowType} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{TYPE_CFG[selectedRow.rowType]?.label}</span>
              <StatusBadge status={selectedRow.status} />
              {selectedRow.vendor !== '—' && (
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRow.vendor}</span>
              )}
            </div>

            {/* General Payable info banner */}
            {selectedRow.rowType === 'general_payable' && (
              <div style={{ padding: '8px 12px', background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.18)', borderRadius: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Category: <strong style={{ color: 'var(--text)' }}>
                      {getCatLabel(selectedRow.source.payableCategory) || '—'}
                    </strong>
                  </span>
                  {selectedRow.source.vendorName && (
                    <span style={{ color: 'var(--text-secondary)' }}>Vendor: <strong style={{ color: 'var(--text)' }}>{selectedRow.source.vendorName}</strong></span>
                  )}
                  {selectedRow.source.notes && (
                    <span style={{ color: 'var(--text-secondary)' }}>Notes: {selectedRow.source.notes}</span>
                  )}
                </div>
              </div>
            )}

            {/* PO / GP items summary */}
            {selectedRow.rowType !== 'general_payable' && (selectedRow.source.items || []).length > 0 && (
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>
                  Items
                </div>
                <div style={{ maxHeight: 130, overflowY: 'auto' }}>
                  {selectedRow.source.items.slice(0, 8).map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: i < Math.min(selectedRow.source.items.length, 8) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName || it.name || 'Item'}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {(it.quantity || it.acceptedQty || 0)} × {formatCurrency(it.unitCost || it.unitPrice || 0, sym)}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text)', marginLeft: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatCurrency((it.quantity || it.acceptedQty || 0) * Number(it.unitCost || it.unitPrice || 0), sym)}
                      </span>
                    </div>
                  ))}
                  {selectedRow.source.items.length > 8 && (
                    <div style={{ padding: '5px 12px', fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      …{selectedRow.source.items.length - 8} more item{selectedRow.source.items.length - 8 !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              {[
                { label: 'Total Amount', value: formatCurrency(selectedRow.totalAmount, sym), color: 'var(--text)'  },
                { label: 'Total Paid',   value: formatCurrency(selectedRow.paidAmount, sym),  color: '#16A34A'      },
                { label: 'Outstanding',  value: formatCurrency(selectedRow.balance, sym),      color: selectedRow.balance > 0 ? '#DC2626' : '#16A34A' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Return credit info */}
            {(selectedRow.returnCred || 0) > 0 && (
              <div style={{ padding: '6px 10px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 7, fontSize: 12, color: '#16A34A' }}>
                Return credit applied: <strong>{formatCurrency(selectedRow.returnCred, sym)}</strong>
              </div>
            )}

            {/* Due date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date:</span>
              {editDueDate ? (
                <>
                  <input type="date" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)}
                    style={{ height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12.5 }} />
                  <button onClick={handleSaveDueDate}
                    style={{ height: 28, padding: '0 10px', borderRadius: 7, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> Save
                  </button>
                  <button onClick={() => setEditDueDate(false)}
                    style={{ height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: selectedRow.dueDate ? 600 : 400, color: selectedRow.dueDate && selectedRow.dueDate < todayStr && selectedRow.balance > 0 ? '#DC2626' : 'var(--text)' }}>
                    {selectedRow.dueDate ? formatDate(selectedRow.dueDate) : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}
                  </span>
                  <button onClick={() => { setEditDueDate(true); setDueDateInput(selectedRow.dueDate || ''); }}
                    style={{ height: 24, padding: '0 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Edit3 size={10} /> Edit
                  </button>
                </>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 -20px' }} />

            {/* Payment History */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment History</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{selectedRow.payments.length} payment{selectedRow.payments.length !== 1 ? 's' : ''}</span>
              </div>
              <PaymentHistory
                payments={selectedRow.payments}
                sym={sym}
                onReceipt={handleViewReceipt}
                onDelete={(paymentId) => {
                  if (selectedRow.rowType === 'general_payable') {
                    setDeletePayTarget({ paymentId, payableId: selectedRow.id });
                  } else {
                    setDeletePayTarget({ paymentId });
                  }
                }}
              />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 -20px' }} />

            {/* Record Payment */}
            {selectedRow.balance > 0 ? (
              <>
                <button onClick={() => setShowPayForm(f => !f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>
                  {showPayForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  Record Payment
                </button>
                {showPayForm && (
                  <PaymentForm
                    outstanding={selectedRow.balance}
                    sym={sym}
                    form={payForm}
                    setForm={setPayForm}
                    errors={payErrors}
                    saving={paySaving}
                    onSave={handleSavePayment}
                    onCancel={() => { setShowPayForm(false); setPayErrors({}); }}
                  />
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16A34A', fontWeight: 700, fontSize: 14 }}>
                <CheckCircle2 size={16} /> Fully Paid
              </div>
            )}

            {/* General Payable edit / delete */}
            {selectedRow.rowType === 'general_payable' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '0 -20px' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { closeDetail(); openEditGpbl(selectedRow); }}
                    style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => setDeleteGpblId(selectedRow.id)}
                    style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Trash2 size={13} /> Delete Payable
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════
          ADD / EDIT GENERAL PAYABLE MODAL
      ══════════════════════════════════════════════════ */}
      <Modal open={gpblModal} onClose={() => setGpblModal(false)} title={editGpbl ? 'Edit Payable' : 'Add General Payable'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Payable Name *</label>
            <input
              placeholder="e.g. Electricity Bill, Office Rent, Staff Salary"
              value={gpblForm.payableName}
              onChange={e => { setGpblForm(f => ({ ...f, payableName: e.target.value })); setGpblErrors(er => ({ ...er, payableName: '' })); }}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${gpblErrors.payableName ? '#EF4444' : 'var(--border)'}`, background: 'var(--canvas)', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, boxSizing: 'border-box', outline: 'none' }} />
            {gpblErrors.payableName && <p style={{ fontSize: 11, color: '#EF4444', margin: '3px 0 0' }}>{gpblErrors.payableName}</p>}
          </div>

          {/* Category + Vendor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</label>
              {/* Combobox trigger */}
              <button
                type="button"
                onClick={() => { setCatSearch(''); setNewCatName(''); setAddingCat(false); setCatOpen(o => !o); }}
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${catOpen ? 'var(--brand)' : 'var(--border)'}`, background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, outline: 'none' }}
              >
                <span>{getCatLabel(gpblForm.payableCategory)}</span>
                <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {/* Dropdown */}
              {catOpen && (
                <div
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1.5px solid var(--brand)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', marginTop: 3, overflow: 'hidden' }}
                  onMouseDown={e => e.preventDefault()}
                >
                  {/* Search */}
                  <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <input
                      autoFocus
                      value={catSearch}
                      onChange={e => { setCatSearch(e.target.value); setAddingCat(false); }}
                      placeholder="Search or type new category…"
                      style={{ width: '100%', height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  {/* List */}
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredCats.map(c => (
                      <button key={c.value} type="button"
                        onClick={() => { setGpblForm(f => ({ ...f, payableCategory: c.value })); setCatOpen(false); setCatSearch(''); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: gpblForm.payableCategory === c.value ? 'var(--brand-faint)' : 'transparent', color: gpblForm.payableCategory === c.value ? 'var(--brand)' : 'var(--text)', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: gpblForm.payableCategory === c.value ? 700 : 400 }}
                        onMouseEnter={e => { if (gpblForm.payableCategory !== c.value) e.currentTarget.style.background = 'var(--canvas)'; }}
                        onMouseLeave={e => { if (gpblForm.payableCategory !== c.value) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {c.label}
                      </button>
                    ))}
                    {filteredCats.length === 0 && catSearch && (
                      <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>No categories match</div>
                    )}
                  </div>
                  {/* Add new */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 8px' }}>
                    {addingCat ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newCatName.trim()) {
                              addPayableCategory(newCatName.trim());
                              setGpblForm(f => ({ ...f, payableCategory: newCatName.trim() }));
                              setCatOpen(false); setAddingCat(false); setNewCatName('');
                            } else if (e.key === 'Escape') { setAddingCat(false); }
                          }}
                          placeholder="Category name…"
                          style={{ flex: 1, height: 28, padding: '0 8px', borderRadius: 6, border: '1.5px solid var(--brand)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
                        />
                        <button type="button"
                          onClick={() => {
                            if (!newCatName.trim()) return;
                            addPayableCategory(newCatName.trim());
                            setGpblForm(f => ({ ...f, payableCategory: newCatName.trim() }));
                            setCatOpen(false); setAddingCat(false); setNewCatName('');
                          }}
                          style={{ height: 28, padding: '0 10px', borderRadius: 6, background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Save
                        </button>
                        <button type="button" onClick={() => setAddingCat(false)}
                          style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--canvas)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setAddingCat(true); setNewCatName(catSearch); }}
                        style={{ width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-faint)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Plus size={12} /> Add New Category
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Vendor / Person (optional)</label>
              <input placeholder="e.g. TNEB, Landlord, Courier" value={gpblForm.vendorName}
                onChange={e => setGpblForm(f => ({ ...f, vendorName: e.target.value }))}
                style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          </div>

          {/* Amount + Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Amount *</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 8, border: `1.5px solid ${gpblErrors.totalAmount ? '#EF4444' : 'var(--border)'}`, background: 'var(--canvas)', overflow: 'hidden' }}>
                <span style={{ padding: '0 4px 0 10px', color: 'var(--text-secondary)', fontSize: 13, flexShrink: 0, userSelect: 'none', lineHeight: '36px' }}>{sym}</span>
                <input type="number" min="0.01" step="0.01" value={gpblForm.totalAmount}
                  onChange={e => { setGpblForm(f => ({ ...f, totalAmount: e.target.value })); setGpblErrors(er => ({ ...er, totalAmount: '' })); }}
                  style={{ flex: 1, height: '100%', padding: '0 8px 0 2px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700, outline: 'none', minWidth: 0 }} />
              </div>
              {gpblErrors.totalAmount && <p style={{ fontSize: 11, color: '#EF4444', margin: '3px 0 0' }}>{gpblErrors.totalAmount}</p>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Due Date (optional)</label>
              <input type="date" value={gpblForm.dueDate} onChange={e => setGpblForm(f => ({ ...f, dueDate: e.target.value }))}
                style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <input placeholder="Any additional details…" value={gpblForm.notes}
              onChange={e => setGpblForm(f => ({ ...f, notes: e.target.value }))}
              style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button onClick={() => setGpblModal(false)}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSaveGpbl} disabled={gpblSaving}
              style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: gpblSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: gpblSaving ? 0.7 : 1 }}>
              <Plus size={14} />{gpblSaving ? 'Saving…' : editGpbl ? 'Update Payable' : 'Add Payable'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Payment Confirm ── */}
      {deletePayTarget && (
        <Modal open={!!deletePayTarget} onClose={() => setDeletePayTarget(null)} title="Delete Payment" size="sm">
          <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 20 }}>This permanently removes the payment record and increases the outstanding balance.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDeletePayTarget(null)}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDeletePayment}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete General Payable Confirm ── */}
      {deleteGpblId && (
        <Modal open={!!deleteGpblId} onClose={() => setDeleteGpblId(null)} title="Delete Payable" size="sm">
          <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>This will permanently delete this payable and all its payment history.</p>
          <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, marginBottom: 20 }}>This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteGpblId(null)}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDeleteGpbl}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════
          PAYMENT RECEIPT VIEWER
      ══════════════════════════════════════════════════ */}
      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="Payment Receipt" size="xl">
        <PayableReceiptViewer data={receiptData} onClose={() => setShowReceipt(false)} />
      </Modal>

    </div>
  );
}
