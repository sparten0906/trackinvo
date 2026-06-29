import React, { useState, useMemo, useCallback } from 'react';
import {
  PackageX, Search, X, Plus, Truck, Info, AlertTriangle,
  Clock, CheckCircle2, XCircle, ArrowRight, Package,
  Edit2, RotateCcw, Inbox, MoreHorizontal, Send, Eye, RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, generateId, today } from '../utils/helpers';
import toast from 'react-hot-toast';

/* ── Status config ───────────────────────────────────────────────────────── */
const STATUS_CFG = {
  pending:               { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', label: 'Pending',               icon: Clock },
  ready_to_return:       { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', label: 'Ready to Return',        icon: Package },
  returned:              { bg: '#FAF5FF', fg: '#7C3AED', border: '#DDD6FE', label: 'Returned to Supplier',   icon: ArrowRight },
  accepted_by_supplier:  { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Accepted by Supplier',   icon: CheckCircle2 },
  rejected_by_supplier:  { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Rejected by Supplier',   icon: XCircle },
  completed:             { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Completed',               icon: CheckCircle2 },
  cancelled:             { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Cancelled',               icon: XCircle },
  pending_replacement:   { bg: '#FEFCE8', fg: '#CA8A04', border: '#FDE68A', label: 'Pending Replacement',    icon: RotateCcw },
  pending_return:        { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE', label: 'Pending Return',         icon: Package },
  partially_replaced:    { bg: '#FFF7ED', fg: '#EA580C', border: '#FDBA74', label: 'Partially Replaced',     icon: Clock },
  replacement_received:              { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Replacement Received',              icon: CheckCircle2 },
  replacement_refused:               { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Replacement Refused',               icon: XCircle },
  replacement_sent:                  { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', label: 'Replacement Sent',                  icon: Send },
  replacement_received_pending_inspection: { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A', label: 'Pending Inspection',          icon: Eye },
  replacement_accepted:              { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Replacement Accepted',              icon: CheckCircle2 },
  replacement_damaged:               { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Replacement Damaged',               icon: AlertTriangle },
  replacement_defective:             { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A', label: 'Replacement Defective',             icon: AlertTriangle },
  replacement_rejected:              { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Replacement Rejected',              icon: XCircle },
};

const REASON_LABELS = {
  damaged:          'Damaged / Defective',
  wrong_item:       'Wrong Item Received',
  quality_issue:    'Quality Issue',
  excess_quantity:  'Excess Quantity',
  price_mismatch:   'Price Mismatch',
  other:            'Other',
};

// "returned" and "pending_replacement" are decision forks — handled separately in UI.
const NEXT_STATUS = {
  pending:              'ready_to_return',
  pending_return:       'ready_to_return',
  ready_to_return:      'returned',
  accepted_by_supplier: 'completed',
  replacement_received: 'completed',
};
const NEXT_LABEL = {
  pending:              'Mark Ready to Return',
  pending_return:       'Mark Ready to Return',
  ready_to_return:      'Mark Returned to Supplier',
  accepted_by_supplier: 'Mark Completed',
  replacement_received: 'Mark Completed',
};

const COND_CFG = {
  good:      { label: 'Good',      color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  damaged:   { label: 'Damaged',   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  defective: { label: 'Defective', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  rejected:  { label: 'Rejected',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};

function StatusBadge({ status, small }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: small ? 10 : 11, fontWeight: 700, padding: small ? '2px 7px' : '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      <Icon size={small ? 9 : 11} strokeWidth={2.5} /> {cfg.label}
    </span>
  );
}

/* ── Source resolution ───────────────────────────────────────────────────── */
function resolveSource(ret, purchaseOrders, purchases) {
  // From PO receiving
  if (ret.purchaseOrderId || ret.purchaseOrderNumber || ret.poId || ret.poNumber) {
    const po = purchaseOrders.find(p => p.id === (ret.purchaseOrderId || ret.poId));
    const ref = ret.purchaseOrderNumber || ret.poNumber || po?.poNumber || 'Unknown';
    return { type: 'Purchase Order', label: 'PO', ref, color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' };
  }
  // From Damaged Stock return
  if (ret.source_type === 'damaged_stock') {
    const ref = ret.damagedStockNumber || '—';
    return { type: 'Damaged Stock Return', label: 'DMG', ref, color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' };
  }
  // From GP receiving
  if (ret.source_type === 'general_purchase_receiving') {
    const gp = purchases.find(p => p.id === ret.purchaseId);
    const ref = ret.purchaseNumber || gp?.gpNumber || gp?.purchaseNumber || 'Unknown';
    return { type: 'General Purchase', label: 'GP', ref, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' };
  }
  // Auto-created during GP receive (legacy — receiving_rejection with purchaseId referencing a GP)
  if (ret.source === 'receiving_rejection' && ret.purchaseId) {
    const linked = purchases.find(p => p.id === ret.purchaseId);
    if (linked && (linked.document_type === 'general_purchase' || linked.gpNumber)) {
      const ref = ret.purchaseNumber || linked.gpNumber || linked.purchaseNumber || 'Unknown';
      return { type: 'General Purchase', label: 'GP', ref, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' };
    }
    // Direct purchase receiving rejection
    const ref = ret.purchaseNumber || linked?.purchaseNumber || 'Unknown';
    return { type: 'Direct Purchase', label: 'PUR', ref, color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' };
  }
  // Manual return with a linked purchase
  if (ret.source === 'manual' && ret.purchaseId) {
    const pur = purchases.find(p => p.id === ret.purchaseId);
    const ref = ret.purchaseNumber || pur?.gpNumber || pur?.purchaseNumber || 'Unknown';
    const isGP = pur?.document_type === 'general_purchase' || !!pur?.gpNumber;
    if (isGP) return { type: 'General Purchase', label: 'GP', ref, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' };
    return { type: 'Direct Purchase', label: 'PUR', ref, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
  }
  // Pure manual
  if (ret.source === 'manual') {
    return { type: 'Manual Return', label: 'Manual', ref: '—', color: '#71717A', bg: '#F4F4F5', border: '#D4D4D8' };
  }
  return { type: 'Receiving Rejection', label: 'Auto', ref: ret.purchaseNumber || '—', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' };
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function PurchaseReturns() {
  const { state, updatePurchaseReturn, addPurchaseReturn, inspectReplacement } = useApp();
  const { purchaseReturns, purchaseOrders, suppliers, products, settings, damagedStockRecords = [] } = state;
  const purchases = state.purchases || [];
  const sym = settings?.currencySymbol || '₹';

  /* ── Filter / selection ── */
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [detailModal, setDetailModal]   = useState(false);
  const [openMenuId, setOpenMenuId]     = useState(null);

  /* ── Modals ── */
  const [editModal, setEditModal]         = useState(false);
  const [newReturnModal, setNewReturn]    = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  /* ── Edit form ── */
  const [editForm, setEditForm]     = useState({});
  const [editErrors, setEditErrors] = useState({});

  /* ── New manual return form ── */
  const [nrForm, setNrForm]     = useState({ supplierId: '', purchaseId: '', reason: 'damaged', notes: '', items: [] });
  const [nrErrors, setNrErrors] = useState({});

  /* ── Stats ── */
  const stats = useMemo(() => {
    const s = { total: 0, pending: 0, pending_replacement: 0, pending_return: 0, partially_replaced: 0, ready_to_return: 0, returned: 0, accepted_by_supplier: 0, rejected_by_supplier: 0, replacement_received: 0, replacement_refused: 0, completed: 0, cancelled: 0, replacement_sent: 0, replacement_received_pending_inspection: 0, replacement_accepted: 0, replacement_damaged: 0, replacement_defective: 0, replacement_rejected: 0 };
    purchaseReturns.forEach(r => { s.total++; if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [purchaseReturns]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = [...purchaseReturns];
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.returnNumber || '').toLowerCase().includes(q) ||
        (r.supplierName || '').toLowerCase().includes(q) ||
        (r.purchaseOrderNumber || '').toLowerCase().includes(q) ||
        (r.purchaseNumber || '').toLowerCase().includes(q) ||
        (r.items || []).some(it => (it.productName || '').toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [purchaseReturns, statusFilter, search]);

  const selectedReturn = purchaseReturns.find(r => r.id === selectedId) || null;

  const openDetail = useCallback((id) => {
    setSelectedId(id);
    setDetailModal(true);
  }, []);

  /* ── Status advance ── */
  const handleAdvanceStatus = () => {
    if (!selectedReturn) return;
    const next = NEXT_STATUS[selectedReturn.status];
    if (!next) return;
    setConfirmAction({ id: selectedReturn.id, toStatus: next, label: `${NEXT_LABEL[selectedReturn.status]}?` });
  };

  const handleCancel = () => {
    if (!selectedReturn) return;
    setConfirmAction({ id: selectedReturn.id, toStatus: 'cancelled', label: 'Cancel this return? This cannot be undone.' });
  };

  const handleAcceptedBySupplier = () => {
    if (!selectedReturn) return;
    setConfirmAction({ id: selectedReturn.id, toStatus: 'accepted_by_supplier', label: 'Confirm supplier accepted this return? The return will be marked accepted.' });
  };

  const handleRejectedBySupplier = () => {
    if (!selectedReturn) return;
    setConfirmAction({ id: selectedReturn.id, toStatus: 'rejected_by_supplier', label: 'Confirm supplier rejected this return? The goods will be moved to Damaged Stock.' });
  };

  const handleReplacementReceived = () => {
    openInspectModal();
  };

  const handleReplacementRefused = () => {
    if (!selectedReturn) return;
    setConfirmAction({ id: selectedReturn.id, toStatus: 'rejected_by_supplier', label: 'Supplier refused to send replacement? The damaged goods will be moved to Damaged Stock.' });
  };

  const doConfirm = async () => {
    if (!confirmAction) return;
    await updatePurchaseReturn(confirmAction.id, { status: confirmAction.toStatus });
    setConfirmAction(null);
  };

  /* ── Edit modal ── */
  const openEdit = () => {
    if (!selectedReturn) return;
    setEditForm({
      reason: selectedReturn.reason || 'damaged',
      notes: selectedReturn.notes || '',
      items: (selectedReturn.items || []).map(it => ({ ...it })),
    });
    setEditErrors({});
    setEditModal(true);
  };

  const setEditItem = (idx, patch) =>
    setEditForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));

  const handleSaveEdit = async () => {
    const errs = {};
    editForm.items.forEach((it, i) => {
      if (!(Number(it.returnQty) > 0)) errs[`qty${i}`] = 'Qty > 0';
    });
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    await updatePurchaseReturn(selectedReturn.id, {
      reason: editForm.reason,
      notes: editForm.notes,
      items: editForm.items,
    });
    setEditModal(false);
  };

  /* ── New manual return ── */
  const openNewReturn = () => {
    setNrForm({ supplierId: '', purchaseId: '', reason: 'damaged', notes: '', items: [] });
    setNrErrors({});
    setNewReturn(true);
  };

  const handleNrSupplierChange = (suppId) => {
    setNrForm(f => ({ ...f, supplierId: suppId, purchaseId: '', items: [] }));
  };

  const handleNrPurchaseChange = (purId) => {
    const pur = purchases.find(p => p.id === purId);
    const items = pur ? (pur.items || []).map(it => ({
      productId: it.productId, productName: it.productName, sku: it.sku || '',
      returnQty: 1, condition: 'damaged', reason: 'damaged', unitCost: it.unitCost || it.costPrice || 0,
    })) : [];
    setNrForm(f => ({ ...f, purchaseId: purId, items }));
  };

  const handleCreateReturn = async () => {
    const errs = {};
    if (!nrForm.supplierId)  errs.supplierId = 'Required';
    if (!nrForm.purchaseId)  errs.purchaseId = 'Required';
    if (!nrForm.items.length) errs.items = 'No items';
    nrForm.items.forEach((it, i) => {
      if (!(Number(it.returnQty) > 0)) errs[`qty${i}`] = 'Qty > 0';
    });
    if (Object.keys(errs).length) { setNrErrors(errs); return; }
    const sup = suppliers.find(s => s.id === nrForm.supplierId);
    const pur = purchases.find(p => p.id === nrForm.purchaseId);
    await addPurchaseReturn({
      supplierId:      nrForm.supplierId,
      supplierName:    sup?.name || '',
      purchaseId:      nrForm.purchaseId,
      purchaseNumber:  pur?.gpNumber || pur?.purchaseNumber || '',
      reason:          nrForm.reason,
      notes:           nrForm.notes,
      items:           nrForm.items,
      source:          'manual',
    });
    setNewReturn(false);
  };

  const supplierPurchases = useMemo(() =>
    nrForm.supplierId ? purchases.filter(p => p.supplierId === nrForm.supplierId) : [],
    [purchases, nrForm.supplierId]
  );

  /* ── Status tabs ── */
  const TABS = [
    { value: 'all',                               label: 'All',                   count: stats.total },
    { value: 'pending',                           label: 'Pending',               count: stats.pending },
    { value: 'pending_replacement',               label: 'Pending Replacement',   count: stats.pending_replacement },
    { value: 'pending_return',                    label: 'Pending Return',        count: stats.pending_return },
    { value: 'partially_replaced',                label: 'Partially Replaced',    count: stats.partially_replaced },
    { value: 'ready_to_return',                   label: 'Ready to Return',       count: stats.ready_to_return },
    { value: 'returned',                          label: 'Returned',              count: stats.returned },
    { value: 'accepted_by_supplier',              label: 'Accepted',              count: stats.accepted_by_supplier },
    { value: 'replacement_sent',                  label: 'Replacement Sent',      count: stats.replacement_sent },
    { value: 'replacement_received_pending_inspection', label: 'Pending Inspection', count: stats.replacement_received_pending_inspection },
    { value: 'replacement_accepted',              label: 'Repl. Accepted',        count: stats.replacement_accepted },
    { value: 'replacement_damaged',               label: 'Repl. Damaged',         count: stats.replacement_damaged },
    { value: 'replacement_defective',             label: 'Repl. Defective',       count: stats.replacement_defective },
    { value: 'replacement_rejected',              label: 'Repl. Rejected',        count: stats.replacement_rejected },
    { value: 'rejected_by_supplier',              label: 'Rejected by Supplier',  count: stats.rejected_by_supplier },
    { value: 'completed',                         label: 'Completed',             count: stats.completed },
    { value: 'cancelled',                         label: 'Cancelled',             count: stats.cancelled },
  ];

  const canEdit    = selectedReturn && ['pending', 'ready_to_return', 'pending_replacement', 'pending_return', 'partially_replaced'].includes(selectedReturn.status);
  const canAdvance = selectedReturn && !!NEXT_STATUS[selectedReturn.status] && !['pending_replacement', 'partially_replaced'].includes(selectedReturn.status);
  const canCancel  = selectedReturn && ['pending', 'ready_to_return', 'pending_replacement', 'pending_return', 'partially_replaced'].includes(selectedReturn.status);

  /* ── Replacement inspection modal ── */
  const blankInspectForm = { receivedQty: '', acceptedQty: '', damagedQty: '', defectiveQty: '', rejectedQty: '', rejectionMode: 'close_rejected', notes: '' };
  const [inspectModal, setInspectModal] = useState(false);
  const [inspectForm, setInspectForm]   = useState(blankInspectForm);
  const [inspectErrors, setInspectErrors] = useState({});

  const openInspectModal = () => {
    if (!selectedReturn) return;
    const totalBad = (selectedReturn.items || []).reduce((s, it) => s + Number(it.returnQty || 0), 0);
    setInspectForm({ ...blankInspectForm, receivedQty: String(totalBad), acceptedQty: String(totalBad), damagedQty: '0', defectiveQty: '0', rejectedQty: '0' });
    setInspectErrors({});
    setInspectModal(true);
  };

  const handleMarkReplacementSent = async () => {
    if (!selectedReturn) return;
    await updatePurchaseReturn(selectedReturn.id, { status: 'replacement_sent' });
  };

  const handleInspectReplacement = async () => {
    const received   = Number(inspectForm.receivedQty  || 0);
    const accepted   = Number(inspectForm.acceptedQty  || 0);
    const damaged    = Number(inspectForm.damagedQty   || 0);
    const defective  = Number(inspectForm.defectiveQty || 0);
    const rejected   = Number(inspectForm.rejectedQty  || 0);
    const errs = {};
    if (!(received > 0)) errs.receivedQty = 'Enter received qty';
    if (accepted + damaged + defective + rejected !== received) errs.sum = `Accepted + Damaged + Defective + Rejected must equal Received (${received})`;
    if (Object.keys(errs).length) { setInspectErrors(errs); return; }
    await inspectReplacement({
      purchaseReturnId:    selectedReturn.id,
      purchaseOrderId:     selectedReturn.purchaseOrderId || selectedReturn.poId || null,
      purchaseOrderItemId: selectedReturn.purchaseOrderItemId || selectedReturn.items?.[0]?.poItemId || null,
      // GP IDs: for GP-origin returns, purchaseId holds the GP id; gpItemId is in items[0]
      generalPurchaseId:   selectedReturn.generalPurchaseId ||
        (selectedReturn.source_type === 'general_purchase_receiving' ? selectedReturn.purchaseId : null) ||
        (selectedReturn.source_type === 'replacement_inspection' ? selectedReturn.generalPurchaseId : null) ||
        null,
      gpItemId:            selectedReturn.gpItemId || selectedReturn.items?.[0]?.gpItemId || null,
      productId:           selectedReturn.productId || selectedReturn.items?.[0]?.productId || null,
      receivedQty:         received,
      acceptedQty:        accepted,
      damagedQty:         damaged,
      defectiveQty:       defective,
      rejectedQty:        rejected,
      rejectionMode:      inspectForm.rejectionMode,
      notes:              inspectForm.notes,
    });
    setInspectModal(false);
  };

  /* ── Source info for selected return ── */
  const selSource = selectedReturn ? resolveSource(selectedReturn, purchaseOrders, purchases) : null;

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}
      onClick={() => { if (openMenuId) setOpenMenuId(null); }}
    >

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: '16px 24px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <PackageX size={20} color="var(--brand)" /> Purchase Returns
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>Returns to suppliers. Auto-created on receiving damaged/defective items.</p>
          </div>
          <button onClick={openNewReturn} style={primaryBtnStyle}>
            <Plus size={15} strokeWidth={2.5} /> New Return
          </button>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          {[
            { l: 'Total',    v: stats.total,           fg: '#4F46E5', bg: '#EEF2FF' },
            { l: 'Pending',  v: stats.pending,          fg: '#C2410C', bg: '#FFF7ED' },
            { l: 'Ready',    v: stats.ready_to_return,  fg: '#1D4ED8', bg: '#EFF6FF' },
            { l: 'Returned', v: stats.returned,         fg: '#7C3AED', bg: '#FAF5FF' },
            { l: 'Completed',v: stats.completed,        fg: '#16A34A', bg: '#F0FDF4' },
            { l: 'Cancelled',v: stats.cancelled,        fg: '#71717A', bg: '#F4F4F5' },
          ].map(c => (
            <div key={c.l} style={{ flexShrink: 0, minWidth: 88, padding: '7px 11px', borderRadius: 9, background: c.bg, border: `1px solid ${c.fg}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{c.l}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: c.fg }}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* Search + status tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Return #, supplier, PO#, GP#, product…" style={{ width: '100%', paddingLeft: 27, height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          {search && <button onClick={() => setSearch('')} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Clear</button>}
        </div>
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)} style={{ flexShrink: 0, padding: '6px 10px', fontSize: 11.5, fontWeight: statusFilter === tab.value ? 700 : 500, color: statusFilter === tab.value ? 'var(--brand)' : 'var(--text-secondary)', borderBottom: statusFilter === tab.value ? '2px solid var(--brand)' : '2px solid transparent', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Full-width table ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.15 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No returns</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Returns auto-appear when items are received as damaged/defective.</div>
            <button onClick={openNewReturn} style={{ ...primaryBtnStyle, marginTop: 14 }}>+ New Return</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--canvas)', position: 'sticky', top: 0, zIndex: 10 }}>
                {[
                  ['Return No', 'left'],
                  ['Date', 'left'],
                  ['Supplier', 'left'],
                  ['Product', 'left'],
                  ['Qty', 'right'],
                  ['Condition', 'left'],
                  ['Source Type', 'left'],
                  ['Source No', 'left'],
                  ['Reason', 'left'],
                  ['Status', 'left'],
                  ['', 'center'],
                ].map(([h, align]) => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: align, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const src = resolveSource(r, purchaseOrders, purchases);
                const totalQty = (r.items || []).reduce((s, it) => s + Number(it.returnQty || 0), 0);
                const firstItem = r.items?.[0];
                const moreItems = (r.items?.length || 0) - 1;
                const firstCond = firstItem?.condition || firstItem?.reason || 'damaged';
                const condCfg = COND_CFG[firstCond] || COND_CFG.damaged;
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    style={{ cursor: 'pointer', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.returnNumber}</td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      {(() => { const { date, time } = formatDateTimeSplit(r.createdAt || r.date); return (<><div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{date}</div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{time}</div></>); })()}
                    </td>
                    <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.supplierName || '—'}</td>
                    <td style={{ padding: '11px 12px', color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {firstItem?.productName || '—'}
                      {moreItems > 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>+{moreItems}</span>}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700 }}>{totalQty}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: condCfg.bg, color: condCfg.color, border: `1px solid ${condCfg.border}`, whiteSpace: 'nowrap' }}>
                        {condCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: src.bg, color: src.color, border: `1px solid ${src.border}`, whiteSpace: 'nowrap' }}>
                        {src.type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>{src.ref}</td>
                    <td style={{ padding: '11px 12px', color: 'var(--text-tertiary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{REASON_LABELS[r.reason] || r.reason || '—'}</td>
                    <td style={{ padding: '11px 12px' }}><StatusBadge status={r.status} small /></td>
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === r.id ? null : r.id); }}
                          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenuId === r.id && (
                          <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                            {[
                              { label: 'View Details', action: () => { openDetail(r.id); setOpenMenuId(null); } },
                              ['pending', 'ready_to_return', 'pending_replacement', 'pending_return', 'partially_replaced'].includes(r.status) ? { label: 'Edit', action: () => { setSelectedId(r.id); setTimeout(openEdit, 0); setOpenMenuId(null); } } : null,
                              (NEXT_STATUS[r.status] && !['pending_replacement', 'partially_replaced'].includes(r.status)) ? { label: NEXT_LABEL[r.status], action: () => { setSelectedId(r.id); setConfirmAction({ id: r.id, toStatus: NEXT_STATUS[r.status], label: `${NEXT_LABEL[r.status]}?` }); setOpenMenuId(null); } } : null,
                              r.status === 'returned' ? { label: '✓ Accepted by Supplier', action: () => { setSelectedId(r.id); setConfirmAction({ id: r.id, toStatus: 'accepted_by_supplier', label: 'Confirm supplier accepted this return?' }); setOpenMenuId(null); } } : null,
                              r.status === 'returned' ? { label: '✕ Rejected by Supplier', action: () => { setSelectedId(r.id); setConfirmAction({ id: r.id, toStatus: 'rejected_by_supplier', label: 'Confirm supplier rejected this return? Goods will move to Damaged Stock.' }); setOpenMenuId(null); }, color: '#DC2626' } : null,
                              ['pending_replacement', 'partially_replaced'].includes(r.status) ? { label: '✓ Replacement Received', action: () => { setSelectedId(r.id); setConfirmAction({ id: r.id, toStatus: 'replacement_received', label: 'Mark replacement as received?' }); setOpenMenuId(null); } } : null,
                              ['pending_replacement', 'partially_replaced'].includes(r.status) ? { label: '✕ Supplier Refused', action: () => { setSelectedId(r.id); setConfirmAction({ id: r.id, toStatus: 'rejected_by_supplier', label: 'Supplier refused replacement? Goods move to Damaged Stock.' }); setOpenMenuId(null); }, color: '#DC2626' } : null,
                              ['pending', 'ready_to_return', 'pending_replacement', 'pending_return', 'partially_replaced'].includes(r.status) ? { label: 'Cancel Return', action: () => { setConfirmAction({ id: r.id, toStatus: 'cancelled', label: 'Cancel this return?' }); setOpenMenuId(null); } } : null,
                            ].filter(Boolean).map(item => (
                              <button key={item.label} onClick={item.action} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: item.color || 'var(--text-primary)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════ DETAIL MODAL ══════ */}
      <Modal
        open={detailModal && !!selectedReturn}
        onClose={() => { setDetailModal(false); }}
        title={selectedReturn ? `${selectedReturn.returnNumber} — Return Details` : ''}
        size="lg"
      >
        {selectedReturn && selSource && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Action bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={selectedReturn.status} />
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: selSource.bg, color: selSource.color, border: `1px solid ${selSource.border}` }}>
                {selSource.type}
              </span>
              <div style={{ flex: 1 }} />
              {canEdit && (
                <button onClick={openEdit} style={outBtnStyle('#4F46E5')}><Edit2 size={12} /> Edit</button>
              )}
              {canAdvance && (
                <button onClick={handleAdvanceStatus} style={solidBtnStyle('#059669')}><ArrowRight size={12} /> {NEXT_LABEL[selectedReturn.status]}</button>
              )}
              {/* Replacement decision fork — shown while waiting for replacement */}
              {['pending_replacement', 'partially_replaced'].includes(selectedReturn.status) && (
                <>
                  <button onClick={handleReplacementReceived} style={solidBtnStyle('#16A34A')}><CheckCircle2 size={12} /> Replacement Received</button>
                  <button onClick={handleReplacementRefused} style={solidBtnStyle('#DC2626')}><XCircle size={12} /> Supplier Refused</button>
                </>
              )}
              {/* Accepted by supplier with replacement required → mark sent */}
              {selectedReturn.status === 'accepted_by_supplier' && selectedReturn.replacementRequired && (
                <button onClick={handleMarkReplacementSent} style={solidBtnStyle('#1D4ED8')}><Send size={12} /> Mark Replacement Sent</button>
              )}
              {/* Replacement sent → inspect when received */}
              {selectedReturn.status === 'replacement_sent' && (
                <button onClick={openInspectModal} style={solidBtnStyle('#D97706')}><Eye size={12} /> Inspect Replacement Received</button>
              )}
              {/* Pending inspection (e.g. set from PO side) → inspect */}
              {selectedReturn.status === 'replacement_received_pending_inspection' && (
                <button onClick={openInspectModal} style={solidBtnStyle('#D97706')}><Eye size={12} /> Inspect Replacement</button>
              )}
              {/* Supplier decision fork — shown when goods have been sent back */}
              {selectedReturn.status === 'returned' && (
                <>
                  <button onClick={handleAcceptedBySupplier} style={solidBtnStyle('#16A34A')}><CheckCircle2 size={12} /> Accepted by Supplier</button>
                  <button onClick={handleRejectedBySupplier} style={solidBtnStyle('#DC2626')}><XCircle size={12} /> Rejected by Supplier</button>
                </>
              )}
              {canCancel && (
                <button onClick={handleCancel} style={outBtnStyle('#DC2626')}><XCircle size={12} /> Cancel Return</button>
              )}
            </div>

            {/* Replacement banners */}
            {['pending_replacement', 'partially_replaced'].includes(selectedReturn.status) && (
              <div style={{ padding: '9px 13px', background: '#FEFCE8', border: '1px solid #FDE68A', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <RotateCcw size={13} color="#CA8A04" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#854D0E' }}>
                  Waiting for supplier to send a <strong>replacement</strong>. Once received, click <strong>Replacement Received</strong> above.
                  If the supplier refuses, click <strong>Supplier Refused</strong> — the goods will be moved to Damaged Stock.
                  {selSource.type === 'Purchase Order' && <span> You can also receive replacements from the linked PO detail page.</span>}
                </div>
              </div>
            )}
            {selectedReturn.status === 'replacement_received' && (
              <div style={{ padding: '9px 13px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CheckCircle2 size={13} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#14532D' }}>
                  Replacement goods have been <strong>received</strong>. Mark as Completed to close this return.
                </div>
              </div>
            )}
            {selectedReturn.status === 'replacement_sent' && (
              <div style={{ padding: '9px 13px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Send size={13} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#1E3A5F' }}>
                  Supplier has <strong>dispatched the replacement</strong>. Once goods arrive, click <strong>Inspect Replacement Received</strong> to inspect and update stock.
                </div>
              </div>
            )}
            {selectedReturn.status === 'replacement_received_pending_inspection' && (
              <div style={{ padding: '9px 13px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Eye size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#78350F' }}>
                  Replacement received — <strong>inspection pending</strong>. Click <strong>Inspect Replacement</strong> to record accepted, damaged, and defective quantities.
                </div>
              </div>
            )}
            {selectedReturn.status === 'replacement_accepted' && (
              <div style={{ padding: '9px 13px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CheckCircle2 size={13} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#14532D' }}>
                  Replacement <strong>accepted</strong> — {selectedReturn.replacementAcceptedQty || 0} unit(s) added to stock.
                </div>
              </div>
            )}
            {['replacement_damaged', 'replacement_defective'].includes(selectedReturn.status) && (
              <div style={{ padding: '9px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#991B1B' }}>
                  Replacement was <strong>{selectedReturn.status === 'replacement_damaged' ? 'damaged' : 'defective'}</strong> — a new return cycle has been created for the bad units.
                </div>
              </div>
            )}
            {selectedReturn.status === 'replacement_rejected' && (
              <div style={{ padding: '9px 13px', background: '#F4F4F5', border: '1px solid #D4D4D8', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <XCircle size={13} color="#71717A" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#52525B' }}>
                  Replacement was <strong>rejected</strong> — the qty has been closed with no further replacement required.
                </div>
              </div>
            )}
            {selectedReturn.status === 'accepted_by_supplier' && selectedReturn.replacementRequired && (
              <div style={{ padding: '9px 13px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <RefreshCw size={13} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#1E3A5F' }}>
                  Supplier accepted the return and will send a <strong>replacement</strong>. Click <strong>Mark Replacement Sent</strong> once the supplier dispatches.
                </div>
              </div>
            )}
            {/* Rejected-by-supplier / replacement refused banner */}
            {selectedReturn.status === 'rejected_by_supplier' && (
              <div style={{ padding: '9px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#991B1B' }}>
                  {selectedReturn.replacementRequired
                    ? <>Supplier <strong>refused</strong> to send a replacement. The damaged goods have been moved to <strong>Damaged Stock</strong>.</>
                    : <>Supplier <strong>rejected</strong> this return. The goods are back with us and have been moved to <strong>Damaged Stock</strong>.</>
                  }
                </div>
              </div>
            )}

            {/* Auto-created notice */}
            {selectedReturn.source === 'receiving_rejection' && (
              <div style={{ padding: '9px 13px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#92400E' }}>
                  This return was <strong>auto-created</strong> when items were marked damaged/defective/rejected during receiving. Stock was <strong>not</strong> deducted — these items were never added to stock.
                </div>
              </div>
            )}

            {/* Damaged Stock source notice */}
            {selectedReturn.source_type === 'damaged_stock' && (() => {
              const dmgRecord = damagedStockRecords.find(r => r.id === selectedReturn.damagedStockId);
              return (
                <div style={{ padding: '9px 13px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#78350F' }}>
                    Created from <strong>Damaged Stock</strong> record{dmgRecord ? <> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{dmgRecord.damageNumber}</span> — {dmgRecord.productName}</> : ''}.
                    {' '}Sellable stock was <strong>not</strong> deducted — items were already moved to damaged stock when marked damaged.
                  </div>
                </div>
              );
            })()}

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Return No',   selectedReturn.returnNumber],
                ['Return Date', formatDateTime(selectedReturn.createdAt || selectedReturn.date)],
                ['Supplier',    selectedReturn.supplierName || '—'],
                ['Reason',      REASON_LABELS[selectedReturn.reason] || selectedReturn.reason || '—'],
                ['Source Type', selSource.type],
                ['Source Ref',  selSource.ref],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: ['Return No','Source Ref'].includes(k) ? 'monospace' : 'inherit' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Items table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--canvas)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Items</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency((selectedReturn.items||[]).reduce((s,it) => s + Number(it.returnQty||0)*Number(it.unitCost||0), 0), sym)}
                  </strong>
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)' }}>
                    {['Product', 'Condition', 'Return Qty', 'Unit Cost', 'Total'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedReturn.items || []).map((it, i) => {
                    const cond = it.condition || it.reason || 'damaged';
                    const cc = COND_CFG[cond] || COND_CFG.damaged;
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600 }}>{it.productName}</div>
                          {it.sku && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{it.sku}</div>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 99, background: cc.bg, color: cc.color, fontSize: 10, fontWeight: 700, border: `1px solid ${cc.border}` }}>
                            {cc.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{it.returnQty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(it.unitCost || 0, sym)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(Number(it.returnQty||0)*Number(it.unitCost||0), sym)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Stock impact note */}
            {selectedReturn.source !== 'receiving_rejection' && selectedReturn.source_type !== 'damaged_stock' && !selectedReturn.isAutoReturn && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <PackageX size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#991B1B' }}>
                  Stock was deducted when this return was created.
                  {(selectedReturn.items||[]).map(it => ` ${it.productName}: −${it.returnQty}`).join(',')}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedReturn.notes && (
              <div style={{ background: 'var(--brand-faint)', border: '1px solid var(--brand-light)', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--brand)' }}>Notes:</strong> {selectedReturn.notes}
              </div>
            )}

            {/* Status flow */}
            {(() => {
              const st = selectedReturn.status;
              const isReplacementFlow = selectedReturn.replacementRequired === true || ['pending_replacement', 'partially_replaced', 'replacement_received', 'replacement_refused'].includes(st);
              const stepDot = (s, label, active, done, small) => {
                const c = STATUS_CFG[s] || STATUS_CFG.pending;
                const sz = small ? 22 : 26;
                return (
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: small ? 64 : 78 }}>
                    <div style={{ width: sz, height: sz, borderRadius: '50%', margin: '0 auto 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? c.fg : done ? '#16A34A' : 'var(--canvas)', border: `2px solid ${active ? c.fg : done ? '#16A34A' : 'var(--border)'}`, color: (active || done) ? '#fff' : 'var(--text-tertiary)' }}>
                      {done ? <CheckCircle2 size={small ? 10 : 12} /> : React.createElement(c.icon, { size: small ? 10 : 11 })}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? c.fg : done ? '#16A34A' : 'var(--text-tertiary)', lineHeight: 1.3 }}>{label || c.label}</div>
                  </div>
                );
              };
              const connector = (done, w = 12) => (
                <div style={{ flex: `1 0 ${w}px`, height: 2, background: done ? '#16A34A' : 'var(--border)', minWidth: w, marginBottom: 14 }} />
              );

              if (isReplacementFlow) {
                // Replacement path: Pending Replacement → [Replacement Received → Completed] OR [Supplier Refused → Damaged Stock]
                const replDone = ['replacement_received', 'completed', 'rejected_by_supplier'].includes(st);
                const rcvDone = ['completed'].includes(st);
                const refused = st === 'rejected_by_supplier';
                return (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 12 }}>Status Flow — Replacement</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto' }}>
                      {stepDot('pending_replacement', 'Pending Replacement', ['pending_replacement', 'partially_replaced'].includes(st), replDone, false)}
                      {connector(replDone)}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: refused ? 0.3 : 1 }}>
                          {stepDot('replacement_received', 'Replacement Received', st === 'replacement_received', rcvDone, true)}
                          {connector(rcvDone, 10)}
                          {stepDot('completed', null, st === 'completed' && !refused, false, true)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 2, opacity: rcvDone && !refused ? 0.3 : 1 }}>
                          {stepDot('rejected_by_supplier', 'Supplier Refused → Damaged Stock', refused, false, true)}
                        </div>
                      </div>
                      {st === 'cancelled' && (
                        <div style={{ marginLeft: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: '#F4F4F5', border: '1px solid #D4D4D8', fontSize: 11, fontWeight: 700, color: '#71717A', alignSelf: 'center' }}>
                          <XCircle size={11} /> Cancelled
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Standard return path: Pending (Return) → Ready to Return → Returned to Supplier → Accepted/Rejected
              const LINEAR_STEPS = st === 'pending_return'
                ? ['pending_return', 'ready_to_return', 'returned']
                : ['pending', 'ready_to_return', 'returned'];
              const afterReturned = ['accepted_by_supplier', 'rejected_by_supplier', 'completed'].includes(st);
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 12 }}>Status Flow</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto' }}>
                    {LINEAR_STEPS.map((s, i) => {
                      const linIdx = LINEAR_STEPS.indexOf(st);
                      const isActive = s === st && !afterReturned;
                      const isDone = linIdx > i || afterReturned;
                      return (
                        <React.Fragment key={s}>
                          {stepDot(s, null, isActive, isDone, false)}
                          {connector(isDone)}
                        </React.Fragment>
                      );
                    })}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: st === 'rejected_by_supplier' ? 0.3 : 1 }}>
                        {stepDot('accepted_by_supplier', null, st === 'accepted_by_supplier', st === 'completed', true)}
                        {connector(st === 'completed', 10)}
                        {stepDot('completed', null, st === 'completed', false, true)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2, opacity: ['accepted_by_supplier', 'completed'].includes(st) ? 0.3 : 1 }}>
                        {stepDot('rejected_by_supplier', 'Rejected → Damaged Stock', st === 'rejected_by_supplier', false, true)}
                      </div>
                    </div>
                    {st === 'cancelled' && (
                      <div style={{ marginLeft: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: '#F4F4F5', border: '1px solid #D4D4D8', fontSize: 11, fontWeight: 700, color: '#71717A', alignSelf: 'center' }}>
                        <XCircle size={11} /> Cancelled
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* ══════ EDIT MODAL ══════ */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Edit Return — ${selectedReturn?.returnNumber || ''}`} size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleSaveEdit} style={primaryBtnStyle}>Save Changes</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Reason">
            <Select value={editForm.reason || ''} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}>
              {Object.entries(REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </FormField>
          <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 0, background: 'var(--canvas)', padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              <div>Product</div><div style={{ textAlign: 'right' }}>Return Qty</div><div style={{ textAlign: 'right' }}>Unit Cost</div>
            </div>
            {(editForm.items || []).map((it, idx) => (
              <div key={idx} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{it.productName}</div>
                    {it.sku && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{it.sku}</div>}
                  </div>
                  <input type="number" min="1" value={it.returnQty} onChange={e => setEditItem(idx, { returnQty: e.target.value })}
                    style={{ width: '100%', height: 30, fontSize: 13, fontWeight: 700, textAlign: 'right', border: `1px solid ${editErrors[`qty${idx}`] ? 'var(--error)' : 'var(--border)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 7px', boxSizing: 'border-box' }}
                  />
                  <input type="number" min="0" step="0.01" value={it.unitCost} onChange={e => setEditItem(idx, { unitCost: e.target.value })}
                    style={{ width: '100%', height: 30, fontSize: 12, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 7px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <FormField label="Notes">
            <Textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ NEW MANUAL RETURN MODAL ══════ */}
      <Modal open={newReturnModal} onClose={() => setNewReturn(false)} title="New Purchase Return" size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setNewReturn(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreateReturn} style={primaryBtnStyle}>Create Return</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '9px 13px', background: 'var(--brand-faint)', border: '1px solid var(--brand-light)', borderRadius: 9, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
            <Info size={14} color="var(--brand)" style={{ flexShrink: 0, marginTop: 1 }} />
            Creating a manual return will deduct stock for the returned items.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Supplier *" error={nrErrors.supplierId}>
              <Select value={nrForm.supplierId} onChange={e => handleNrSupplierChange(e.target.value)} error={!!nrErrors.supplierId}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Original Purchase *" error={nrErrors.purchaseId}>
              <Select value={nrForm.purchaseId} onChange={e => handleNrPurchaseChange(e.target.value)} error={!!nrErrors.purchaseId} disabled={!nrForm.supplierId}>
                <option value="">Select purchase…</option>
                {supplierPurchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.gpNumber || p.purchaseNumber || p.id} — {formatDate(p.date || p.purchaseDate)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Reason">
            <Select value={nrForm.reason} onChange={e => setNrForm(f => ({ ...f, reason: e.target.value }))}>
              {Object.entries(REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </FormField>
          {nrForm.items.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', background: 'var(--canvas)', padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                <div>Product</div><div style={{ textAlign: 'right' }}>Return Qty</div>
              </div>
              {nrForm.items.map((it, idx) => (
                <div key={idx} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{it.productName}</div>
                    <input type="number" min="0" value={it.returnQty}
                      onChange={e => setNrForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, returnQty: e.target.value } : x) }))}
                      style={{ width: '100%', height: 30, fontSize: 13, fontWeight: 700, textAlign: 'right', border: `1px solid ${nrErrors[`qty${idx}`] ? 'var(--error)' : 'var(--border)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 7px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <FormField label="Notes">
            <Textarea value={nrForm.notes} onChange={e => setNrForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ REPLACEMENT INSPECTION MODAL ══════ */}
      <Modal
        open={inspectModal}
        onClose={() => setInspectModal(false)}
        title={`Inspect Replacement — ${selectedReturn?.returnNumber || ''}`}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setInspectModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleInspectReplacement} style={primaryBtnStyle}>Record Inspection</button>
          </div>
        }
      >
        {selectedReturn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Context strip */}
            <div style={{ padding: '9px 13px', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Return</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedReturn.returnNumber}</div>
              </div>
              {(selectedReturn.items || []).slice(0, 1).map(it => (
                <div key={it.productId}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{it.productName}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Original Bad Qty</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  {(selectedReturn.items || []).reduce((s, it) => s + Number(it.returnQty || 0), 0)}
                </div>
              </div>
            </div>

            {/* Received qty */}
            <FormField label="Replacement Qty Received *" error={inspectErrors.receivedQty}>
              <Input
                type="number" min="0"
                value={inspectForm.receivedQty}
                onChange={e => setInspectForm(f => ({ ...f, receivedQty: e.target.value }))}
                placeholder="Total units received from supplier"
              />
            </FormField>

            {/* Breakdown table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: 'var(--canvas)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                Qty Breakdown <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— must equal Received qty</span>
              </div>
              {[
                { key: 'acceptedQty',  label: 'Accepted (Good)',     color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
                { key: 'damagedQty',   label: 'Damaged',             color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                { key: 'defectiveQty', label: 'Defective',           color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { key: 'rejectedQty',  label: 'Rejected (on arrival)',color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              ].map(row => (
                <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                    {row.label}
                  </span>
                  <input
                    type="number" min="0"
                    value={inspectForm[row.key]}
                    onChange={e => setInspectForm(f => ({ ...f, [row.key]: e.target.value }))}
                    style={{ width: '100%', height: 30, fontSize: 13, fontWeight: 700, textAlign: 'right', border: `1px solid ${row.border}`, borderRadius: 6, background: row.bg, color: row.color, padding: '0 7px', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              {/* Live sum */}
              {(() => {
                const recv = Number(inspectForm.receivedQty || 0);
                const sum  = ['acceptedQty','damagedQty','defectiveQty','rejectedQty'].reduce((s, k) => s + Number(inspectForm[k] || 0), 0);
                const ok   = recv > 0 && sum === recv;
                return (
                  <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border)', background: ok ? '#F0FDF4' : sum > recv ? '#FEF2F2' : 'var(--canvas)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: ok ? '#16A34A' : sum > recv ? '#DC2626' : 'var(--text-secondary)' }}>
                      {ok ? '✓ Totals match' : sum > recv ? `Over by ${sum - recv}` : `${recv - sum} remaining`}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ok ? '#16A34A' : '#DC2626' }}>{sum} / {recv || '—'}</span>
                  </div>
                );
              })()}
            </div>
            {inspectErrors.sum && <div style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>{inspectErrors.sum}</div>}

            {/* Rejection mode — shown only if rejectedQty > 0 */}
            {Number(inspectForm.rejectedQty || 0) > 0 && (
              <div style={{ padding: '11px 13px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 9 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5B21B6', marginBottom: 8 }}>What to do with {inspectForm.rejectedQty} rejected unit(s)?</div>
                {[
                  { value: 'request_again', label: 'Request replacement again', desc: 'Creates a new return cycle for these units' },
                  { value: 'close_rejected', label: 'Close — no further replacement', desc: 'Marks these units as lost/closed, no new cycle' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', marginBottom: opt.value === 'request_again' ? 7 : 0 }}>
                    <input
                      type="radio" name="rejectionMode"
                      value={opt.value}
                      checked={inspectForm.rejectionMode === opt.value}
                      onChange={() => setInspectForm(f => ({ ...f, rejectionMode: opt.value }))}
                      style={{ marginTop: 3, accentColor: '#7C3AED', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#4C1D95' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#6D28D9' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Notes */}
            <FormField label="Inspection Notes">
              <Textarea
                value={inspectForm.notes}
                onChange={e => setInspectForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Optional — record any observations about the replacement quality"
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ══════ CONFIRM ══════ */}
      <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={doConfirm} title="Confirm" message={confirmAction?.label || ''} confirmLabel="Confirm" />
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────────────── */
const primaryBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer' };
const cancelBtnStyle  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', cursor: 'pointer' };
function solidBtnStyle(color) { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: color, color: '#fff', border: `1.5px solid ${color}`, cursor: 'pointer', whiteSpace: 'nowrap' }; }
function outBtnStyle(color)   { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'transparent', color, border: `1.5px solid ${color}`, cursor: 'pointer', whiteSpace: 'nowrap' }; }
