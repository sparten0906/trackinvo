import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, Search, X, Package, CheckCircle2, XCircle,
  Clock, Wrench, Trash2, RotateCcw, Truck, Info,
  MoreHorizontal, Inbox, TrendingDown, RefreshCw, Link2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatDate, formatDateTime, formatDateTimeSplit, formatModalDateTime, formatCurrency, searchFilter, today } from '../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  open:                 { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', label: 'Open',                  Icon: Clock },
  under_review:         { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', label: 'Under Review',          Icon: Info },
  repaired:             { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Repaired',               Icon: CheckCircle2 },
  written_off:          { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE', label: 'Written Off',            Icon: XCircle },
  disposed:             { bg: '#F3F4F6', fg: '#6B7280', border: '#D1D5DB', label: 'Disposed',               Icon: Trash2 },
  returned_to_supplier: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', label: 'Returned to Supplier',  Icon: Truck },
  replacement_pending:  { bg: '#FEFCE8', fg: '#A16207', border: '#FDE68A', label: 'Replacement Pending',   Icon: RefreshCw },
  returned_rejected:    { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Return Rejected',        Icon: XCircle },
  closed:               { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Closed',                 Icon: CheckCircle2 },
  cancelled:            { bg: '#F3F4F6', fg: '#6B7280', border: '#D1D5DB', label: 'Cancelled',              Icon: XCircle },
};

const DAMAGE_TYPE_LABELS = {
  warehouse_damage:         'Warehouse Damage',
  customer_return:          'Customer Return',
  defective:                'Defective',
  expired:                  'Expired',
  broken:                   'Broken',
  missing_parts:            'Missing Parts',
  supplier_rejected_return: 'Supplier Rejected Return',
  other:                    'Other',
};

const SOURCE_TYPE_LABELS = {
  manual:                    'Manual',
  sales_return:              'Sales Return',
  purchase_order:            'Purchase Order',
  general_purchase:          'General Purchase',
  purchase_return_rejected:  'Purchase Return (Rejected)',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  const { Icon } = cfg;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      <Icon size={10} strokeWidth={2.5} /> {cfg.label}
    </span>
  );
}

export default function DamagedStock() {
  const { state, resolveDamagedStock } = useApp();
  const { damagedStockRecords = [], products, settings, suppliers = [], purchaseReturns = [] } = state;
  const sym = settings?.currencySymbol || '₹';

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailId, setDetailId]       = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolution: 'repaired', quantity: '', notes: '', supplierId: '' });
  const [resolveTarget, setResolveTarget] = useState(null);
  const [openMenuId, setOpenMenuId]   = useState(null);

  const stats = useMemo(() => {
    const s = { total: damagedStockRecords.length, open: 0, under_review: 0, repaired: 0, written_off: 0, disposed: 0, returned_to_supplier: 0, replacement_pending: 0, returned_rejected: 0, closed: 0, cancelled: 0 };
    damagedStockRecords.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    const totalDmgQty = damagedStockRecords.filter(r => ['open','under_review'].includes(r.status)).reduce((s, r) => s + r.quantity, 0);
    return { ...s, totalDmgQty };
  }, [damagedStockRecords]);

  const filtered = useMemo(() => {
    let list = [...damagedStockRecords];
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    list = searchFilter(list, search, ['productName', 'sku', 'damageNumber', 'reason', 'sourceReferenceNo']);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [damagedStockRecords, statusFilter, search]);

  const selectedRecord = damagedStockRecords.find(r => r.id === detailId) || null;

  const openResolve = (record) => {
    setResolveTarget(record);
    setResolveForm({ resolution: 'repaired', quantity: String(record.quantity), notes: '', supplierId: record.supplierId || '' });
    setResolveModal(true);
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    const qty = Number(resolveForm.quantity);
    if (!(qty > 0)) { toast.error('Quantity must be > 0'); return; }
    if (resolveForm.resolution === 'returned_to_supplier' && !resolveForm.supplierId) {
      toast.error('Please select the supplier to return to'); return;
    }
    const selectedSupplier = suppliers.find(s => s.id === resolveForm.supplierId);
    const extraData = resolveForm.resolution === 'returned_to_supplier'
      ? { supplierId: resolveForm.supplierId, supplierName: selectedSupplier?.name || '', returnReason: 'damaged' }
      : {};
    await resolveDamagedStock(resolveTarget.id, resolveForm.resolution, qty, resolveForm.notes, extraData);
    setResolveModal(false);
    if (detailId === resolveTarget.id) setDetailModal(false);
  };

  const canResolve = (r) => ['open', 'under_review'].includes(r.status);

  const TABS = [
    { value: 'all',                  label: 'All',              count: stats.total },
    { value: 'open',                 label: 'Open',             count: stats.open },
    { value: 'replacement_pending',  label: 'Repl. Pending',   count: stats.replacement_pending },
    { value: 'returned_rejected',    label: 'Return Rejected',  count: stats.returned_rejected },
    { value: 'repaired',             label: 'Repaired',         count: stats.repaired },
    { value: 'written_off',          label: 'Written Off',      count: stats.written_off },
    { value: 'disposed',             label: 'Disposed',         count: stats.disposed },
    { value: 'returned_to_supplier', label: 'Returned',         count: stats.returned_to_supplier },
    { value: 'closed',               label: 'Closed',           count: stats.closed },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}
      onClick={() => { if (openMenuId) setOpenMenuId(null); }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 24px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <AlertTriangle size={20} color="#D97706" /> Damaged Stock
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
              Track and resolve damaged, defective, and non-sellable inventory.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, maxWidth: '100%' }}>
            {[
              { l: 'Total Records', v: stats.total, fg: '#4F46E5', bg: '#EEF2FF' },
              { l: 'Active (Damaged)', v: stats.totalDmgQty + ' units', fg: '#C2410C', bg: '#FFF7ED' },
              { l: 'Repaired', v: stats.repaired, fg: '#16A34A', bg: '#F0FDF4' },
            ].map(kpi => (
              <div key={kpi.l} style={{ background: kpi.bg, border: `1px solid ${kpi.fg}30`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: kpi.fg }}>{kpi.v}</div>
                <div style={{ fontSize: 10, color: kpi.fg, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{kpi.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              style={{ padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: statusFilter === tab.value ? 700 : 500, color: statusFilter === tab.value ? 'var(--brand)' : 'var(--text-tertiary)', borderBottom: statusFilter === tab.value ? '2px solid var(--brand)' : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, background: statusFilter === tab.value ? 'var(--brand)' : 'var(--border)', color: statusFilter === tab.value ? '#fff' : 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product, damage no, reason..."
            style={{ width: '100%', height: 34, padding: '0 10px 0 32px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', fontSize: 13, color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <Inbox size={40} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>No damaged stock records</p>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>Records appear when stock is marked as damaged or returned damaged.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)' }}>
                    {['Damage No', 'Reported Date', 'Product', 'SKU', 'Qty', 'Damage Type', 'Source', 'Status', 'Reason', ''].map((h, i) => (
                      <th key={h || i} style={{ padding: '9px 14px', textAlign: i > 3 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(rec => (
                    <tr key={rec.id} onClick={() => { setDetailId(rec.id); setDetailModal(true); }}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#D97706', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{rec.damageNumber}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDate(rec.reportedDate || rec.createdAt)}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.productName}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>{rec.sku || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#DC2626' }}>{rec.quantity}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', whiteSpace: 'nowrap' }}>
                          {DAMAGE_TYPE_LABELS[rec.damageType] || rec.damageType}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {SOURCE_TYPE_LABELS[rec.sourceType] || rec.sourceType}
                          {rec.sourceReferenceNo && <span style={{ fontFamily: 'monospace', marginLeft: 3, color: 'var(--brand)' }}>#{rec.sourceReferenceNo}</span>}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}><StatusBadge status={rec.status} /></td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.reason || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === rec.id ? null : rec.id); }}
                            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <MoreHorizontal size={14} />
                          </button>
                          {openMenuId === rec.id && (
                            <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, overflow: 'hidden' }}>
                              <button onClick={() => { setDetailId(rec.id); setDetailModal(true); setOpenMenuId(null); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-primary)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>View Details</button>
                              {canResolve(rec) && (
                                <button onClick={() => { openResolve(rec); setOpenMenuId(null); }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#16A34A', borderTop: '1px solid var(--border-subtle)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Resolve</button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <Modal open={detailModal && !!selectedRecord} onClose={() => setDetailModal(false)}
          title={`${selectedRecord.damageNumber} — Damage Detail`} size="lg"
          footer={
            canResolve(selectedRecord) ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailModal(false)} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Close</button>
                <button onClick={() => openResolve(selectedRecord)} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Resolve This Record</button>
              </div>
            ) : null
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Damage No',   selectedRecord.damageNumber],
                ['Reported',    formatDateTime(selectedRecord.reportedDate || selectedRecord.createdAt)],
                ['Product',     selectedRecord.productName],
                ['SKU',         selectedRecord.sku || '—'],
                ['Quantity',    selectedRecord.quantity + ' units'],
                ['Damage Type', DAMAGE_TYPE_LABELS[selectedRecord.damageType] || selectedRecord.damageType],
                ['Source',      (SOURCE_TYPE_LABELS[selectedRecord.sourceType] || selectedRecord.sourceType) + (selectedRecord.sourceReferenceNo ? ` (${selectedRecord.sourceReferenceNo})` : '')],
                ['Status',      ''],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
                  {k === 'Status' ? <StatusBadge status={selectedRecord.status} /> : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: k === 'Damage No' ? '#D97706' : 'var(--text-primary)', fontFamily: k === 'Damage No' || k === 'SKU' ? 'monospace' : 'inherit' }}>{v}</div>
                  )}
                </div>
              ))}
            </div>
            {selectedRecord.reason && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: 3 }}>Reason</div>
                <div style={{ fontSize: 13, color: '#78350F' }}>{selectedRecord.reason}</div>
              </div>
            )}
            {selectedRecord.notes && (
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 3 }}>Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedRecord.notes}</div>
              </div>
            )}
            {selectedRecord.resolvedDate && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 3 }}>Resolved</div>
                <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{formatDateTime(selectedRecord.resolvedDate)}</div>
              </div>
            )}
            {selectedRecord.status === 'returned_rejected' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <XCircle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#991B1B' }}>
                  The supplier <strong>rejected this return</strong> — goods are back in damaged stock and must be resolved separately.
                </div>
              </div>
            )}
            {selectedRecord.purchaseReturnId && (() => {
              const linkedPR = purchaseReturns.find(r => r.id === selectedRecord.purchaseReturnId);
              if (!linkedPR) return null;
              const prStatusCfg = {
                pending_return: { bg: '#FFF7ED', fg: '#C2410C', label: 'Pending Return' },
                returned: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Returned' },
                accepted_by_supplier: { bg: '#F0FDF4', fg: '#16A34A', label: 'Accepted' },
                rejected_by_supplier: { bg: '#FEF2F2', fg: '#DC2626', label: 'Rejected' },
                replacement_pending: { bg: '#FEFCE8', fg: '#A16207', label: 'Replacement Pending' },
                replacement_sent: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Replacement Sent' },
                replacement_accepted: { bg: '#F0FDF4', fg: '#16A34A', label: 'Replacement Accepted' },
                cancelled: { bg: '#F3F4F6', fg: '#6B7280', label: 'Cancelled' },
              };
              const cfg = prStatusCfg[linkedPR.status] || { bg: '#F3F4F6', fg: '#6B7280', label: linkedPR.status };
              return (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Link2 size={10} /> Linked Purchase Return
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace' }}>{linkedPR.returnNumber}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.fg}40` }}>{cfg.label}</span>
                    {linkedPR.supplierName && <span style={{ fontSize: 12, color: '#374151' }}>{linkedPR.supplierName}</span>}
                    <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto' }}>Go to Purchase Returns to manage replacement</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Resolve Modal */}
      <Modal open={resolveModal} onClose={() => setResolveModal(false)}
        title="Resolve Damage Record" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setResolveModal(false)} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
            <button onClick={handleResolve} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Confirm Resolution</button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resolveTarget && (
            <div style={{ padding: '8px 12px', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>{resolveTarget.productName}</strong> · {resolveTarget.damageNumber} · {resolveTarget.quantity} units damaged
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Resolution</label>
            <select value={resolveForm.resolution} onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))}
              style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
              <option value="repaired">Mark Repaired (restore to sellable stock)</option>
              <option value="written_off">Write Off (remove from records)</option>
              <option value="disposed">Mark Disposed</option>
              <option value="returned_to_supplier">Return to Supplier (creates Purchase Return)</option>
              <option value="cancelled">Cancel Record</option>
            </select>
          </div>
          {resolveForm.resolution === 'returned_to_supplier' && (
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Supplier <span style={{ color: '#DC2626' }}>*</span></label>
              <select value={resolveForm.supplierId} onChange={e => setResolveForm(f => ({ ...f, supplierId: e.target.value }))}
                style={{ width: '100%', height: 34, padding: '0 10px', border: `1px solid ${!resolveForm.supplierId ? '#FCA5A5' : 'var(--border)'}`, borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                <option value="">— Select supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{ marginTop: 6, padding: '7px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 11.5, color: '#1D4ED8' }}>
                A Purchase Return will be created and linked to this damage record. Sellable stock will <strong>not</strong> be deducted again.
              </div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Quantity</label>
            <input type="number" min="1" value={resolveForm.quantity} onChange={e => setResolveForm(f => ({ ...f, quantity: e.target.value }))}
              style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes</label>
            <textarea value={resolveForm.notes} onChange={e => setResolveForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          {resolveForm.resolution === 'repaired' && (
            <div style={{ padding: '8px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, color: '#166534', fontWeight: 600 }}>
              This will move the quantity back to sellable stock.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
