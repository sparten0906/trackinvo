import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Search, Receipt, X, Minus, Plus,
  ChevronRight, Inbox, CheckCircle2, AlertTriangle,
  PackageCheck, ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, today, calcSalesReturnTotals } from '../utils/helpers';
import toast from 'react-hot-toast';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: 'good',           short: 'Good',      label: 'Good Condition', stockType: 'sellable', clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0' },
  { id: 'damaged',        short: 'Damaged',   label: 'Damaged',        stockType: 'damaged',  clr: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
  { id: 'defective',      short: 'Defective', label: 'Defective',      stockType: 'damaged',  clr: '#EA580C', bg: '#FFF7ED', bdr: '#FED7AA' },
  { id: 'used',           short: 'Used',      label: 'Used / Worn',    stockType: 'damaged',  clr: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
  { id: 'not_resellable', short: 'N/R',       label: 'Not Resellable', stockType: 'damaged',  clr: '#71717A', bg: '#F4F4F5', bdr: '#D4D4D8' },
];
const COND_MAP = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

const REFUND_METHODS = [
  { id: 'cash',          label: 'Cash'          },
  { id: 'bank_transfer', label: 'Bank Transfer'  },
  { id: 'credit_note',   label: 'Credit Note'   },
  { id: 'upi',           label: 'UPI'           },
  { id: 'store_credit',  label: 'Store Credit'  },
  { id: 'no_refund',     label: 'No Refund'     },
];

const RETURN_REASONS = [
  { id: 'quality_issue',         label: 'Quality Issue'           },
  { id: 'wrong_item',            label: 'Wrong Item Delivered'    },
  { id: 'damaged_in_transit',    label: 'Damaged in Transit'      },
  { id: 'defective',             label: 'Defective / Not Working' },
  { id: 'customer_changed_mind', label: 'Customer Changed Mind'   },
  { id: 'expired',               label: 'Expired'                 },
  { id: 'not_as_described',      label: 'Not As Described'        },
  { id: 'other',                 label: 'Other'                   },
];

const PS_CFG = {
  paid:    { fg: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', label: 'Paid'    },
  partial: { fg: '#CA8A04', bg: '#FEFCE8', bdr: '#FEF08A', label: 'Partial' },
  unpaid:  { fg: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', label: 'Unpaid'  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildReturnedMap(salesReturns, invoiceId) {
  const map = {};
  (salesReturns || [])
    .filter(r => r.invoiceId === invoiceId && r.status !== 'cancelled')
    .forEach(r => (r.items || []).forEach(it => {
      map[it.productId] = (map[it.productId] || 0) + Number(it.returnQty || 0);
    }));
  return map;
}

function makeRow(invItem, retMap) {
  const invoiceQty      = Number(invItem.quantity || 0);
  const alreadyReturned = retMap[invItem.productId] || 0;
  return {
    productId:       invItem.productId,
    productName:     invItem.productName || invItem.name || '',
    sku:             invItem.sku || '',
    invoiceQty,
    alreadyReturned,
    maxReturn:       Math.max(0, invoiceQty - alreadyReturned),
    returnQty:       0,
    condition:       'good',
    remarks:         '',
    unitPrice:       Number(invItem.unitPrice || invItem.price || invItem.sellingPrice || 0),
    taxPercent:      Number(invItem.taxPercent || 0),
    discount:        Number(invItem.discount || 0),
  };
}

// ─── Condition Picker ─────────────────────────────────────────────────────────

// Reasons that strongly imply damage — warn if user picks "good" condition
const DAMAGE_REASONS = new Set(['damaged_in_transit', 'defective', 'quality_issue', 'expired']);

function ConditionPicker({ value, onChange, disabled, returnReason }) {
  const selected = COND_MAP[value] || CONDITIONS[0];
  const showWarning = !disabled && selected.stockType === 'sellable' && DAMAGE_REASONS.has(returnReason);

  return (
    <div>
      {/* Card row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
        {CONDITIONS.map(c => {
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !disabled && onChange(c.id)}
              disabled={disabled}
              title={`${c.label} — returns to ${c.stockType === 'sellable' ? 'sellable' : 'damaged'} stock`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '5px 6px', minWidth: 50, flex: 1,
                border: `1.5px solid ${active ? c.clr : 'var(--border)'}`,
                borderRadius: 7,
                background: active ? c.bg : 'var(--canvas)',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.38 : 1,
                gap: 2,
                transition: 'border-color 0.12s, background 0.12s',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? c.clr : 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                {c.short}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: active ? c.clr : 'var(--text-disabled)', whiteSpace: 'nowrap', opacity: 0.9, letterSpacing: '0.02em' }}>
                {c.stockType === 'sellable' ? '↑ Sellable' : '↑ Damaged'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warning: reason implies damage but user chose Good */}
      {showWarning && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <AlertTriangle size={10} color="#D97706" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, color: '#92400E', fontWeight: 600, lineHeight: 1.4 }}>
            Return reason suggests damage — confirm condition is correct.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SalesReturnNew() {
  const navigate = useNavigate();
  const { state, addSalesReturn } = useApp();
  const { invoices = [], salesReturns = [], settings } = state;
  const sym = settings?.currencySymbol || '₹';

  const [search,        setSearch]        = useState('');
  const [selectedInvId, setSelectedInvId] = useState(null);
  const [returnItems,   setReturnItems]   = useState([]);
  const [refundMode,    setRefundMode]    = useState('cash');
  const [reason,        setReason]        = useState('quality_issue');
  const [notes,         setNotes]         = useState('');
  const [returnDate,    setReturnDate]    = useState(today());
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const selectedInv = invoices.find(i => i.id === selectedInvId) || null;

  const eligibleInvoices = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invoices
      .filter(inv => (inv.items || []).length > 0)
      .filter(inv =>
        !q ||
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.customerName  || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''))
      .slice(0, 40);
  }, [invoices, search]);

  const activeItems = useMemo(() => returnItems.filter(it => it.returnQty > 0), [returnItems]);

  const stockImpact = useMemo(() => {
    let sellable = 0, damaged = 0;
    activeItems.forEach(it => {
      if ((COND_MAP[it.condition] || CONDITIONS[0]).stockType === 'sellable') sellable += it.returnQty;
      else damaged += it.returnQty;
    });
    return { sellable, damaged };
  }, [activeItems]);

  const { total: refundAmount } = useMemo(() => calcSalesReturnTotals(activeItems), [activeItems]);
  const canComplete = !!selectedInv && activeItems.length > 0 && !isSubmitting;

  function handleSelectInv(inv) {
    const retMap = buildReturnedMap(salesReturns, inv.id);
    setSelectedInvId(inv.id);
    setReturnItems((inv.items || []).map(it => makeRow(it, retMap)));
    setRefundMode('cash');
    setReason('quality_issue');
    setNotes('');
    setReturnDate(today());
  }

  function bumpQty(productId, delta) {
    setReturnItems(prev => prev.map(it =>
      it.productId === productId
        ? { ...it, returnQty: Math.max(0, Math.min(it.maxReturn, it.returnQty + delta)) }
        : it
    ));
  }

  function updateItem(productId, updates) {
    setReturnItems(prev => prev.map(it => it.productId === productId ? { ...it, ...updates } : it));
  }

  async function handleComplete() {
    if (!canComplete) return;
    setIsSubmitting(true);
    try {
      addSalesReturn({
        invoiceId:     selectedInv.id,
        invoiceNumber: selectedInv.invoiceNumber,
        customerId:    selectedInv.customerId,
        customerName:  selectedInv.customerName,
        date:          returnDate,
        reason,
        refundMode,
        notes,
        totalAmount:   refundAmount,
        items: activeItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          sku:         it.sku,
          returnQty:   it.returnQty,
          condition:   it.condition,
          reason,
          unitPrice:   it.unitPrice,
          taxPercent:  it.taxPercent,
          discount:    it.discount,
        })),
      });
      toast.success('Return recorded successfully');
      navigate('/sales-returns');
    } catch {
      toast.error('Failed to process return');
      setIsSubmitting(false);
    }
  }

  // shared input style
  const iSel = { height: 34, padding: '0 28px 0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: `var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717A' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center / 16px 16px`, color: 'var(--text-primary)', width: '100%', WebkitAppearance: 'none', appearance: 'none', outline: 'none' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Header bar ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 54, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14 }}>
        <button
          type="button"
          onClick={() => navigate('/sales-returns')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', flexShrink: 0 }}>Create Sales Return</span>
        {selectedInv && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontWeight: 700, color: 'var(--brand)' }}>{selectedInv.invoiceNumber}</span>
              {' · '}{selectedInv.customerName}{' · '}{formatDate(selectedInv.date || selectedInv.createdAt)}
            </span>
          </>
        )}
      </div>

      {/* ── Body: main scroll + sidebar ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Main scroll area ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minWidth: 0 }}>

          {/* ─ Invoice Lookup ─ */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Lookup</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {selectedInv ? `${selectedInv.customerName} · ${selectedInv.invoiceNumber}` : 'Search by invoice number or customer name'}
                </div>
              </div>
              {selectedInv && (
                <button
                  type="button"
                  onClick={() => { setSelectedInvId(null); setReturnItems([]); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}
                >
                  <X size={11} /> Change
                </button>
              )}
            </div>

            {!selectedInv && (
              <>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search invoice number or customer name…"
                      style={{ width: '100%', height: 38, paddingLeft: 32, fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>

                {eligibleInvoices.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No invoices match your search.</div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {eligibleInvoices.map((inv, i) => {
                      const ps = PS_CFG[inv.paymentStatus] || PS_CFG.unpaid;
                      const prevRet = salesReturns.filter(r => r.invoiceId === inv.id && r.status !== 'cancelled').length;
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => handleSelectInv(inv)}
                          style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--brand-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 12 }}>
                            <Receipt size={13} color="var(--brand)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Menlo, Consolas, monospace' }}>{inv.invoiceNumber}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: ps.bg, color: ps.fg, border: `1px solid ${ps.bdr}` }}>{ps.label}</span>
                              {prevRet > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: 'var(--brand-faint)', color: 'var(--brand)' }}>{prevRet} prior return{prevRet !== 1 ? 's' : ''}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10 }}>
                              <span>{inv.customerName}</span>
                              <span style={{ color: 'var(--text-tertiary)' }}>{formatDate(inv.date || inv.createdAt)}</span>
                              <span style={{ color: 'var(--text-tertiary)' }}>{(inv.items || []).length} items</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(inv.grandTotal || inv.totalAmount || 0, sym)}</span>
                            <ChevronRight size={13} color="var(--text-tertiary)" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Invoice info strip */}
            {selectedInv && (
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
                {[
                  ['Customer',   selectedInv.customerName || '—',                                   false],
                  ['Invoice',    selectedInv.invoiceNumber,                                          true ],
                  ['Date',       formatDate(selectedInv.date || selectedInv.createdAt),              false],
                  ['Amount',     formatCurrency(selectedInv.grandTotal || selectedInv.totalAmount || 0, sym), false],
                ].map(([k, v, mono], idx, arr) => (
                  <div key={k} style={{ padding: '12px 18px', borderRight: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono ? 'Menlo, Consolas, monospace' : 'inherit' }}>{v}</div>
                  </div>
                ))}
                <div style={{ padding: '12px 18px', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Payment</div>
                  {(() => { const ps = PS_CFG[selectedInv.paymentStatus] || PS_CFG.unpaid; return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ps.bg, color: ps.fg, border: `1px solid ${ps.bdr}` }}>{ps.label}</span>; })()}
                </div>
              </div>
            )}
          </div>

          {/* ─ Products table ─ */}
          {selectedInv && returnItems.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Returned Products</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {returnItems.length} product{returnItems.length !== 1 ? 's' : ''}{activeItems.length > 0 ? ` · ${activeItems.length} selected` : ''}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                {/* Condition legend */}
                <div style={{ padding: '8px 14px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Condition guide:</span>
                  {CONDITIONS.map(c => (
                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.clr, border: `1px solid ${c.bdr}` }}>
                      {c.id === 'good' ? <PackageCheck size={9} strokeWidth={2.5} /> : <ShieldAlert size={9} strokeWidth={2.5} />}
                      {c.short} → {c.stockType === 'sellable' ? 'Sellable' : 'Damaged'}
                    </span>
                  ))}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas)' }}>
                      {[
                        ['Product',          'left',   'auto' ],
                        ['Invoice Qty',      'center', '80px' ],
                        ['Prev. Returned',   'center', '90px' ],
                        ['Return Qty',       'center', '100px'],
                        ['Condition & Impact','left',  '310px'],
                        ['Refund',           'right',  '110px'],
                        ['Remarks',          'left',   '130px'],
                      ].map(([h, align, w]) => (
                        <th key={h} style={{ padding: '8px 13px', textAlign: align, fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: w }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((item, idx) => {
                      const cond       = COND_MAP[item.condition] || CONDITIONS[0];
                      const isSellable = cond.stockType === 'sellable';
                      const lineTotal  = item.returnQty * item.unitPrice;
                      const exhausted  = item.maxReturn === 0;
                      const isLast     = idx === returnItems.length - 1;
                      return (
                        <tr key={item.productId} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', opacity: exhausted ? 0.45 : 1, background: item.returnQty > 0 ? 'var(--brand-faint, #f5f3ff05)' : '' }}>
                          {/* Product */}
                          <td style={{ padding: '11px 13px' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>{item.productName}</div>
                            {item.sku && <div style={{ fontSize: 11, fontFamily: 'Menlo, Consolas, monospace', color: 'var(--text-tertiary)' }}>{item.sku}</div>}
                            {exhausted && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '1px 7px', borderRadius: 20 }}>
                                <AlertTriangle size={9} strokeWidth={2.5} /> All units returned
                              </div>
                            )}
                          </td>
                          {/* Invoice Qty */}
                          <td style={{ padding: '11px 13px', textAlign: 'center' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{item.invoiceQty}</span>
                          </td>
                          {/* Already returned */}
                          <td style={{ padding: '11px 13px', textAlign: 'center' }}>
                            {item.alreadyReturned > 0
                              ? <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEFCE8', color: '#CA8A04', border: '1px solid #FEF08A' }}>{item.alreadyReturned}</span>
                              : <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>}
                          </td>
                          {/* Return qty stepper */}
                          <td style={{ padding: '11px 13px', textAlign: 'center' }}>
                            {exhausted ? <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span> : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', background: 'var(--surface)' }}>
                                <button type="button" onClick={() => bumpQty(item.productId, -1)} disabled={item.returnQty <= 0}
                                  style={{ width: 28, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: item.returnQty <= 0 ? 'default' : 'pointer', color: item.returnQty <= 0 ? 'var(--text-disabled)' : 'var(--text-secondary)' }}>
                                  <Minus size={10} strokeWidth={2.5} />
                                </button>
                                <span style={{ minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 800, color: item.returnQty > 0 ? 'var(--brand)' : 'var(--text-tertiary)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', lineHeight: '30px', padding: '0 4px', display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}>{item.returnQty}</span>
                                <button type="button" onClick={() => bumpQty(item.productId, 1)} disabled={item.returnQty >= item.maxReturn}
                                  style={{ width: 28, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: item.returnQty >= item.maxReturn ? 'default' : 'pointer', color: item.returnQty >= item.maxReturn ? 'var(--text-disabled)' : 'var(--text-secondary)' }}>
                                  <Plus size={10} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </td>
                          {/* Condition & Impact combined */}
                          <td style={{ padding: '8px 13px' }}>
                            {exhausted
                              ? <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>
                              : (
                                <div>
                                  <ConditionPicker
                                    value={item.condition}
                                    onChange={v => updateItem(item.productId, { condition: v })}
                                    disabled={item.returnQty === 0}
                                    returnReason={reason}
                                  />
                                  {/* Stock destination indicator */}
                                  {item.returnQty > 0 && (
                                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                      {isSellable
                                        ? <><PackageCheck size={11} color="#16A34A" strokeWidth={2.5} /><span style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A' }}>Returns to Sellable Stock</span></>
                                        : <><ShieldAlert size={11} color="#DC2626" strokeWidth={2.5} /><span style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626' }}>Goes to Damaged Inventory</span></>
                                      }
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          </td>
                          {/* Refund */}
                          <td style={{ padding: '11px 13px', textAlign: 'right' }}>
                            {item.returnQty > 0
                              ? <>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(lineTotal, sym)}</div>
                                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{item.returnQty} × {formatCurrency(item.unitPrice, sym)}</div>
                                </>
                              : <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>}
                          </td>
                          {/* Remarks */}
                          <td style={{ padding: '8px 13px' }}>
                            {!exhausted && (
                              <input
                                value={item.remarks}
                                onChange={e => updateItem(item.productId, { remarks: e.target.value })}
                                placeholder="Optional…"
                                style={{ width: '100%', height: 30, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─ Return details ─ */}
          {activeItems.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Return Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Return Reason</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} style={iSel}>
                    {RETURN_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Refund Method</label>
                  <select value={refundMode} onChange={e => setRefundMode(e.target.value)} style={iSel}>
                    {REFUND_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Return Date</label>
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={{ ...iSel, background: 'var(--surface)', padding: '0 10px' }} />
                </div>
              </div>
              <div style={{ marginTop: 13 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional return notes…"
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical', minHeight: 58, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky sidebar summary ── */}
        <div style={{ width: 282, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Return Summary</div>

            {/* Refund total */}
            <div style={{ textAlign: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Total Refund</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: canComplete ? 'var(--brand)' : 'var(--text-disabled)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatCurrency(refundAmount, sym)}
              </div>
              {activeItems.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {activeItems.reduce((s, i) => s + i.returnQty, 0)} units · {activeItems.length} product{activeItems.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Stock impact */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Stock Impact</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Sellable', qty: stockImpact.sellable, bg: '#F0FDF4', fg: '#16A34A', bdr: '#BBF7D0' },
                  { label: 'Damaged',  qty: stockImpact.damaged,  bg: '#FEF2F2', fg: '#DC2626', bdr: '#FECACA' },
                ].map(({ label, qty, bg, fg, bdr }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 7, background: qty > 0 ? bg : 'var(--canvas)', border: `1px solid ${qty > 0 ? bdr : 'var(--border)'}` }}>
                    <span style={{ fontSize: 12.5, color: qty > 0 ? fg : 'var(--text-tertiary)', fontWeight: 500 }}>{label} Stock</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: qty > 0 ? fg : 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums' }}>+{qty}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected items mini list */}
            {activeItems.length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Selected Items</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activeItems.map((it, idx) => {
                    const c = COND_MAP[it.condition] || CONDITIONS[0];
                    return (
                      <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: idx < activeItems.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ minWidth: 0, paddingRight: 8 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName}</div>
                          <div style={{ fontSize: 11, marginTop: 1, display: 'flex', gap: 5 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Qty: {it.returnQty}</span>
                            <span style={{ color: c.clr, fontWeight: 600 }}>· {c.short}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(it.returnQty * it.unitPrice, sym)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!selectedInv && (
              <div style={{ textAlign: 'center', padding: '28px 8px' }}>
                <Receipt size={26} strokeWidth={1} style={{ margin: '0 auto 10px', opacity: 0.2, display: 'block' }} />
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>Select an invoice to start processing the return.</div>
              </div>
            )}
          </div>

          {/* Complete button inside sidebar */}
          <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={handleComplete}
              disabled={!canComplete}
              style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: canComplete ? 'var(--brand)' : 'var(--zinc-200)', color: canComplete ? '#fff' : 'var(--text-disabled)', border: 'none', borderRadius: 9, cursor: canComplete ? 'pointer' : 'not-allowed', fontSize: 13.5, fontWeight: 700 }}
            >
              <CheckCircle2 size={15} />
              {isSubmitting ? 'Processing…' : 'Complete Return'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => navigate('/sales-returns')} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <X size={13} /> Cancel
        </button>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {activeItems.length > 0
            ? `${activeItems.length} item${activeItems.length !== 1 ? 's' : ''} selected · ${formatCurrency(refundAmount, sym)} refund`
            : selectedInv ? 'Select items to return' : 'Select an invoice to begin'}
        </div>
        <button type="button" onClick={handleComplete} disabled={!canComplete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 18px', background: canComplete ? 'var(--brand)' : 'var(--zinc-200)', color: canComplete ? '#fff' : 'var(--text-disabled)', border: 'none', borderRadius: 8, cursor: canComplete ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {isSubmitting ? 'Processing…' : 'Complete Return'}
        </button>
      </div>
    </div>
  );
}
