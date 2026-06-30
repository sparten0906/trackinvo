import React, { useState, useMemo } from 'react';
import {
  TrendingUp, ShoppingCart, RotateCcw, PackageX, Package,
  GitCompareArrows, AlertTriangle, Users, Truck, BarChart3,
  Receipt, CreditCard, Download, Printer, Calendar,
  Activity, Wallet, Layers, ChevronRight, ChevronLeft, ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, filterByDateRange, isLowStock, sumField } from '../utils/helpers';
import {
  exportSales, exportPurchases, exportProfit, exportTax, exportPayments,
  exportSalesReturns, exportPurchaseReturns, exportStock, exportStockMovements,
  exportLowStock, exportCustomerOutstanding, exportSupplierOutstanding,
} from '../utils/exportExcel';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',          label: 'Overview',             icon: Activity,         color: 'var(--brand)'   },
  { id: 'sales',             label: 'Sales',                icon: TrendingUp,       color: 'var(--brand)'   },
  { id: 'purchases',         label: 'Purchases',            icon: ShoppingCart,     color: '#7c3aed'        },
  { id: 'profit',            label: 'Profit & Loss',        icon: BarChart3,        color: 'var(--emerald)' },
  { id: 'tax',               label: 'GST / Tax',            icon: Receipt,          color: 'var(--brand)'   },
  { id: 'payment',           label: 'Payments',             icon: CreditCard,       color: 'var(--emerald)' },
  { id: 'sales_returns',     label: 'Sales Returns',        icon: RotateCcw,        color: 'var(--emerald)' },
  { id: 'purchase_returns',  label: 'Purchase Returns',     icon: PackageX,         color: 'var(--warning)'   },
  { id: 'stock',             label: 'Stock Ledger',         icon: Package,          color: 'var(--brand)'   },
  { id: 'stock_movements',   label: 'Stock Movements',      icon: GitCompareArrows, color: '#7c3aed'        },
  { id: 'low_stock',         label: 'Low Stock',            icon: AlertTriangle,    color: 'var(--warning)'   },
  { id: 'cust_outstanding',  label: 'Cust. Outstanding',    icon: Users,            color: 'var(--warning)'   },
  { id: 'supp_outstanding',  label: 'Supp. Outstanding',    icon: Truck,            color: 'var(--error)'   },
];

const PRESETS = [
  { label: 'Today',     days: 0    },
  { label: '7 Days',    days: 7    },
  { label: '30 Days',   days: 30   },
  { label: '3 Months',  days: 90   },
  { label: '1 Year',    days: 365  },
  { label: 'All Time',  days: null },
];

const STOCK_TYPE_META = {
  SALE:              { label: 'Sale',           color: 'var(--red)'     },
  PURCHASE:          { label: 'Purchase',       color: 'var(--emerald)' },
  SALE_RETURN:       { label: 'Sale Return',    color: 'var(--emerald)' },
  PURCHASE_RETURN:   { label: 'Purch. Return',  color: 'var(--warning)'   },
  MANUAL_ADJUSTMENT: { label: 'Adjustment',     color: 'var(--accent)'  },
  DAMAGED:           { label: 'Damaged',        color: 'var(--red)'     },
  EXPIRED:           { label: 'Expired',        color: 'var(--red)'     },
  OPENING_STOCK:     { label: 'Opening Stock',  color: 'var(--accent)'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatePreset(days) {
  if (days === null) return { from: '', to: '' };
  const to = new Date().toISOString().slice(0, 10);
  if (days === 0) return { from: to, to };
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function pct(numerator, denominator) {
  return denominator > 0 ? Math.min(100, (numerator / denominator) * 100) : 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'var(--text-primary)', icon: Icon, progress, progressLabel }) {
  const iconBg    = color !== 'var(--text-primary)' ? `${color}1a` : 'var(--brand-faint)';
  const iconColor = color !== 'var(--text-primary)' ? color : 'var(--brand)';
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="label mb-0" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: iconBg }}>
            <Icon size={15} style={{ color: iconColor }} />
          </div>
        )}
      </div>
      <div>
        <p className="num font-bold" style={{ fontSize: 21, lineHeight: 1.1, color }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>
      {progress !== undefined && (
        <div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: iconColor }} />
          </div>
          {progressLabel && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{progressLabel}</p>}
        </div>
      )}
    </div>
  );
}

function MiniBar({ value, max, color = 'var(--brand)' }) {
  return (
    <div className="h-2 rounded-full overflow-hidden flex-1" style={{ background: 'var(--border)', minWidth: 60 }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mb-3"
      style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
      {children}
    </p>
  );
}

function payBadge(s) {
  if (s === 'paid')    return <span className="badge badge-success">Paid</span>;
  if (s === 'partial') return <span className="badge badge-neutral" style={{ color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border, #FEF08A)' }}>Partial</span>;
  return <span className="badge" style={{ color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>Unpaid</span>;
}

function EmptyIllustration({ icon: Icon, color, title, body }) {
  return (
    <div className="card p-12 flex flex-col items-center text-center gap-3">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${color}1a` }}>
        <Icon size={28} style={{ color }} />
      </div>
      <div>
        <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {body && <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{body}</p>}
      </div>
    </div>
  );
}

function ReportTable({ headers, rows, emptyText = 'No data for this period' }) {
  return (
    <div className="card overflow-hidden">
      {/* Desktop */}
      <div className="hidden sm:block table-wrapper">
        <table className="table" style={{ minWidth: 600 }}>
          <thead>
            <tr>{headers.map((h) => <th key={h} className="th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="td text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="tr">{row.map((cell, j) => <td key={j} className="td">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</div>
        ) : rows.map((row, i) => (
          <div key={i} className="p-3 space-y-1.5">
            {headers.map((h, j) => (
              <div key={j} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-xs shrink-0 pt-0.5" style={{ color: 'var(--text-tertiary)', minWidth: 110 }}>{h}</span>
                <span className="text-right min-w-0">{row[j]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section icon badge ───────────────────────────────────────────────────────

function TabIcon({ id }) {
  const tab = TABS.find((t) => t.id === id);
  if (!tab) return null;
  const Icon = tab.icon;
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${tab.color}1a` }}>
      <Icon size={17} style={{ color: tab.color }} />
    </div>
  );
}

// ─── Report hub metadata ──────────────────────────────────────────────────────

const REPORT_HUB = [
  { id: 'overview',         label: 'Business Overview',    icon: Activity,         color: '#4F46E5', desc: 'Revenue, profit, outstanding balances & top products' },
  { id: 'sales',            label: 'Sales',                icon: TrendingUp,       color: '#4F46E5', desc: 'Invoice breakdown, collection rates, discounts & tax' },
  { id: 'purchases',        label: 'Purchases',            icon: ShoppingCart,     color: '#7c3aed', desc: 'Purchase orders, supplier payments & open balances' },
  { id: 'profit',           label: 'Profit & Loss',        icon: BarChart3,        color: '#16A34A', desc: 'COGS, gross profit margin & product-level profitability' },
  { id: 'tax',              label: 'GST / Tax',            icon: Receipt,          color: '#4F46E5', desc: 'Tax billed, collected vs pending, effective tax rate' },
  { id: 'payment',          label: 'Payments',             icon: CreditCard,       color: '#16A34A', desc: 'Collections by payment method, outstanding breakdown' },
  { id: 'sales_returns',    label: 'Sales Returns',        icon: RotateCcw,        color: '#16A34A', desc: 'Customer returns processed, refund amounts & reasons' },
  { id: 'purchase_returns', label: 'Purchase Returns',     icon: PackageX,         color: '#D97706', desc: 'Returns to suppliers, credit notes & stock adjustments' },
  { id: 'stock',            label: 'Stock Ledger',         icon: Package,          color: '#4F46E5', desc: 'Current inventory levels, cost & retail valuation' },
  { id: 'stock_movements',  label: 'Stock Movements',      icon: GitCompareArrows, color: '#7c3aed', desc: 'All stock-in and stock-out transactions with running balance' },
  { id: 'low_stock',        label: 'Low Stock Alert',      icon: AlertTriangle,    color: '#D97706', desc: 'Products below minimum stock level or out of stock' },
  { id: 'cust_outstanding', label: 'Customer Outstanding', icon: Users,            color: '#D97706', desc: 'Unpaid invoices grouped by customer with total balance' },
  { id: 'supp_outstanding', label: 'Supplier Outstanding', icon: Truck,            color: '#DC2626', desc: 'Unpaid purchase orders grouped by supplier' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Reports() {
  const { state } = useApp();
  const {
    invoices, purchases, products, categories,
    salesReturns, purchaseReturns, stockTransactions,
    settings,
  } = state;
  const sym = settings.currencySymbol;

  const [activeTab,    setActiveTab]    = useState(null);
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [activePreset, setActivePreset] = useState('All Time');

  function applyPreset(preset) {
    setActivePreset(preset.label);
    const { from, to } = getDatePreset(preset.days);
    setDateFrom(from);
    setDateTo(to);
  }

  // ── Filtered datasets ───────────────────────────────────────────────────────
  const fi  = useMemo(() => filterByDateRange(invoices,          dateFrom, dateTo),              [invoices,          dateFrom, dateTo]);
  const fp  = useMemo(() => filterByDateRange(purchases,         dateFrom, dateTo),              [purchases,         dateFrom, dateTo]);
  const fsr = useMemo(() => filterByDateRange(salesReturns,      dateFrom, dateTo),              [salesReturns,      dateFrom, dateTo]);
  const fpr = useMemo(() => filterByDateRange(purchaseReturns,   dateFrom, dateTo),              [purchaseReturns,   dateFrom, dateTo]);
  const fst = useMemo(() => filterByDateRange(stockTransactions, dateFrom, dateTo, 'createdAt'), [stockTransactions, dateFrom, dateTo]);

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const salesM = useMemo(() => ({
    total:        sumField(fi, 'grandTotal'),
    paid:         fi.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + i.grandTotal, 0),
    tax:          sumField(fi, 'taxAmount'),
    discount:     sumField(fi, 'discountAmount'),
    balance:      sumField(fi, 'balanceAmount'),
    count:        fi.length,
    paidCount:    fi.filter((i) => i.paymentStatus === 'paid').length,
    partialCount: fi.filter((i) => i.paymentStatus === 'partial').length,
    unpaidCount:  fi.filter((i) => i.paymentStatus === 'unpaid').length,
  }), [fi]);

  const purchM = useMemo(() => ({
    total:   sumField(fp, 'grandTotal'),
    paid:    fp.filter((p) => p.paymentStatus === 'paid').reduce((s, p) => s + p.grandTotal, 0),
    balance: sumField(fp, 'balanceAmount'),
    count:   fp.length,
  }), [fp]);

  const srM = useMemo(() => ({ total: sumField(fsr, 'totalAmount'), count: fsr.length }), [fsr]);
  const prM = useMemo(() => ({ total: sumField(fpr, 'totalAmount'), count: fpr.length }), [fpr]);

  const profitM = useMemo(() => {
    const grossSales     = sumField(fi, 'grandTotal');
    const returnedAmount = sumField(fsr, 'totalAmount');
    const netSales       = grossSales - returnedAmount;
    let cogs = 0;
    fi.forEach((inv) => inv.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      cogs += (prod ? (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) : 0) * item.quantity;
    }));
    fsr.forEach((ret) => ret.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      cogs -= (prod ? (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) : 0) * item.returnQty;
    }));
    cogs = Math.max(0, cogs);
    const grossProfit = netSales - cogs;
    const margin      = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    return { grossSales, returnedAmount, netSales, cogs, grossProfit, margin };
  }, [fi, fsr, products]);

  const taxM = useMemo(() => ({
    totalTax:  sumField(fi, 'taxAmount'),
    paidTax:   fi.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + i.taxAmount, 0),
    unpaidTax: fi.filter((i) => i.paymentStatus !== 'paid').reduce((s, i) => s + i.taxAmount, 0),
  }), [fi]);

  const payM = useMemo(() => {
    const byMethod = {};
    fi.forEach((inv) => {
      const m = inv.paymentMethod || 'other';
      if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total += inv.paidAmount || 0;
    });
    return byMethod;
  }, [fi]);

  const custOutstanding = useMemo(() => {
    const byCustomer = {};
    invoices
      .filter((i) => i.paymentStatus !== 'paid' && (i.balanceAmount || 0) > 0)
      .forEach((inv) => {
        const cid = inv.customerId || 'walkin';
        if (!byCustomer[cid]) byCustomer[cid] = { name: inv.customerName, customerId: cid, invoices: [], totalBalance: 0 };
        byCustomer[cid].invoices.push(inv);
        byCustomer[cid].totalBalance += Number(inv.balanceAmount || 0);
      });
    return Object.values(byCustomer).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [invoices]);

  const suppOutstanding = useMemo(() => {
    const bySupplier = {};
    purchases
      .filter((p) => p.paymentStatus !== 'paid' && (p.balanceAmount || 0) > 0)
      .forEach((pur) => {
        const sid = pur.supplierId || 'unknown';
        if (!bySupplier[sid]) bySupplier[sid] = { name: pur.supplierName, supplierId: sid, purchases: [], totalBalance: 0 };
        bySupplier[sid].purchases.push(pur);
        bySupplier[sid].totalBalance += Number(pur.balanceAmount || 0);
      });
    return Object.values(bySupplier).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [purchases]);

  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products]);

  const topProducts = useMemo(() => {
    const byProd = {};
    fi.forEach((inv) => inv.items.forEach((item) => {
      const id = item.productId || item.id;
      if (!byProd[id]) byProd[id] = { name: item.productName || item.name || 'Unknown', revenue: 0, qty: 0 };
      byProd[id].revenue += (item.unitPrice || 0) * (item.quantity || 0);
      byProd[id].qty     += item.quantity || 0;
    }));
    return Object.values(byProd).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [fi]);

  const maxProductRevenue = topProducts[0]?.revenue || 0;

  const periodLabel = activePreset !== 'All Time'
    ? activePreset
    : (dateFrom || dateTo) ? `${dateFrom || '∞'} → ${dateTo || '∞'}` : 'All Time';

  // ── Excel Export ────────────────────────────────────────────────────────────
  async function handleExportCSV() {
    const pl = periodLabel.replace(/[\/\\:*?"<>|]/g, '-');
    switch (activeTab) {
      case 'overview':
      case 'sales':            await exportSales(fi, pl); break;
      case 'purchases':        await exportPurchases(fp, pl); break;
      case 'profit':           await exportProfit(fi, fsr, products, pl); break;
      case 'tax':              await exportTax(fi, pl); break;
      case 'payment':          await exportPayments(fi, pl); break;
      case 'sales_returns':    await exportSalesReturns(fsr, pl); break;
      case 'purchase_returns': await exportPurchaseReturns(fpr, pl); break;
      case 'stock':            await exportStock(products, categories, pl); break;
      case 'stock_movements':  await exportStockMovements(fst, pl); break;
      case 'low_stock':        await exportLowStock(products, categories, pl); break;
      case 'cust_outstanding': await exportCustomerOutstanding(invoices, pl); break;
      case 'supp_outstanding': await exportSupplierOutstanding(purchases, pl); break;
      default: break;
    }
  }

  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  const cardMetrics = {
    overview:         { label: 'Revenue',     value: formatCurrency(salesM.total, sym) },
    sales:            { label: 'Invoices',    value: salesM.count },
    purchases:        { label: 'PO Total',    value: formatCurrency(purchM.total, sym) },
    profit:           { label: 'Profit',      value: formatCurrency(profitM.grossProfit, sym) },
    tax:              { label: 'Tax Billed',  value: formatCurrency(taxM.totalTax, sym) },
    payment:          { label: 'Collected',   value: formatCurrency(salesM.paid, sym) },
    sales_returns:    { label: 'Refunds',     value: formatCurrency(srM.total, sym) },
    purchase_returns: { label: 'Credit',      value: formatCurrency(prM.total, sym) },
    stock:            { label: 'Products',    value: products.length },
    stock_movements:  { label: 'Movements',   value: fst.length },
    low_stock:        { label: 'Low Stock',   value: lowStockProducts.length },
    cust_outstanding: { label: 'Outstanding', value: formatCurrency(custOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym) },
    supp_outstanding: { label: 'Outstanding', value: formatCurrency(suppOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym) },
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ══ HUB VIEW ══════════════════════════════════════════════════════════ */}
      {!activeTab && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {/* Header + date presets */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={22} color="var(--brand)" /> Reports</h1>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Analyze your business performance &middot; {periodLabel}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => {
                const isActive = activePreset === p.label;
                return (
                  <button key={p.label} onClick={() => applyPreset(p)} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: isActive ? 'var(--brand)' : 'var(--surface)', color: isActive ? '#fff' : 'var(--text-secondary)', border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`, boxShadow: isActive ? '0 2px 6px rgba(79,70,229,0.25)' : '0 1px 2px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {REPORT_HUB.map((card) => {
              const IconC = card.icon;
              const m = cardMetrics[card.id];
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveTab(card.id)}
                  style={{ textAlign: 'left', padding: '18px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconC size={16} style={{ color: card.color }} />
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', marginTop: 4 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{card.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{card.desc}</p>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ REPORT VIEW ═══════════════════════════════════════════════════════ */}
      {activeTab && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Header bar: back + title + export ──────────────────────────── */}
          <div style={{ height: 54, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => setActiveTab(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              <ChevronLeft size={13} /> Reports
            </button>
            <span style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <TabIcon id={activeTab} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{activeTabMeta?.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 8 }}>{periodLabel}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={13} /> Export
            </button>
          </div>

          {/* ── Scrollable content ──────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="space-y-5">

            {/* Date filter */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <span className="text-xs font-medium mr-1" style={{ color: 'var(--text-tertiary)' }}>Quick:</span>
                {PRESETS.map((p) => {
                  const active = activePreset === p.label;
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: active ? 'var(--brand)' : 'var(--zinc-50)',
                        color:      active ? '#fff'          : 'var(--text-secondary)',
                        border:     `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                        boxShadow:  active ? '0 2px 6px rgba(79,70,229,0.25)' : 'none',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Custom range:</span>
                <input
                  type="date" className="input text-xs" style={{ width: 140 }} value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setActivePreset('Custom'); }}
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
                <input
                  type="date" className="input text-xs" style={{ width: 140 }} value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setActivePreset('Custom'); }}
                />
                {(dateFrom || dateTo) && (
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => { setDateFrom(''); setDateTo(''); setActivePreset('All Time'); }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Report tab switcher (compact pill strip) */}
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
                {TABS.map(({ id, label, icon: Icon, color }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
                      style={{
                        background: active ? color       : 'var(--surface)',
                        color:      active ? '#fff'      : 'var(--text-secondary)',
                        border:     `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                        boxShadow:  active ? `0 2px 8px ${color}44` : '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Gross Revenue" icon={TrendingUp} color="var(--brand)"
              value={formatCurrency(salesM.total, sym)}
              sub={`${salesM.count} invoice${salesM.count !== 1 ? 's' : ''}`}
              progress={pct(salesM.paid, salesM.total)}
              progressLabel={`${pct(salesM.paid, salesM.total).toFixed(0)}% collected`}
            />
            <StatCard
              label="Total Collected" icon={Wallet} color="var(--emerald)"
              value={formatCurrency(salesM.paid, sym)}
              sub={`Balance: ${formatCurrency(salesM.balance, sym)}`}
            />
            <StatCard
              label="Gross Profit" icon={BarChart3}
              color={profitM.grossProfit >= 0 ? 'var(--emerald)' : 'var(--error)'}
              value={formatCurrency(profitM.grossProfit, sym)}
              sub={`Margin: ${profitM.margin.toFixed(1)}%`}
              progress={Math.max(0, profitM.margin)}
              progressLabel={`On ${formatCurrency(profitM.netSales, sym)} net sales`}
            />
            <StatCard
              label="Total Purchases" icon={ShoppingCart} color="var(--warning)"
              value={formatCurrency(purchM.total, sym)}
              sub={`${purchM.count} order${purchM.count !== 1 ? 's' : ''}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card p-4">
              <SectionLabel>Invoice Status Breakdown</SectionLabel>
              {salesM.count === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No invoices for this period</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Paid',    count: salesM.paidCount,    color: 'var(--success)' },
                    { label: 'Partial', count: salesM.partialCount, color: 'var(--warning)'   },
                    { label: 'Unpaid',  count: salesM.unpaidCount,  color: 'var(--error)'   },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-secondary)', width: 52 }}>{label}</span>
                      <MiniBar value={count} max={salesM.count} color={color} />
                      <span className="text-xs font-bold shrink-0 w-5 text-right num" style={{ color }}>{count}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-1 border-t space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-tertiary)' }}>Tax collected</span>
                      <span className="num font-medium" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(salesM.tax, sym)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-tertiary)' }}>Discounts given</span>
                      <span className="num font-medium" style={{ color: 'var(--error)' }}>−{formatCurrency(salesM.discount, sym)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4">
              <SectionLabel>Outstanding Balances</SectionLabel>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--warning-bg, #FEFCE8)' }}>
                  <div className="flex items-center gap-2">
                    <Users size={15} style={{ color: 'var(--warning)' }} />
                    <div>
                      <p className="font-semibold text-sm">Customers owe you</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {custOutstanding.length} customer{custOutstanding.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="num font-bold text-base" style={{ color: 'var(--warning)' }}>
                    {formatCurrency(custOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym)}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--error-bg)' }}>
                  <div className="flex items-center gap-2">
                    <Truck size={15} style={{ color: 'var(--error)' }} />
                    <div>
                      <p className="font-semibold text-sm">You owe suppliers</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {suppOutstanding.length} supplier{suppOutstanding.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="num font-bold text-base" style={{ color: 'var(--error)' }}>
                    {formatCurrency(suppOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span style={{ color: 'var(--text-tertiary)' }}>Low-stock items</span>
                  <span className="font-semibold"
                    style={{ color: lowStockProducts.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {lowStockProducts.length === 0 ? 'All stocked' : `${lowStockProducts.length} items need restock`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {topProducts.length > 0 && (
            <div className="card p-4">
              <SectionLabel>Top Products by Revenue</SectionLabel>
              <div className="space-y-3">
                {topProducts.map((prod, i) => (
                  <div key={prod.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold shrink-0 w-4 text-right num" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{prod.name}</span>
                    <MiniBar value={prod.revenue} max={maxProductRevenue} color="var(--brand)" />
                    <span className="num text-xs font-semibold shrink-0 w-24 text-right" style={{ color: 'var(--brand)' }}>
                      {formatCurrency(prod.revenue, sym)}
                    </span>
                    <span className="text-xs shrink-0 w-14 text-right" style={{ color: 'var(--text-tertiary)' }}>
                      {prod.qty} units
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fi.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <SectionLabel>Recent Invoices</SectionLabel>
                <button className="text-xs flex items-center gap-1" style={{ color: 'var(--brand)' }}
                  onClick={() => setActiveTab('sales')}>
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="table-wrapper">
                <table className="table" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th className="th">Invoice #</th>
                      <th className="th">Customer</th>
                      <th className="th">Date</th>
                      <th className="th text-right">Total</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fi].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((inv) => (
                      <tr key={inv.id} className="tr">
                        <td className="td font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{inv.invoiceNumber}</td>
                        <td className="td">{inv.customerName}</td>
                        <td className="td text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</td>
                        <td className="td text-right num font-semibold">{formatCurrency(inv.grandTotal, sym)}</td>
                        <td className="td">{payBadge(inv.paymentStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fi.length === 0 && salesM.count === 0 && (
            <EmptyIllustration icon={Activity} color="var(--brand)"
              title="No data for this period"
              body="Adjust the date range or create invoices to see your business overview." />
          )}
        </div>
      )}

      {/* ══ SALES ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'sales' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard label="Gross Revenue"  icon={TrendingUp}    color="var(--brand)"
              value={formatCurrency(salesM.total, sym)}  sub={`${salesM.count} invoices`} />
            <StatCard label="Collected"      icon={Wallet}        color="var(--emerald)"
              value={formatCurrency(salesM.paid, sym)}
              progress={pct(salesM.paid, salesM.total)}
              progressLabel={`${pct(salesM.paid, salesM.total).toFixed(0)}% of billed`} />
            <StatCard label="Outstanding"    icon={AlertTriangle} color="var(--warning)"
              value={formatCurrency(salesM.balance, sym)} />
            <StatCard label="Tax Collected"  icon={Receipt}       color="var(--brand)"
              value={formatCurrency(salesM.tax, sym)} />
            <StatCard label="Discounts"      icon={ArrowUpRight}  color="var(--error)"
              value={formatCurrency(salesM.discount, sym)} />
            <StatCard label="Avg Invoice"    icon={BarChart3}
              value={formatCurrency(salesM.count ? salesM.total / salesM.count : 0, sym)} />
          </div>
          <ReportTable
            headers={['Invoice #', 'Customer', 'Date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status']}
            rows={[...fi].sort((a, b) => b.date.localeCompare(a.date)).map((inv) => [
              <span className="font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{inv.invoiceNumber}</span>,
              inv.customerName,
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</span>,
              <span className="num">{formatCurrency(inv.subtotal, sym)}</span>,
              <span className="num" style={{ color: inv.discountAmount > 0 ? 'var(--error)' : 'var(--text-tertiary)' }}>
                {inv.discountAmount > 0 ? `−${formatCurrency(inv.discountAmount, sym)}` : '—'}
              </span>,
              <span className="num">{formatCurrency(inv.taxAmount, sym)}</span>,
              <span className="num font-semibold">{formatCurrency(inv.grandTotal, sym)}</span>,
              <span className="num" style={{ color: 'var(--emerald)' }}>{formatCurrency(inv.paidAmount || 0, sym)}</span>,
              <span className="num" style={{ color: (inv.balanceAmount || 0) > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                {formatCurrency(inv.balanceAmount || 0, sym)}
              </span>,
              payBadge(inv.paymentStatus),
            ])}
          />
        </div>
      )}

      {/* ══ PURCHASES ═════════════════════════════════════════════════════════ */}
      {activeTab === 'purchases' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Purchases" icon={ShoppingCart}  color="var(--brand)"
              value={formatCurrency(purchM.total, sym)} sub={`${purchM.count} orders`} />
            <StatCard label="Paid"            icon={Wallet}        color="var(--emerald)"
              value={formatCurrency(purchM.paid, sym)}
              progress={pct(purchM.paid, purchM.total)}
              progressLabel={`${pct(purchM.paid, purchM.total).toFixed(0)}% settled`} />
            <StatCard label="Outstanding"     icon={AlertTriangle} color="var(--warning)"
              value={formatCurrency(purchM.balance, sym)} />
            <StatCard label="Received"        icon={Package}
              value={fp.filter((p) => p.status === 'received').length} sub="orders received" />
          </div>
          <ReportTable
            headers={['PO #', 'Supplier', 'Date', 'Total', 'Paid', 'Balance', 'Payment', 'Status']}
            rows={[...fp].sort((a, b) => b.date.localeCompare(a.date)).map((pur) => [
              <span className="font-mono text-xs font-semibold" style={{ color: '#7c3aed' }}>{pur.purchaseNumber}</span>,
              pur.supplierName,
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(pur.date)}</span>,
              <span className="num font-semibold">{formatCurrency(pur.grandTotal, sym)}</span>,
              <span className="num" style={{ color: 'var(--emerald)' }}>{formatCurrency(pur.paidAmount || 0, sym)}</span>,
              <span className="num" style={{ color: (pur.balanceAmount || 0) > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                {formatCurrency(pur.balanceAmount || 0, sym)}
              </span>,
              payBadge(pur.paymentStatus),
              <span className={`badge ${pur.status === 'received' ? 'badge-success' : 'badge-neutral'}`}>{pur.status}</span>,
            ])}
          />
        </div>
      )}

      {/* ══ PROFIT & LOSS ═════════════════════════════════════════════════════ */}
      {activeTab === 'profit' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card p-5"
            style={{ background: 'linear-gradient(135deg, var(--brand-faint) 0%, var(--success-bg) 100%)' }}>
            <p className="mb-4"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Profit &amp; Loss Summary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Gross Sales',  value: profitM.grossSales,  color: 'var(--brand)'   },
                { label: 'COGS',         value: profitM.cogs,        color: 'var(--error)'   },
                { label: 'Net Sales',    value: profitM.netSales,    color: 'var(--text-primary)' },
                { label: 'Gross Profit', value: profitM.grossProfit, color: profitM.grossProfit >= 0 ? 'var(--emerald)' : 'var(--error)' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                  <p className="num font-bold text-lg" style={{ color }}>{formatCurrency(value, sym)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Profit Margin</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{
                  width: `${Math.max(0, Math.min(100, profitM.margin))}%`,
                  background: profitM.margin >= 20 ? 'var(--emerald)' : profitM.margin > 0 ? 'var(--warning)' : 'var(--error)',
                }} />
              </div>
              <span className="num font-bold text-sm"
                style={{ color: profitM.margin >= 20 ? 'var(--emerald)' : profitM.margin > 0 ? 'var(--warning)' : 'var(--error)' }}>
                {profitM.margin.toFixed(1)}%
              </span>
            </div>
          </div>
          <ReportTable
            headers={['Product', 'Units Sold', 'Returns', 'Net Units', 'Revenue', 'Cost', 'Profit', 'Margin']}
            rows={products.map((prod) => {
              let unitsSold = 0, revenue = 0, cost = 0, unitsReturned = 0;
              fi.forEach((inv) => {
                const it = inv.items.find((i) => i.productId === prod.id);
                if (it) { unitsSold += it.quantity; revenue += it.unitPrice * it.quantity; cost += (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) * it.quantity; }
              });
              fsr.forEach((ret) => {
                const it = ret.items.find((i) => i.productId === prod.id);
                if (it) { unitsReturned += it.returnQty; revenue -= it.unitPrice * it.returnQty; cost -= (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) * it.returnQty; }
              });
              if (unitsSold === 0) return null;
              const netUnits = unitsSold - unitsReturned;
              const profit   = revenue - cost;
              const margin   = revenue > 0 ? (profit / revenue) * 100 : 0;
              return [
                <span className="font-medium">{prod.name}</span>,
                <span className="num">{unitsSold}</span>,
                <span className="num" style={{ color: unitsReturned > 0 ? 'var(--error)' : 'var(--text-tertiary)' }}>{unitsReturned || '—'}</span>,
                <span className="num font-semibold">{netUnits}</span>,
                <span className="num">{formatCurrency(revenue, sym)}</span>,
                <span className="num">{formatCurrency(cost, sym)}</span>,
                <span className="num font-semibold" style={{ color: profit >= 0 ? 'var(--emerald)' : 'var(--error)' }}>{formatCurrency(profit, sym)}</span>,
                <span className={`badge ${margin >= 30 ? 'badge-success' : margin >= 15 ? 'badge-neutral' : ''}`}
                  style={margin < 15 ? { color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' } : {}}>
                  {margin.toFixed(1)}%
                </span>,
              ];
            }).filter(Boolean)}
          />
        </div>
      )}

      {/* ══ GST / TAX ═════════════════════════════════════════════════════════ */}
      {activeTab === 'tax' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Tax Billed"     icon={Receipt}       color="var(--brand)"
              value={formatCurrency(taxM.totalTax, sym)} sub={`${salesM.count} invoices`} />
            <StatCard label="Tax Collected (Paid)" icon={Wallet}        color="var(--emerald)"
              value={formatCurrency(taxM.paidTax, sym)}
              progress={pct(taxM.paidTax, taxM.totalTax)}
              progressLabel={`${pct(taxM.paidTax, taxM.totalTax).toFixed(0)}% collected`} />
            <StatCard label="Tax Pending"          icon={AlertTriangle} color="var(--warning)"
              value={formatCurrency(taxM.unpaidTax, sym)} />
            <StatCard label="Effective Tax Rate"   icon={BarChart3}
              value={`${salesM.total > 0 ? ((taxM.totalTax / salesM.total) * 100).toFixed(1) : 0}%`} />
          </div>
          <ReportTable
            headers={['Invoice #', 'Customer', 'Date', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Status']}
            rows={[...fi].sort((a, b) => b.date.localeCompare(a.date)).map((inv) => [
              <span className="font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{inv.invoiceNumber}</span>,
              inv.customerName,
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</span>,
              <span className="num">{formatCurrency(inv.subtotal, sym)}</span>,
              <span className="num">{inv.subtotal > 0 ? `${((inv.taxAmount / inv.subtotal) * 100).toFixed(1)}%` : '0%'}</span>,
              <span className="num font-semibold" style={{ color: 'var(--brand)' }}>{formatCurrency(inv.taxAmount, sym)}</span>,
              payBadge(inv.paymentStatus),
            ])}
          />
        </div>
      )}

      {/* ══ PAYMENTS ══════════════════════════════════════════════════════════ */}
      {activeTab === 'payment' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Total Collected"      icon={Wallet}        color="var(--emerald)"
              value={formatCurrency(Object.values(payM).reduce((s, m) => s + m.total, 0), sym)} />
            <StatCard label="Total Outstanding"    icon={AlertTriangle} color="var(--warning)"
              value={formatCurrency(salesM.balance, sym)} />
            <StatCard label="Payment Methods Used" icon={CreditCard}
              value={Object.keys(payM).length} />
          </div>

          {Object.keys(payM).length > 0 && (
            <div className="card p-4">
              <SectionLabel>By Payment Method</SectionLabel>
              <div className="space-y-3">
                {(() => {
                  const maxTotal = Math.max(...Object.values(payM).map((d) => d.total));
                  return Object.entries(payM)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([method, data]) => (
                      <div key={method} className="flex items-center gap-3">
                        <span className="text-sm font-medium capitalize shrink-0 w-24" style={{ color: 'var(--text-secondary)' }}>
                          {method.replace(/_/g, ' ')}
                        </span>
                        <MiniBar value={data.total} max={maxTotal} color="var(--brand)" />
                        <span className="num text-sm font-semibold shrink-0 w-28 text-right" style={{ color: 'var(--brand)' }}>
                          {formatCurrency(data.total, sym)}
                        </span>
                        <span className="text-xs shrink-0 w-14 text-right" style={{ color: 'var(--text-tertiary)' }}>
                          {data.count} inv.
                        </span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          <ReportTable
            headers={['Invoice #', 'Customer', 'Date', 'Total', 'Paid', 'Balance', 'Method', 'Status']}
            rows={[...fi].sort((a, b) => b.date.localeCompare(a.date)).map((inv) => [
              <span className="font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{inv.invoiceNumber}</span>,
              inv.customerName,
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</span>,
              <span className="num">{formatCurrency(inv.grandTotal, sym)}</span>,
              <span className="num" style={{ color: 'var(--emerald)' }}>{formatCurrency(inv.paidAmount || 0, sym)}</span>,
              <span className="num" style={{ color: (inv.balanceAmount || 0) > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                {formatCurrency(inv.balanceAmount || 0, sym)}
              </span>,
              <span className="capitalize text-xs">{(inv.paymentMethod || '—').replace(/_/g, ' ')}</span>,
              payBadge(inv.paymentStatus),
            ])}
          />
        </div>
      )}

      {/* ══ SALES RETURNS ═════════════════════════════════════════════════════ */}
      {activeTab === 'sales_returns' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Total Returns" icon={RotateCcw} value={srM.count} sub="transactions" />
            <StatCard label="Refund Amount" icon={Wallet} color="var(--emerald)" value={formatCurrency(srM.total, sym)} />
            <StatCard label="Avg Refund"    icon={BarChart3} value={formatCurrency(srM.count ? srM.total / srM.count : 0, sym)} />
          </div>
          {fsr.length === 0 ? (
            <EmptyIllustration icon={RotateCcw} color="var(--emerald)" title="No sales returns" body="No returns recorded for this period." />
          ) : (
            <ReportTable
              headers={['Return #', 'Invoice #', 'Customer', 'Date', 'Reason', 'Items', 'Refund']}
              rows={[...fsr].sort((a, b) => b.date.localeCompare(a.date)).map((r) => [
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{r.returnNumber}</span>,
                <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.invoiceNumber}</span>,
                r.customerName,
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.date)}</span>,
                <span className="capitalize text-xs">{r.reason.replace(/_/g, ' ')}</span>,
                r.items.length,
                <span className="num font-semibold" style={{ color: 'var(--emerald)' }}>{formatCurrency(r.totalAmount, sym)}</span>,
              ])}
            />
          )}
        </div>
      )}

      {/* ══ PURCHASE RETURNS ══════════════════════════════════════════════════ */}
      {activeTab === 'purchase_returns' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Total Returns" icon={PackageX} value={prM.count} sub="transactions" />
            <StatCard label="Credit Value"  icon={Wallet}   color="var(--warning)" value={formatCurrency(prM.total, sym)} />
            <StatCard label="Avg Return"    icon={BarChart3} value={formatCurrency(prM.count ? prM.total / prM.count : 0, sym)} />
          </div>
          {fpr.length === 0 ? (
            <EmptyIllustration icon={PackageX} color="var(--warning)" title="No purchase returns" body="No returns recorded for this period." />
          ) : (
            <ReportTable
              headers={['Return #', 'PO #', 'Supplier', 'Date', 'Reason', 'Items', 'Amount']}
              rows={[...fpr].sort((a, b) => b.date.localeCompare(a.date)).map((r) => [
                <span className="font-mono text-xs font-semibold" style={{ color: '#7c3aed' }}>{r.returnNumber}</span>,
                <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.purchaseNumber}</span>,
                r.supplierName,
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.date)}</span>,
                <span className="capitalize text-xs">{r.reason.replace(/_/g, ' ')}</span>,
                r.items.length,
                <span className="num font-semibold" style={{ color: 'var(--warning)' }}>{formatCurrency(r.totalAmount, sym)}</span>,
              ])}
            />
          )}
        </div>
      )}

      {/* ══ STOCK LEDGER ══════════════════════════════════════════════════════ */}
      {activeTab === 'stock' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Products"      icon={Package}      value={products.length} />
            <StatCard label="Total Stock Units"   icon={Layers}       value={products.reduce((s, p) => s + p.stock, 0)} />
            <StatCard label="Inv. Value (Cost)"   icon={ShoppingCart} color="var(--brand)"
              value={formatCurrency(products.reduce((s, p) => s + p.purchasePrice * p.stock, 0), sym)} />
            <StatCard label="Inv. Value (Retail)" icon={TrendingUp}   color="var(--emerald)"
              value={formatCurrency(products.reduce((s, p) => s + p.sellingPrice * p.stock, 0), sym)} />
          </div>
          <div className="card overflow-hidden">
            <div className="hidden sm:block table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">SKU</th>
                    <th className="th">Category</th>
                    <th className="th text-right">Stock</th>
                    <th className="th text-right">Min</th>
                    <th className="th text-right">Cost/Unit</th>
                    <th className="th text-right">Cost Value</th>
                    <th className="th text-right">Retail Value</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const cat = categories.find((c) => c.id === p.categoryId);
                    const stockStatus = p.stock === 0 ? 'Out of Stock' : isLowStock(p) ? 'Low Stock' : 'In Stock';
                    return (
                      <tr key={p.id} className="tr">
                        <td className="td font-medium">{p.name}</td>
                        <td className="td font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.sku}</td>
                        <td className="td" style={{ color: 'var(--text-secondary)' }}>{cat?.name || '—'}</td>
                        <td className="td text-right num font-semibold">{p.stock} {p.unit}</td>
                        <td className="td text-right num" style={{ color: 'var(--text-tertiary)' }}>{p.minStock}</td>
                        <td className="td text-right num">{formatCurrency(p.purchasePrice, sym)}</td>
                        <td className="td text-right num">{formatCurrency(p.purchasePrice * p.stock, sym)}</td>
                        <td className="td text-right num" style={{ color: 'var(--emerald)' }}>{formatCurrency(p.sellingPrice * p.stock, sym)}</td>
                        <td className="td">
                          <span className={`badge ${p.stock === 0 ? '' : isLowStock(p) ? 'badge-neutral' : 'badge-success'}`}
                            style={p.stock === 0 ? { color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' } : {}}>
                            {stockStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {products.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold" style={{ fontSize: 13 }}>{p.name}</p>
                      <p className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.sku}</p>
                    </div>
                    <span className={`badge ${p.stock === 0 ? '' : isLowStock(p) ? 'badge-neutral' : 'badge-success'}`}
                      style={p.stock === 0 ? { color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' } : {}}>
                      {p.stock === 0 ? 'Out' : isLowStock(p) ? 'Low' : 'OK'}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Stock: <span className="num font-semibold">{p.stock} {p.unit}</span></span>
                    <span style={{ color: 'var(--emerald)' }}>Retail: <span className="num font-semibold">{formatCurrency(p.sellingPrice * p.stock, sym)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ STOCK MOVEMENTS ═══════════════════════════════════════════════════ */}
      {activeTab === 'stock_movements' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Transactions" icon={GitCompareArrows} value={fst.length} />
            <StatCard label="Total In"     icon={ArrowUpRight}     color="var(--emerald)"
              value={fst.reduce((s, t) => s + Number(t.quantityIn || 0), 0)} />
            <StatCard label="Total Out"    icon={Layers}           color="var(--error)"
              value={fst.reduce((s, t) => s + Number(t.quantityOut || 0), 0)} />
          </div>
          <div className="card overflow-hidden">
            <div className="hidden sm:block table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Product</th>
                    <th className="th">Type</th>
                    <th className="th">Reference</th>
                    <th className="th text-right">In</th>
                    <th className="th text-right">Out</th>
                    <th className="th text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {fst.length === 0 ? (
                    <tr><td colSpan={7} className="td text-center py-10" style={{ color: 'var(--text-tertiary)' }}>No movements for this period</td></tr>
                  ) : [...fst].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => {
                    const meta = STOCK_TYPE_META[t.transactionType] || STOCK_TYPE_META.MANUAL_ADJUSTMENT;
                    return (
                      <tr key={t.id} className="tr">
                        <td className="td">
                          {(() => { const dt = formatDateTimeSplit(t.createdAt); return (<><div style={{fontSize:12.5,fontWeight:500,color:'var(--text-primary)',whiteSpace:'nowrap'}}>{dt.date}</div>{dt.time && <div style={{fontSize:11,color:'var(--text-tertiary)',marginTop:1}}>{dt.time}</div>}</>); })()}
                        </td>
                        <td className="td">
                          <p className="font-medium" style={{ fontSize: 13 }}>{t.productName}</p>
                          <p className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.sku}</p>
                        </td>
                        <td className="td">
                          <span className="badge badge-neutral" style={{ color: meta.color }}>{meta.label}</span>
                        </td>
                        <td className="td font-mono text-xs" style={{ color: 'var(--brand)' }}>{t.referenceNumber || '—'}</td>
                        <td className="td text-right num font-semibold" style={{ color: t.quantityIn > 0 ? 'var(--emerald)' : 'var(--text-tertiary)' }}>
                          {t.quantityIn > 0 ? `+${t.quantityIn}` : '—'}
                        </td>
                        <td className="td text-right num font-semibold" style={{ color: t.quantityOut > 0 ? 'var(--error)' : 'var(--text-tertiary)' }}>
                          {t.quantityOut > 0 ? `−${t.quantityOut}` : '—'}
                        </td>
                        <td className="td text-right num font-semibold">{t.newStock}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {fst.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No movements for this period</div>
              ) : [...fst].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => {
                const meta = STOCK_TYPE_META[t.transactionType] || STOCK_TYPE_META.MANUAL_ADJUSTMENT;
                return (
                  <div key={t.id} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{t.productName}</span>
                      <span className="badge badge-neutral" style={{ color: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{formatDateTimeSplit(t.createdAt).date}{formatDateTimeSplit(t.createdAt).time ? ` • ${formatDateTimeSplit(t.createdAt).time}` : ''}</span>
                      {t.quantityIn  > 0 && <span style={{ color: 'var(--emerald)' }}>+{t.quantityIn}</span>}
                      {t.quantityOut > 0 && <span style={{ color: 'var(--error)' }}>−{t.quantityOut}</span>}
                      <span>Balance: <span className="num font-semibold" style={{ color: 'var(--text-primary)' }}>{t.newStock}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ LOW STOCK ═════════════════════════════════════════════════════════ */}
      {activeTab === 'low_stock' && (
        <div className="space-y-4 animate-fadeIn">
          {lowStockProducts.length === 0 ? (
            <EmptyIllustration icon={Package} color="var(--success)"
              title="All products well stocked"
              body="No items are below their minimum stock level." />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <StatCard label="Low Stock Items"   icon={AlertTriangle} color="var(--warning)"
                  value={lowStockProducts.length} />
                <StatCard label="Out of Stock"       icon={PackageX}      color="var(--error)"
                  value={lowStockProducts.filter((p) => p.stock === 0).length} />
                <StatCard label="Restock Cost Est."  icon={ShoppingCart}
                  value={formatCurrency(lowStockProducts.reduce((s, p) => s + Math.max(0, p.minStock - p.stock) * p.purchasePrice, 0), sym)} />
              </div>
              <ReportTable
                headers={['Product', 'SKU', 'Current', 'Minimum', 'Needed', 'Restock Cost', 'Status']}
                rows={lowStockProducts.map((p) => [
                  <span className="font-medium">{p.name}</span>,
                  <span className="font-mono text-xs">{p.sku}</span>,
                  <span className="num font-bold" style={{ color: p.stock === 0 ? 'var(--error)' : 'var(--warning)' }}>{p.stock} {p.unit}</span>,
                  <span className="num">{p.minStock}</span>,
                  <span className="num font-semibold" style={{ color: 'var(--brand)' }}>{Math.max(0, p.minStock - p.stock)} more</span>,
                  <span className="num">{formatCurrency(Math.max(0, p.minStock - p.stock) * p.purchasePrice, sym)}</span>,
                  <span
                    className={p.stock === 0 ? 'badge' : 'badge badge-neutral'}
                    style={p.stock === 0 ? { color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' } : {}}>
                    {p.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                  </span>,
                ])}
              />
            </>
          )}
        </div>
      )}

      {/* ══ CUSTOMER OUTSTANDING ══════════════════════════════════════════════ */}
      {activeTab === 'cust_outstanding' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Customers with Balance" icon={Users}         value={custOutstanding.length} />
            <StatCard label="Total Outstanding"       icon={AlertTriangle} color="var(--warning)"
              value={formatCurrency(custOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym)} />
            <StatCard label="Unpaid Invoices"          icon={Receipt}
              value={invoices.filter((i) => i.paymentStatus !== 'paid').length} />
          </div>
          {custOutstanding.length === 0 ? (
            <EmptyIllustration icon={Users} color="var(--success)" title="No outstanding balances" body="All customers have fully paid." />
          ) : custOutstanding.map((cust) => {
            const nowMs = Date.now();
            const agingBuckets = [
              { label: '0–30 days',  days: [0,  30], color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', amount: 0, count: 0 },
              { label: '31–60 days', days: [31, 60], color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A', amount: 0, count: 0 },
              { label: '61–90 days', days: [61, 90], color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', amount: 0, count: 0 },
              { label: '90+ days',   days: [91,Infinity], color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', amount: 0, count: 0 },
            ];
            cust.invoices.forEach(inv => {
              const d = Math.max(0, Math.floor((nowMs - new Date(inv.date || inv.createdAt || nowMs).getTime()) / 86400000));
              const bal = Number(inv.balanceAmount || 0);
              const bucket = agingBuckets.find(b => d >= b.days[0] && d <= b.days[1]) || agingBuckets[3];
              bucket.amount += bal;
              bucket.count  += 1;
            });
            const activeBuckets = agingBuckets.filter(b => b.amount > 0);
            return (
              <div key={cust.customerId} className="card overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--zinc-50)' }}>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cust.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {cust.invoices.length} unpaid invoice{cust.invoices.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-bold text-lg" style={{ color: 'var(--warning)' }}>{formatCurrency(cust.totalBalance, sym)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>outstanding</p>
                  </div>
                </div>

                {/* Aging buckets */}
                {activeBuckets.length > 0 && (
                  <div style={{ display:'flex', gap:8, padding:'10px 16px', background:'var(--canvas)', borderBottom:'1px solid var(--border-subtle)', flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', alignSelf:'center', marginRight:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Aging:</span>
                    {activeBuckets.map(b => (
                      <div key={b.label} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:b.bg, border:`1px solid ${b.border}` }}>
                        <span style={{ fontSize:10, fontWeight:700, color:b.color }}>{b.label}</span>
                        <span style={{ fontSize:10.5, fontWeight:800, color:b.color, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(b.amount, sym)}</span>
                        <span style={{ fontSize:9.5, color:b.color, opacity:0.7 }}>({b.count})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoice table */}
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Invoice #</th><th className="th">Date</th>
                        <th className="th text-right">Total</th><th className="th text-right">Paid</th>
                        <th className="th text-right">Balance</th><th className="th">Status</th><th className="th">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cust.invoices.map((inv) => {
                        const days = Math.max(0, Math.floor((nowMs - new Date(inv.date || inv.createdAt || nowMs).getTime()) / 86400000));
                        const ageBucket = agingBuckets.find(b => days >= b.days[0] && days <= b.days[1]) || agingBuckets[3];
                        return (
                          <tr key={inv.id} className="tr">
                            <td className="td font-mono text-xs font-semibold" style={{ color: 'var(--brand)' }}>{inv.invoiceNumber}</td>
                            <td className="td text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</td>
                            <td className="td text-right num">{formatCurrency(inv.grandTotal, sym)}</td>
                            <td className="td text-right num" style={{ color: 'var(--emerald)' }}>{formatCurrency(inv.paidAmount || 0, sym)}</td>
                            <td className="td text-right num font-semibold" style={{ color: 'var(--warning)' }}>{formatCurrency(inv.balanceAmount || 0, sym)}</td>
                            <td className="td">{payBadge(inv.paymentStatus)}</td>
                            <td className="td">
                              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:ageBucket.bg, color:ageBucket.color, border:`1px solid ${ageBucket.border}`, whiteSpace:'nowrap' }}>
                                {days}d
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SUPPLIER OUTSTANDING ══════════════════════════════════════════════ */}
      {activeTab === 'supp_outstanding' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Suppliers with Balance" icon={Truck}          value={suppOutstanding.length} />
            <StatCard label="Total Outstanding"       icon={AlertTriangle}  color="var(--error)"
              value={formatCurrency(suppOutstanding.reduce((s, c) => s + c.totalBalance, 0), sym)} />
            <StatCard label="Unpaid POs"              icon={ShoppingCart}
              value={purchases.filter((p) => p.paymentStatus !== 'paid').length} />
          </div>
          {suppOutstanding.length === 0 ? (
            <EmptyIllustration icon={Truck} color="var(--success)" title="No outstanding supplier balances" body="All supplier invoices are fully paid." />
          ) : suppOutstanding.map((supp) => (
            <div key={supp.supplierId} className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--zinc-50)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{supp.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {supp.purchases.length} unpaid order{supp.purchases.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-bold text-lg" style={{ color: 'var(--error)' }}>{formatCurrency(supp.totalBalance, sym)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>outstanding</p>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">PO #</th><th className="th">Date</th>
                      <th className="th text-right">Total</th><th className="th text-right">Paid</th>
                      <th className="th text-right">Balance</th><th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supp.purchases.map((pur) => (
                      <tr key={pur.id} className="tr">
                        <td className="td font-mono text-xs font-semibold" style={{ color: '#7c3aed' }}>{pur.purchaseNumber}</td>
                        <td className="td text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(pur.date)}</td>
                        <td className="td text-right num">{formatCurrency(pur.grandTotal, sym)}</td>
                        <td className="td text-right num" style={{ color: 'var(--emerald)' }}>{formatCurrency(pur.paidAmount || 0, sym)}</td>
                        <td className="td text-right num font-semibold" style={{ color: 'var(--error)' }}>{formatCurrency(pur.balanceAmount || 0, sym)}</td>
                        <td className="td">{payBadge(pur.paymentStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

          </div>
        </div>
      )}

    </div>
  );
}
