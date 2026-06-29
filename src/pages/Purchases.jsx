import React, { useState, useMemo } from 'react';
import {
  Plus, Search, ShoppingCart, TrendingDown, Clock, CheckCircle2,
  X, Package, Truck, DollarSign, ChevronRight, Trash2,
  BarChart3, AlertTriangle, ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select } from '../components/forms/FormField';
import { formatCurrency, formatDate, formatDateTime, searchFilter, today, calcPurchaseTotals } from '../utils/helpers';
import toast from 'react-hot-toast';

const emptyForm = { supplierId: '', date: today(), expectedDate: today(), paymentStatus: 'paid', status: 'received', notes: '' };
const emptyItem = { productId: '', quantity: 1, unitCost: '', condition: 'good' };

/* ── Status config ──────────────────────────────────────────────────── */
const STATUS_CFG = {
  received:  { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Received'   },
  partial:   { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', label: 'Partial'    },
  pending:   { bg: '#FEFCE8', fg: '#CA8A04', border: '#FDE047', label: 'Pending'    },
  cancelled: { bg: '#F4F4F5', fg: '#71717A', border: '#E4E4E7', label: 'Cancelled'  },
};
const PAY_CFG = {
  paid:    { bg: '#F0FDF4', fg: '#16A34A', label: 'Paid'    },
  partial: { bg: '#FEFCE8', fg: '#CA8A04', label: 'Partial' },
  unpaid:  { bg: '#FEF2F2', fg: '#DC2626', label: 'Unpaid'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
}
function PayBadge({ status }) {
  const cfg = PAY_CFG[status] || PAY_CFG.unpaid;
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
export default function Purchases() {
  const { state, addPurchase, deletePurchase } = useApp();
  const { purchases, suppliers, products, settings } = state;
  const sym = settings.currencySymbol || '₹';

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatus]       = useState('');
  const [selectedId, setSelected]       = useState(null);
  const [deleteId, setDeleteId]         = useState(null);
  const [modal, setModal]               = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [items, setItems]               = useState([{ ...emptyItem }]);
  const [errors, setErrors]             = useState({});

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      monthTotal:  purchases.filter(p => (p.date || '').startsWith(thisMonth)).reduce((s, p) => s + (p.grandTotal || 0), 0),
      received:    purchases.filter(p => p.status === 'received').reduce((s, p) => s + (p.grandTotal || 0), 0),
      pending:     purchases.filter(p => p.status === 'pending').reduce((s, p) => s + (p.grandTotal || 0), 0),
      pendingCount: purchases.filter(p => p.status === 'pending').length,
    };
  }, [purchases]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = searchFilter(purchases, search, ['purchaseNumber', 'supplierName']);
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [purchases, search, statusFilter]);

  /* ── Selected ── */
  const selPurchase  = purchases.find(p => p.id === selectedId) || null;
  const selSupplier  = selPurchase ? suppliers.find(s => s.id === selPurchase.supplierId) : null;

  /* ── Stock impact for selected purchase ── */
  const stockImpact = useMemo(() => {
    if (!selPurchase) return [];
    return (selPurchase.items || []).map(item => {
      const prod = products.find(p => p.id === item.productId || p.name === item.productName);
      return { ...item, currentStock: prod?.stock ?? '—', unit: prod?.unit || '' };
    });
  }, [selPurchase, products]);

  /* ── Form ── */
  const set     = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErrors(e => ({ ...e, [f]: '' })); };
  const setItem = (idx, field, val) => setItems(prev => {
    const next = [...prev];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) next[idx].unitCost = prod.costPrice || prod.purchasePrice || '';
    }
    return next;
  });
  const addRow    = () => setItems(p => [...p, { ...emptyItem }]);
  const removeRow = idx => setItems(p => p.filter((_, i) => i !== idx));
  const { subtotal, grandTotal } = useMemo(() => calcPurchaseTotals(items), [items]);

  const validate = () => {
    const errs = {};
    if (!form.supplierId) errs.supplierId = 'Select a supplier';
    if (items.length === 0 || items.some(i => !i.productId)) errs.items = 'All items must have a product selected';
    if (items.some(i => Number(i.quantity) <= 0)) errs.items = 'Quantities must be > 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const supplier    = suppliers.find(s => s.id === form.supplierId);
    const mappedItems = items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return { ...item, productName: prod?.name || '', sku: prod?.sku || '' };
    });
    addPurchase({ ...form, supplierName: supplier?.name || '', items: mappedItems, subtotal, grandTotal });
    setModal(false);
    setForm(emptyForm);
    setItems([{ ...emptyItem }]);
    setErrors({});
  };

  const openNew  = () => { setForm(emptyForm); setItems([{ ...emptyItem }]); setErrors({}); setModal(true); };

  const handleDelete = async () => {
    try {
      await deletePurchase(deleteId);
      if (selectedId === deleteId) setSelected(null);
      toast.success('Purchase deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* Top panel */}
      <div style={{ flexShrink: 0, padding: '20px 24px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><ShoppingCart size={20} color="var(--brand)" /> Purchases</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{purchases.length} orders · {kpi.pendingCount} pending</p>
          </div>
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.5} /> New Purchase
          </button>
        </div>

        {/* KPI strip */}
        <div className="kpi-strip" style={{ marginBottom: 16 }}>
          {[
            { icon: ShoppingCart, label: 'This Month', value: formatCurrency(kpi.monthTotal, sym), fg: '#4F46E5', bg: '#EEF2FF' },
            { icon: CheckCircle2, label: 'Received',   value: formatCurrency(kpi.received,   sym), fg: '#16A34A', bg: '#F0FDF4' },
            { icon: Clock,        label: 'Pending',    value: formatCurrency(kpi.pending,    sym), fg: kpi.pending > 0 ? '#CA8A04' : '#16A34A', bg: kpi.pending > 0 ? '#FEFCE8' : '#F0FDF4' },
            { icon: AlertTriangle,label: 'Pending POs',value: kpi.pendingCount,                   fg: kpi.pendingCount > 0 ? '#DC2626' : '#16A34A', bg: kpi.pendingCount > 0 ? '#FEF2F2' : '#F0FDF4' },
          ].map(({ icon: Icon, label, value, fg, bg }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--canvas)', borderRadius: 11, border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: fg }} strokeWidth={1.75} />
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO number or supplier…"
              style={{ width: '100%', height: 34, paddingLeft: 30, paddingRight: 10, border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--canvas)', outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)' }}
              onFocus={e => e.target.style.borderColor = 'var(--brand)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          {[{ val: '', label: 'All' }, { val: 'received', label: 'Received' }, { val: 'partial', label: 'Partial' }, { val: 'pending', label: 'Pending' }, { val: 'cancelled', label: 'Cancelled' }].map(s => (
            <button key={s.val} onClick={() => setStatus(s.val)} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, transition: 'all 0.12s', background: statusFilter === s.val ? 'var(--brand)' : 'transparent', color: statusFilter === s.val ? '#fff' : 'var(--text-secondary)', borderColor: statusFilter === s.val ? 'var(--brand)' : 'var(--border)' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Purchase list */}
        <div style={{ width: 380, flexShrink: 0, borderRight: '1.5px solid var(--border)', overflowY: 'auto', background: 'var(--surface)' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <ShoppingCart size={36} style={{ color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No purchases found</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {search || statusFilter ? 'Try adjusting filters' : 'Record your first purchase order'}
              </p>
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {filtered.map(pur => {
                const isSel = pur.id === selectedId;
                return (
                  <div key={pur.id} onClick={() => setSelected(prev => prev === pur.id ? null : pur.id)}
                    style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s', marginBottom: 2, border: `1.5px solid ${isSel ? 'var(--brand)' : 'transparent'}`, background: isSel ? 'var(--brand-faint)' : 'transparent' }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--canvas)'; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{pur.purchaseNumber}</p>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pur.supplierName || '—'}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatDate(pur.date)} · {(pur.items || []).length} item{(pur.items||[]).length !== 1 ? 's' : ''}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(pur.grandTotal || 0, sym)}</p>
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <StatusBadge status={pur.status} />
                          <PayBadge status={pur.paymentStatus} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Purchase detail */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!selPurchase ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ShoppingCart size={48} strokeWidth={1.25} style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Select a purchase to view</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Click any order in the list on the left</p>
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Detail header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{selPurchase.purchaseNumber}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <StatusBadge status={selPurchase.status} />
                    <PayBadge status={selPurchase.paymentStatus} />
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{formatDate(selPurchase.date)}</span>
                    {selPurchase.createdAt && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{formatDateTime(selPurchase.createdAt)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setDeleteId(selPurchase.id)} style={{ width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:8,cursor:'pointer',color:'#DC2626' }}>
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>

              {/* Supplier card */}
              <div style={{ background: 'var(--canvas)', borderRadius: 12, padding: '14px 18px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Truck size={18} style={{ color: '#4F46E5' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selPurchase.supplierName || '—'}</p>
                  {selSupplier?.phone && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{selSupplier.phone}</p>}
                  {selSupplier?.email && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selSupplier.email}</p>}
                </div>
                {selPurchase.expectedDate && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>EXPECTED</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{formatDate(selPurchase.expectedDate)}</p>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Order Items</p>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--canvas)' }}>
                        {['Product', 'Ordered', selPurchase.status === 'partial' ? 'Received' : null, 'Unit Cost', 'Total', 'Stock Now'].filter(Boolean).map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(selPurchase.items || []).map((item, i) => {
                        const si = stockImpact[i] || {};
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</p>
                              {item.sku && <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>{item.sku}</p>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.quantity}</td>
                            {selPurchase.status === 'partial' && (
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#C2410C' }}>
                                {item.receivedQty ?? 0}
                                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 3 }}>/ {item.quantity}</span>
                              </td>
                            )}
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(item.unitCost, sym)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(item.unitCost) * Number(item.quantity), sym)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: typeof si.currentStock === 'number' ? (si.currentStock < 5 ? '#DC2626' : 'var(--text-secondary)') : 'var(--text-tertiary)' }}>
                                {si.currentStock !== undefined ? `${si.currentStock} ${si.unit || ''}` : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <div style={{ width: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(selPurchase.subtotal || 0, sym)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, paddingTop: 10, borderTop: '1.5px solid var(--border)', color: 'var(--text-primary)' }}>
                      <span>Grand Total</span>
                      <span style={{ color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(selPurchase.grandTotal || 0, sym)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selPurchase.notes && (
                <div style={{ background: '#FEFCE8', borderRadius: 10, padding: '12px 14px', border: '1px solid #FEF08A' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: '#A16207', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selPurchase.notes}</p>
                </div>
              )}

              {/* Timestamps */}
              {(selPurchase.receivedAt || selPurchase.completedAt) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                  {selPurchase.receivedAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Received At</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{formatDateTime(selPurchase.receivedAt)}</span>
                    </div>
                  )}
                  {selPurchase.completedAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Completed At</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{formatDateTime(selPurchase.completedAt)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Purchase Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Purchase Order">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Supplier *" error={errors.supplierId}>
              <Select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} className={errors.supplierId ? 'input-error' : ''}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Order Date">
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Expected Date">
              <Input type="date" value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="received">Fully Received</option>
                <option value="partial">Partially Received</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormField>
            <FormField label="Payment">
              <Select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </FormField>
          </div>

          {/* Items */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Items *</p>
            {errors.items && <p style={{ fontSize: 11.5, color: 'var(--error)', marginBottom: 8 }}>{errors.items}</p>}
            {form.status === 'partial' && (
              <div style={{ display: 'flex', gap: 8, padding: '4px 0 2px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <span style={{ flex: 2 }}>Product</span>
                <span style={{ width: 68 }}>Ordered</span>
                <span style={{ width: 68 }}>Received</span>
                <span style={{ width: 96 }}>Unit Cost</span>
                <span style={{ width: 28 }}></span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 2 }}>
                    <Select value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)}>
                      <option value="">Select product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </div>
                  <div style={{ width: 68 }}>
                    <Input type="number" min="1" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} placeholder="Qty" />
                  </div>
                  {form.status === 'partial' && (
                    <div style={{ width: 68 }}>
                      <Input type="number" min="0" max={item.quantity} value={item.receivedQty ?? ''} onChange={e => setItem(idx, 'receivedQty', e.target.value)} placeholder="Rcvd" style={{ borderColor: '#F59E0B' }} />
                    </div>
                  )}
                  <div style={{ width: 96 }}>
                    <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setItem(idx, 'unitCost', e.target.value)} placeholder="Cost" />
                  </div>
                  <div style={{ width: 110 }}>
                    <select value={item.condition || 'good'} onChange={e => setItem(idx, 'condition', e.target.value)}
                      style={{ width: '100%', height: 36, fontSize: 12, border: `1.5px solid ${item.condition && item.condition !== 'good' ? '#FED7AA' : 'var(--border)'}`, borderRadius: 7, background: 'var(--surface)', color: item.condition && item.condition !== 'good' ? '#C2410C' : 'var(--text-primary)', padding: '0 6px', cursor: 'pointer' }}>
                      <option value="good">Good ✓</option>
                      <option value="damaged">Damaged ✗</option>
                      <option value="defective">Defective ✗</option>
                      <option value="rejected">Rejected ✗</option>
                    </select>
                  </div>
                  <button onClick={() => removeRow(idx)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRow} style={{ marginTop: 8, height: 30, padding: '0 12px', background: 'none', border: '1.5px dashed var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={12} /> Add item
            </button>
          </div>

          {/* Totals preview */}
          {items.some(i => i.productId) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ padding: '10px 14px', background: 'var(--canvas)', borderRadius: 9, border: '1px solid var(--border-subtle)', minWidth: 200 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotal, sym)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--border)', color: 'var(--brand)' }}>
                  <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(grandTotal, sym)}</span>
                </div>
              </div>
            </div>
          )}

          <FormField label="Notes">
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setModal(false)} style={{ height: 36, padding: '0 16px', background: 'var(--canvas)', border: '1.5px solid var(--border)', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} style={{ height: 36, padding: '0 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save Purchase</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Purchase" message="This will permanently delete this purchase order and reverse the stock changes." confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
    </div>
  );
}
