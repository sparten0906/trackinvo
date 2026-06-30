// All date/time formatting is delegated to the central dateTime utility.
// Re-exported here so existing imports from helpers.js continue to work.
import {
  hasTime as _hasTime,
  formatDate as _formatDate,
  formatDateOnly as _formatDateOnly,
  formatDateTime as _formatDateTime,
  formatDateTimeShort as _formatDateTimeShort,
  formatDateTimeSplit as _formatDateTimeSplit,
  formatTime as _formatTime,
  formatBusinessDateTime as _formatBusinessDateTime,
  formatBusinessDateTimeSplit as _formatBusinessDateTimeSplit,
  formatTableDateTime as _formatTableDateTime,
  formatModalDateTime as _formatModalDateTime,
  formatMobileDateTime as _formatMobileDateTime,
  formatDateForInput as _fmtDateForInput,
  getTodayLocalDate as _getTodayLocalDate,
  startOfLocalDay as _startOfLocalDay,
  endOfLocalDay as _endOfLocalDay,
  toLocalDateRange as _toLocalDateRange,
  isWithinLocalDateRange as _isWithinLocalDateRange,
  setAppTimezone as _setAppTimezone,
  getAppTimezone as _getAppTimezone,
} from './dateTime.js';

export const hasTime                    = _hasTime;
export const formatDate                 = _formatDate;
export const formatDateOnly             = _formatDateOnly;
export const formatDateTime             = _formatDateTime;
export const formatDateTimeShort        = _formatDateTimeShort;
export const formatDateTimeSplit        = _formatDateTimeSplit;
export const formatTime                 = _formatTime;
export const formatBusinessDateTime     = _formatBusinessDateTime;
export const formatBusinessDateTimeSplit = _formatBusinessDateTimeSplit;
export const formatTableDateTime        = _formatTableDateTime;
export const formatModalDateTime        = _formatModalDateTime;
export const formatMobileDateTime       = _formatMobileDateTime;
export const formatDateForInput         = _fmtDateForInput;
export const getTodayLocalDate          = _getTodayLocalDate;
export const startOfLocalDay            = _startOfLocalDay;
export const endOfLocalDay              = _endOfLocalDay;
export const toLocalDateRange           = _toLocalDateRange;
export const isWithinLocalDateRange     = _isWithinLocalDateRange;
export const setAppTimezone             = _setAppTimezone;
export const getAppTimezone             = _getAppTimezone;

// ─── FORMATTING ───────────────────────────────────────────────────────────────
export const formatCurrency = (amount, symbol = '$') =>
  `${symbol}${Number(amount || 0).toFixed(2)}`;

// Legacy shim: converts an ISO or YYYY-MM-DD string to "YYYY-MM-DD" for inputs.
export const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
};

// ─── ID GENERATORS ────────────────────────────────────────────────────────────
export const generateId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const generateInvoiceNumber = (prefix, existing) => {
  const nums = existing
    .map((inv) => parseInt(inv.invoiceNumber?.split('-').pop() || '0', 10))
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
};

export const generateReturnNumber = (prefix, existingReturns) => {
  const nums = existingReturns
    .map((r) => parseInt(r.returnNumber?.split('-').pop() || '0', 10))
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
};

// ─── BILLING MATH ─────────────────────────────────────────────────────────────
export const calcItemSubtotal = (item) =>
  Number(item.unitPrice) * Number(item.quantity);

export const calcItemTax = (item) => {
  const lineNet = calcItemSubtotal(item) - Number(item.discount || 0);
  return (Math.max(0, lineNet) * Number(item.taxPercent || 0)) / 100;
};

export const calcInvoiceTotals = (items, discountType, discountValue) => {
  const subtotal = items.reduce((s, it) => s + calcItemSubtotal(it), 0);
  const itemDiscounts = items.reduce((s, it) => s + Number(it.discount || 0), 0);

  const afterItemDiscounts = Math.max(0, subtotal - itemDiscounts);

  let invoiceDiscount = 0;
  if (discountType === 'percent') {
    invoiceDiscount = (afterItemDiscounts * Number(discountValue || 0)) / 100;
  } else {
    invoiceDiscount = Number(discountValue || 0);
  }
  invoiceDiscount = Math.min(invoiceDiscount, afterItemDiscounts);

  const discountAmount = itemDiscounts + invoiceDiscount;
  const taxableAmount  = Math.max(0, subtotal - discountAmount);

  const invDiscRatio = afterItemDiscounts > 0 ? invoiceDiscount / afterItemDiscounts : 0;
  const taxAmount = items.reduce((s, it) => {
    const lineNet  = Math.max(0, calcItemSubtotal(it) - Number(it.discount || 0));
    const lineAfterInvDisc = lineNet * (1 - invDiscRatio);
    return s + (lineAfterInvDisc * Number(it.taxPercent || 0)) / 100;
  }, 0);

  const grandTotal = Math.max(0, taxableAmount + taxAmount);
  return { subtotal, itemDiscounts, invoiceDiscount, discountAmount, taxableAmount, taxAmount, grandTotal };
};

// ─── PAYMENT / BALANCE ───────────────────────────────────────────────────────
export const calcBalance = (grandTotal, paidAmount) =>
  Math.max(0, Number(grandTotal || 0) - Number(paidAmount || 0));

export const derivePaymentStatus = (grandTotal, paidAmount) => {
  const paid  = Number(paidAmount || 0);
  const total = Number(grandTotal || 0);
  if (paid <= 0)      return 'unpaid';
  if (paid >= total)  return 'paid';
  return 'partial';
};

// ─── PURCHASE MATH ────────────────────────────────────────────────────────────
export const calcPurchaseTotals = (items) => {
  const subtotal = items.reduce(
    (s, it) => s + Number(it.unitCost || 0) * Number(it.quantity || 0), 0
  );
  return { subtotal, grandTotal: subtotal };
};

// ─── RETURN MATH ──────────────────────────────────────────────────────────────
export const calcSalesReturnTotals = (items) => {
  const total = items.reduce((s, it) => {
    const qty    = Number(it.returnQty || 0);
    const price  = Number(it.unitPrice || 0);
    const disc   = Number(it.discount || 0);
    const taxPct = Number(it.taxPercent || 0);
    const lineNet  = Math.max(0, price * qty - disc);
    const lineTax  = (lineNet * taxPct) / 100;
    return s + lineNet + lineTax;
  }, 0);
  return { total };
};

export const calcPurchaseReturnTotals = (items) => {
  const total = items.reduce(
    (s, it) => s + Number(it.returnQty || 0) * Number(it.unitCost || 0), 0
  );
  return { total };
};

// ─── STOCK HELPERS ────────────────────────────────────────────────────────────
export const isLowStock = (product) =>
  product.stock <= product.minStock;

export const getStockStatus = (product) => {
  if (product.stock === 0) return { label: 'Out of Stock', cls: 'badge-red' };
  if (isLowStock(product)) return { label: 'Low Stock', cls: 'badge-yellow' };
  return { label: 'In Stock', cls: 'badge-green' };
};

// ─── FILTER / SEARCH ──────────────────────────────────────────────────────────
export const searchFilter = (items, query, fields) => {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter((item) =>
    fields.some((f) => String(item[f] || '').toLowerCase().includes(q))
  );
};

export const paginate = (items, page, pageSize) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

// ─── REPORT HELPERS ───────────────────────────────────────────────────────────

// Timezone-aware date-range filter. Handles both ISO timestamps and YYYY-MM-DD strings.
export const filterByDateRange = (items, from, to, dateField = 'date') =>
  items.filter((item) => _isWithinLocalDateRange(item[dateField], from || null, to || null));

export const sumField = (items, field) =>
  items.reduce((s, it) => s + Number(it[field] || 0), 0);

export const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    const k = item[key] || 'unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});

// ─── VALIDATION ───────────────────────────────────────────────────────────────
export const required    = (val) => (String(val || '').trim() ? '' : 'This field is required');
export const minVal      = (val, min) => Number(val) >= min ? '' : `Must be at least ${min}`;
export const positiveNum = (val) => Number(val) > 0 ? '' : 'Must be greater than 0';

export const validateProduct = (data) => {
  const errors = {};
  if (!data.name?.trim())             errors.name         = 'Product name is required';
  if (!data.sku?.trim())              errors.sku          = 'SKU is required';
  if (!data.categoryId)               errors.categoryId   = 'Category is required';
  if (!data.unit?.trim())             errors.unit         = 'Unit is required';
  if (Number(data.purchasePrice) < 0) errors.purchasePrice = 'Must be ≥ 0';
  if (Number(data.sellingPrice) <= 0) errors.sellingPrice = 'Must be > 0';
  if (Number(data.stock) < 0)         errors.stock        = 'Cannot be negative';
  if (Number(data.minStock) < 0)      errors.minStock     = 'Cannot be negative';
  return errors;
};

export const validateCustomer = (data) => {
  const errors = {};
  if (!data.name?.trim())  errors.name  = 'Name is required';
  if (!data.email?.trim()) errors.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(data.email)) errors.email = 'Invalid email';
  return errors;
};

export const validateSupplier = (data) => {
  const errors = {};
  if (!data.name?.trim())  errors.name  = 'Name is required';
  if (!data.email?.trim()) errors.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(data.email)) errors.email = 'Invalid email';
  if (!data.phone?.trim()) errors.phone = 'Phone is required';
  return errors;
};

// Returns today's date as "YYYY-MM-DD" in the business timezone (Asia/Kolkata by default).
export const today = () => _getTodayLocalDate();
