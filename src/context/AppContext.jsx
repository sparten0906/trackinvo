/**
 * AppContext — single source of truth for all business data.
 *
 * Every stock-mutating action creates a matching stock transaction record.
 * Supabase write-through is attempted first; on SUPABASE_NOT_CONFIGURED the
 * action silently falls back to local state only.
 */
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  initialCategories, initialSuppliers, initialCustomers,
  initialProducts, initialInvoices, initialPurchases, initialSettings,
  initialSalesReturns, initialPurchaseReturns, initialStockTransactions,
  initialPurchaseOrders, initialPurchaseReceipts,
} from '../data/mockData';
import {
  generateId, generateInvoiceNumber, generateReturnNumber,
  calcBalance, derivePaymentStatus, setAppTimezone,
} from '../utils/helpers';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { productService }  from '../services/productService';
import { categoryService } from '../services/categoryService';
import { supplierService } from '../services/supplierService';
import { customerService } from '../services/customerService';
import { invoiceService }  from '../services/invoiceService';
import { purchaseService }      from '../services/purchaseService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { settingsService }      from '../services/settingsService';

const AppContext = createContext(null);
const LOCAL_KEY  = 'trackinvo_state';

// ─── localStorage persistence ─────────────────────────────────────────────────
function loadLocal() {
  try { const r = localStorage.getItem(LOCAL_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveLocal(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch {}
}

const saved = loadLocal();

// Prime the timezone from persisted settings immediately so formatters are correct before Supabase loads.
if (saved?.settings?.businessTimezone) {
  setAppTimezone(saved.settings.businessTimezone);
}

const initialState = {
  categories:         saved?.categories         ?? initialCategories,
  suppliers:          saved?.suppliers          ?? initialSuppliers,
  customers:          saved?.customers          ?? initialCustomers,
  products:           saved?.products           ?? initialProducts,
  invoices:           saved?.invoices           ?? initialInvoices,
  purchases:          saved?.purchases          ?? initialPurchases,
  salesReturns:       saved?.salesReturns       ?? initialSalesReturns,
  purchaseReturns:    saved?.purchaseReturns    ?? initialPurchaseReturns,
  stockTransactions:  saved?.stockTransactions  ?? initialStockTransactions,
  purchaseOrders:     saved?.purchaseOrders     ?? initialPurchaseOrders,
  purchaseReceipts:   saved?.purchaseReceipts   ?? initialPurchaseReceipts,
  settings:           saved?.settings           ?? initialSettings,
  damagedStockRecords:  saved?.damagedStockRecords  ?? [],
  supplierPayments:     saved?.supplierPayments     ?? [],
  supplierCredits:      saved?.supplierCredits      ?? [],
  generalPayables:      saved?.generalPayables      ?? [],
  payableCategories:    saved?.payableCategories    ?? [],
  supplierRatings:      saved?.supplierRatings      ?? [],
  productSupplierPrices: saved?.productSupplierPrices ?? [],
};

// ─── PO number helpers ────────────────────────────────────────────────────────
function genPONumber(existing) {
  const nums = existing.map(p => parseInt((p.poNumber || '').split('-').pop() || '0', 10)).filter(Boolean);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `PO-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}
function genGRNNumber(existing) {
  const nums = existing.map(r => parseInt((r.receiptNumber || '').split('-').pop() || '0', 10)).filter(Boolean);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `GRN-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}
function genGPNumber(existing) {
  const nums = existing.map(p => parseInt((p.gpNumber || '').split('-').pop() || '0', 10)).filter(Boolean);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `GP-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}
function genGPAYNumber(existing) {
  const gpays = (existing || []).filter(p => p.gpayNumber);
  const nums = gpays.map(p => parseInt((p.gpayNumber || '').split('-').pop() || '0', 10)).filter(n => !isNaN(n) && n > 0);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `GPAY-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

function genPayableNumber(existing) {
  const nums = (existing || []).map(p => parseInt((p.payableNumber || '').split('-').pop() || '0', 10)).filter(n => !isNaN(n) && n > 0);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `GPBL-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

// ─── Stock transaction helper (pure — no side effects) ────────────────────────
function makeStxRecord({ productId, productName, sku, type, refType, refId, refNumber, qtyIn = 0, qtyOut = 0, prevStock = 0, newStock = 0, nonSellableQtyIn = 0, nonSellableQtyOut = 0, note = '' }) {
  return {
    id: generateId('stx'),
    productId, productName, sku,
    transactionType: type,
    referenceType: refType,
    referenceId: refId,
    referenceNumber: refNumber,
    quantityIn: Number(qtyIn) || 0,
    quantityOut: Number(qtyOut) || 0,
    nonSellableQuantityIn: Number(nonSellableQtyIn) || 0,
    nonSellableQuantityOut: Number(nonSellableQtyOut) || 0,
    previousStock: Number(prevStock) || 0,
    newStock: Number(newStock) || 0,
    note: note || '',
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

// ─── Product-Supplier Price record upsert (pure) ─────────────────────────────
function updatePSPRecord(pspList, { productId, supplierId, price, qty, poId, gpId, date }) {
  const key = p => p.productId === productId && p.supplierId === supplierId;
  const existing = pspList.find(key);
  const prevQty = existing?.totalPurchasedQuantity || 0;
  const prevVal = existing?.totalPurchaseValue     || 0;
  const newQty  = prevQty + qty;
  const newVal  = prevVal + qty * price;
  const avgPrice = newQty > 0 ? Math.round(newVal / newQty * 100) / 100 : price;
  if (existing) {
    return pspList.map(p => key(p) ? {
      ...p,
      lastPurchasePrice:    price,
      averagePurchasePrice: avgPrice,
      lowestPurchasePrice:  Math.min(p.lowestPurchasePrice  ?? price, price),
      highestPurchasePrice: Math.max(p.highestPurchasePrice ?? price, price),
      lastPurchaseDate:     date,
      lastPurchaseOrderId:  poId || p.lastPurchaseOrderId,
      lastGeneralPurchaseId: gpId || p.lastGeneralPurchaseId,
      totalPurchasedQuantity: newQty,
      totalPurchaseValue:     Math.round(newVal * 100) / 100,
      updatedAt: date,
    } : p);
  }
  return [...pspList, {
    id: generateId('psp'),
    productId, supplierId,
    lastPurchasePrice:    price,
    averagePurchasePrice: avgPrice,
    lowestPurchasePrice:  price,
    highestPurchasePrice: price,
    lastPurchaseDate:     date,
    lastPurchaseOrderId:  poId  || null,
    lastGeneralPurchaseId: gpId || null,
    totalPurchasedQuantity: qty,
    totalPurchaseValue:     Math.round(qty * price * 100) / 100,
    isPreferred: false,
    createdAt: date,
    updatedAt: date,
  }];
}

function generateDamageNumber(records) {
  const nums = (records || [])
    .map(r => parseInt((r.damageNumber || '').split('-').pop() || '0', 10))
    .filter(n => !isNaN(n) && n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return 'DMG-' + String(next).padStart(4, '0');
}

function makeDamageRecord(data, allRecords) {
  return {
    id: generateId('dmg'),
    damageNumber: generateDamageNumber(allRecords),
    productId: data.productId || '',
    productName: data.productName || '',
    sku: data.sku || '',
    quantity: Number(data.quantity) || 0,
    damageType: data.damageType || 'other',
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId || null,
    sourceReferenceNo: data.sourceReferenceNo || '',
    customerId: data.customerId || null,
    supplierId: data.supplierId || null,
    invoiceId: data.invoiceId || null,
    salesReturnId: data.salesReturnId || null,
    purchaseOrderId: data.purchaseOrderId || null,
    purchaseId: data.purchaseId || null,
    purchaseReturnId: data.purchaseReturnId || null,
    reason: data.reason || '',
    notes: data.notes || '',
    status: 'open',
    reportedDate: data.reportedDate || new Date().toISOString().slice(0, 10),
    resolvedDate: null,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  let next = state;

  switch (action.type) {
    case 'SEED': next = { ...state, ...action.payload }; break;

    // CATEGORIES
    case 'ADD_CATEGORY':    next = { ...state, categories: [...state.categories, { ...action.payload, id: action.payload.id || generateId('cat'), createdAt: action.payload.createdAt || new Date().toISOString().slice(0,10) }] }; break;
    case 'UPDATE_CATEGORY': next = { ...state, categories: state.categories.map((c) => c.id === action.payload.id ? { ...c, ...action.payload } : c) }; break;
    case 'DELETE_CATEGORY': next = { ...state, categories: state.categories.filter((c) => c.id !== action.payload) }; break;

    // SUPPLIERS
    case 'ADD_SUPPLIER':    next = { ...state, suppliers: [...state.suppliers, { ...action.payload, id: action.payload.id || generateId('sup'), createdAt: action.payload.createdAt || new Date().toISOString().slice(0,10) }] }; break;
    case 'UPDATE_SUPPLIER': next = { ...state, suppliers: state.suppliers.map((s) => s.id === action.payload.id ? { ...s, ...action.payload } : s) }; break;
    case 'DELETE_SUPPLIER': next = { ...state, suppliers: state.suppliers.filter((s) => s.id !== action.payload) }; break;

    case 'ADD_SUPPLIER_RATING': {
      const rating = { id: generateId('srat'), ...action.payload, createdAt: action.payload.createdAt || new Date().toISOString().slice(0, 10) };
      next = { ...state, supplierRatings: [...state.supplierRatings, rating] };
      break;
    }

    case 'SET_PREFERRED_SUPPLIER': {
      const { productId, supplierId } = action.payload;
      next = {
        ...state,
        productSupplierPrices: state.productSupplierPrices.map(p =>
          p.productId === productId ? { ...p, isPreferred: p.supplierId === supplierId } : p
        ),
      };
      break;
    }

    // CUSTOMERS
    case 'ADD_CUSTOMER':    next = { ...state, customers: [...state.customers, { ...action.payload, id: action.payload.id || generateId('cust'), createdAt: action.payload.createdAt || new Date().toISOString().slice(0,10) }] }; break;
    case 'UPDATE_CUSTOMER': next = { ...state, customers: state.customers.map((c) => c.id === action.payload.id ? { ...c, ...action.payload } : c) }; break;
    case 'DELETE_CUSTOMER': next = { ...state, customers: state.customers.filter((c) => c.id !== action.payload) }; break;

    // PRODUCTS
    case 'ADD_PRODUCT':    next = { ...state, products: [...state.products, { ...action.payload, id: action.payload.id || generateId('prod'), createdAt: action.payload.createdAt || new Date().toISOString().slice(0,10) }] }; break;
    case 'UPDATE_PRODUCT': next = { ...state, products: state.products.map((p) => p.id === action.payload.id ? { ...p, ...action.payload } : p) }; break;
    case 'DELETE_PRODUCT': next = { ...state, products: state.products.filter((p) => p.id !== action.payload) }; break;

    case 'ADJUST_STOCK': {
      const { productId, delta, note, refType, refId, refNumber } = action.payload;
      const newTxs = [];
      const products = state.products.map((p) => {
        if (p.id !== productId) return p;
        const prevStock = p.stock;
        const newStock  = Math.max(0, prevStock + delta);
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: delta >= 0 ? 'MANUAL_ADJUSTMENT' : 'MANUAL_ADJUSTMENT',
          refType: refType || 'adjustment', refId: refId || '', refNumber: refNumber || '',
          qtyIn: delta > 0 ? delta : 0, qtyOut: delta < 0 ? Math.abs(delta) : 0,
          prevStock, newStock, note,
        }));
        return { ...p, stock: newStock };
      });
      next = { ...state, products, stockTransactions: [...state.stockTransactions, ...newTxs] };
      break;
    }

    case 'ADJUST_DAMAGED_STOCK': {
      const { productId, delta, txType, note } = action.payload;
      const newTxs = [];
      const products = state.products.map(p => {
        if (p.id !== productId) return p;
        const newDmg = Math.max(0, (p.damagedQty || 0) + delta);
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: txType || 'DAMAGED_WRITEOFF',
          refType: 'adjustment', refId: '', refNumber: '',
          nonSellableQtyIn:  delta > 0 ? delta : 0,
          nonSellableQtyOut: delta < 0 ? Math.abs(delta) : 0,
          prevStock: p.stock, newStock: p.stock, note: note || '',
        }));
        return { ...p, damagedQty: newDmg };
      });
      next = { ...state, products, stockTransactions: [...state.stockTransactions, ...newTxs] };
      break;
    }

    // INVOICES
    case 'ADD_INVOICE': {
      const data = action.payload;
      const inv = {
        ...data,
        id: data.id || generateId('inv'),
        invoiceNumber: data.invoiceNumber || generateInvoiceNumber(state.settings.invoicePrefix, state.invoices),
        createdAt: data.createdAt || new Date().toISOString(),
        returnStatus: data.returnStatus || 'none',
      };
      const newTxs = [];
      const products = state.products.map((p) => {
        const item = inv.items.find((i) => i.productId === p.id);
        if (!item) return p;
        const prevStock = p.stock;
        const newStock  = Math.max(0, prevStock - item.quantity);
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'SALE', refType: 'invoice', refId: inv.id, refNumber: inv.invoiceNumber,
          qtyIn: 0, qtyOut: item.quantity, prevStock, newStock,
          note: `Sold via ${inv.invoiceNumber}`,
        }));
        return { ...p, stock: newStock };
      });
      next = {
        ...state,
        invoices: [...state.invoices, inv],
        products,
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }
    case 'UPDATE_INVOICE': next = { ...state, invoices: state.invoices.map((i) => i.id === action.payload.id ? { ...i, ...action.payload } : i) }; break;
    case 'VOID_INVOICE': {
      const invId = action.payload;
      const inv = state.invoices.find(i => i.id === invId);
      if (!inv || inv.status === 'voided') { next = state; break; }
      const voidTxs = [];
      const voidProducts = state.products.map(p => {
        const item = (inv.items || []).find(i => i.productId === p.id);
        if (!item) return p;
        const prevStock = p.stock;
        const newStock  = prevStock + Number(item.quantity || 0);
        voidTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'INVOICE_VOID', refType: 'invoice', refId: inv.id, refNumber: inv.invoiceNumber,
          qtyIn: Number(item.quantity || 0), qtyOut: 0, prevStock, newStock,
          note: `Stock reversed — ${inv.invoiceNumber} voided`,
        }));
        return { ...p, stock: newStock };
      });
      next = {
        ...state,
        invoices: state.invoices.map(i => i.id === invId
          ? { ...i, status: 'voided', paymentStatus: 'voided', voidedAt: new Date().toISOString().slice(0, 10) }
          : i),
        products: voidProducts,
        stockTransactions: [...state.stockTransactions, ...voidTxs],
      };
      break;
    }

    // PURCHASES
    case 'ADD_PURCHASE': {
      const data = action.payload;
      const pur = {
        document_type: 'general_purchase',
        fulfillmentStatus: 'pending',
        ...data,
        id: data.id || generateId('pur'),
        gpNumber: data.gpNumber || genGPNumber(state.purchases),
        purchaseNumber: data.purchaseNumber || generateInvoiceNumber(state.settings.purchasePrefix, state.purchases),
        createdAt: data.createdAt || new Date().toISOString().slice(0, 10),
        returnStatus: data.returnStatus || 'none',
      };
      // fulfillmentStatus takes precedence over legacy status field for stock decisions
      const effStatus = pur.fulfillmentStatus ?? pur.status;
      const newTxs = [];
      const condAutoReturns = [];
      const condReasonMap = { damaged: 'Damaged during delivery', defective: 'Defective item received', rejected: 'Rejected during receiving' };

      // Stock added depends on fulfillmentStatus AND item condition; only accepted/good stock items add to stock
      const products = state.products.map((p) => {
        const item = pur.items.find((i) => i.productId === p.id && i.affects_stock !== false && i.itemType !== 'non_stock_item');
        if (!item) return p;
        const rawQtyIn = effStatus === 'received'
          ? Number(item.quantity)
          : effStatus === 'partial'
          ? Number(item.receivedQty || 0)
          : 0;
        if (rawQtyIn === 0) return p;
        // Bad-condition items go to purchase return, not stock
        const isBad = item.condition && item.condition !== 'good';
        if (isBad) return p;
        const prevStock = p.stock;
        const newStock  = prevStock + rawQtyIn;
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'PURCHASE', refType: 'purchase', refId: pur.id, refNumber: pur.gpNumber || pur.purchaseNumber,
          qtyIn: rawQtyIn, qtyOut: 0, prevStock, newStock,
          note: `${effStatus === 'partial' ? 'Partially received' : 'Received'} via ${pur.gpNumber || pur.purchaseNumber} (accepted)`,
        }));
        return { ...p, stock: newStock };
      });

      // Auto-create purchase returns for bad-condition stock items only
      pur.items.forEach(item => {
        if (item.affects_stock === false || item.itemType === 'non_stock_item') return;
        if (!item.condition || item.condition === 'good') return;
        const rawQtyIn = effStatus === 'received' ? Number(item.quantity) : effStatus === 'partial' ? Number(item.receivedQty || 0) : 0;
        if (!rawQtyIn) return;
        condAutoReturns.push({
          id:           generateId('pret'),
          returnNumber: generateReturnNumber(state.settings?.purReturnPrefix || 'PRR', [...state.purchaseReturns, ...condAutoReturns]),
          supplierId:   pur.supplierId, supplierName: pur.supplierName,
          purchaseId: pur.id, purchaseNumber: pur.purchaseNumber,
          source: 'receiving_rejection', returnType: 'Receiving Rejection',
          reason: condReasonMap[item.condition] || 'Rejected item',
          condition: item.condition,
          date: pur.date || new Date().toISOString().slice(0, 10),
          status: 'pending',
          items: [{ productId: item.productId, productName: item.productName, sku: item.sku || '', returnQty: rawQtyIn, unitCost: item.unitCost || 0, condition: item.condition }],
          totalAmount: (item.unitCost || 0) * rawQtyIn,
          createdAt: new Date().toISOString().slice(0, 10),
        });
      });

      next = {
        ...state,
        purchases: [...state.purchases, pur],
        purchaseReturns: condAutoReturns.length ? [...state.purchaseReturns, ...condAutoReturns] : state.purchaseReturns,
        products,
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }
    case 'UPDATE_PURCHASE': {
      const upd = action.payload;
      const prev = state.purchases.find(p => p.id === upd.id);
      if (!prev) { next = { ...state, purchases: state.purchases.map(p => p.id === upd.id ? { ...p, ...upd } : p) }; break; }
      // Compute stock delta: new stocked qty - previously stocked qty per item
      const newTxs = [];
      const products = state.products.map(p => {
        const newItem  = (upd.items || prev.items || []).find(i => i.productId === p.id);
        const prevItem = (prev.items || []).find(i => i.productId === p.id);
        if (!newItem) return p;
        const prevStatus  = prev.fulfillmentStatus ?? prev.status;
        const updStatus   = upd.fulfillmentStatus  ?? upd.status;
        const prevStocked = prevStatus === 'received'
          ? Number(prevItem?.quantity || 0)
          : prevStatus === 'partial'
          ? Number(prevItem?.receivedQty || 0)
          : 0;
        const newStocked  = updStatus === 'received'
          ? Number(newItem.quantity)
          : updStatus === 'partial'
          ? Number(newItem.receivedQty || 0)
          : 0;
        const delta = newStocked - prevStocked;
        if (delta === 0) return p;
        const prevStock = p.stock;
        const newStock  = Math.max(0, prevStock + delta);
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'PURCHASE', refType: 'purchase', refId: prev.id, refNumber: prev.purchaseNumber,
          qtyIn: delta > 0 ? delta : 0, qtyOut: delta < 0 ? Math.abs(delta) : 0,
          prevStock, newStock,
          note: `Stock adjusted on status update of ${prev.purchaseNumber}`,
        }));
        return { ...p, stock: newStock };
      });
      next = {
        ...state,
        purchases: state.purchases.map(p => p.id === upd.id ? { ...p, ...upd } : p),
        products,
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }
    case 'VOID_PURCHASE': {
      const purId = action.payload;
      const pur = state.purchases.find(p => p.id === purId);
      if (!pur || pur.fulfillmentStatus === 'voided') { next = state; break; }
      const effSt = pur.fulfillmentStatus ?? pur.status;
      const purVoidTxs = [];
      const purVoidProducts = (effSt === 'received' || effSt === 'partial' || effSt === 'fully_received' || effSt === 'partially_received')
        ? state.products.map(p => {
            const item = (pur.items || []).find(i => i.productId === p.id);
            if (!item) return p;
            const stockedQty = (effSt === 'received' || effSt === 'fully_received')
              ? Number(item.quantity || 0)
              : Number(item.receivedQty || item.acceptedQty || 0);
            if (!stockedQty) return p;
            const prevStock = p.stock;
            const newStock  = Math.max(0, prevStock - stockedQty);
            purVoidTxs.push(makeStxRecord({
              productId: p.id, productName: p.name, sku: p.sku,
              type: 'PURCHASE_VOID', refType: 'purchase', refId: pur.id,
              refNumber: pur.gpNumber || pur.purchaseNumber,
              qtyIn: 0, qtyOut: stockedQty, prevStock, newStock,
              note: `Stock reversed — ${pur.gpNumber || pur.purchaseNumber} voided`,
            }));
            return { ...p, stock: newStock };
          })
        : state.products;
      next = {
        ...state,
        purchases: state.purchases.map(p => p.id === purId
          ? { ...p, fulfillmentStatus: 'voided', voidedAt: new Date().toISOString().slice(0, 10) }
          : p),
        products: purVoidProducts,
        stockTransactions: purVoidTxs.length ? [...state.stockTransactions, ...purVoidTxs] : state.stockTransactions,
      };
      break;
    }

    // SALES RETURNS
    case 'ADD_SALES_RETURN': {
      const ret = {
        ...action.payload,
        id: action.payload.id || generateId('sret'),
        returnNumber: action.payload.returnNumber || generateReturnNumber(
          state.settings.returnPrefix || 'RET', state.salesReturns
        ),
        createdAt: action.payload.createdAt || new Date().toISOString().slice(0, 10),
      };
      // Restore stock for returned items — route by condition (good→sellable, damaged→damagedQty)
      const newTxs = [];
      const newDamageRecords = [];
      const products = state.products.map((p) => {
        const item = ret.items.find((i) => i.productId === p.id);
        if (!item || !item.returnQty) return p;
        const returnQty = Number(item.returnQty);
        const isGood = !item.condition || item.condition === 'good';
        if (isGood) {
          const prevStock = p.stock;
          const newStock  = prevStock + returnQty;
          newTxs.push(makeStxRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            type: 'SALE_RETURN', refType: 'sales_return', refId: ret.id, refNumber: ret.returnNumber,
            qtyIn: returnQty, qtyOut: 0, prevStock, newStock,
            note: `Return via ${ret.returnNumber} (${ret.reason})`,
          }));
          return { ...p, stock: newStock };
        } else {
          // Damaged/defective/used return — do NOT add to sellable stock
          const damagedQty = (p.damagedQty || 0) + returnQty;
          const dmgRec = makeDamageRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            quantity: returnQty,
            damageType: item.condition === 'defective' ? 'defective' : 'customer_return',
            sourceType: 'sales_return', sourceId: ret.id, sourceReferenceNo: ret.returnNumber,
            customerId: ret.customerId, invoiceId: ret.invoiceId, salesReturnId: ret.id,
            reason: item.condition, notes: ret.notes,
            reportedDate: ret.date || ret.createdAt,
          }, [...state.damagedStockRecords, ...newDamageRecords]);
          newDamageRecords.push(dmgRec);
          newTxs.push(makeStxRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            type: 'SALES_RETURN_DAMAGED', refType: 'sales_return', refId: ret.id, refNumber: ret.returnNumber,
            qtyIn: 0, qtyOut: 0, prevStock: p.stock, newStock: p.stock,
            nonSellableQtyIn: returnQty,
            note: `Damaged return via ${ret.returnNumber} (${item.condition})`,
          }));
          return { ...p, damagedQty };
        }
      });
      // Update parent invoice return_status
      const returnedQtyMap = {};
      ret.items.forEach((i) => { returnedQtyMap[i.productId] = (returnedQtyMap[i.productId] || 0) + Number(i.returnQty); });
      const invoices = state.invoices.map((inv) => {
        if (inv.id !== ret.invoiceId) return inv;
        // Count total returned qty across all returns for this invoice
        const allReturns = [...state.salesReturns, ret];
        const totalReturnedByProduct = {};
        allReturns.filter((r) => r.invoiceId === inv.id).forEach((r) => {
          r.items.forEach((i) => { totalReturnedByProduct[i.productId] = (totalReturnedByProduct[i.productId] || 0) + Number(i.returnQty); });
        });
        const fullyReturned = inv.items.every((it) => (totalReturnedByProduct[it.productId] || 0) >= it.quantity);
        const anyReturned   = inv.items.some((it) => (totalReturnedByProduct[it.productId] || 0) > 0);
        const returnStatus  = fullyReturned ? 'full' : anyReturned ? 'partial' : 'none';
        return { ...inv, returnStatus };
      });
      next = {
        ...state,
        salesReturns: [...state.salesReturns, ret],
        invoices,
        products,
        stockTransactions: [...state.stockTransactions, ...newTxs],
        damagedStockRecords: [...(state.damagedStockRecords || []), ...newDamageRecords],
      };
      break;
    }

    // PURCHASE RETURNS
    case 'ADD_PURCHASE_RETURN': {
      const ret = {
        ...action.payload,
        id: action.payload.id || generateId('pret'),
        returnNumber: action.payload.returnNumber || generateReturnNumber(
          state.settings.purReturnPrefix || 'PRR', state.purchaseReturns
        ),
        createdAt: action.payload.createdAt || new Date().toISOString().slice(0, 10),
        status: action.payload.status || 'pending',
      };

      // Auto-created returns (PO receiving_rejection or GP general_purchase_receiving) never had
      // items enter sellable stock, so we must NOT reduce stock for them.
      const isAutoReturn = ret.source === 'receiving_rejection'
        || ret.source_type === 'general_purchase_receiving';

      const newTxs = [];
      const products = isAutoReturn ? state.products : state.products.map((p) => {
        const item = ret.items.find((i) => i.productId === p.id);
        if (!item || !item.returnQty) return p;
        const prevStock = p.stock;
        const newStock  = Math.max(0, prevStock - Number(item.returnQty));
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'PURCHASE_RETURN', refType: 'purchase_return', refId: ret.id, refNumber: ret.returnNumber,
          qtyIn: 0, qtyOut: Number(item.returnQty), prevStock, newStock,
          note: `Returned to supplier via ${ret.returnNumber}`,
        }));
        return { ...p, stock: newStock };
      });

      // Update parent purchase return_status (only for direct purchase returns)
      const purchases = state.purchases.map((pur) => {
        if (pur.id !== ret.purchaseId) return pur;
        const allReturns = [...state.purchaseReturns, ret];
        const totalReturnedByProduct = {};
        allReturns.filter((r) => r.purchaseId === pur.id).forEach((r) => {
          r.items.forEach((i) => { totalReturnedByProduct[i.productId] = (totalReturnedByProduct[i.productId] || 0) + Number(i.returnQty); });
        });
        const fullyReturned = pur.items.every((it) => (totalReturnedByProduct[it.productId] || 0) >= it.quantity);
        const anyReturned   = pur.items.some((it) => (totalReturnedByProduct[it.productId] || 0) > 0);
        const returnStatus  = fullyReturned ? 'full' : anyReturned ? 'partial' : 'none';
        return { ...pur, returnStatus };
      });

      next = {
        ...state,
        purchaseReturns: [...state.purchaseReturns, ret],
        purchases,
        products,
        stockTransactions: isAutoReturn ? state.stockTransactions : [...state.stockTransactions, ...newTxs],
      };
      break;
    }

    // Update a purchase return (status, notes, reason, qty).
    // Special case: "rejected_by_supplier" → create damage records + update damagedQty (once only).
    case 'UPDATE_PURCHASE_RETURN': {
      const { id, updates } = action.payload;
      const existing = state.purchaseReturns.find(r => r.id === id);

      const applyUpdate = (extra = {}) => {
        const purchaseReturns = state.purchaseReturns.map(r =>
          r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString().slice(0, 10) } : r
        );
        return { ...state, purchaseReturns, ...extra };
      };

      // True for returns that originated from a Damaged Stock record
      const isDamagedStockReturn = existing?.source_type === 'damaged_stock' && !!existing?.damagedStockId;

      // When supplier rejects a return the goods come back to us as damaged stock.
      // Guard: only runs on first transition to rejected_by_supplier (never on re-save).
      const isNewRejection = updates.status === 'rejected_by_supplier'
        && existing?.status !== 'rejected_by_supplier'
        && !(state.damagedStockRecords || []).some(r => r.purchaseReturnId === id && r.status === 'returned_rejected');

      // When supplier accepts a no-replacement return sourced from damaged stock → close damage record
      const isAcceptedNoReplacement = updates.status === 'accepted_by_supplier'
        && existing?.status !== 'accepted_by_supplier'
        && isDamagedStockReturn
        && !existing?.replacementRequired;

      if (isNewRejection && existing && isDamagedStockReturn) {
        // Goods came back rejected — restore damagedQty, update existing damage record (don't create a new one)
        const newTxs = [];
        const products = state.products.map(p => {
          const item = (existing.items || []).find(i => i.productId === p.id);
          if (!item || !Number(item.returnQty)) return p;
          const qty = Number(item.returnQty);
          newTxs.push(makeStxRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            type: 'PURCHASE_RETURN_REJECTED',
            refType: 'purchase_return', refId: id, refNumber: existing.returnNumber || '',
            qtyIn: 0, qtyOut: 0, prevStock: p.stock, newStock: p.stock,
            nonSellableQtyIn: qty,
            note: `Supplier rejected return ${existing.returnNumber || ''} — goods back in damaged stock`,
          }));
          return { ...p, damagedQty: (p.damagedQty || 0) + qty };
        });
        next = applyUpdate({
          products,
          damagedStockRecords: (state.damagedStockRecords || []).map(r =>
            r.id === existing.damagedStockId
              ? { ...r, status: 'returned_rejected', updatedAt: new Date().toISOString().slice(0, 10) }
              : r
          ),
          stockTransactions: [...state.stockTransactions, ...newTxs],
        });
      } else if (isNewRejection && existing) {
        const newDamageRecords = [];
        const newTxs = [];
        const products = state.products.map(p => {
          const item = (existing.items || []).find(i => i.productId === p.id);
          if (!item || !Number(item.returnQty)) return p;
          const qty = Number(item.returnQty);
          const dmgRec = makeDamageRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            quantity: qty,
            damageType: 'supplier_rejected_return',
            sourceType: 'purchase_return_rejected',
            sourceId: id, sourceReferenceNo: existing.returnNumber || '',
            supplierId: existing.supplierId || null,
            purchaseOrderId: existing.purchaseOrderId || null,
            purchaseId: existing.purchaseId || null,
            purchaseReturnId: id,
            reason: 'Supplier rejected purchase return',
            notes: updates.notes || existing.notes || '',
            reportedDate: new Date().toISOString().slice(0, 10),
          }, [...(state.damagedStockRecords || []), ...newDamageRecords]);
          newDamageRecords.push(dmgRec);
          newTxs.push(makeStxRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            type: 'PURCHASE_RETURN_REJECTED',
            refType: 'purchase_return', refId: id, refNumber: existing.returnNumber || '',
            qtyIn: 0, qtyOut: 0, prevStock: p.stock, newStock: p.stock,
            nonSellableQtyIn: qty,
            note: `Supplier rejected return ${existing.returnNumber || ''} — moved to damaged stock`,
          }));
          return { ...p, damagedQty: (p.damagedQty || 0) + qty };
        });
        next = applyUpdate({
          products,
          damagedStockRecords: [...(state.damagedStockRecords || []), ...newDamageRecords],
          stockTransactions: [...state.stockTransactions, ...newTxs],
        });
      } else if (isAcceptedNoReplacement) {
        next = applyUpdate({
          damagedStockRecords: (state.damagedStockRecords || []).map(r =>
            r.id === existing.damagedStockId
              ? { ...r, status: 'closed', resolvedDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) }
              : r
          ),
        });
      } else {
        next = applyUpdate();
      }
      break;
    }

    // Update a sales return (reason, refundMode, notes, date) — never modifies stock
    case 'UPDATE_SALES_RETURN': {
      const { id, updates } = action.payload;
      const salesReturns = state.salesReturns.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString().slice(0, 10) } : r
      );
      next = { ...state, salesReturns };
      break;
    }

    // Mark existing sellable stock as damaged — moves qty from stock to damagedQty
    case 'MARK_DAMAGED_STOCK': {
      const { productId, quantity, damageType, reason, notes: dmgNotes, date: dmgDate } = action.payload;
      const product = state.products.find(p => p.id === productId);
      if (!product || Number(quantity) <= 0) { next = state; break; }
      const qty = Number(quantity);
      const prevStock = product.stock;
      const newStock = Math.max(0, prevStock - qty);
      const newDamagedQty = (product.damagedQty || 0) + qty;
      const dmgRec = makeDamageRecord({
        productId, productName: product.name, sku: product.sku,
        quantity: qty, damageType: damageType || 'warehouse_damage',
        sourceType: 'manual', reason: reason || '', notes: dmgNotes || '',
        reportedDate: dmgDate || new Date().toISOString().slice(0, 10),
      }, state.damagedStockRecords || []);
      const txn = makeStxRecord({
        productId, productName: product.name, sku: product.sku,
        type: 'DAMAGED_STOCK', refType: 'damaged_stock_record',
        refId: dmgRec.id, refNumber: dmgRec.damageNumber,
        qtyIn: 0, qtyOut: qty, prevStock, newStock,
        nonSellableQtyIn: qty,
        note: `Moved to damaged stock: ${reason || damageType || ''}`,
      });
      next = {
        ...state,
        products: state.products.map(p =>
          p.id === productId ? { ...p, stock: newStock, damagedQty: newDamagedQty } : p
        ),
        damagedStockRecords: [...(state.damagedStockRecords || []), dmgRec],
        stockTransactions: [...state.stockTransactions, txn],
      };
      break;
    }

    // Resolve damaged stock record — repair/write-off/dispose/return to supplier/cancel
    case 'RESOLVE_DAMAGED_STOCK': {
      const { recordId, resolution, quantity: resolveQty, notes: resNotes } = action.payload;
      const record = (state.damagedStockRecords || []).find(r => r.id === recordId);
      if (!record) { next = state; break; }
      const qty = Number(resolveQty) || record.quantity;
      const product = state.products.find(p => p.id === record.productId);
      const newTxs = [];
      let newProducts = state.products;
      const TYPE_MAP = {
        repaired: 'DAMAGED_REPAIRED',
        written_off: 'DAMAGED_WRITEOFF',
        disposed: 'DAMAGED_DISPOSED',
        returned_to_supplier: 'DAMAGED_RETURN_TO_SUPPLIER',
      };
      if (product && resolution !== 'cancelled') {
        const newDamagedQty = Math.max(0, (product.damagedQty || 0) - qty);
        let newStock = product.stock;
        let txnQtyIn = 0;
        if (resolution === 'repaired') { newStock = product.stock + qty; txnQtyIn = qty; }
        newProducts = state.products.map(p =>
          p.id === record.productId ? { ...p, stock: newStock, damagedQty: newDamagedQty } : p
        );
        if (TYPE_MAP[resolution]) {
          newTxs.push(makeStxRecord({
            productId: record.productId, productName: record.productName, sku: record.sku,
            type: TYPE_MAP[resolution], refType: 'damaged_stock_record',
            refId: recordId, refNumber: record.damageNumber,
            qtyIn: txnQtyIn, qtyOut: 0, prevStock: product.stock, newStock,
            nonSellableQtyOut: qty,
            note: `${resolution}: ${resNotes || ''}`,
          }));
        }
      }
      const statusMap = { repaired: 'repaired', written_off: 'written_off', disposed: 'disposed', returned_to_supplier: 'returned_to_supplier', cancelled: 'cancelled' };
      next = {
        ...state,
        products: newProducts,
        damagedStockRecords: (state.damagedStockRecords || []).map(r =>
          r.id === recordId ? { ...r, status: statusMap[resolution] || 'open', resolvedDate: new Date().toISOString().slice(0, 10), notes: resNotes || r.notes, updatedAt: new Date().toISOString().slice(0, 10) } : r
        ),
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }

    // Creates a linked Purchase Return + reduces damagedQty atomically.
    // Called when a damage record is resolved with 'returned_to_supplier'.
    // CRITICAL: Does NOT touch sellable stock — the product was already removed when damaged.
    case 'RETURN_DAMAGED_TO_SUPPLIER': {
      const { recordId, quantity: retQty, notes: retNotes, supplierId, supplierName, returnReason } = action.payload;
      const record = (state.damagedStockRecords || []).find(r => r.id === recordId);
      if (!record) { next = state; break; }
      const qty = Number(retQty) || record.quantity;
      const product = state.products.find(p => p.id === record.productId);
      const newPRId = generateId('pret');
      const unitCost = product?.lastPurchasePrice || product?.costPrice || 0;
      const newPR = {
        id: newPRId,
        returnNumber: generateReturnNumber(state.settings?.purReturnPrefix || 'PRR', state.purchaseReturns),
        supplierId: supplierId || record.supplierId || '',
        supplierName: supplierName || '',
        source: 'damaged_stock_return',
        source_type: 'damaged_stock',
        damagedStockId: recordId,
        damagedStockNumber: record.damageNumber,
        purchaseId: record.purchaseId || null,
        purchaseNumber: record.sourceReferenceNo || '',
        purchaseOrderId: record.purchaseOrderId || null,
        reason: returnReason || record.reason || 'damaged',
        condition: record.damageType || 'damaged',
        replacementRequired: true,
        pendingReplacementQty: qty,
        date: new Date().toISOString().slice(0, 10),
        status: 'pending_return',
        items: [{
          productId: record.productId,
          productName: record.productName,
          sku: record.sku || '',
          returnQty: qty,
          unitCost,
          condition: record.damageType || 'damaged',
          reason: record.reason || '',
        }],
        totalAmount: qty * unitCost,
        notes: retNotes || record.notes || '',
        isAutoReturn: true,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      const newDamagedQty = product ? Math.max(0, (product.damagedQty || 0) - qty) : 0;
      const txn = makeStxRecord({
        productId: record.productId, productName: record.productName, sku: record.sku || '',
        type: 'DAMAGED_RETURN_TO_SUPPLIER',
        refType: 'damaged_stock_record', refId: recordId, refNumber: record.damageNumber,
        qtyIn: 0, qtyOut: 0, prevStock: product?.stock || 0, newStock: product?.stock || 0,
        nonSellableQtyOut: qty,
        note: `Returned to supplier (${supplierName || supplierId || ''}): ${retNotes || ''}`,
      });
      next = {
        ...state,
        products: product ? state.products.map(p => p.id === record.productId ? { ...p, damagedQty: newDamagedQty } : p) : state.products,
        damagedStockRecords: (state.damagedStockRecords || []).map(r =>
          r.id === recordId ? { ...r, status: 'replacement_pending', purchaseReturnId: newPRId, resolvedDate: new Date().toISOString().slice(0, 10), notes: retNotes || r.notes, updatedAt: new Date().toISOString().slice(0, 10) } : r
        ),
        purchaseReturns: [...state.purchaseReturns, newPR],
        stockTransactions: [...state.stockTransactions, txn],
      };
      break;
    }

    // RECORD PAYMENT (on invoice)
    case 'RECORD_PAYMENT': {
      const { invoiceId, payment } = action.payload;
      const invoices = state.invoices.map(inv => {
        if (inv.id !== invoiceId) return inv;
        const payments = [...(inv.payments || []), { ...payment, id: generateId('pmt') }];
        const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
        const balanceAmount = Math.max(0, (inv.grandTotal || 0) - paidAmount);
        const paymentStatus = balanceAmount < 0.01 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
        return { ...inv, payments, paidAmount, balanceAmount, paymentStatus };
      });
      next = { ...state, invoices };
      break;
    }

    // PURCHASE ORDERS — NO stock on create/send/approve/cancel/reject/close
    case 'ADD_PURCHASE_ORDER': {
      const po = {
        ...action.payload,
        id:        action.payload.id       || generateId('po'),
        poNumber:  action.payload.poNumber || genPONumber(state.purchaseOrders),
        status:    action.payload.status   || 'created',
        timeline: [{ status: 'created', date: new Date().toISOString().slice(0, 10), note: 'Purchase order created' }, ...(action.payload.timeline || [])],
        createdAt: action.payload.createdAt || new Date().toISOString().slice(0, 10),
      };
      next = { ...state, purchaseOrders: [...state.purchaseOrders, po] };
      break;
    }

    case 'UPDATE_PO_STATUS': {
      const { id, status, note } = action.payload;
      const purchaseOrders = state.purchaseOrders.map(po => {
        if (po.id !== id) return po;
        const entry = { status, date: new Date().toISOString().slice(0, 10), note: note || status };
        return { ...po, status, timeline: [...(po.timeline || []), entry] };
      });
      next = { ...state, purchaseOrders };
      break;
    }

    // RECEIVE_PO_ITEMS — stock ONLY for accepted (good) + extra-accepted qty
    // STATUS: completion = accepted + rejected (damaged/defective keep PO pending until replacement arrives)
    case 'RECEIVE_PO_ITEMS': {
      const { poId, receiptItems, notes: rcvNotes, receiptDate } = action.payload;
      const po = state.purchaseOrders.find(p => p.id === poId);
      if (!po) { next = state; break; }

      const rcvDate = receiptDate || new Date().toISOString().slice(0, 10);
      const receipt = {
        id:            generateId('gr'),
        receiptNumber: genGRNNumber(state.purchaseReceipts),
        poId, poNumber: po.poNumber,
        supplierId:    po.supplierId, supplierName: po.supplierName,
        receiptDate:   rcvDate, notes: rcvNotes || '',
        items:         receiptItems,
        createdAt:     new Date().toISOString().slice(0, 10),
      };

      // Update PO items — regular + extra quantity tracking
      const updatedItems = po.items.map(item => {
        const r = receiptItems.find(ri => ri.poItemId === item.id);
        if (!r) return item;
        const regTotal   = Number(r.acceptedQty||0) + Number(r.damagedQty||0) + Number(r.defectiveQty||0) + Number(r.rejectedQty||0);
        const extraTotal = Number(r.extraAcceptedQty||0) + Number(r.extraDamagedQty||0) + Number(r.extraDefectiveQty||0) + Number(r.extraRejectedQty||0);
        return {
          ...item,
          receivedQty:            (item.receivedQty           || 0) + regTotal + extraTotal,
          acceptedQty:            (item.acceptedQty           || 0) + Number(r.acceptedQty           || 0),
          damagedQty:             (item.damagedQty            || 0) + Number(r.damagedQty            || 0),
          defectiveQty:           (item.defectiveQty          || 0) + Number(r.defectiveQty          || 0),
          rejectedQty:            (item.rejectedQty           || 0) + Number(r.rejectedQty           || 0),
          // pendingReplacementQty grows with each damaged/defective batch; decreases when replacement arrives
          pendingReplacementQty:  (item.pendingReplacementQty || 0) + Number(r.damagedQty || 0) + Number(r.defectiveQty || 0),
          extraAcceptedQty:       (item.extraAcceptedQty      || 0) + Number(r.extraAcceptedQty      || 0),
          extraDamagedQty:        (item.extraDamagedQty       || 0) + Number(r.extraDamagedQty       || 0),
          extraDefectiveQty:      (item.extraDefectiveQty     || 0) + Number(r.extraDefectiveQty     || 0),
          extraRejectedQty:       (item.extraRejectedQty      || 0) + Number(r.extraRejectedQty      || 0),
        };
      });

      // Status: completion_qty = accepted + rejected; must also have no pending replacements
      const allDone    = updatedItems.every(it => ((it.acceptedQty||0) + (it.rejectedQty||0)) >= it.quantity && (it.pendingReplacementQty||0) === 0);
      const anyProgress = updatedItems.some(it  => (it.acceptedQty||0) + (it.damagedQty||0) + (it.defectiveQty||0) + (it.rejectedQty||0) > 0);
      const newStatus  = allDone ? 'fully_received' : anyProgress ? 'partially_received' : po.status;

      // Stock transactions — accepted + extraAccepted only
      const newTxs = [];
      const products = state.products.map(p => {
        const r = receiptItems.find(ri => ri.productId === p.id);
        if (!r) return p;
        const goodQty = Number(r.acceptedQty || 0) + Number(r.extraAcceptedQty || 0);
        if (!goodQty) return p;
        const prevStock = p.stock;
        const newStock  = prevStock + goodQty;
        const unitCost  = Number(r.unitCost || 0);
        // Weighted average purchase cost
        const existingAvg = Number(p.averagePurchaseCost || p.costPrice || p.purchasePrice || 0);
        const newAvgCost = prevStock > 0 && existingAvg > 0
          ? (prevStock * existingAvg + goodQty * unitCost) / newStock
          : unitCost;
        const extraNote = Number(r.extraAcceptedQty) > 0 ? ` (incl. ${r.extraAcceptedQty} extra)` : '';
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'PURCHASE_RECEIVE', refType: 'purchase_receipt',
          refId: receipt.id, refNumber: receipt.receiptNumber,
          qtyIn: goodQty, qtyOut: 0, prevStock, newStock,
          note: `GRN ${receipt.receiptNumber} — ${goodQty} accepted from PO ${po.poNumber}${extraNote}`,
        }));
        return {
          ...p,
          stock: newStock,
          lastPurchasePrice:   unitCost,
          averagePurchaseCost: Math.round(newAvgCost * 100) / 100,
          lastSupplierId:      po.supplierId || null,
          lastPurchasedAt:     rcvDate,
        };
      });

      // Auto-create purchase returns for all bad items (regular + extra)
      const autoReturns = [];
      const COND_META = {
        damaged:   { reason: 'Damaged during delivery',              replacementRequired: true,  retStatus: 'pending_replacement' },
        defective: { reason: 'Defective item received',              replacementRequired: true,  retStatus: 'pending_replacement' },
        rejected:  { reason: 'Rejected during receiving inspection', replacementRequired: false, retStatus: 'pending_return'      },
      };

      receiptItems.forEach(r => {
        const buildReturn = (qty, cond, isExtra) => {
          if (!qty) return;
          const { reason, replacementRequired, retStatus } = COND_META[cond];
          autoReturns.push({
            id:                    generateId('pret'),
            returnNumber:          generateReturnNumber(state.settings?.purReturnPrefix || 'PRR', [...state.purchaseReturns, ...autoReturns]),
            supplierId:            po.supplierId,
            supplierName:          po.supplierName,
            purchaseOrderId:       poId,
            purchaseOrderItemId:   r.poItemId,      // ← top-level for INSPECT_REPLACEMENT lookup
            purchaseOrderNumber:   po.poNumber,
            productId:             r.productId,      // ← top-level for stock update lookup
            purchaseReceiptId:     receipt.id,
            purchaseReceiptNumber: receipt.receiptNumber,
            source:                'receiving_rejection',
            source_type:           'purchase_order_receiving',
            returnType:            isExtra ? 'Extra Quantity Return' : 'Receiving Rejection',
            reason:                isExtra ? `${reason} (extra quantity — supplier sent more than ordered)` : reason,
            condition:             cond,
            conditionType:         cond,
            isExtraQuantity:       isExtra,
            replacementRequired,
            pendingReplacementQty: replacementRequired ? qty : 0,
            date:                  rcvDate,
            status:                retStatus,
            items: [{
              productId:      r.productId,
              productName:    r.productName,
              sku:            r.sku || '',
              returnQty:      qty,
              unitCost:       r.unitCost || 0,
              condition:      cond,
              poItemId:       r.poItemId,
              isExtraQuantity: isExtra,
            }],
            totalAmount: (r.unitCost || 0) * qty,
            createdAt:   new Date().toISOString().slice(0, 10),
          });
        };

        buildReturn(Number(r.damagedQty        || 0), 'damaged',   false);
        buildReturn(Number(r.defectiveQty       || 0), 'defective', false);
        buildReturn(Number(r.rejectedQty        || 0), 'rejected',  false);
        buildReturn(Number(r.extraDamagedQty    || 0), 'damaged',   true);
        buildReturn(Number(r.extraDefectiveQty  || 0), 'defective', true);
        buildReturn(Number(r.extraRejectedQty   || 0), 'rejected',  true);
      });

      const totalAccepted = receiptItems.reduce((s, r) => s + Number(r.acceptedQty||0) + Number(r.extraAcceptedQty||0), 0);
      const totalBad      = receiptItems.reduce((s, r) => s + Number(r.damagedQty||0) + Number(r.defectiveQty||0) + Number(r.rejectedQty||0) + Number(r.extraDamagedQty||0) + Number(r.extraDefectiveQty||0) + Number(r.extraRejectedQty||0), 0);
      const tlNote   = `${receipt.receiptNumber}: ${totalAccepted} accepted to stock${totalBad ? `, ${totalBad} returned/rejected` : ''}`;
      const tlEntry  = { status: newStatus, date: rcvDate, note: tlNote };
      const updatedPO = { ...po, items: updatedItems, status: newStatus, timeline: [...(po.timeline || []), tlEntry] };

      // Update product-supplier pricing records for every accepted item
      let updatedPSP = state.productSupplierPrices;
      receiptItems.forEach(r => {
        const accepted = Number(r.acceptedQty || 0) + Number(r.extraAcceptedQty || 0);
        if (!accepted || !r.productId || !po.supplierId) return;
        updatedPSP = updatePSPRecord(updatedPSP, {
          productId: r.productId, supplierId: po.supplierId,
          price: Number(r.unitCost || 0), qty: accepted,
          poId: poId, gpId: null, date: rcvDate,
        });
      });

      next = {
        ...state,
        purchaseOrders:    state.purchaseOrders.map(p => p.id === poId ? updatedPO : p),
        purchaseReceipts:  [...state.purchaseReceipts, receipt],
        purchaseReturns:   autoReturns.length ? [...state.purchaseReturns, ...autoReturns] : state.purchaseReturns,
        products,
        productSupplierPrices: updatedPSP,
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }

    // RECEIVE_REPLACEMENT — stock IN for replacement good items from supplier
    // Updates purchase return status + PO completion status
    case 'RECEIVE_REPLACEMENT': {
      const { poId, replacements, receiptDate, notes: replNotes } = action.payload;
      // replacements: [{ returnId, poItemId, productId, productName, sku, unitCost, replacedQty }]
      const po = state.purchaseOrders.find(p => p.id === poId);
      if (!po) { next = state; break; }

      const rcvDate    = receiptDate || new Date().toISOString().slice(0, 10);
      const replRefNum = `REP-${genGRNNumber(state.purchaseReceipts).replace('GRN-', '')}`;

      // Update PO items: accepted += replacedQty, pendingReplacementQty -= replacedQty
      const updatedItems = po.items.map(item => {
        const ri = replacements.find(r => r.poItemId === item.id);
        if (!ri || !Number(ri.replacedQty)) return item;
        const qty = Number(ri.replacedQty);
        return {
          ...item,
          acceptedQty:            (item.acceptedQty            || 0) + qty,
          pendingReplacementQty:  Math.max(0, (item.pendingReplacementQty || 0) - qty),
          replacementReceivedQty: (item.replacementReceivedQty || 0) + qty,
        };
      });

      // Recalculate PO status
      const allDone    = updatedItems.every(it => ((it.acceptedQty||0) + (it.rejectedQty||0)) >= it.quantity);
      const anyProgress = updatedItems.some(it  => (it.receivedQty || 0) > 0);
      const newStatus  = allDone ? 'fully_received' : anyProgress ? 'partially_received' : po.status;

      // Stock in for replacement accepted qty
      const newTxs = [];
      const products = state.products.map(p => {
        const ri = replacements.find(r => r.productId === p.id);
        if (!ri || !Number(ri.replacedQty)) return p;
        const qty = Number(ri.replacedQty);
        const prevStock = p.stock;
        const newStock  = prevStock + qty;
        const unitCost  = Number(ri.unitCost || 0);
        const existingAvg = Number(p.averagePurchaseCost || p.costPrice || p.purchasePrice || 0);
        const newAvgCost = prevStock > 0 && existingAvg > 0
          ? (prevStock * existingAvg + qty * unitCost) / newStock
          : unitCost || existingAvg;
        newTxs.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'PURCHASE_REPLACEMENT_RECEIVE', refType: 'purchase_receipt',
          refId: generateId('rep'), refNumber: replRefNum,
          qtyIn: qty, qtyOut: 0, prevStock, newStock,
          note: `Replacement ${replRefNum} — ${qty} units received for PO ${po.poNumber}`,
        }));
        return {
          ...p,
          stock: newStock,
          lastPurchasePrice:   unitCost || p.lastPurchasePrice,
          averagePurchaseCost: unitCost > 0 ? Math.round(newAvgCost * 100) / 100 : p.averagePurchaseCost,
          lastPurchasedAt:     rcvDate,
        };
      });

      // Update each purchase return's pendingReplacementQty + status
      const returnUpdates = {};
      replacements.forEach(ri => {
        if (!ri.returnId || !Number(ri.replacedQty)) return;
        returnUpdates[ri.returnId] = (returnUpdates[ri.returnId] || 0) + Number(ri.replacedQty);
      });

      const purchaseReturns = state.purchaseReturns.map(ret => {
        const replaced = returnUpdates[ret.id];
        if (!replaced) return ret;
        const pending = Math.max(0, (ret.pendingReplacementQty || 0) - replaced);
        return {
          ...ret,
          pendingReplacementQty: pending,
          status:                pending <= 0 ? 'replacement_received' : 'partially_replaced',
          replacementDate:       rcvDate,
          replacementNotes:      replNotes || '',
          replacementRefNum:     replRefNum,
        };
      });

      const totalReplaced = replacements.reduce((s, r) => s + Number(r.replacedQty || 0), 0);
      const tlNote  = `Replacement ${replRefNum}: ${totalReplaced} units received${allDone ? ' — PO fully received' : ''}`;
      const tlEntry = { status: newStatus, date: rcvDate, note: tlNote };
      const updatedPO = { ...po, items: updatedItems, status: newStatus, timeline: [...(po.timeline || []), tlEntry] };

      next = {
        ...state,
        purchaseOrders:    state.purchaseOrders.map(p => p.id === poId ? updatedPO : p),
        purchaseReturns,
        products,
        stockTransactions: [...state.stockTransactions, ...newTxs],
      };
      break;
    }

    // INSPECT_REPLACEMENT — full inspection loop: stock for good qty, new returns for bad qty, PO update
    case 'INSPECT_REPLACEMENT': {
      const {
        purchaseReturnId,
        receivedQty, acceptedQty, damagedQty, defectiveQty, rejectedQty,
        rejectionMode = 'close_rejected', notes,
      } = action.payload;

      const pret = state.purchaseReturns.find(r => r.id === purchaseReturnId);
      if (!pret) { next = state; break; }

      // Resolve IDs — payload values take priority; fall back to fields stored on the return itself
      const purchaseOrderId     = action.payload.purchaseOrderId     || pret.purchaseOrderId     || pret.poId || null;
      const purchaseOrderItemId = action.payload.purchaseOrderItemId || pret.purchaseOrderItemId || pret.items?.[0]?.poItemId || null;
      const productId           = action.payload.productId           || pret.productId           || pret.items?.[0]?.productId || null;

      // GP-specific IDs — source_type tells us this return came from a general purchase
      const isGPSource = pret.source_type === 'general_purchase_receiving' ||
        (pret.source_type === 'replacement_inspection' && !!(pret.generalPurchaseId || pret.items?.[0]?.gpItemId));
      const generalPurchaseId = action.payload.generalPurchaseId ||
        pret.generalPurchaseId ||
        (pret.source_type === 'general_purchase_receiving' ? pret.purchaseId : null) ||
        null;
      const gpItemId = action.payload.gpItemId ||
        pret.gpItemId ||
        pret.items?.[0]?.gpItemId ||
        null;

      const rcvDate  = new Date().toISOString().slice(0, 10);
      const newTxs   = [];

      // 1. Stock IN for accepted (good) replacement quantity
      let updatedProducts = state.products;
      if (Number(acceptedQty) > 0 && productId) {
        updatedProducts = state.products.map(p => {
          if (p.id !== productId) return p;
          const qty       = Number(acceptedQty);
          const prevStock = p.stock;
          const newStock  = prevStock + qty;
          const unitCost  = Number(pret.items?.[0]?.unitCost || 0);
          const existingAvg = Number(p.averagePurchaseCost || p.costPrice || 0);
          const newAvgCost  = prevStock > 0 && existingAvg > 0
            ? (prevStock * existingAvg + qty * unitCost) / newStock
            : unitCost || existingAvg;
          newTxs.push(makeStxRecord({
            productId: p.id, productName: p.name, sku: p.sku,
            type: 'PURCHASE_REPLACEMENT_RECEIVE', refType: 'purchase_return_replacement',
            refId: purchaseReturnId, refNumber: pret.returnNumber || '',
            qtyIn: qty, qtyOut: 0, prevStock, newStock,
            note: `Replacement accepted for ${pret.returnNumber || purchaseReturnId}`,
          }));
          return {
            ...p,
            stock: newStock,
            lastPurchasePrice:   unitCost || p.lastPurchasePrice,
            averagePurchaseCost: unitCost > 0 ? Math.round(newAvgCost * 100) / 100 : p.averagePurchaseCost,
            lastPurchasedAt:     rcvDate,
          };
        });
      }

      // 2. Create child purchase returns for damaged/defective/re-rejected replacement
      const childReturns = [];
      const CHILD_REASONS = {
        damaged:   'Replacement received — found damaged again',
        defective: 'Replacement received — found defective again',
        rejected:  'Replacement rejected — requesting replacement again',
      };
      const buildChildReturn = (qty, condition) => {
        if (!qty) return;
        childReturns.push({
          id:                     generateId('pret'),
          returnNumber:           generateReturnNumber(
            state.settings?.purReturnPrefix || 'PRR',
            [...state.purchaseReturns, ...childReturns]
          ),
          parentPurchaseReturnId: purchaseReturnId,
          purchaseOrderId:        purchaseOrderId || '',
          purchaseOrderItemId:    purchaseOrderItemId || '',
          purchaseOrderNumber:    pret.purchaseOrderNumber || '',
          // Propagate GP IDs so subsequent inspections can update the same GP item
          generalPurchaseId:      isGPSource ? (generalPurchaseId || '') : '',
          gpItemId:               isGPSource ? (gpItemId || '') : '',
          purchaseId:             isGPSource ? (generalPurchaseId || pret.purchaseId || '') : '',
          productId:              productId || '',
          supplierId:             pret.supplierId || '',
          supplierName:           pret.supplierName || '',
          source:                 'replacement_inspection',
          source_type:            'replacement_inspection',
          returnType:             'Replacement Inspection Return',
          reason:                 CHILD_REASONS[condition] || condition,
          condition,
          conditionType:          condition,
          replacementRequired:    true,
          pendingReplacementQty:  qty,
          date:                   rcvDate,
          status:                 'pending_replacement',
          items: [{
            productId:   productId || '',
            productName: pret.items?.[0]?.productName || '',
            sku:         pret.items?.[0]?.sku || '',
            returnQty:   qty,
            unitCost:    pret.items?.[0]?.unitCost || 0,
            condition,
            poItemId:    purchaseOrderItemId || '',
            gpItemId:    isGPSource ? (gpItemId || '') : '',
          }],
          totalAmount: qty * Number(pret.items?.[0]?.unitCost || 0),
          createdAt:   rcvDate,
        });
      };
      buildChildReturn(Number(damagedQty   || 0), 'damaged');
      buildChildReturn(Number(defectiveQty || 0), 'defective');
      if (rejectionMode === 'request_again') buildChildReturn(Number(rejectedQty || 0), 'rejected');

      // 3. Update PO item quantities and recalculate PO status
      let updatedPOs = state.purchaseOrders;
      if (purchaseOrderId) {
        updatedPOs = state.purchaseOrders.map(po => {
          if (po.id !== purchaseOrderId) return po;
          const updatedItems = po.items.map(item => {
            // Match by poItemId first; fall back to productId if poItemId missing
            const isTarget = purchaseOrderItemId
              ? item.id === purchaseOrderItemId
              : (productId && item.productId === productId);
            if (!isTarget) return item;
            const newBadQty  = Number(damagedQty || 0) + Number(defectiveQty || 0) +
              (rejectionMode === 'request_again' ? Number(rejectedQty || 0) : 0);
            const newPending = Math.max(0, (item.pendingReplacementQty || 0) - Number(receivedQty || 0)) + newBadQty;
            return {
              ...item,
              acceptedQty:             (item.acceptedQty             || 0) + Number(acceptedQty  || 0),
              rejectedQty:             (item.rejectedQty             || 0) + (rejectionMode === 'close_rejected' ? Number(rejectedQty || 0) : 0),
              pendingReplacementQty:   newPending,
              replacementReceivedQty:  (item.replacementReceivedQty  || 0) + Number(receivedQty  || 0),
              replacementAcceptedQty:  (item.replacementAcceptedQty  || 0) + Number(acceptedQty  || 0),
              replacementDamagedQty:   (item.replacementDamagedQty   || 0) + Number(damagedQty   || 0),
              replacementDefectiveQty: (item.replacementDefectiveQty || 0) + Number(defectiveQty || 0),
              replacementRejectedQty:  (item.replacementRejectedQty  || 0) + Number(rejectedQty  || 0),
            };
          });
          const allDone    = updatedItems.every(it =>
            ((it.acceptedQty || 0) + (it.rejectedQty || 0)) >= it.quantity &&
            (it.pendingReplacementQty || 0) === 0
          );
          const anyProgress = updatedItems.some(it => (it.receivedQty || 0) > 0 || (it.acceptedQty || 0) > 0);
          const newPoStatus = allDone ? 'fully_received' : anyProgress ? 'partially_received' : po.status;
          const tlEntry = {
            status: newPoStatus, date: rcvDate,
            note: `Replacement inspected (${pret.returnNumber}): ${acceptedQty} accepted, ${Number(damagedQty||0)+Number(defectiveQty||0)} bad, ${Number(rejectedQty||0)} rejected${allDone ? ' — PO fully received' : ''}`,
          };
          return { ...po, items: updatedItems, status: newPoStatus, timeline: [...(po.timeline || []), tlEntry] };
        });
      }

      // 3b. Update GP item quantities and recalculate GP fulfillment status
      let updatedPurchases = state.purchases;
      if (isGPSource && generalPurchaseId) {
        updatedPurchases = state.purchases.map(gp => {
          if (gp.id !== generalPurchaseId) return gp;
          const updatedGPItems = gp.items.map(item => {
            const isTarget = gpItemId
              ? item.id === gpItemId
              : (productId && item.productId === productId);
            if (!isTarget) return item;
            const newBadQty = Number(damagedQty || 0) + Number(defectiveQty || 0) +
              (rejectionMode === 'request_again' ? Number(rejectedQty || 0) : 0);
            const newPending = Math.max(0, (item.pendingReplacementQty || 0) - Number(receivedQty || 0)) + newBadQty;
            return {
              ...item,
              acceptedQty:             (item.acceptedQty             || 0) + Number(acceptedQty  || 0),
              rejectedQty:             (item.rejectedQty             || 0) + (rejectionMode === 'close_rejected' ? Number(rejectedQty || 0) : 0),
              pendingReplacementQty:   newPending,
              replacementReceivedQty:  (item.replacementReceivedQty  || 0) + Number(receivedQty  || 0),
              replacementAcceptedQty:  (item.replacementAcceptedQty  || 0) + Number(acceptedQty  || 0),
              replacementDamagedQty:   (item.replacementDamagedQty   || 0) + Number(damagedQty   || 0),
              replacementDefectiveQty: (item.replacementDefectiveQty || 0) + Number(defectiveQty || 0),
              replacementRejectedQty:  (item.replacementRejectedQty  || 0) + Number(rejectedQty  || 0),
            };
          });
          // Recalculate GP fulfillment status — only stock items count toward completion
          const stockItems = updatedGPItems.filter(it => it.affects_stock !== false && it.itemType !== 'non_stock_item');
          const allGPDone = stockItems.length > 0 && stockItems.every(it => {
            const completed = (it.acceptedQty || 0) + (it.rejectedQty || 0);
            return completed >= it.quantity && (it.pendingReplacementQty || 0) === 0;
          });
          const anyGPProgress = stockItems.some(it => (it.receivedQty || 0) > 0 || (it.acceptedQty || 0) > 0);
          const newGPStatus = allGPDone ? 'fully_received' : anyGPProgress ? 'partially_received' : gp.fulfillmentStatus;
          return { ...gp, items: updatedGPItems, fulfillmentStatus: newGPStatus };
        });
      }

      // 4. Determine new status for this purchase return
      const _accepted  = Number(acceptedQty  || 0);
      const _damaged   = Number(damagedQty   || 0);
      const _defective = Number(defectiveQty || 0);
      const _rejected  = Number(rejectedQty  || 0);
      let newReturnStatus;
      if (_damaged === 0 && _defective === 0 && _rejected === 0) {
        newReturnStatus = 'replacement_accepted';
      } else if (_damaged > 0 && _defective === 0) {
        newReturnStatus = 'replacement_damaged';
      } else if (_defective > 0 && _damaged === 0) {
        newReturnStatus = 'replacement_defective';
      } else if (_damaged > 0 || _defective > 0) {
        newReturnStatus = 'replacement_damaged';
      } else if (_rejected > 0 && rejectionMode === 'close_rejected') {
        newReturnStatus = _accepted > 0 ? 'replacement_accepted' : 'replacement_rejected';
      } else {
        newReturnStatus = _accepted > 0 ? 'replacement_accepted' : 'pending_replacement';
      }

      // 5. Update the purchase return record
      const updatedReturns = state.purchaseReturns.map(r => {
        if (r.id !== purchaseReturnId) return r;
        return {
          ...r,
          status:                     newReturnStatus,
          replacementReceivedQty:     Number(receivedQty  || 0),
          replacementAcceptedQty:     Number(acceptedQty  || 0),
          replacementDamagedQty:      Number(damagedQty   || 0),
          replacementDefectiveQty:    Number(defectiveQty || 0),
          replacementRejectedQty:     Number(rejectedQty  || 0),
          replacementInspectionNotes: notes || '',
          replacementInspectedAt:     rcvDate,
          pendingReplacementQty:      0,
        };
      });

      // Close linked damage record when replacement fully accepted
      let updatedDmgRecords = state.damagedStockRecords || [];
      if (pret.source_type === 'damaged_stock' && pret.damagedStockId && newReturnStatus === 'replacement_accepted') {
        updatedDmgRecords = updatedDmgRecords.map(r =>
          r.id === pret.damagedStockId
            ? { ...r, status: 'closed', resolvedDate: rcvDate, updatedAt: rcvDate }
            : r
        );
      }

      next = {
        ...state,
        purchaseReturns:     [...updatedReturns, ...childReturns],
        purchaseOrders:      updatedPOs,
        purchases:           updatedPurchases,
        products:            updatedProducts,
        damagedStockRecords: updatedDmgRecords,
        stockTransactions:   [...state.stockTransactions, ...newTxs],
      };
      break;
    }

    // RECEIVE GP ITEMS — stock only for accepted qty; bad → auto purchase return
    case 'RECEIVE_GENERAL_PURCHASE': {
      const { gpId, receiptItems, receiptDate } = action.payload;
      const gp = state.purchases.find(p => p.id === gpId);
      if (!gp) { next = state; break; }
      const rcvDate = receiptDate || new Date().toISOString().slice(0, 10);
      const updatedItems = gp.items.map(item => {
        const r = receiptItems.find(ri => ri.gpItemId === item.id);
        if (!r) return item;
        const totalRcv = Number(r.acceptedQty||0) + Number(r.damagedQty||0) + Number(r.defectiveQty||0) + Number(r.rejectedQty||0);
        return {
          ...item,
          receivedQty:           (item.receivedQty           || 0) + totalRcv,
          acceptedQty:           (item.acceptedQty           || 0) + Number(r.acceptedQty  || 0),
          damagedQty:            (item.damagedQty            || 0) + Number(r.damagedQty   || 0),
          defectiveQty:          (item.defectiveQty          || 0) + Number(r.defectiveQty || 0),
          rejectedQty:           (item.rejectedQty           || 0) + Number(r.rejectedQty  || 0),
          // Track outstanding replacement units (damaged+defective need supplier replacement)
          pendingReplacementQty: (item.pendingReplacementQty || 0) + Number(r.damagedQty || 0) + Number(r.defectiveQty || 0),
        };
      });
      const allDone = updatedItems.every(it => (it.receivedQty || 0) >= it.quantity);
      const anyDone = updatedItems.some(it => (it.receivedQty || 0) > 0);
      const newFulfillmentStatus = allDone ? 'fully_received' : anyDone ? 'partially_received' : gp.fulfillmentStatus || 'pending';
      const newTxsGP = [];
      const productsGP = state.products.map(p => {
        const r = receiptItems.find(ri => ri.productId === p.id);
        if (!r || !Number(r.acceptedQty)) return p;
        const qty = Number(r.acceptedQty);
        const prevStock = p.stock;
        const newStock  = prevStock + qty;
        const unitCost  = Number(r.unitCost || 0);
        const existingAvg = Number(p.averagePurchaseCost || p.costPrice || p.purchasePrice || 0);
        const newAvgCost = prevStock > 0 && existingAvg > 0
          ? (prevStock * existingAvg + qty * unitCost) / newStock
          : unitCost;
        newTxsGP.push(makeStxRecord({
          productId: p.id, productName: p.name, sku: p.sku,
          type: 'GENERAL_PURCHASE_RECEIVE', refType: 'general_purchase',
          refId: gp.id, refNumber: gp.gpNumber || gp.purchaseNumber,
          qtyIn: qty, qtyOut: 0, prevStock, newStock,
          note: `GP ${gp.gpNumber || gp.purchaseNumber} — ${qty} accepted`,
        }));
        return {
          ...p,
          stock: newStock,
          lastPurchasePrice:   unitCost,
          averagePurchaseCost: Math.round(newAvgCost * 100) / 100,
          lastSupplierId:      gp.supplierId || null,
          lastPurchasedAt:     rcvDate,
        };
      });
      const autoReturnsGP = [];
      const COND_META_GP = {
        damaged:   { reason: 'Damaged during delivery',              replacementRequired: true,  retStatus: 'pending_replacement' },
        defective: { reason: 'Defective item received',              replacementRequired: true,  retStatus: 'pending_replacement' },
        rejected:  { reason: 'Rejected during receiving inspection', replacementRequired: false, retStatus: 'pending_return'      },
      };
      receiptItems.forEach(r => {
        [{ field: 'damagedQty', cond: 'damaged' }, { field: 'defectiveQty', cond: 'defective' }, { field: 'rejectedQty', cond: 'rejected' }].forEach(({ field, cond }) => {
          const qty = Number(r[field] || 0);
          if (!qty) return;
          const { reason, replacementRequired, retStatus } = COND_META_GP[cond];
          autoReturnsGP.push({
            id: generateId('pret'),
            returnNumber: generateReturnNumber(state.settings?.purReturnPrefix || 'PRR', [...state.purchaseReturns, ...autoReturnsGP]),
            supplierId: gp.supplierId, supplierName: gp.supplierName,
            purchaseId: gpId, purchaseNumber: gp.gpNumber || gp.purchaseNumber,
            source: 'receiving_rejection', source_type: 'general_purchase_receiving',
            returnType: 'Receiving Rejection', reason,
            condition: cond, conditionType: cond,
            replacementRequired, pendingReplacementQty: replacementRequired ? qty : 0,
            date: rcvDate, status: retStatus,
            isAutoReturn: true,
            items: [{ productId: r.productId, productName: r.productName, sku: r.sku || '', returnQty: qty, unitCost: r.unitCost || 0, condition: cond, gpItemId: r.gpItemId }],
            totalAmount: (r.unitCost || 0) * qty,
            createdAt: new Date().toISOString().slice(0, 10),
          });
        });
      });
      // Update product-supplier pricing records for GP accepted items
      let updatedPSP_GP = state.productSupplierPrices;
      receiptItems.forEach(r => {
        const accepted = Number(r.acceptedQty || 0);
        if (!accepted || !r.productId || !gp.supplierId) return;
        updatedPSP_GP = updatePSPRecord(updatedPSP_GP, {
          productId: r.productId, supplierId: gp.supplierId,
          price: Number(r.unitCost || 0), qty: accepted,
          poId: null, gpId: gpId, date: rcvDate,
        });
      });

      next = {
        ...state,
        purchases: state.purchases.map(p => p.id === gpId ? { ...gp, items: updatedItems, fulfillmentStatus: newFulfillmentStatus } : p),
        purchaseReturns: autoReturnsGP.length ? [...state.purchaseReturns, ...autoReturnsGP] : state.purchaseReturns,
        products: productsGP,
        productSupplierPrices: updatedPSP_GP,
        stockTransactions: [...state.stockTransactions, ...newTxsGP],
      };
      break;
    }

    case 'UPDATE_GP_STATUS': {
      const { id, fulfillmentStatus } = action.payload;
      next = { ...state, purchases: state.purchases.map(p => p.id === id ? { ...p, fulfillmentStatus } : p) };
      break;
    }

    case 'LINK_PO_ITEM_PRODUCT': {
      const { poId, itemId, productId } = action.payload;
      const purchaseOrders = state.purchaseOrders.map(po => {
        if (po.id !== poId) return po;
        return {
          ...po,
          items: po.items.map(it =>
            it.id === itemId ? { ...it, productId, productLinked: true } : it
          ),
        };
      });
      next = { ...state, purchaseOrders };
      break;
    }

    case 'UPDATE_SETTINGS': next = { ...state, settings: { ...state.settings, ...action.payload } }; break;

    // SUPPLIER PAYMENTS & CREDITS
    case 'ADD_SUPPLIER_PAYMENT': {
      const isUnlinkedGpay = action.payload.sourceType === 'general_payment' && !action.payload.sourceId;
      const gpayNum = (action.payload.sourceType === 'general_payment' && !action.payload.gpayNumber)
        ? genGPAYNumber(state.supplierPayments)
        : action.payload.gpayNumber || null;
      const payment = {
        ...action.payload,
        id: action.payload.id || generateId('spay'),
        gpayNumber: gpayNum,
        createdAt: action.payload.createdAt || new Date().toISOString().slice(0, 10),
      };
      let newCredits = state.supplierCredits || [];
      if (isUnlinkedGpay) {
        const creditId = generateId('credit');
        payment.creditId = creditId;
        newCredits = [...newCredits, {
          id: creditId,
          supplierId:        payment.supplierId,
          supplierName:      payment.supplierName,
          creditAmount:      Number(payment.paymentAmount),
          usedAmount:        0,
          availableAmount:   Number(payment.paymentAmount),
          sourcePaymentId:   payment.id,
          sourcePaymentRef:  gpayNum,
          notes:             payment.notes || '',
          createdAt:         payment.createdAt,
        }];
      }
      next = { ...state, supplierPayments: [...(state.supplierPayments || []), payment], supplierCredits: newCredits };
      break;
    }
    case 'DELETE_SUPPLIER_PAYMENT': {
      const pmt = (state.supplierPayments || []).find(p => p.id === action.payload);
      let credits = state.supplierCredits || [];
      if (pmt?.creditId) {
        credits = credits.filter(c => c.id !== pmt.creditId);
      }
      if (pmt?.fromCreditId) {
        credits = credits.map(c => {
          if (c.id !== pmt.fromCreditId) return c;
          const used = Math.max(0, Number(c.usedAmount || 0) - Number(pmt.paymentAmount || 0));
          return { ...c, usedAmount: used, availableAmount: Math.max(0, Number(c.creditAmount) - used) };
        });
      }
      next = { ...state, supplierPayments: (state.supplierPayments || []).filter(p => p.id !== action.payload), supplierCredits: credits };
      break;
    }
    case 'APPLY_SUPPLIER_CREDIT': {
      const { creditId, payment } = action.payload;
      const creditPayment = { ...payment, id: generateId('spay'), fromCreditId: creditId, createdAt: new Date().toISOString().slice(0, 10) };
      const updatedCredits = (state.supplierCredits || []).map(c => {
        if (c.id !== creditId) return c;
        const used = Number(c.usedAmount || 0) + Number(payment.paymentAmount);
        return { ...c, usedAmount: used, availableAmount: Math.max(0, Number(c.creditAmount) - used) };
      });
      next = { ...state, supplierPayments: [...(state.supplierPayments || []), creditPayment], supplierCredits: updatedCredits };
      break;
    }
    case 'ADD_GENERAL_PAYABLE': {
      const gpbl = {
        ...action.payload,
        id: action.payload.id || generateId('gpbl'),
        payableNumber: genPayableNumber(state.generalPayables),
        payments: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };
      next = { ...state, generalPayables: [...(state.generalPayables || []), gpbl] };
      break;
    }
    case 'UPDATE_GENERAL_PAYABLE': {
      next = {
        ...state,
        generalPayables: (state.generalPayables || []).map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
      break;
    }
    case 'DELETE_GENERAL_PAYABLE': {
      next = { ...state, generalPayables: (state.generalPayables || []).filter(p => p.id !== action.payload) };
      break;
    }
    case 'ADD_PAYABLE_CATEGORY': {
      const exists = (state.payableCategories || []).some(
        c => c.name.toLowerCase() === action.payload.name.trim().toLowerCase()
      );
      if (exists) { next = state; break; }
      const cat = {
        id: generateId('pcat'),
        name: action.payload.name.trim(),
        isCustom: true,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      next = { ...state, payableCategories: [...(state.payableCategories || []), cat] };
      break;
    }
    case 'ADD_GENERAL_PAYABLE_PAYMENT': {
      const { payableId, payment: pmtData } = action.payload;
      next = {
        ...state,
        generalPayables: (state.generalPayables || []).map(p => {
          if (p.id !== payableId) return p;
          const payments = [...(p.payments || []), { ...pmtData, id: generateId('gpay'), createdAt: new Date().toISOString().slice(0, 10) }];
          return { ...p, payments };
        }),
      };
      break;
    }
    case 'DELETE_GENERAL_PAYABLE_PAYMENT': {
      const { payableId: pid, paymentId } = action.payload;
      next = {
        ...state,
        generalPayables: (state.generalPayables || []).map(p => {
          if (p.id !== pid) return p;
          return { ...p, payments: (p.payments || []).filter(pm => pm.id !== paymentId) };
        }),
      };
      break;
    }
    case 'SET_PAYMENT_DUE_DATE': {
      const { sourceType, sourceId, dueDate } = action.payload;
      if (sourceType === 'purchase_order') {
        next = { ...state, purchaseOrders: state.purchaseOrders.map(po => po.id === sourceId ? { ...po, dueDate } : po) };
      } else {
        next = { ...state, purchases: state.purchases.map(p => p.id === sourceId ? { ...p, dueDate } : p) };
      }
      break;
    }

    default: return state;
  }

  saveLocal(next);
  return next;
}

// ─── Service call wrapper ─────────────────────────────────────────────────────
async function tryService(fn) {
  try { return await fn(); } catch (err) {
    if (err.message !== 'SUPABASE_NOT_CONFIGURED') console.error('[TrackInvo]', err.message);
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dbLoading, setDbLoading] = useState(false);

  // Supabase hydration on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setDbLoading(true);
    Promise.all([
      tryService(() => categoryService.getAll()),
      tryService(() => supplierService.getAll()),
      tryService(() => customerService.getAll()),
      tryService(() => productService.getAll()),
      tryService(() => invoiceService.getAll()),
      tryService(() => purchaseService.getAll()),
      tryService(() => settingsService.get()),
    ]).then(([categories, suppliers, customers, products, invoices, purchases, settings]) => {
      const seed = {};
      if (categories) seed.categories = categories;
      if (suppliers)  seed.suppliers  = suppliers;
      if (customers)  seed.customers  = customers;
      if (products)   seed.products   = products;
      if (invoices)   seed.invoices   = invoices;
      if (purchases)  seed.purchases  = purchases;
      if (settings)   seed.settings   = { ...initialState.settings, ...settings };
      if (seed.settings?.businessTimezone) setAppTimezone(seed.settings.businessTimezone);
      if (Object.keys(seed).length) dispatch({ type: 'SEED', payload: seed });
    }).finally(() => setDbLoading(false));
  }, []);

  // ─── Action creators ─────────────────────────────────────────────────────────
  const actions = {
    // CATEGORIES
    addCategory:    useCallback(async (data) => { const r = await tryService(() => categoryService.create(data)); dispatch({ type: 'ADD_CATEGORY',    payload: r || data }); toast.success('Category added'); }, []),
    updateCategory: useCallback(async (data) => { await tryService(() => categoryService.update(data.id, data));   dispatch({ type: 'UPDATE_CATEGORY', payload: data });      toast.success('Category updated'); }, []),
    deleteCategory: useCallback(async (id)   => { await tryService(() => categoryService.delete(id));             dispatch({ type: 'DELETE_CATEGORY', payload: id });        toast.success('Category deleted'); }, []),

    // SUPPLIERS
    addSupplier:    useCallback(async (data) => { const r = await tryService(() => supplierService.create(data)); dispatch({ type: 'ADD_SUPPLIER',    payload: r || data }); toast.success('Supplier added'); }, []),
    updateSupplier: useCallback(async (data) => { await tryService(() => supplierService.update(data.id, data));   dispatch({ type: 'UPDATE_SUPPLIER', payload: data });      toast.success('Supplier updated'); }, []),
    deleteSupplier: useCallback(async (id)   => { await tryService(() => supplierService.delete(id));             dispatch({ type: 'DELETE_SUPPLIER', payload: id });        toast.success('Supplier deleted'); }, []),

    // CUSTOMERS
    addCustomer:    useCallback(async (data) => { const r = await tryService(() => customerService.create(data)); dispatch({ type: 'ADD_CUSTOMER',    payload: r || data }); toast.success('Customer added'); }, []),
    updateCustomer: useCallback(async (data) => { await tryService(() => customerService.update(data.id, data));   dispatch({ type: 'UPDATE_CUSTOMER', payload: data });      toast.success('Customer updated'); }, []),
    deleteCustomer: useCallback(async (id)   => { await tryService(() => customerService.delete(id));             dispatch({ type: 'DELETE_CUSTOMER', payload: id });        toast.success('Customer deleted'); }, []),

    // PRODUCTS
    addProduct:    useCallback(async (data) => { const r = await tryService(() => productService.create(data)); dispatch({ type: 'ADD_PRODUCT',    payload: r || data }); toast.success('Product added'); }, []),
    updateProduct: useCallback(async (data) => { await tryService(() => productService.update(data.id, data));   dispatch({ type: 'UPDATE_PRODUCT', payload: data });      toast.success('Product updated'); }, []),
    deleteProduct: useCallback(async (id)   => { await tryService(() => productService.delete(id));             dispatch({ type: 'DELETE_PRODUCT', payload: id });        toast.success('Product deleted'); }, []),

    adjustStock: useCallback(async (productId, delta, note = '', refType, refId, refNumber) => {
      await tryService(() => productService.adjustStock(productId, delta, note));
      dispatch({ type: 'ADJUST_STOCK', payload: { productId, delta, note, refType, refId, refNumber } });
      toast.success('Stock adjusted');
    }, []),

    adjustDamagedStock: useCallback((productId, delta, note = '', txType = 'DAMAGED_WRITEOFF') => {
      dispatch({ type: 'ADJUST_DAMAGED_STOCK', payload: { productId, delta, note, txType } });
    }, []),

    // INVOICES
    addInvoice: useCallback(async (data) => {
      let dbRecord = null;
      try { dbRecord = await invoiceService.create(data); } catch (err) {
        if (err.message !== 'SUPABASE_NOT_CONFIGURED') { toast.error(err.message); return false; }
      }
      dispatch({ type: 'ADD_INVOICE', payload: dbRecord || data });
      toast.success('Invoice created successfully');
      return true;
    }, []),

    updateInvoice: useCallback(async (data) => {
      await tryService(() => invoiceService.updateStatus(data.id, data.paymentStatus));
      dispatch({ type: 'UPDATE_INVOICE', payload: data });
      toast.success('Invoice updated');
    }, []),

    deleteInvoice: useCallback(async (id) => {
      await tryService(() => invoiceService.delete(id));
      dispatch({ type: 'VOID_INVOICE', payload: id });
      toast.success('Invoice voided & stock reversed');
    }, []),

    // PURCHASES
    addPurchase: useCallback(async (data) => {
      const dbRecord = await tryService(() => purchaseService.create(data));
      dispatch({ type: 'ADD_PURCHASE', payload: dbRecord || data });
      toast.success('Purchase recorded & stock updated');
    }, []),

    updatePurchase: useCallback(async (data) => {
      dispatch({ type: 'UPDATE_PURCHASE', payload: data });
      toast.success('Purchase updated & stock adjusted');
    }, []),

    deletePurchase: useCallback(async (id) => {
      await tryService(() => purchaseService.delete(id));
      dispatch({ type: 'VOID_PURCHASE', payload: id });
      toast.success('Purchase voided & stock reversed');
    }, []),

    // SALES RETURNS
    addSalesReturn: useCallback(async (data) => {
      dispatch({ type: 'ADD_SALES_RETURN', payload: data });
      toast.success('Sales return recorded & stock restored');
    }, []),

    updateSalesReturn: useCallback(async (id, updates) => {
      dispatch({ type: 'UPDATE_SALES_RETURN', payload: { id, updates } });
      toast.success('Sales return updated');
    }, []),

    markDamagedStock: useCallback(async (data) => {
      dispatch({ type: 'MARK_DAMAGED_STOCK', payload: data });
      toast.success(data.quantity + ' unit(s) marked as damaged');
    }, []),

    resolveDamagedStock: useCallback(async (recordId, resolution, quantity, notes, extraData = {}) => {
      if (resolution === 'returned_to_supplier') {
        dispatch({ type: 'RETURN_DAMAGED_TO_SUPPLIER', payload: { recordId, quantity, notes, supplierId: extraData.supplierId || '', supplierName: extraData.supplierName || '', returnReason: extraData.returnReason || 'damaged' } });
        toast.success('Returned to supplier — purchase return created');
      } else {
        dispatch({ type: 'RESOLVE_DAMAGED_STOCK', payload: { recordId, resolution, quantity, notes } });
        const labels = { repaired: 'Repaired — stock restored', written_off: 'Written off', disposed: 'Disposed', cancelled: 'Cancelled' };
        toast.success(labels[resolution] || 'Damage record updated');
      }
    }, []),

    // PURCHASE RETURNS
    addPurchaseReturn: useCallback(async (data) => {
      dispatch({ type: 'ADD_PURCHASE_RETURN', payload: data });
      if (data.source !== 'receiving_rejection') toast.success('Purchase return recorded & stock adjusted');
    }, []),

    updatePurchaseReturn: useCallback(async (id, updates) => {
      dispatch({ type: 'UPDATE_PURCHASE_RETURN', payload: { id, updates } });
      toast.success('Purchase return updated');
    }, []),

    inspectReplacement: useCallback(async (payload) => {
      dispatch({ type: 'INSPECT_REPLACEMENT', payload });
      const accepted = Number(payload.acceptedQty || 0);
      const bad = Number(payload.damagedQty || 0) + Number(payload.defectiveQty || 0);
      if (accepted > 0 && bad === 0) toast.success(`Replacement accepted — ${accepted} unit${accepted !== 1 ? 's' : ''} added to stock`);
      else if (accepted > 0) toast.success(`Replacement partially accepted — ${accepted} to stock, ${bad} new return cycle created`);
      else toast.success('Replacement inspection recorded');
    }, []),

    // RECORD PAYMENT
    recordPayment: useCallback(async (invoiceId, payment) => {
      dispatch({ type: 'RECORD_PAYMENT', payload: { invoiceId, payment } });
    }, []),

    // PURCHASE ORDERS
    addPurchaseOrder: useCallback(async (data) => {
      const dbRecord = await tryService(() => purchaseOrderService.create(data));
      dispatch({ type: 'ADD_PURCHASE_ORDER', payload: dbRecord || data });
      toast.success('Purchase order created');
    }, []),

    sendPurchaseOrder: useCallback(async (id) => {
      await tryService(() => purchaseOrderService.updateStatus(id, 'sent', { status: 'sent', date: new Date().toISOString().slice(0,10), note: 'Order sent to supplier' }));
      dispatch({ type: 'UPDATE_PO_STATUS', payload: { id, status: 'sent', note: 'Order sent to supplier' } });
      toast.success('Purchase order sent to supplier');
    }, []),

    approvePurchaseOrder: useCallback(async (id) => {
      await tryService(() => purchaseOrderService.updateStatus(id, 'approved', { status: 'approved', date: new Date().toISOString().slice(0,10), note: 'Order approved' }));
      dispatch({ type: 'UPDATE_PO_STATUS', payload: { id, status: 'approved', note: 'Order approved' } });
      toast.success('Purchase order approved');
    }, []),

    cancelPurchaseOrder: useCallback(async (id) => {
      await tryService(() => purchaseOrderService.updateStatus(id, 'cancelled', { status: 'cancelled', date: new Date().toISOString().slice(0,10), note: 'Order cancelled' }));
      dispatch({ type: 'UPDATE_PO_STATUS', payload: { id, status: 'cancelled', note: 'Order cancelled' } });
      toast.success('Purchase order cancelled');
    }, []),

    rejectPurchaseOrder: useCallback(async (id) => {
      await tryService(() => purchaseOrderService.updateStatus(id, 'rejected', { status: 'rejected', date: new Date().toISOString().slice(0,10), note: 'Order rejected' }));
      dispatch({ type: 'UPDATE_PO_STATUS', payload: { id, status: 'rejected', note: 'Order rejected' } });
      toast.success('Purchase order rejected');
    }, []),

    closePurchaseOrder: useCallback(async (id) => {
      await tryService(() => purchaseOrderService.updateStatus(id, 'closed', { status: 'closed', date: new Date().toISOString().slice(0,10), note: 'Order closed' }));
      dispatch({ type: 'UPDATE_PO_STATUS', payload: { id, status: 'closed', note: 'Order closed' } });
      toast.success('Purchase order closed');
    }, []),

    receivePurchaseOrderItems: useCallback(async (poId, receiptItems, notes, receiptDate) => {
      dispatch({ type: 'RECEIVE_PO_ITEMS', payload: { poId, receiptItems, notes, receiptDate } });
      toast.success('Items received & stock updated');
    }, []),

    receivePOItemReplacement: useCallback(async (poId, replacements, notes, receiptDate) => {
      dispatch({ type: 'RECEIVE_REPLACEMENT', payload: { poId, replacements, notes, receiptDate } });
      toast.success('Replacement items received & stock updated');
    }, []),

    receiveGeneralPurchase: useCallback(async (gpId, receiptItems, notes, receiptDate) => {
      dispatch({ type: 'RECEIVE_GENERAL_PURCHASE', payload: { gpId, receiptItems, notes, receiptDate } });
      toast.success('Items received & stock updated');
    }, []),

    cancelGeneralPurchase: useCallback(async (id) => {
      dispatch({ type: 'UPDATE_GP_STATUS', payload: { id, fulfillmentStatus: 'cancelled' } });
      toast.success('General purchase cancelled');
    }, []),

    completeGeneralPurchase: useCallback(async (id) => {
      dispatch({ type: 'UPDATE_GP_STATUS', payload: { id, fulfillmentStatus: 'completed' } });
      toast.success('General purchase completed');
    }, []),

    linkPOItemToProduct: useCallback(async (poId, itemId, productId) => {
      await tryService(() => purchaseOrderService.linkItemToProduct(itemId, productId));
      dispatch({ type: 'LINK_PO_ITEM_PRODUCT', payload: { poId, itemId, productId } });
      toast.success('Product linked to PO item');
    }, []),

    // SUPPLIER PAYMENTS & CREDITS
    addSupplierPayment: useCallback(async (data) => {
      dispatch({ type: 'ADD_SUPPLIER_PAYMENT', payload: data });
      const isCredit = data.sourceType === 'general_payment' && !data.sourceId;
      toast.success(isCredit ? 'Supplier credit created' : 'Payment recorded');
    }, []),
    deleteSupplierPayment: useCallback(async (id) => {
      dispatch({ type: 'DELETE_SUPPLIER_PAYMENT', payload: id });
      toast.success('Payment deleted');
    }, []),
    applySupplierCredit: useCallback(async (creditId, sourceType, sourceId, sourceRef, supplierId, supplierName, amount) => {
      dispatch({ type: 'APPLY_SUPPLIER_CREDIT', payload: {
        creditId,
        payment: {
          supplierId, supplierName, sourceType, sourceId,
          sourceReferenceNo: sourceRef,
          paymentAmount: Number(amount),
          paymentMode: 'credit_note',
          paymentPurpose: 'credit_applied',
          paymentDate: new Date().toISOString().slice(0, 10),
          transactionReference: '',
          notes: 'Applied from supplier credit',
        },
      }});
      toast.success('Credit applied successfully');
    }, []),
    setPaymentDueDate: useCallback(async (sourceType, sourceId, dueDate) => {
      dispatch({ type: 'SET_PAYMENT_DUE_DATE', payload: { sourceType, sourceId, dueDate } });
    }, []),

    // GENERAL PAYABLES
    addPayableCategory: useCallback(async (name) => {
      dispatch({ type: 'ADD_PAYABLE_CATEGORY', payload: { name } });
    }, []),

    addGeneralPayable: useCallback(async (data) => {
      dispatch({ type: 'ADD_GENERAL_PAYABLE', payload: data });
      toast.success('Payable added');
    }, []),
    updateGeneralPayable: useCallback(async (data) => {
      dispatch({ type: 'UPDATE_GENERAL_PAYABLE', payload: data });
      toast.success('Payable updated');
    }, []),
    deleteGeneralPayable: useCallback(async (id) => {
      dispatch({ type: 'DELETE_GENERAL_PAYABLE', payload: id });
      toast.success('Payable deleted');
    }, []),
    addGeneralPayablePayment: useCallback(async (payableId, payment) => {
      dispatch({ type: 'ADD_GENERAL_PAYABLE_PAYMENT', payload: { payableId, payment } });
      toast.success('Payment recorded');
    }, []),
    deleteGeneralPayablePayment: useCallback(async (payableId, paymentId) => {
      dispatch({ type: 'DELETE_GENERAL_PAYABLE_PAYMENT', payload: { payableId, paymentId } });
      toast.success('Payment deleted');
    }, []),

    // SETTINGS
    updateSettings: useCallback(async (data) => {
      await tryService(() => settingsService.save(data));
      dispatch({ type: 'UPDATE_SETTINGS', payload: data });
      if (data.businessTimezone) setAppTimezone(data.businessTimezone);
      toast.success('Settings saved');
    }, []),

    // SUPPLIER RATINGS
    addSupplierRating: useCallback((payload) => {
      dispatch({ type: 'ADD_SUPPLIER_RATING', payload });
      toast.success('Supplier rating submitted');
    }, []),

    // PRODUCT-SUPPLIER PRICING
    setPreferredSupplier: useCallback((productId, supplierId) => {
      dispatch({ type: 'SET_PREFERRED_SUPPLIER', payload: { productId, supplierId } });
      toast.success('Preferred supplier updated');
    }, []),
  };

  return (
    <AppContext.Provider value={{ state, dbLoading, ...actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
