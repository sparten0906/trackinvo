import React from 'react';

/* ─── Local SVG imports (bundled by Vite as asset URLs) ─────────────── */
import dashboardSvg      from '../../assets/icons/dashboard.svg';
import productsSvg       from '../../assets/icons/products.svg';
import categoriesSvg     from '../../assets/icons/categories.svg';
import suppliersSvg      from '../../assets/icons/suppliers.svg';
import customersSvg      from '../../assets/icons/customers.svg';
import billingSvg        from '../../assets/icons/billing.svg';
import invoicesSvg       from '../../assets/icons/invoices.svg';
import purchasesSvg      from '../../assets/icons/purchases.svg';
import purchaseOrdersSvg from '../../assets/icons/purchase-orders.svg';
import salesReturnsSvg   from '../../assets/icons/sales-returns.svg';
import purchaseReturnsSvg from '../../assets/icons/purchase-returns.svg';
import stockLedgerSvg    from '../../assets/icons/stock-ledger.svg';
import stockMovementSvg  from '../../assets/icons/stock-movement.svg';
import damagedStockSvg   from '../../assets/icons/damaged-stock.svg';
import reportsSvg        from '../../assets/icons/reports.svg';
import settingsSvg       from '../../assets/icons/settings.svg';
import profileSvg        from '../../assets/icons/profile.svg';
import notificationsSvg  from '../../assets/icons/notifications.svg';
import searchSvg         from '../../assets/icons/search.svg';
import todaySalesSvg     from '../../assets/icons/today-sales.svg';
import outstandingSvg    from '../../assets/icons/outstanding.svg';
import profitSvg         from '../../assets/icons/profit.svg';
import revenueSvg        from '../../assets/icons/revenue.svg';
import stockValueSvg     from '../../assets/icons/stock-value.svg';
import outOfStockSvg     from '../../assets/icons/out-of-stock.svg';
import taxSvg            from '../../assets/icons/tax.svg';
import businessSvg       from '../../assets/icons/business.svg';
import purchasesCostSvg  from '../../assets/icons/purchases-cost.svg';

/* ─── Centralized icon map ─────────────────────────────────────────── */
export const ICON_MAP = {
  /* Core navigation modules */
  'dashboard':         dashboardSvg,
  'products':          productsSvg,
  'categories':        categoriesSvg,
  'suppliers':         suppliersSvg,
  'customers':         customersSvg,
  'billing':           billingSvg,
  'invoices':          invoicesSvg,
  'purchases':         purchasesSvg,
  'purchase-orders':   purchaseOrdersSvg,
  'sales-returns':     salesReturnsSvg,
  'purchase-returns':  purchaseReturnsSvg,
  'stock-ledger':      stockLedgerSvg,
  'stock-movement':    stockMovementSvg,
  'damaged-stock':     damagedStockSvg,
  'reports':           reportsSvg,
  'settings':          settingsSvg,

  /* Dashboard KPI semantic names */
  'today-sales':       todaySalesSvg,
  'revenue':           revenueSvg,
  'profit':            profitSvg,
  'outstanding':       outstandingSvg,
  'stock-value':       stockValueSvg,
  'purchases-cost':    purchasesCostSvg,
  'low-stock':         damagedStockSvg,
  'out-of-stock':      outOfStockSvg,

  /* Quick action aliases */
  'new-invoice':       invoicesSvg,
  'add-product':       productsSvg,
  'new-purchase':      purchasesSvg,
  'add-customer':      customersSvg,

  /* Utility / system */
  'tax':               taxSvg,
  'currency':          taxSvg,
  'business':          businessSvg,
  'profile':           profileSvg,
  'notifications':     notificationsSvg,
  'search':            searchSvg,
  'alert':             damagedStockSvg,
  'overdue':           outstandingSvg,
};

/* ─── AppIcon component ─────────────────────────────────────────────── */
export default function AppIcon({ name, size = 24, className, style }) {
  const src = ICON_MAP[name] ?? settingsSvg;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={name}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      draggable={false}
    />
  );
}
