import React, { useState, useMemo, useCallback } from 'react';
import {
  Activity, Search, X, Plus, Package, Truck, RotateCcw,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertTriangle,
  Trash2, Wrench, SlidersHorizontal,
  Download, Printer, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, ArrowRight, Inbox,
  Clock, Calendar, CheckCircle2, ArrowUpRight,
  ChevronDown, ChevronUp, FileText, Tag, Filter,
  BarChart3, GitCompareArrows,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime, formatDateTimeSplit, formatCurrency, filterByDateRange } from '../utils/helpers';
import toast from 'react-hot-toast';

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────

const TYPE_META = {
  OPENING_STOCK:                { label: 'Opening Stock',        cat: 'in',      clr: '#1D4ED8', bg: '#EFF6FF', bdr: '#BFDBFE', Icon: Package         },
  PURCHASE_RECEIVE:             { label: 'PO Received',          cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: ArrowDownCircle  },
  GENERAL_PURCHASE_RECEIVE:     { label: 'GP Received',          cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: ArrowDownCircle  },
  PURCHASE_REPLACEMENT_RECEIVE: { label: 'Replacement Rcvd',     cat: 'in',      clr: '#059669', bg: '#ECFDF5', bdr: '#6EE7B7', Icon: RefreshCw        },
  PURCHASE_EXTRA_RECEIVE:       { label: 'Extra Units Rcvd',     cat: 'in',      clr: '#0891B2', bg: '#ECFEFF', bdr: '#A5F3FC', Icon: ArrowDownCircle  },
  SALE:                         { label: 'Sale',                 cat: 'out',     clr: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', Icon: ArrowUpCircle    },
  SALES_RETURN:                 { label: 'Sales Return',         cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: RotateCcw        },
  SALE_RETURN:                  { label: 'Sales Return',         cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: RotateCcw        },
  SALES_RETURN_DAMAGED:         { label: 'Return (Damaged)',     cat: 'dmg-in',  clr: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', Icon: AlertTriangle    },
  PURCHASE_RETURN:              { label: 'Purchase Return',      cat: 'out',     clr: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE', Icon: ArrowUpCircle    },
  PURCHASE_RETURN_REJECTED:     { label: 'Rtn Rejected (Dmg)',   cat: 'dmg-in',  clr: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', Icon: AlertTriangle    },
  DAMAGED_STOCK:                { label: 'Damaged Stock',        cat: 'dmg-in',  clr: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', Icon: AlertTriangle    },
  DAMAGED_REPAIRED:             { label: 'Repaired',             cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: Wrench           },
  DAMAGED_WRITEOFF:             { label: 'Written Off',          cat: 'dmg-out', clr: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE', Icon: Trash2           },
  DAMAGED_DISPOSED:             { label: 'Disposed',             cat: 'dmg-out', clr: '#6B7280', bg: '#F3F4F6', bdr: '#D1D5DB', Icon: Trash2           },
  DAMAGED_RETURN_TO_SUPPLIER:   { label: 'Returned to Supplier', cat: 'dmg-out', clr: '#1D4ED8', bg: '#EFF6FF', bdr: '#BFDBFE', Icon: Truck            },
  MANUAL_ADJUSTMENT:            { label: 'Manual Adjustment',    cat: 'adj',     clr: '#0EA5E9', bg: '#F0F9FF', bdr: '#BAE6FD', Icon: SlidersHorizontal},
  STOCK_CORRECTION:             { label: 'Stock Correction',     cat: 'adj',     clr: '#0EA5E9', bg: '#F0F9FF', bdr: '#BAE6FD', Icon: SlidersHorizontal},
  PURCHASE:                     { label: 'Purchase',             cat: 'in',      clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0', Icon: ArrowDownCircle  },
  DAMAGED:                      { label: 'Damaged',              cat: 'dmg-in',  clr: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', Icon: AlertTriangle    },
  EXPIRED:                      { label: 'Expired',              cat: 'dmg-out', clr: '#9333EA', bg: '#FAF5FF', bdr: '#D8B4FE', Icon: Trash2           },
};

const CAT_STRIPE = {
  'in':      '#16A34A',
  'out':     '#DC2626',
  'dmg-in':  '#D97706',
  'dmg-out': '#7C3AED',
  'adj':     '#0EA5E9',
};

const MANUAL_TYPES = new Set(['MANUAL_ADJUSTMENT','STOCK_CORRECTION','OPENING_STOCK']);

const PAGE_SIZE = 50;

function getMeta(type) {
  return TYPE_META[type] || { label: type || 'Transaction', cat: 'adj', clr: '#6B7280', bg: '#F3F4F6', bdr: '#D1D5DB', Icon: Activity };
}

// ─── Source Document Resolver ────────────────────────────────────────────────

function resolveSource(tx, state) {
  const { invoices = [], salesReturns = [], purchaseOrders = [], purchases = [], purchaseReturns = [], damagedStockRecords = [] } = state;
  const refId  = tx.referenceId;
  const rType  = (tx.referenceType || '').toLowerCase();
  const txType = tx.transactionType || '';

  if (rType === 'invoice' || txType === 'SALE') {
    const doc = invoices.find(i => i.id === refId) || invoices.find(i => i.invoiceNumber === tx.referenceNumber);
    return { label: 'Invoice', sourceType: 'Invoice', ref: tx.referenceNumber || doc?.invoiceNumber, party: doc?.customerName, partyLabel: 'Customer', doc, nav: '/invoices', clr: '#1D4ED8', bg: '#EFF6FF', bdr: '#BFDBFE' };
  }
  if (rType.includes('sales_return') || txType === 'SALES_RETURN' || txType === 'SALE_RETURN' || txType === 'SALES_RETURN_DAMAGED') {
    const doc = salesReturns.find(r => r.id === refId) || salesReturns.find(r => r.returnNumber === tx.referenceNumber);
    return { label: 'Sales Return', sourceType: 'Sales Return', ref: tx.referenceNumber || doc?.returnNumber, party: doc?.customerName, partyLabel: 'Customer', doc, nav: '/sales-returns', clr: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0' };
  }
  if (rType.includes('purchase_order') || rType === 'po' || rType === 'grn' || txType === 'PURCHASE_RECEIVE' || txType === 'PURCHASE_REPLACEMENT_RECEIVE' || txType === 'PURCHASE_EXTRA_RECEIVE') {
    const doc = purchaseOrders.find(p => p.id === refId) || purchaseOrders.find(p => p.poNumber === tx.referenceNumber);
    return { label: 'Purchase Order', sourceType: 'Purchase Order', ref: tx.referenceNumber || doc?.poNumber, party: doc?.supplierName, partyLabel: 'Supplier', doc, nav: '/purchase-orders', clr: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' };
  }
  if (rType === 'purchase' || rType === 'general_purchase' || rType.includes('general_purchase') || txType === 'GENERAL_PURCHASE_RECEIVE' || txType === 'PURCHASE') {
    const doc = purchases.find(p => p.id === refId) || purchases.find(p => p.gpNumber === tx.referenceNumber);
    return { label: 'General Purchase', sourceType: 'Gen. Purchase', ref: tx.referenceNumber || doc?.gpNumber, party: doc?.supplierName, partyLabel: 'Supplier', doc, nav: '/purchases', clr: '#0891B2', bg: '#ECFEFF', bdr: '#A5F3FC' };
  }
  if (rType.includes('purchase_return') || rType === 'return' || txType === 'PURCHASE_RETURN' || txType === 'PURCHASE_RETURN_REJECTED') {
    const doc = purchaseReturns.find(r => r.id === refId) || purchaseReturns.find(r => r.returnNumber === tx.referenceNumber);
    return { label: 'Purchase Return', sourceType: 'Purchase Return', ref: tx.referenceNumber || doc?.returnNumber, party: doc?.supplierName, partyLabel: 'Supplier', doc, nav: '/purchase-returns', clr: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' };
  }
  if (rType.includes('damaged') || txType === 'DAMAGED_STOCK' || txType === 'DAMAGED_REPAIRED' || txType === 'DAMAGED_WRITEOFF' || txType === 'DAMAGED_DISPOSED' || txType === 'DAMAGED_RETURN_TO_SUPPLIER' || txType === 'DAMAGED') {
    const doc = damagedStockRecords.find(d => d.id === refId) || damagedStockRecords.find(d => d.damageNumber === tx.referenceNumber);
    return { label: 'Damaged Stock', sourceType: 'Damaged Stock', ref: tx.referenceNumber || doc?.damageNumber, party: null, partyLabel: null, doc, nav: '/damaged-stock', clr: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' };
  }
  if (rType === 'adjustment' || txType === 'MANUAL_ADJUSTMENT' || txType === 'STOCK_CORRECTION' || txType === 'OPENING_STOCK' || txType === 'EXPIRED') {
    return { label: 'Manual', sourceType: 'Adjustment', ref: tx.referenceNumber || '—', party: null, partyLabel: null, doc: null, nav: null, clr: '#0EA5E9', bg: '#F0F9FF', bdr: '#BAE6FD' };
  }
  return { label: 'System', sourceType: 'System', ref: tx.referenceNumber || '—', party: null, partyLabel: null, doc: null, nav: null, clr: '#6B7280', bg: '#F3F4F6', bdr: '#D1D5DB' };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(rows, state) {
  const hdr = ['#','Date','Product','SKU','Type','Category','Source Type','Reference No','Stock In','Stock Out','Damaged In','Damaged Out','Previous Stock','New Stock','Status','Note'];
  const data = rows.map((tx, i) => {
    const m  = getMeta(tx.transactionType);
    const src = resolveSource(tx, state);
    return [
      i + 1, tx.createdAt, `"${tx.productName || ''}"`, tx.sku || '',
      m.label, m.cat, src.sourceType, tx.referenceNumber || '',
      tx.quantityIn || 0, tx.quantityOut || 0,
      tx.nonSellableQuantityIn || 0, tx.nonSellableQuantityOut || 0,
      tx.previousStock ?? '', tx.newStock ?? '',
      MANUAL_TYPES.has(tx.transactionType) ? 'Manual' : 'Auto',
      `"${(tx.note || '').replace(/"/g, "'")}"`,
    ].join(',');
  });
  const csv  = [hdr.join(','), ...data].join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const m = getMeta(type);
  const Icon = m.Icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: m.bg, color: m.clr, border: `1px solid ${m.bdr}`, whiteSpace: 'nowrap', letterSpacing: '0.01em', lineHeight: 1.6 }}>
      <Icon size={9} strokeWidth={2.5} /> {m.label}
    </span>
  );
}

function SourceBadge({ src }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: src.bg, color: src.clr, border: `1px solid ${src.bdr}`, whiteSpace: 'nowrap' }}>
      {src.sourceType}
    </span>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatStrip({ kpi }) {
  const items = [
    { Icon: Activity,     label: 'Total Movements', value: kpi.count,                                                  clr: 'var(--brand)'  },
    { Icon: TrendingUp,   label: 'Stock In',        value: `+${kpi.totalIn}`,                                          clr: '#16A34A'       },
    { Icon: TrendingDown, label: 'Stock Out',        value: `−${kpi.totalOut}`,                                         clr: '#DC2626'       },
    { Icon: AlertTriangle,label: 'Damaged In',       value: `+${kpi.dmgIn}`,                                            clr: '#D97706'       },
    { Icon: Trash2,       label: 'Damaged Out',      value: `−${kpi.dmgOut}`,                                           clr: '#7C3AED'       },
    { Icon: SlidersHorizontal,label:'Adjustments',   value: kpi.adj,                                                    clr: '#0EA5E9'       },
    { Icon: Clock,        label: 'Last Movement',    value: kpi.lastDate ? formatDateTime(kpi.lastDate) : '—',              clr: 'var(--text-secondary)' },
  ];
  return (
    <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '2px solid var(--border)', display: 'flex', overflowX: 'auto' }}>
      {items.map(({ Icon, label, value, clr }, i) => (
        <React.Fragment key={label}>
          {i > 0 && <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch', margin: '6px 0' }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px', flexShrink: 0 }}>
            <Icon size={13} color={clr} strokeWidth={2} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: clr, letterSpacing: '-0.02em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({ filters, setFilter, products, onReset, sym }) {
  const iBase = { height: 32, padding: '0 9px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none' };
  const iSel  = { ...iBase, padding: '0 26px 0 9px', background: `var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717A' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E") no-repeat right 7px center/14px 14px`, WebkitAppearance: 'none', appearance: 'none' };

  const FLabel = ({ children }) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{children}</div>
  );

  const uniqueTypes = Object.entries(TYPE_META).reduce((acc, [k, m]) => {
    if (!acc.find(([, m2]) => m2.label === m.label)) acc.push([k, m]);
    return acc;
  }, []);

  return (
    <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 16px' }}>
        {/* Date From */}
        <div><FLabel>Date From</FLabel><input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} style={{ ...iBase, padding: '0 7px' }} /></div>
        {/* Date To */}
        <div><FLabel>Date To</FLabel><input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} style={{ ...iBase, padding: '0 7px' }} /></div>
        {/* Product */}
        <div>
          <FLabel>Product</FLabel>
          <select value={filters.productId} onChange={e => setFilter('productId', e.target.value)} style={iSel}>
            <option value="">All Products</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {/* SKU */}
        <div><FLabel>SKU</FLabel><input value={filters.sku} onChange={e => setFilter('sku', e.target.value)} placeholder="e.g. WBH-001" style={iBase} /></div>
        {/* Transaction Type */}
        <div>
          <FLabel>Transaction Type</FLabel>
          <select value={filters.txType} onChange={e => setFilter('txType', e.target.value)} style={iSel}>
            <option value="">All Types</option>
            {uniqueTypes.map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
        {/* Direction */}
        <div>
          <FLabel>Direction</FLabel>
          <select value={filters.cat} onChange={e => setFilter('cat', e.target.value)} style={iSel}>
            <option value="">All Directions</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="dmg-in">Damaged In</option>
            <option value="dmg-out">Damaged Out</option>
            <option value="adj">Adjustments</option>
          </select>
        </div>
        {/* Source Type */}
        <div>
          <FLabel>Source Type</FLabel>
          <select value={filters.sourceType} onChange={e => setFilter('sourceType', e.target.value)} style={iSel}>
            <option value="">All Sources</option>
            <option value="invoice">Invoice (Sale)</option>
            <option value="sales_return">Sales Return</option>
            <option value="purchase_order">Purchase Order</option>
            <option value="purchase">General Purchase</option>
            <option value="purchase_return">Purchase Return</option>
            <option value="damaged_stock">Damaged Stock</option>
            <option value="adjustment">Manual / Adjustment</option>
          </select>
        </div>
        {/* Reference No */}
        <div><FLabel>Reference No</FLabel><input value={filters.refNo} onChange={e => setFilter('refNo', e.target.value)} placeholder="e.g. INV-2026-0001" style={iBase} /></div>
        {/* Damaged Only toggle */}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => setFilter('damagedOnly', !filters.damagedOnly)}
              style={{ width: 36, height: 20, borderRadius: 10, background: filters.damagedOnly ? '#D97706' : 'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 3, left: filters.damagedOnly ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: filters.damagedOnly ? '#D97706' : 'var(--text-secondary)' }}>Damaged Stock Only</span>
          </label>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onReset} style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Reset All
        </button>
      </div>
    </div>
  );
}

// ─── Product Summary Panel ────────────────────────────────────────────────────

function ProductPanel({ product, txList, pspList, sym }) {
  if (!product) return null;
  const sellable  = product.stock || 0;
  const damaged   = product.damagedQty || 0;
  const total     = sellable + damaged;
  const psp       = (pspList || []).find(p => p.productId === product.id);
  const lastTx    = txList.find(t => t.productId === product.id);
  const lastDate  = lastTx?.createdAt;

  return (
    <div style={{ flexShrink: 0, margin: '0', background: 'var(--brand-faint)', borderBottom: '2px solid var(--brand)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 24, overflowX: 'auto' }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brand)', marginBottom: 2 }}>Filtered Product</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{product.name}</div>
        <div style={{ fontSize: 11, fontFamily: 'Menlo, Consolas, monospace', color: 'var(--text-tertiary)' }}>{product.sku}</div>
      </div>
      <div style={{ width: 1, height: 40, background: 'var(--brand-light, #c7d2fe)', flexShrink: 0 }} />
      {[
        { l: 'Sellable Stock', v: sellable, hi: true, clr: '#16A34A'           },
        { l: 'Damaged Stock',  v: damaged,  hi: true, clr: damaged > 0 ? '#D97706' : 'var(--text-tertiary)' },
        { l: 'Total Physical', v: total,    hi: false, clr: 'var(--text-primary)' },
        { l: 'Last Movement',  v: lastDate ? formatDateTime(lastDate) : '—', hi: false, clr: 'var(--text-secondary)' },
        psp ? { l: 'Last Purchase',  v: formatCurrency(psp.lastPurchasePrice || 0, sym),  hi: false, clr: 'var(--text-secondary)' } : null,
        psp ? { l: 'Avg Cost',       v: formatCurrency(psp.averagePurchasePrice || 0, sym), hi: false, clr: 'var(--text-secondary)' } : null,
        { l: 'Stock Value',    v: formatCurrency(sellable * (psp?.lastPurchasePrice || product.purchasePrice || 0), sym), hi: false, clr: 'var(--text-secondary)' },
      ].filter(Boolean).map(({ l, v, hi, clr }) => (
        <div key={l} style={{ flexShrink: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{l}</div>
          <div style={{ fontSize: hi ? 18 : 13, fontWeight: hi ? 900 : 700, color: clr, fontVariantNumeric: 'tabular-nums', letterSpacing: hi ? '-0.03em' : 0 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ tx, state, onClose }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('all');

  if (!tx) return null;

  const { products = [], categories = [], settings } = state;
  const sym     = settings?.currencySymbol || '₹';
  const m       = getMeta(tx.transactionType);
  const Icon    = m.Icon;
  const src     = resolveSource(tx, state);
  const product = products.find(p => p.id === tx.productId);
  const category= categories.find(c => c.id === product?.categoryId);
  const isManual= MANUAL_TYPES.has(tx.transactionType);

  const qIn  = Number(tx.quantityIn  || 0);
  const qOut = Number(tx.quantityOut || 0);
  const dIn  = Number(tx.nonSellableQuantityIn  || 0);
  const dOut = Number(tx.nonSellableQuantityOut || 0);
  const prevSell = Number(tx.previousStock || 0);
  const newSell  = Number(tx.newStock || 0);
  const netSell  = qIn - qOut;

  function SectionHead({ label }) {
    return (
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10, marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        {label}
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
    );
  }

  function DataRow({ label, value, mono, highlight, full }) {
    if (full) return (
      <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: highlight || 'var(--text-primary)', fontFamily: mono ? 'Menlo, Consolas, monospace' : 'inherit', fontWeight: 600, lineHeight: 1.5 }}>{value}</div>
      </div>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12.5, color: highlight || 'var(--text-primary)', fontFamily: mono ? 'Menlo, Consolas, monospace' : 'inherit', fontWeight: mono ? 700 : 600, wordBreak: 'break-all' }}>{value || '—'}</span>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />

      {/* Drawer panel */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(680px, 96vw)', background: 'var(--surface)', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>

        {/* ── Drawer header ── */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Stock Movement Details</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: m.bg, border: `1px solid ${m.bdr}` }}>
                  <Icon size={12} color={m.clr} strokeWidth={2.5} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.clr }}>{m.label}</span>
                </div>
                {tx.referenceNumber && (
                  <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 13, fontWeight: 800, color: 'var(--brand)', letterSpacing: '0.02em' }}>{tx.referenceNumber}</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: isManual ? '#F0F9FF' : '#F0FDF4', color: isManual ? '#0EA5E9' : '#16A34A', border: `1px solid ${isManual ? '#BAE6FD' : '#BBF7D0'}` }}>
                  {isManual ? 'Manual Entry' : 'Auto-generated'}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatDateTime(tx.createdAt)}</span>
            {' · '} Transaction ID: <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 11 }}>{tx.id}</span>
          </div>
        </div>

        {/* ── Stock movement hero ── */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '14px 22px', background: netSell > 0 ? '#F0FDF4' : netSell < 0 ? '#FEF2F2' : dIn > 0 ? '#FFFBEB' : 'var(--canvas)', display: 'flex', gap: 0 }}>
          {/* Sellable stock */}
          <div style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Sellable Stock</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>Before</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{prevSell}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 2 }}>
                {netSell !== 0 && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: netSell > 0 ? '#16A34A' : '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                    {netSell > 0 ? `+${netSell}` : netSell}
                  </div>
                )}
                <ArrowRight size={16} color="var(--text-disabled)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>After</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: netSell > 0 ? '#16A34A' : netSell < 0 ? '#DC2626' : 'var(--text-primary)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{newSell}</div>
              </div>
            </div>
          </div>

          {/* Damaged stock (if applicable) */}
          {(dIn > 0 || dOut > 0) && (
            <>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 16px', alignSelf: 'stretch' }} />
              <div style={{ flex: 1, paddingLeft: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#D97706', marginBottom: 8 }}>Damaged Stock</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {dIn > 0 && (
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#D97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Damaged In</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>+{dIn}</div>
                    </div>
                  )}
                  {dOut > 0 && (
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: '#F5F3FF', border: '1px solid #DDD6FE', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Damaged Out</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#7C3AED', fontVariantNumeric: 'tabular-nums' }}>−{dOut}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 28px' }}>

          {/* B. Product Information */}
          <SectionHead label="Product Information" />
          <DataRow label="Product Name"     value={tx.productName} />
          <DataRow label="SKU"              value={tx.sku}                 mono />
          {product && <>
            <DataRow label="Category"       value={category?.name}         />
            <DataRow label="Brand"          value={product.brand}          />
            <DataRow label="Unit"           value={product.unit}           />
            <DataRow label="Current Sellable" value={`${product.stock ?? '—'} units`} highlight="#16A34A" />
            <DataRow label="Current Damaged"  value={`${product.damagedQty ?? '—'} units`} highlight={product.damagedQty > 0 ? '#D97706' : undefined} />
            <DataRow label="Total Physical"   value={`${(product.stock || 0) + (product.damagedQty || 0)} units`} />
          </>}

          {/* C. Stock Movement Details */}
          <SectionHead label="Stock Movement Details" />
          <DataRow label="Stock In"          value={qIn  > 0 ? `+${qIn} units`  : '—'} highlight={qIn  > 0 ? '#16A34A' : undefined} />
          <DataRow label="Stock Out"         value={qOut > 0 ? `−${qOut} units` : '—'} highlight={qOut > 0 ? '#DC2626' : undefined} />
          <DataRow label="Damaged In"        value={dIn  > 0 ? `+${dIn} units`  : '—'} highlight={dIn  > 0 ? '#D97706' : undefined} />
          <DataRow label="Damaged Out"       value={dOut > 0 ? `−${dOut} units` : '—'} highlight={dOut > 0 ? '#7C3AED' : undefined} />
          <DataRow label="Previous Sellable" value={`${prevSell} units`} />
          <DataRow label="New Sellable"      value={`${newSell} units`}   highlight={netSell > 0 ? '#16A34A' : netSell < 0 ? '#DC2626' : undefined} />
          <DataRow label="Net Change"        value={netSell > 0 ? `+${netSell}` : netSell < 0 ? `${netSell}` : 'No sellable change'} highlight={netSell > 0 ? '#16A34A' : netSell < 0 ? '#DC2626' : 'var(--text-tertiary)'} />

          {/* D. Source Document */}
          <SectionHead label="Source Document" />
          <DataRow label="Source Type"   value={src.sourceType} />
          <DataRow label="Reference No"  value={src.ref || tx.referenceNumber} mono />
          {src.party && <DataRow label={src.partyLabel} value={src.party} />}
          {src.doc && (
            <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>Document</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {src.doc?.invoiceNumber || src.doc?.returnNumber || src.doc?.poNumber || src.doc?.gpNumber || src.doc?.damageNumber || 'Linked'}
                  </span>
                  {src.nav && (
                    <button
                      onClick={() => { toast.success(`Navigating to ${src.label}`); setTimeout(() => navigate(src.nav), 300); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', border: `1px solid ${src.bdr}`, borderRadius: 6, background: src.bg, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: src.clr, whiteSpace: 'nowrap' }}
                    >
                      View Document <ArrowUpRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {!src.doc && src.nav && (
            <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>Document</span>
                <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>Not linked</span>
              </div>
            </div>
          )}

          {/* E. Business Reason */}
          {tx.note && (
            <>
              <SectionHead label="Reason & Notes" />
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, fontWeight: 500 }}>{tx.note}</div>
              </div>
            </>
          )}

          {/* F. Financial Details */}
          {product && (product.purchasePrice || product.sellingPrice) && (
            <>
              <SectionHead label="Financial Context" />
              <DataRow label="Purchase Price"  value={formatCurrency(product.purchasePrice || 0, sym)} />
              <DataRow label="Selling Price"   value={formatCurrency(product.sellingPrice  || 0, sym)} />
              {(qIn > 0 || qOut > 0) && (
                <DataRow
                  label="Est. Stock Impact"
                  value={formatCurrency(Math.abs(netSell) * (product.purchasePrice || 0), sym)}
                  highlight={netSell > 0 ? '#16A34A' : netSell < 0 ? '#DC2626' : undefined}
                />
              )}
            </>
          )}

          {/* G. Audit Trail */}
          <SectionHead label="Audit Trail" />
          <DataRow label="Transaction ID" value={tx.id}          mono />
          <DataRow label="Created At"     value={formatDateTime(tx.createdAt)} />
          <DataRow label="Created By"     value="System"         />
          <DataRow label="Entry Type"     value={isManual ? 'Manual Entry' : 'System-Generated'} highlight={isManual ? '#0EA5E9' : '#16A34A'} />
          <DataRow label="Transaction Type" value={tx.transactionType} mono />
          {tx.referenceType && <DataRow label="Reference Type"  value={tx.referenceType} />}

          {/* H. Mini timeline */}
          <SectionHead label="Event Timeline" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Source Created', desc: src.ref ? `${src.sourceType}: ${src.ref}` : 'Source document', done: true, clr: '#16A34A' },
              { label: 'Stock Movement Recorded', desc: `${m.label} — ${formatDateTime(tx.createdAt)}`, done: true, clr: m.clr },
              ...(dIn > 0 || dOut > 0 ? [{ label: 'Damaged Stock Updated', desc: `${dIn > 0 ? `+${dIn} damaged in` : ''}${dOut > 0 ? ` −${dOut} damaged out` : ''}`, done: true, clr: '#D97706' }] : []),
            ].map((ev, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < arr.length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.done ? ev.clr : 'var(--border)', marginTop: 3, border: `2px solid ${ev.done ? ev.clr : 'var(--border)'}` }} />
                  {i < arr.length - 1 && <div style={{ width: 1.5, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: ev.done ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{ev.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Adjustment Modal ─────────────────────────────────────────────────────────

const ADJ_TYPES = [
  { id: 'increase_sellable',   label: 'Increase Sellable Stock',   desc: 'Add units to sellable inventory'          },
  { id: 'decrease_sellable',   label: 'Decrease Sellable Stock',   desc: 'Remove units from sellable inventory'      },
  { id: 'sellable_to_damaged', label: 'Move Sellable → Damaged',   desc: 'Transfer good stock to damaged inventory'  },
  { id: 'damaged_to_sellable', label: 'Move Damaged → Sellable',   desc: 'Restore repaired stock to sellable'        },
  { id: 'writeoff_damaged',    label: 'Write Off Damaged Stock',   desc: 'Permanently remove from damaged inventory' },
];
const ADJ_REASONS = [
  { id: 'cycle_count',     label: 'Cycle Count / Stocktake'  },
  { id: 'physical_audit',  label: 'Physical Audit'            },
  { id: 'system_error',    label: 'System Error Correction'   },
  { id: 'theft_loss',      label: 'Theft / Loss'              },
  { id: 'expiry',          label: 'Expiry / Obsolescence'     },
  { id: 'quality_failure', label: 'Quality Check Failure'     },
  { id: 'supplier_credit', label: 'Supplier Credit Return'    },
  { id: 'other',           label: 'Other'                     },
];

function AdjustmentModal({ products, adjustStock, adjustDamagedStock, onClose }) {
  const [form, setForm] = useState({ productId: '', adjType: 'increase_sellable', qty: '', reason: 'cycle_count', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const prod    = products.find(p => p.id === form.productId) || null;
  const sellable = prod?.stock ?? 0;
  const damaged  = prod?.damagedQty ?? 0;
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErr(''); }

  const iSel = { height: 36, padding: '0 26px 0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: `var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717A' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center / 14px 14px`, color: 'var(--text-primary)', width: '100%', WebkitAppearance: 'none', appearance: 'none', outline: 'none', boxSizing: 'border-box' };

  async function submit() {
    if (!prod) return setErr('Select a product');
    const qty = parseInt(form.qty, 10);
    if (!qty || qty <= 0) return setErr('Enter a valid quantity');
    const note = ADJ_REASONS.find(r => r.id === form.reason)?.label + (form.notes ? ` — ${form.notes}` : '');
    if (form.adjType === 'decrease_sellable'  && qty > sellable) return setErr(`Only ${sellable} sellable units available`);
    if (form.adjType === 'sellable_to_damaged' && qty > sellable) return setErr(`Only ${sellable} sellable units available`);
    if (form.adjType === 'damaged_to_sellable' && qty > damaged)  return setErr(`Only ${damaged} damaged units available`);
    if (form.adjType === 'writeoff_damaged'    && qty > damaged)  return setErr(`Only ${damaged} damaged units available`);
    setBusy(true);
    try {
      switch (form.adjType) {
        case 'increase_sellable':   await adjustStock(prod.id, qty,  note, 'adjustment', '', ''); break;
        case 'decrease_sellable':   await adjustStock(prod.id, -qty, note, 'adjustment', '', ''); break;
        case 'sellable_to_damaged':
          await adjustStock(prod.id, -qty, note + ' (moved to damaged)', 'adjustment', '', '');
          adjustDamagedStock(prod.id, qty, note + ' (moved from sellable)', 'DAMAGED_STOCK');
          break;
        case 'damaged_to_sellable':
          await adjustStock(prod.id, qty, note + ' (restored from damaged)', 'adjustment', '', '');
          adjustDamagedStock(prod.id, -qty, note + ' (restored to sellable)', 'DAMAGED_REPAIRED');
          break;
        case 'writeoff_damaged':
          adjustDamagedStock(prod.id, -qty, note, 'DAMAGED_WRITEOFF');
          toast.success('Damaged stock written off');
          break;
      }
      onClose();
    } catch { setErr('Adjustment failed'); setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}><SlidersHorizontal size={15} color="var(--brand)" /> Stock Adjustment</div>
          <button onClick={onClose} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}><X size={13} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Product *</div>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} style={iSel}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          {prod && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ l:'Sellable', v: sellable, clr:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0' }, { l:'Damaged', v: damaged, clr:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A' }].map(({ l, v, clr, bg, bdr }) => (
                <div key={l} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, background: bg, border: `1px solid ${bdr}` }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: clr, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: clr, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Adjustment Type *</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ADJ_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => set('adjType', t.id)}
                  style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', borderRadius: 7, border: `1px solid ${form.adjType === t.id ? 'var(--brand)' : 'var(--border)'}`, background: form.adjType === t.id ? 'var(--brand-faint)' : 'var(--canvas)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: form.adjType === t.id ? 'var(--brand)' : 'var(--text-primary)' }}>{t.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Quantity *</div>
              <input type="number" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} placeholder="0" style={{ ...iSel, background: 'var(--canvas)', paddingRight: 10 }} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Reason *</div>
              <select value={form.reason} onChange={e => set('reason', e.target.value)} style={iSel}>
                {ADJ_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Notes</div>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional details…" rows={2} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', outline: 'none', minHeight: 52 }} />
          </div>
          {err && <div style={{ padding: '8px 12px', borderRadius: 7, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 8, background: busy ? 'var(--text-disabled)' : 'var(--brand)', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} /> {busy ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const INIT_FILTERS = { dateFrom: '', dateTo: '', productId: '', sku: '', txType: '', cat: '', sourceType: '', refNo: '', damagedOnly: false };

export default function StockTransactions() {
  const navigate = useNavigate();
  const { state, adjustStock, adjustDamagedStock } = useApp();
  const { stockTransactions = [], products = [], settings, productSupplierPrices = [] } = state;
  const sym = settings?.currencySymbol || '₹';

  const [search,      setSearch]      = useState('');
  const [filters,     setFilters]     = useState(INIT_FILTERS);
  const [filterOpen,  setFilterOpen]  = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [adjOpen,     setAdjOpen]     = useState(false);
  const [page,        setPage]        = useState(1);

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(1); }
  function resetFilters()  { setFilters(INIT_FILTERS); setSearch(''); setPage(1); }
  const hasFilter = search || Object.values(filters).some(v => v !== '' && v !== false);

  // Sorted + filtered list
  const sorted = useMemo(() => [...stockTransactions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [stockTransactions]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (filters.dateFrom || filters.dateTo) list = filterByDateRange(list, filters.dateFrom, filters.dateTo, 'createdAt');
    if (filters.productId) list = list.filter(t => t.productId === filters.productId);
    if (filters.sku)       list = list.filter(t => (t.sku || '').toLowerCase().includes(filters.sku.toLowerCase()));
    if (filters.txType)    list = list.filter(t => t.transactionType === filters.txType);
    if (filters.cat)       list = list.filter(t => getMeta(t.transactionType).cat === filters.cat);
    if (filters.sourceType) list = list.filter(t => (t.referenceType || '').toLowerCase().includes(filters.sourceType));
    if (filters.refNo)     list = list.filter(t => (t.referenceNumber || '').toLowerCase().includes(filters.refNo.toLowerCase()));
    if (filters.damagedOnly) list = list.filter(t => (t.nonSellableQuantityIn || 0) > 0 || (t.nonSellableQuantityOut || 0) > 0);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.productName || '').toLowerCase().includes(q) ||
        (t.sku || '').toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [sorted, filters, search]);

  // KPI stats (from ALL transactions, not filtered)
  const kpi = useMemo(() => {
    const all = stockTransactions;
    return {
      count:    all.length,
      totalIn:  all.reduce((s, t) => s + Number(t.quantityIn  || 0), 0),
      totalOut: all.reduce((s, t) => s + Number(t.quantityOut || 0), 0),
      dmgIn:    all.reduce((s, t) => s + Number(t.nonSellableQuantityIn  || 0), 0),
      dmgOut:   all.reduce((s, t) => s + Number(t.nonSellableQuantityOut || 0), 0),
      adj:      all.filter(t => getMeta(t.transactionType).cat === 'adj').length,
      lastDate: all[0]?.createdAt || null,
    };
  }, [stockTransactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const filteredProduct = products.find(p => p.id === filters.productId) || null;

  // Table column definitions
  const COLS = [
    { key: '#',          label: '#',             w: 44,   align: 'center' },
    { key: 'date',       label: 'Date',          w: 96,   align: 'left'   },
    { key: 'product',    label: 'Product',       w: 'auto', align: 'left' },
    { key: 'type',       label: 'Transaction',   w: 148,  align: 'left'   },
    { key: 'source',     label: 'Source',        w: 110,  align: 'left'   },
    { key: 'ref',        label: 'Reference',     w: 124,  align: 'left'   },
    { key: 'qin',        label: 'Stock In',      w: 80,   align: 'right'  },
    { key: 'qout',       label: 'Stock Out',     w: 80,   align: 'right'  },
    { key: 'din',        label: 'Dmg In',        w: 74,   align: 'right'  },
    { key: 'dout',       label: 'Dmg Out',       w: 74,   align: 'right'  },
    { key: 'prev',       label: 'Prev Stock',    w: 86,   align: 'right'  },
    { key: 'new',        label: 'New Stock',     w: 86,   align: 'right'  },
    { key: 'by',         label: 'Created By',    w: 90,   align: 'left'   },
    { key: 'status',     label: 'Status',        w: 80,   align: 'center' },
  ];

  const iSearch = { height: 34, paddingLeft: 30, paddingRight: 8, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', width: 220, outline: 'none' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Page Header ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '13px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={19} color="var(--brand)" /> Stock Ledger & Movement Audit
            </h1>
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.5 }}>
              Track every stock change, source document, stock balance, and damaged/non-sellable movement.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <button onClick={() => exportCSV(filtered, state)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={() => setAdjOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', background: 'var(--brand)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#fff' }}>
              <Plus size={13} strokeWidth={2.5} /> Stock Adjustment
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <StatStrip kpi={kpi} />

      {/* ── Filter Bar ── */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search product, SKU, reference…" style={iSearch} />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFilterOpen(f => !f)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 13px', border: `1px solid ${filterOpen || hasFilter ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: filterOpen || hasFilter ? 'var(--brand-faint)' : 'var(--surface)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: filterOpen || hasFilter ? 'var(--brand)' : 'var(--text-secondary)' }}
        >
          <Filter size={12} /> Filters {hasFilter ? '·' : ''} {filterOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Quick direction filter */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', flexShrink: 0 }}>
          {[
            { v: '',        l: 'All'      },
            { v: 'in',      l: '↑ In'     },
            { v: 'out',     l: '↓ Out'    },
            { v: 'dmg-in',  l: '⚠ Dmg'   },
            { v: 'adj',     l: '≈ Adj'    },
          ].map(({ v, l }, i) => (
            <button key={v} onClick={() => { setFilter('cat', v); }}
              style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: 34, border: 'none', borderRight: i < 4 ? '1px solid var(--border)' : 'none', background: filters.cat === v ? 'var(--brand-faint)' : 'transparent', color: filters.cat === v ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11.5, fontWeight: filters.cat === v ? 700 : 500, whiteSpace: 'nowrap' }}>
              {l}
            </button>
          ))}
        </div>

        {hasFilter && (
          <button onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', border: '1px solid #FECACA', borderRadius: 7, background: '#FEF2F2', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#DC2626', flexShrink: 0 }}>
            <X size={10} /> Clear all
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{filtered.length.toLocaleString()}</strong> records{hasFilter ? ' (filtered)' : ''}
        </div>
      </div>

      {/* ── Advanced Filter Panel (collapsible) ── */}
      {filterOpen && (
        <FilterPanel filters={filters} setFilter={setFilter} products={products} onReset={resetFilters} sym={sym} />
      )}

      {/* ── Product Summary Panel ── */}
      {filteredProduct && (
        <ProductPanel product={filteredProduct} txList={sorted} pspList={productSupplierPrices} sym={sym} />
      )}

      {/* ── Ledger Table ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, textAlign: 'center', padding: 24 }}>
              <GitCompareArrows size={36} strokeWidth={1} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {hasFilter ? 'No matching stock movements' : 'No stock movements recorded yet'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 320 }}>
                {hasFilter ? 'Try adjusting your filters or clearing the search.' : 'Stock movements appear here as inventory changes.'}
              </div>
              {hasFilter && (
                <button onClick={resetFilters} style={{ height: 32, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1380, width: 'max(100%, 1380px)' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--canvas)' }}>
                  {COLS.map(col => (
                    <th key={col.key} style={{ padding: '9px 11px', textAlign: col.align, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', width: col.w }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((tx, idx) => {
                  const m        = getMeta(tx.transactionType);
                  const stripeClr = CAT_STRIPE[m.cat] || '#6B7280';
                  const src      = resolveSource(tx, state);
                  const isActive = selected?.id === tx.id;
                  const qIn      = Number(tx.quantityIn  || 0);
                  const qOut     = Number(tx.quantityOut || 0);
                  const dIn      = Number(tx.nonSellableQuantityIn  || 0);
                  const dOut     = Number(tx.nonSellableQuantityOut || 0);
                  const isManual = MANUAL_TYPES.has(tx.transactionType);
                  const rowN     = (page - 1) * PAGE_SIZE + idx + 1;
                  const evenBg   = idx % 2 === 0 ? 'var(--surface)' : 'transparent';
                  const rowBg    = isActive ? m.bg : evenBg;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelected(prev => prev?.id === tx.id ? null : tx)}
                      style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.08s' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--brand-faint)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = rowBg; }}
                    >
                      {/* # */}
                      <td style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `3px solid ${stripeClr}` }}>
                        <span style={{ fontSize: 10.5, color: 'var(--text-disabled)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{rowN}</span>
                      </td>
                      {/* Date */}
                      <td style={{ padding: '8px 11px', whiteSpace: 'nowrap' }}>
                        {(() => { const { date, time } = formatDateTimeSplit(tx.createdAt); return (<><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{date}</div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{time}</div></>); })()}
                      </td>
                      {/* Product */}
                      <td style={{ padding: '8px 11px', minWidth: 160, maxWidth: 220 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.productName}</div>
                        {tx.sku && <div style={{ fontSize: 10.5, fontFamily: 'Menlo, Consolas, monospace', color: 'var(--text-tertiary)', marginTop: 1 }}>{tx.sku}</div>}
                      </td>
                      {/* Type */}
                      <td style={{ padding: '8px 11px' }}><TypeBadge type={tx.transactionType} /></td>
                      {/* Source */}
                      <td style={{ padding: '8px 11px' }}><SourceBadge src={src} /></td>
                      {/* Reference */}
                      <td style={{ padding: '8px 11px' }}>
                        {tx.referenceNumber
                          ? <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.02em' }}>{tx.referenceNumber}</span>
                          : <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>—</span>}
                      </td>
                      {/* Stock In */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {qIn > 0
                          ? <span style={{ fontSize: 13.5, fontWeight: 800, color: '#16A34A' }}>+{qIn}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      {/* Stock Out */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {qOut > 0
                          ? <span style={{ fontSize: 13.5, fontWeight: 800, color: '#DC2626' }}>−{qOut}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      {/* Damaged In */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {dIn > 0
                          ? <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706', background: '#FFFBEB', padding: '1px 5px', borderRadius: 4, border: '1px solid #FDE68A' }}>+{dIn}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      {/* Damaged Out */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {dOut > 0
                          ? <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '1px 5px', borderRadius: 4, border: '1px solid #DDD6FE' }}>−{dOut}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>}
                      </td>
                      {/* Previous Stock */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>{tx.previousStock ?? '—'}</span>
                      </td>
                      {/* New Stock */}
                      <td style={{ padding: '8px 11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>{tx.newStock ?? '—'}</span>
                      </td>
                      {/* Created By */}
                      <td style={{ padding: '8px 11px' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>System</span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '8px 11px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: isManual ? '#F0F9FF' : '#F0FDF4', color: isManual ? '#0EA5E9' : '#16A34A', border: `1px solid ${isManual ? '#BAE6FD' : '#BBF7D0'}`, whiteSpace: 'nowrap' }}>
                          {isManual ? 'Manual' : 'Auto'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()} records
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)', gap: 4, fontSize: 12.5 }}>
                <ChevronLeft size={12} /> Prev
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600, padding: '0 8px' }}>
                Page {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)', gap: 4, fontSize: 12.5 }}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selected && <DetailDrawer tx={selected} state={state} onClose={() => setSelected(null)} />}

      {/* ── Adjustment Modal ── */}
      {adjOpen && (
        <AdjustmentModal products={products} adjustStock={adjustStock} adjustDamagedStock={adjustDamagedStock} onClose={() => setAdjOpen(false)} />
      )}
    </div>
  );
}
