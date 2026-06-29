import React, { useState, useMemo } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, RefreshCw, GitCompareArrows,
  TrendingUp, TrendingDown, Activity, X, Package, SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, searchFilter, filterByDateRange } from '../utils/helpers';

const TYPE_META = {
  SALE:              { label: 'Sale',            color: 'var(--error)',   faint: 'var(--error-bg)',    dir: 'out', Icon: ArrowDownCircle },
  PURCHASE:          { label: 'Purchase',        color: 'var(--success)', faint: 'var(--success-bg)',  dir: 'in',  Icon: ArrowUpCircle },
  SALE_RETURN:       { label: 'Sale Return',     color: 'var(--success)', faint: 'var(--success-bg)',  dir: 'in',  Icon: ArrowUpCircle },
  PURCHASE_RETURN:   { label: 'Purch. Return',   color: 'var(--warning)', faint: 'var(--warning-bg)',  dir: 'out', Icon: ArrowDownCircle },
  MANUAL_ADJUSTMENT: { label: 'Adjustment',      color: 'var(--brand)',   faint: 'var(--brand-faint)', dir: 'both', Icon: RefreshCw },
  DAMAGED:           { label: 'Damaged',         color: 'var(--error)',   faint: 'var(--error-bg)',    dir: 'out', Icon: ArrowDownCircle },
  EXPIRED:           { label: 'Expired',         color: '#9333EA',        faint: '#FAF5FF',             dir: 'out', Icon: ArrowDownCircle },
  OPENING_STOCK:     { label: 'Opening Stock',   color: 'var(--brand)',   faint: 'var(--brand-faint)', dir: 'in',  Icon: GitCompareArrows },
  SALES_RETURN_DAMAGED:         { label: 'Return (Damaged)',       color: '#DC2626', faint: '#FEF2F2', dir: 'damaged', Icon: ArrowDownCircle },
  DAMAGED_STOCK:                { label: 'Damaged (Internal)',     color: '#D97706', faint: '#FFFBEB', dir: 'damaged', Icon: ArrowDownCircle },
  DAMAGED_REPAIRED:             { label: 'Repaired',              color: '#16A34A', faint: '#F0FDF4', dir: 'in',      Icon: ArrowUpCircle },
  DAMAGED_WRITEOFF:             { label: 'Written Off',           color: '#7C3AED', faint: '#F5F3FF', dir: 'damaged', Icon: ArrowDownCircle },
  DAMAGED_DISPOSED:             { label: 'Disposed',              color: '#6B7280', faint: '#F3F4F6', dir: 'damaged', Icon: ArrowDownCircle },
  DAMAGED_RETURN_TO_SUPPLIER:   { label: 'Returned to Supplier',  color: '#1D4ED8', faint: '#EFF6FF', dir: 'damaged', Icon: ArrowDownCircle },
  PURCHASE_RECEIVE:             { label: 'PO Received',              color: '#16A34A', faint: '#F0FDF4', dir: 'in',      Icon: ArrowUpCircle },
  PURCHASE_REPLACEMENT_RECEIVE: { label: 'Replacement Received',     color: '#059669', faint: '#ECFDF5', dir: 'in',      Icon: ArrowUpCircle },
  GENERAL_PURCHASE_RECEIVE:     { label: 'GP Received',              color: '#16A34A', faint: '#F0FDF4', dir: 'in',      Icon: ArrowUpCircle },
  PURCHASE_RETURN_REJECTED:     { label: 'Return Rejected (Damaged)', color: '#DC2626', faint: '#FEF2F2', dir: 'damaged', Icon: ArrowDownCircle },
};
const TYPES = Object.keys(TYPE_META);

export default function StockTransactions() {
  const { state } = useApp();
  const { stockTransactions, products } = state;

  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [filterOpen, setFilterOpen]       = useState(false);

  const stats = useMemo(() => {
    const totalIn  = stockTransactions.reduce((s, t) => s + Number(t.quantityIn  || 0), 0);
    const totalOut = stockTransactions.reduce((s, t) => s + Number(t.quantityOut || 0), 0);
    return { count: stockTransactions.length, totalIn, totalOut, net: totalIn - totalOut };
  }, [stockTransactions]);

  const filtered = useMemo(() => {
    let list = stockTransactions;
    if (typeFilter)    list = list.filter((t) => t.transactionType === typeFilter);
    if (productFilter) list = list.filter((t) => t.productId === productFilter);
    if (dateFrom || dateTo) list = filterByDateRange(list, dateFrom, dateTo, 'createdAt');
    list = searchFilter(list, search, ['productName', 'sku', 'referenceNumber', 'note']);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [stockTransactions, search, typeFilter, productFilter, dateFrom, dateTo]);

  const hasFilter = typeFilter || productFilter || dateFrom || dateTo || search;
  const clearAll = () => { setTypeFilter(''); setProductFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Left filter sidebar ──────────────────────────────────────────────── */}
      <div className={`stock-filter-sidebar${filterOpen ? ' filter-open' : ''}`} style={{
        width: 232, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--brand)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Filters
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasFilter && (
                <button
                  onClick={clearAll}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear all
                </button>
              )}
              <button
                className="stock-filter-close-btn"
                onClick={() => setFilterOpen(false)}
                style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--canvas)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: 0, flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Search */}
          <input
            className="input"
            style={{ fontSize: 12.5, height: 34 }}
            placeholder="Product, SKU, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Scrollable filter body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Type filter */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Transaction Type
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TYPES.map((t) => {
                const m = TYPE_META[t];
                const active = typeFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(active ? '' : t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                      borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: 500,
                      background: active ? `${m.color}14` : 'transparent',
                      color: active ? m.color : 'var(--text-secondary)',
                      transition: 'background 0.12s, color 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--canvas)'; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; } }}
                  >
                    <m.Icon size={12} style={{ flexShrink: 0 }} />
                    {m.label}
                    {active && <X size={11} style={{ marginLeft: 'auto' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product filter */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Product
            </p>
            <select
              className="select"
              style={{ fontSize: 12.5, height: 34 }}
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Date Range
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>From</p>
                <input type="date" className="input" style={{ fontSize: 12, height: 34 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>To</p>
                <input type="date" className="input" style={{ fontSize: 12, height: 34 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar footer: summary stats */}
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { label: 'Stock IN',  value: `+${stats.totalIn}`, color: 'var(--success)' },
            { label: 'Stock OUT', value: `−${stats.totalOut}`, color: 'var(--error)' },
            { label: 'Net',       value: stats.net >= 0 ? `+${stats.net}` : `${stats.net}`, color: stats.net >= 0 ? 'var(--success)' : 'var(--error)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
              <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile backdrop */}
      {filterOpen && (
        <div
          onClick={() => setFilterOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 299 }}
        />
      )}

      {/* ── Right ledger area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Ledger header bar */}
        <div style={{
          flexShrink: 0, height: 48,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Activity size={15} style={{ color: 'var(--brand)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Stock Ledger
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: 'var(--brand-faint)', color: 'var(--brand)',
          }}>
            {filtered.length} entries{hasFilter ? ' (filtered)' : ''}
          </span>
          <button
            className="stock-filter-mobile-btn"
            onClick={() => setFilterOpen(true)}
            style={{ alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 7, border: `1px solid ${hasFilter ? 'var(--brand)' : 'var(--border)'}`, background: hasFilter ? 'var(--brand-faint)' : 'var(--canvas)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: hasFilter ? 'var(--brand)' : 'var(--text-secondary)', flexShrink: 0 }}
          >
            <SlidersHorizontal size={12} />
            Filters{hasFilter ? ' •' : ''}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {stats.count} total transactions
          </span>
        </div>

        {/* Full-height ledger table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 10 }}>
              <GitCompareArrows size={32} style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {hasFilter ? 'No matching transactions' : 'No transactions yet'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                {hasFilter ? 'Try adjusting your filters' : 'Transactions appear as stock moves in and out'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 780 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--canvas)', borderBottom: '2px solid var(--border)' }}>
                  {['Date', 'Product', 'Type', 'Change', 'Before → After', 'Reference', 'Note'].map((h) => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = TYPE_META[t.transactionType] || TYPE_META.MANUAL_ADJUSTMENT;
                  const { Icon } = meta;
                  const changePositive = Number(t.quantityIn || 0) > 0;
                  const changeVal = changePositive ? Number(t.quantityIn || 0) : Number(t.quantityOut || 0);
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-faint)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'transparent'; }}
                    >
                      {/* Date */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {formatDate(t.createdAt)}
                      </td>

                      {/* Product */}
                      <td style={{ padding: '10px 14px', minWidth: 160 }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{t.productName}</p>
                        <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.sku}</p>
                      </td>

                      {/* Type badge */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                          background: meta.faint, color: meta.color,
                        }}>
                          <Icon size={11} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Change quantity */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {changeVal > 0 ? (
                          <span style={{ fontSize: 14, fontWeight: 700, color: changePositive ? 'var(--success)' : 'var(--error)' }}>
                            {changePositive ? '+' : '−'}{changeVal}
                          </span>
                        ) : <span style={{ color: 'var(--border)' }}>—</span>}
                        {(t.nonSellableQuantityIn > 0 || t.nonSellableQuantityOut > 0) && (
                          <div style={{ fontSize: 10, color: '#D97706', fontWeight: 600, marginTop: 2 }}>
                            {t.nonSellableQuantityIn > 0 && `+${t.nonSellableQuantityIn} damaged`}
                            {t.nonSellableQuantityOut > 0 && `-${t.nonSellableQuantityOut} damaged`}
                          </div>
                        )}
                      </td>

                      {/* Before → After */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.previousStock}</span>
                        <span style={{ margin: '0 6px', color: 'var(--border)' }}>→</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{t.newStock}</span>
                      </td>

                      {/* Reference */}
                      <td style={{ padding: '10px 14px' }}>
                        {t.referenceNumber
                          ? <span style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 600, color: 'var(--brand)' }}>{t.referenceNumber}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>
                        }
                      </td>

                      {/* Note */}
                      <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                        {t.note
                          ? <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.note}>{t.note}</span>
                          : <span style={{ color: 'var(--border)' }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
