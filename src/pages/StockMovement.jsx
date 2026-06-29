import React, { useState, useMemo } from 'react';
import {
  Package, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Search, Activity, GitCompareArrows, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime, formatCurrency, searchFilter, filterByDateRange } from '../utils/helpers';

const TYPE_META = {
  SALE:              { label: 'Sale',            color: 'var(--error)',   faint: 'var(--error-bg)',    Icon: ArrowDownCircle },
  PURCHASE:          { label: 'Purchase',        color: 'var(--success)', faint: 'var(--success-bg)',  Icon: ArrowUpCircle },
  SALE_RETURN:       { label: 'Sale Return',     color: 'var(--success)', faint: 'var(--success-bg)',  Icon: ArrowUpCircle },
  PURCHASE_RETURN:   { label: 'Purch. Return',   color: 'var(--warning)', faint: 'var(--warning-bg)',  Icon: ArrowDownCircle },
  MANUAL_ADJUSTMENT: { label: 'Adjustment',      color: 'var(--brand)',   faint: 'var(--brand-faint)', Icon: RefreshCw },
  DAMAGED:           { label: 'Damaged',         color: 'var(--error)',   faint: 'var(--error-bg)',    Icon: ArrowDownCircle },
  EXPIRED:           { label: 'Expired',         color: '#9333EA',        faint: '#FAF5FF',             Icon: ArrowDownCircle },
  OPENING_STOCK:     { label: 'Opening Stock',   color: 'var(--brand)',   faint: 'var(--brand-faint)', Icon: GitCompareArrows },
};

function barColor(stock, min) {
  if (stock === 0) return '#DC2626';
  if (min > 0 && stock <= min) return '#CA8A04';
  return '#16A34A';
}

export default function StockMovement() {
  const { state } = useApp();
  const { stockTransactions, products, categories, settings } = state;
  const sym = settings?.currencySymbol || '₹';

  const [selectedId, setSelectedId]   = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredProducts = useMemo(
    () => searchFilter(products, searchQuery, ['name', 'sku']),
    [products, searchQuery],
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId],
  );

  const productTxns = useMemo(() => {
    if (!selectedId) return [];
    let list = stockTransactions.filter((t) => t.productId === selectedId);
    if (dateFrom || dateTo) list = filterByDateRange(list, dateFrom, dateTo, 'createdAt');
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [stockTransactions, selectedId, dateFrom, dateTo]);

  const stats = useMemo(() => {
    if (!selectedProduct) return { totalIn: 0, totalOut: 0, txnCount: 0 };
    return {
      totalIn:   productTxns.reduce((s, t) => s + Number(t.quantityIn  || 0), 0),
      totalOut:  productTxns.reduce((s, t) => s + Number(t.quantityOut || 0), 0),
      txnCount:  productTxns.length,
    };
  }, [productTxns, selectedProduct]);

  const chartData = useMemo(() => {
    const slice = [...productTxns].reverse().slice(-12);
    const max = slice.reduce((m, t) => Math.max(m, Number(t.newStock || 0)), 1);
    return slice.map((t, i) => ({
      val:    Number(t.newStock || 0),
      pct:    (Number(t.newStock || 0) / max) * 100,
      color:  barColor(Number(t.newStock || 0), selectedProduct?.minStock ?? 0),
      opacity: 0.4 + (i / Math.max(slice.length - 1, 1)) * 0.6,
      label:  formatDateTime(t.createdAt),
    }));
  }, [productTxns, selectedProduct]);

  const isOut     = selectedProduct?.stock === 0;
  const isLow     = selectedProduct && !isOut && selectedProduct.stock <= (selectedProduct.minStock ?? 0) && (selectedProduct.minStock ?? 0) > 0;
  const sColor    = isOut ? 'var(--error)' : isLow ? 'var(--warning)' : 'var(--success)';
  const sFaint    = isOut ? 'var(--error-bg)' : isLow ? 'var(--warning-bg)' : 'var(--success-bg)';
  const sLabel    = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock';
  const StatusIcon = isOut || isLow ? AlertTriangle : CheckCircle;
  const category  = selectedProduct ? categories.find((c) => c.id === selectedProduct.categoryId) : null;

  const handleSelect = (id) => {
    setSelectedId(id);
    setSearchQuery('');
    setShowDropdown(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Top: product search bar ──────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 640 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 38, fontSize: 14, height: 42 }}
              placeholder="Search products by name or SKU…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
            />
            {/* Dropdown */}
            {showDropdown && searchQuery && filteredProducts.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
              }}>
                {filteredProducts.slice(0, 8).map((p) => {
                  const pColor = p.stock === 0 ? 'var(--error)' : (p.stock <= (p.minStock ?? 0) && (p.minStock ?? 0) > 0) ? 'var(--warning)' : 'var(--success)';
                  return (
                    <button
                      key={p.id}
                      onMouseDown={() => handleSelect(p.id)}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--canvas)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{p.name}</p>
                        <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{p.sku}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: pColor }}>{p.stock}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.unit}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedProduct && (
            <button
              onClick={() => setSelectedId('')}
              style={{ height: 42, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {!selectedProduct ? (
        /* Landing: product browse grid */
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
          <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 6 }}>
            Stock Movement
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
            Search or select a product above to view its complete movement history
          </p>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            All Products ({products.length})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {products.map((p) => {
              const pIsOut = p.stock === 0;
              const pIsLow = !pIsOut && p.stock <= (p.minStock ?? 0) && (p.minStock ?? 0) > 0;
              const pColor = pIsOut ? 'var(--error)' : pIsLow ? 'var(--warning)' : 'var(--success)';
              const pFaint = pIsOut ? 'var(--error-bg)' : pIsLow ? 'var(--warning-bg)' : 'var(--success-bg)';
              const pTxns = stockTransactions.filter((t) => t.productId === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = pColor; e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.08)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: pFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={14} style={{ color: pColor }} />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: pColor }}>{p.stock}</span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.unit} · {pTxns} movements</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      ) : (
        /* Product detail: left info panel + right timeline */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: product info panel */}
          <div style={{
            width: 300, flexShrink: 0,
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Product header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: sFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Package size={22} style={{ color: sColor }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {selectedProduct.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--canvas)', padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)' }}>
                  {selectedProduct.sku}
                </span>
                {category && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{category.name}</span>}
              </div>
            </div>

            {/* Current stock */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Current Stock</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: sFaint, color: sColor }}>
                  <StatusIcon size={11} /> {sLabel}
                </span>
              </div>
              <p style={{ fontSize: 32, fontWeight: 900, color: sColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {selectedProduct.stock}
                <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>{selectedProduct.unit}</span>
              </p>
              <div style={{ marginTop: 10, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, background: sColor,
                  width: `${Math.min(100, (selectedProduct.stock / Math.max(selectedProduct.minStock * 3, selectedProduct.stock, 1)) * 100)}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Min: {selectedProduct.minStock ?? 0} {selectedProduct.unit}
              </p>
            </div>

            {/* Pricing */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Purchase Price', val: formatCurrency(selectedProduct.purchasePrice, sym) },
                  { label: 'Selling Price',  val: formatCurrency(selectedProduct.sellingPrice, sym) },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement stats */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { label: 'Total Received', val: `+${stats.totalIn}`,  color: 'var(--success)', Icon: TrendingUp },
                { label: 'Total Dispatched', val: `${stats.totalOut}`, color: 'var(--error)',   Icon: TrendingDown },
                { label: 'Movements',      val: stats.txnCount,        color: 'var(--brand)',   Icon: Activity },
              ].map(({ label, val, color, Icon: I }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <I size={13} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div style={{ padding: '14px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Stock History</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      title={`${bar.label}: ${bar.val}`}
                      style={{ flex: 1, height: `${Math.max(bar.pct, 4)}%`, borderRadius: '3px 3px 0 0', background: bar.color, opacity: bar.opacity, minHeight: 3 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Date filter */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Filter Timeline</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input type="date" className="input" style={{ fontSize: 12, height: 32 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input type="date" className="input" style={{ fontSize: 12, height: 32 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                {(dateFrom || dateTo) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ fontSize: 11, height: 28 }}>
                    <X size={11} /> Clear dates
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: movement timeline */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {productTxns.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 10 }}>
                <Activity size={28} style={{ color: 'var(--border)' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No movements{(dateFrom || dateTo) ? ' in this period' : ' yet'}</p>
              </div>
            ) : (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                  {/* Vertical timeline line */}
                  <div style={{ position: 'absolute', left: 14, top: 8, bottom: 8, width: 2, background: 'var(--border)', borderRadius: 2 }} />

                  {productTxns.map((t, i) => {
                    const meta = TYPE_META[t.transactionType] || TYPE_META.MANUAL_ADJUSTMENT;
                    const { Icon } = meta;
                    const changePositive = Number(t.quantityIn || 0) > 0;
                    const changeVal = changePositive ? Number(t.quantityIn || 0) : Number(t.quantityOut || 0);
                    const balColor = t.newStock === 0 ? 'var(--error)' : (t.newStock <= (selectedProduct.minStock ?? 0) && (selectedProduct.minStock ?? 0) > 0) ? 'var(--warning)' : 'var(--text-primary)';

                    return (
                      <div key={t.id} style={{ position: 'relative', marginBottom: i < productTxns.length - 1 ? 16 : 0 }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute', left: -26, top: 12,
                          width: 20, height: 20, borderRadius: '50%',
                          background: meta.faint, border: `2px solid ${meta.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                        }}>
                          <Icon size={10} style={{ color: meta.color }} />
                        </div>

                        {/* Event card */}
                        <div style={{
                          background: 'var(--surface)', borderRadius: 10,
                          border: '1px solid var(--border)',
                          padding: '12px 14px',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.06)`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: meta.faint, color: meta.color }}>
                                  <Icon size={10} /> {meta.label}
                                </span>
                                {t.referenceNumber && (
                                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--brand)', fontWeight: 600 }}>{t.referenceNumber}</span>
                                )}
                              </div>
                              <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{formatDateTime(t.createdAt)}</p>
                              {t.note && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t.note}</p>}
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {changeVal > 0 && (
                                <p style={{ fontSize: 16, fontWeight: 800, color: changePositive ? 'var(--success)' : 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>
                                  {changePositive ? '+' : '−'}{changeVal}
                                </p>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                                <span style={{ fontSize: 15, fontWeight: 700, color: balColor, fontVariantNumeric: 'tabular-nums' }}>
                                  {t.newStock} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{selectedProduct.unit}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
