import ExcelJS from 'exceljs';

// ─── Design tokens (ARGB: alpha + RGB hex) ───────────────────────────────────
const C = {
  TITLE_BG   : 'FF1A237E', // deep navy
  TITLE_FG   : 'FFFFFFFF',
  HEADER_BG  : 'FF4F62E5', // accent blue
  HEADER_FG  : 'FFFFFFFF',
  ALT_ROW    : 'FFF4F5F7', // subtle alternate row
  WHITE      : 'FFFFFFFF',
  LABEL_BG   : 'FFEEF0FD', // light accent faint
  LABEL_FG   : 'FF3D50D0',
  SECTION_BG : 'FFE8EAF6', // section divider
  BORDER     : 'FFD0D3DE',
  GREEN      : 'FF0D9373',
  GREEN_BG   : 'FFE6F6F2',
  RED        : 'FFDC2626',
  RED_BG     : 'FFFEF2F2',
  AMBER      : 'FFD98C0A',
  AMBER_BG   : 'FFFEF6E4',
  TEXT       : 'FF0D0F14',
  TEXT2      : 'FF6B7280',
  TOTAL_BG   : 'FF4F62E5',
  TOTAL_FG   : 'FFFFFFFF',
};

// ─── Value formatters ─────────────────────────────────────────────────────────
const n  = (v) => Number(v || 0);
const fd = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
};
const cap = (s) => s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

// ─── Border styles ────────────────────────────────────────────────────────────
const thinBorder = (color = C.BORDER) => ({
  top:    { style: 'thin',  color: { argb: color } },
  left:   { style: 'thin',  color: { argb: color } },
  bottom: { style: 'thin',  color: { argb: color } },
  right:  { style: 'thin',  color: { argb: color } },
});
const mediumBorder = () => ({
  top:    { style: 'medium', color: { argb: C.HEADER_BG } },
  left:   { style: 'medium', color: { argb: C.HEADER_BG } },
  bottom: { style: 'medium', color: { argb: C.HEADER_BG } },
  right:  { style: 'medium', color: { argb: C.HEADER_BG } },
});

// ─── Sheet construction helpers ───────────────────────────────────────────────

/**
 * Column config: [{ header, key, width, numFmt?, align? }, ...]
 * align: 'left' | 'right' | 'center'  (default left)
 * numFmt: Excel number format string
 */

/** Add styled title block (2 rows: title + period) */
function addTitle(ws, title, period, colCount) {
  const r1 = ws.addRow([title]);
  r1.height = 36;
  const c1 = r1.getCell(1);
  c1.font      = { bold: true, size: 14, color: { argb: C.TITLE_FG } };
  c1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TITLE_BG } };
  c1.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(r1.number, 1, r1.number, colCount);

  const r2 = ws.addRow([`Period: ${period}`]);
  r2.height = 20;
  const c2 = r2.getCell(1);
  c2.font      = { size: 10, italic: true, color: { argb: C.TITLE_FG } };
  c2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HEADER_BG } };
  c2.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(r2.number, 1, r2.number, colCount);

  ws.addRow([]); // blank spacer
}

/** Add styled column header row */
function addHeaders(ws, cols) {
  const row = ws.addRow(cols.map((c) => c.header));
  row.height = 32;
  row.eachCell((cell, ci) => {
    const col = cols[ci - 1];
    cell.font      = { bold: true, size: 10, color: { argb: C.HEADER_FG } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HEADER_BG } };
    cell.alignment = { horizontal: col?.align || 'center', vertical: 'middle', wrapText: true };
    cell.border    = thinBorder('FF3D50D0');
  });
  ws.views = [{ state: 'frozen', ySplit: row.number }];
  return row.number; // return header row number so data starts after it
}

/** Add a data row with alternating fill + alignment + number format */
function addDataRow(ws, values, rowIndex, cols) {
  const row = ws.addRow(values);
  row.height = 20;
  const isAlt = rowIndex % 2 === 0;
  row.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = cols[ci - 1];
    if (!col) return;
    const align = col.align || 'left';
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: false };
    cell.font      = { size: 10, color: { argb: C.TEXT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? C.ALT_ROW : C.WHITE } };
    cell.border    = thinBorder();
    if (col.numFmt) cell.numFmt = col.numFmt;
  });
  return row;
}

/** Add a totals/summary footer row */
function addTotalsRow(ws, values, cols) {
  const row = ws.addRow(values);
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = cols[ci - 1];
    if (!col) return;
    const align = col.align || 'left';
    cell.font      = { bold: true, size: 10, color: { argb: C.TOTAL_FG } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TOTAL_BG } };
    cell.alignment = { horizontal: align, vertical: 'middle' };
    cell.border    = mediumBorder();
    if (col.numFmt) cell.numFmt = col.numFmt;
  });
}

/** Color a cell's text based on payment status */
function colorStatus(cell, status) {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'in stock')     { cell.font = { ...cell.font, color: { argb: C.GREEN }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GREEN_BG } }; }
  else if (s === 'unpaid' || s === 'out of stock') { cell.font = { ...cell.font, color: { argb: C.RED },   bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.RED_BG } }; }
  else if (s === 'partial' || s === 'low stock')   { cell.font = { ...cell.font, color: { argb: C.AMBER }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AMBER_BG } }; }
}

/** Apply all column widths and default number formats */
function applyColConfig(ws, cols) {
  ws.columns = cols.map((c) => ({
    key:   c.key,
    width: c.width || 16,
    style: {
      numFmt:    c.numFmt || '@',
      alignment: { horizontal: c.align || 'left', vertical: 'middle', wrapText: false },
    },
  }));
}

/** Summary sheet builder: [{label, value, highlight?}] */
function buildSummarySheet(wb, sheetName, title, period, groups) {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = [{ width: 36 }, { width: 24 }];

  // Title block
  const r1 = ws.addRow([title]);
  r1.height = 38;
  const c1 = r1.getCell(1);
  c1.font      = { bold: true, size: 15, color: { argb: C.TITLE_FG } };
  c1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TITLE_BG } };
  c1.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(1, 1, 1, 2);

  const r2 = ws.addRow([`Period: ${period}`]);
  r2.height = 20;
  r2.getCell(1).font      = { size: 10, italic: true, color: { argb: C.TITLE_FG } };
  r2.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HEADER_BG } };
  r2.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(2, 1, 2, 2);

  ws.addRow([]);

  groups.forEach((group) => {
    if (group.title) {
      const gr = ws.addRow([group.title]);
      gr.height = 22;
      gr.getCell(1).font      = { bold: true, size: 10, color: { argb: C.LABEL_FG } };
      gr.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SECTION_BG } };
      gr.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      ws.mergeCells(gr.number, 1, gr.number, 2);
    }

    group.rows.forEach(([label, value, type]) => {
      const row = ws.addRow([label, value]);
      row.height = 22;
      const lc = row.getCell(1);
      const vc = row.getCell(2);

      lc.font      = { size: 10, color: { argb: C.TEXT2 } };
      lc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.LABEL_BG } };
      lc.alignment = { horizontal: 'left', vertical: 'middle' };
      lc.border    = thinBorder();

      vc.font      = { bold: true, size: 11, color: { argb: C.TEXT } };
      vc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.WHITE } };
      vc.alignment = { horizontal: 'right', vertical: 'middle' };
      vc.border    = thinBorder();

      if (type === 'currency') { vc.numFmt = '#,##0.00'; }
      else if (type === 'pct') { vc.font = { ...vc.font, color: { argb: C.LABEL_FG } }; }
      else if (type === 'good') { vc.font = { ...vc.font, color: { argb: C.GREEN } }; }
      else if (type === 'bad')  { vc.font = { ...vc.font, color: { argb: C.RED } }; }
    });

    ws.addRow([]);
  });
}

/** Trigger browser download of the workbook */
async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── CURRENCY format constant ─────────────────────────────────────────────────
const CURR = '#,##0.00';
const INT  = '#,##0';

// ═══════════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportSales(invoices, period) {
  const wb   = new ExcelJS.Workbook();
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date));

  const total    = sorted.reduce((s, i) => s + n(i.grandTotal), 0);
  const paid     = sorted.reduce((s, i) => s + n(i.paidAmount), 0);
  const tax      = sorted.reduce((s, i) => s + n(i.taxAmount), 0);
  const discount = sorted.reduce((s, i) => s + n(i.discountAmount), 0);
  const balance  = sorted.reduce((s, i) => s + n(i.balanceAmount), 0);

  // ── Sheet 1: Summary ────────────────────────────────────────────────────────
  buildSummarySheet(wb, 'Summary', 'SALES REPORT', period, [
    {
      title: 'Invoice Counts',
      rows: [
        ['Total Invoices',   sorted.length, 'int'],
        ['Paid Invoices',    sorted.filter((i) => i.paymentStatus === 'paid').length,    'good'],
        ['Partial Invoices', sorted.filter((i) => i.paymentStatus === 'partial').length, ''],
        ['Unpaid Invoices',  sorted.filter((i) => i.paymentStatus === 'unpaid').length,  'bad'],
      ],
    },
    {
      title: 'Revenue & Collections',
      rows: [
        ['Gross Revenue',        total,    'currency'],
        ['Total Collected',      paid,     'currency'],
        ['Total Outstanding',    balance,  'currency'],
        ['Tax Billed',           tax,      'currency'],
        ['Discounts Given',      discount, 'currency'],
        ['Average Invoice Value', sorted.length ? total / sorted.length : 0, 'currency'],
        ['Collection Rate', sorted.length ? `${((paid / total) * 100).toFixed(1)}%` : '0%', 'pct'],
      ],
    },
  ]);

  // ── Sheet 2: Invoice List ───────────────────────────────────────────────────
  const invCols = [
    { header: 'Invoice #',      key: 'inv',    width: 16, align: 'left'  },
    { header: 'Customer',       key: 'cust',   width: 22, align: 'left'  },
    { header: 'Phone',          key: 'phone',  width: 15, align: 'left'  },
    { header: 'Date',           key: 'date',   width: 14, align: 'center' },
    { header: 'Due Date',       key: 'due',    width: 14, align: 'center' },
    { header: 'Subtotal',       key: 'sub',    width: 14, align: 'right', numFmt: CURR },
    { header: 'Discount',       key: 'disc',   width: 12, align: 'right', numFmt: CURR },
    { header: 'Tax Amount',     key: 'tax',    width: 13, align: 'right', numFmt: CURR },
    { header: 'Grand Total',    key: 'total',  width: 15, align: 'right', numFmt: CURR },
    { header: 'Paid Amount',    key: 'paid',   width: 14, align: 'right', numFmt: CURR },
    { header: 'Balance',        key: 'bal',    width: 13, align: 'right', numFmt: CURR },
    { header: 'Pay Method',     key: 'method', width: 14, align: 'left'  },
    { header: 'Status',         key: 'status', width: 12, align: 'center' },
  ];
  const ws2 = wb.addWorksheet('Invoice List');
  applyColConfig(ws2, invCols);
  addTitle(ws2, 'SALES — Invoice List', period, invCols.length);
  addHeaders(ws2, invCols);

  let totSub = 0, totDisc = 0, totTax = 0, totTotal = 0, totPaid = 0, totBal = 0;
  sorted.forEach((inv, i) => {
    const row = addDataRow(ws2, [
      inv.invoiceNumber,
      inv.customerName,
      inv.customerPhone || '',
      fd(inv.date),
      fd(inv.dueDate),
      n(inv.subtotal),
      n(inv.discountAmount),
      n(inv.taxAmount),
      n(inv.grandTotal),
      n(inv.paidAmount),
      n(inv.balanceAmount),
      cap(inv.paymentMethod),
      cap(inv.paymentStatus),
    ], i, invCols);
    colorStatus(row.getCell(13), inv.paymentStatus);
    totSub += n(inv.subtotal); totDisc += n(inv.discountAmount); totTax += n(inv.taxAmount);
    totTotal += n(inv.grandTotal); totPaid += n(inv.paidAmount); totBal += n(inv.balanceAmount);
  });
  addTotalsRow(ws2, ['TOTALS', '', '', '', '', totSub, totDisc, totTax, totTotal, totPaid, totBal, '', ''], invCols);

  // ── Sheet 3: Line Items ─────────────────────────────────────────────────────
  const liCols = [
    { header: 'Invoice #',   key: 'inv',    width: 16, align: 'left'  },
    { header: 'Customer',    key: 'cust',   width: 22, align: 'left'  },
    { header: 'Date',        key: 'date',   width: 14, align: 'center' },
    { header: 'Product',     key: 'prod',   width: 26, align: 'left'  },
    { header: 'HSN/SAC',     key: 'hsn',    width: 12, align: 'center' },
    { header: 'Qty',         key: 'qty',    width: 8,  align: 'right', numFmt: INT   },
    { header: 'Unit',        key: 'unit',   width: 8,  align: 'center' },
    { header: 'Unit Price',  key: 'price',  width: 13, align: 'right', numFmt: CURR  },
    { header: 'Discount',    key: 'disc',   width: 12, align: 'right', numFmt: CURR  },
    { header: 'Tax %',       key: 'taxpct', width: 9,  align: 'center' },
    { header: 'Tax Amt',     key: 'taxamt', width: 12, align: 'right', numFmt: CURR  },
    { header: 'Line Total',  key: 'ltotal', width: 14, align: 'right', numFmt: CURR  },
  ];
  const ws3 = wb.addWorksheet('Line Items');
  applyColConfig(ws3, liCols);
  addTitle(ws3, 'SALES — Line Items', period, liCols.length);
  addHeaders(ws3, liCols);

  let liIdx = 0;
  sorted.forEach((inv) => {
    (inv.items || []).forEach((item) => {
      const lineNet  = n(item.unitPrice) * n(item.quantity) - n(item.discount || 0);
      const lineTax  = (lineNet * n(item.taxPercent || 0)) / 100;
      addDataRow(ws3, [
        inv.invoiceNumber, inv.customerName, fd(inv.date),
        item.productName || item.name || '',
        item.hsnCode || item.hsn || '',
        n(item.quantity), item.unit || '',
        n(item.unitPrice), n(item.discount || 0),
        `${n(item.taxPercent || 0)}%`, lineTax, lineNet + lineTax,
      ], liIdx++, liCols);
    });
  });

  await saveWorkbook(wb, `Sales-Report-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASES
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportPurchases(purchases, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...purchases].sort((a, b) => b.date.localeCompare(a.date));
  const total  = sorted.reduce((s, p) => s + n(p.grandTotal), 0);
  const paidAmt = sorted.reduce((s, p) => s + n(p.paidAmount), 0);
  const bal    = sorted.reduce((s, p) => s + n(p.balanceAmount), 0);

  buildSummarySheet(wb, 'Summary', 'PURCHASE REPORT', period, [
    {
      title: 'Order Counts',
      rows: [
        ['Total Purchase Orders', sorted.length, ''],
        ['Received Orders',       sorted.filter((p) => p.status === 'received').length, 'good'],
        ['Pending Orders',        sorted.filter((p) => p.status !== 'received').length, ''],
      ],
    },
    {
      title: 'Financials',
      rows: [
        ['Total Value',       total,   'currency'],
        ['Total Paid',        paidAmt, 'currency'],
        ['Total Outstanding', bal,     'currency'],
        ['Avg Order Value',   sorted.length ? total / sorted.length : 0, 'currency'],
      ],
    },
  ]);

  const poCols = [
    { header: 'PO #',          key: 'po',     width: 16, align: 'left'  },
    { header: 'Supplier',      key: 'supp',   width: 22, align: 'left'  },
    { header: 'Phone',         key: 'phone',  width: 15, align: 'left'  },
    { header: 'Date',          key: 'date',   width: 14, align: 'center' },
    { header: 'Expected Date', key: 'exp',    width: 16, align: 'center' },
    { header: 'Grand Total',   key: 'total',  width: 15, align: 'right', numFmt: CURR },
    { header: 'Paid Amount',   key: 'paid',   width: 14, align: 'right', numFmt: CURR },
    { header: 'Balance',       key: 'bal',    width: 13, align: 'right', numFmt: CURR },
    { header: 'Pay Method',    key: 'method', width: 14, align: 'left'  },
    { header: 'Pay Status',    key: 'pstatus',width: 12, align: 'center' },
    { header: 'Order Status',  key: 'ostatus',width: 14, align: 'center' },
  ];
  const ws2 = wb.addWorksheet('Purchase Orders');
  applyColConfig(ws2, poCols);
  addTitle(ws2, 'PURCHASES — Order List', period, poCols.length);
  addHeaders(ws2, poCols);

  let totTotal = 0, totPaid = 0, totBal = 0;
  sorted.forEach((p, i) => {
    const row = addDataRow(ws2, [
      p.purchaseNumber, p.supplierName, p.supplierPhone || '',
      fd(p.date), fd(p.expectedDate),
      n(p.grandTotal), n(p.paidAmount), n(p.balanceAmount),
      cap(p.paymentMethod), cap(p.paymentStatus), cap(p.status),
    ], i, poCols);
    colorStatus(row.getCell(10), p.paymentStatus);
    const osCell = row.getCell(11);
    if ((p.status || '').toLowerCase() === 'received') {
      osCell.font = { ...osCell.font, color: { argb: C.GREEN }, bold: true };
      osCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GREEN_BG } };
    }
    totTotal += n(p.grandTotal); totPaid += n(p.paidAmount); totBal += n(p.balanceAmount);
  });
  addTotalsRow(ws2, ['TOTALS', '', '', '', '', totTotal, totPaid, totBal, '', '', ''], poCols);

  const liCols = [
    { header: 'PO #',       key: 'po',    width: 16, align: 'left'  },
    { header: 'Supplier',   key: 'supp',  width: 22, align: 'left'  },
    { header: 'Date',       key: 'date',  width: 14, align: 'center' },
    { header: 'Product',    key: 'prod',  width: 26, align: 'left'  },
    { header: 'SKU',        key: 'sku',   width: 14, align: 'left'  },
    { header: 'Qty',        key: 'qty',   width: 8,  align: 'right', numFmt: INT  },
    { header: 'Unit',       key: 'unit',  width: 8,  align: 'center' },
    { header: 'Unit Cost',  key: 'cost',  width: 13, align: 'right', numFmt: CURR },
    { header: 'Line Total', key: 'lt',    width: 14, align: 'right', numFmt: CURR },
  ];
  const ws3 = wb.addWorksheet('Line Items');
  applyColConfig(ws3, liCols);
  addTitle(ws3, 'PURCHASES — Line Items', period, liCols.length);
  addHeaders(ws3, liCols);
  let idx = 0;
  sorted.forEach((p) => {
    (p.items || []).forEach((item) => {
      const uc = n(item.unitCost || item.unitPrice || 0);
      addDataRow(ws3, [
        p.purchaseNumber, p.supplierName, fd(p.date),
        item.productName || item.name || '', item.sku || '',
        n(item.quantity), item.unit || '', uc,
        uc * n(item.quantity),
      ], idx++, liCols);
    });
  });

  await saveWorkbook(wb, `Purchase-Report-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFIT & LOSS
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportProfit(invoices, salesReturns, products, period) {
  const wb = new ExcelJS.Workbook();

  const grossSales     = invoices.reduce((s, i) => s + n(i.grandTotal), 0);
  const returnedAmount = salesReturns.reduce((s, r) => s + n(r.totalAmount), 0);
  const netSales       = grossSales - returnedAmount;

  const byProd = {};
  invoices.forEach((inv) => {
    (inv.items || []).forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const id   = item.productId;
      if (!byProd[id]) byProd[id] = { name: item.productName || item.name, sku: prod?.sku || '', sold: 0, returned: 0, revenue: 0, cost: 0 };
      byProd[id].sold    += n(item.quantity);
      byProd[id].revenue += n(item.unitPrice) * n(item.quantity);
      byProd[id].cost    += n(prod?.purchasePrice) * n(item.quantity);
    });
  });
  salesReturns.forEach((ret) => {
    (ret.items || []).forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (byProd[item.productId]) {
        byProd[item.productId].returned += n(item.returnQty);
        byProd[item.productId].revenue  -= n(item.unitPrice) * n(item.returnQty);
        byProd[item.productId].cost     -= n(prod?.purchasePrice) * n(item.returnQty);
      }
    });
  });

  const prodRows = Object.values(byProd)
    .filter((r) => r.sold > 0)
    .map((r) => {
      r.cost = Math.max(0, r.cost);
      const profit = r.revenue - r.cost;
      const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
      return { ...r, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit);

  const totalCOGS   = prodRows.reduce((s, r) => s + r.cost, 0);
  const grossProfit = netSales - totalCOGS;
  const margin      = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  buildSummarySheet(wb, 'P&L Summary', 'PROFIT & LOSS REPORT', period, [
    {
      title: 'Income Statement',
      rows: [
        ['Gross Sales Revenue',       grossSales,     'currency'],
        ['Less: Sales Returns',        returnedAmount, 'currency'],
        ['Net Sales',                  netSales,       'currency'],
        ['Less: Cost of Goods Sold',   totalCOGS,      'currency'],
        ['Gross Profit',               grossProfit,    grossProfit >= 0 ? 'good' : 'bad'],
        ['Gross Profit Margin',        `${margin.toFixed(1)}%`, 'pct'],
      ],
    },
    {
      title: 'Volume',
      rows: [
        ['Products Sold', prodRows.length, ''],
        ['Total Units Sold',     prodRows.reduce((s, r) => s + r.sold, 0), ''],
        ['Total Units Returned', prodRows.reduce((s, r) => s + r.returned, 0), ''],
      ],
    },
  ]);

  const cols = [
    { header: 'Product',       key: 'prod',    width: 28, align: 'left'  },
    { header: 'SKU',           key: 'sku',     width: 14, align: 'left'  },
    { header: 'Units Sold',    key: 'sold',    width: 12, align: 'right', numFmt: INT  },
    { header: 'Returns',       key: 'ret',     width: 10, align: 'right', numFmt: INT  },
    { header: 'Net Units',     key: 'net',     width: 10, align: 'right', numFmt: INT  },
    { header: 'Revenue',       key: 'rev',     width: 15, align: 'right', numFmt: CURR },
    { header: 'COGS',          key: 'cogs',    width: 15, align: 'right', numFmt: CURR },
    { header: 'Gross Profit',  key: 'profit',  width: 15, align: 'right', numFmt: CURR },
    { header: 'Margin %',      key: 'margin',  width: 11, align: 'center' },
  ];
  const ws2 = wb.addWorksheet('By Product');
  applyColConfig(ws2, cols);
  addTitle(ws2, 'PROFIT & LOSS — By Product', period, cols.length);
  addHeaders(ws2, cols);

  prodRows.forEach((r, i) => {
    const row = addDataRow(ws2, [
      r.name, r.sku, r.sold, r.returned, r.sold - r.returned,
      r.revenue, r.cost, r.profit, `${r.margin.toFixed(1)}%`,
    ], i, cols);
    const profitCell = row.getCell(8);
    if (r.profit < 0) { profitCell.font = { ...profitCell.font, color: { argb: C.RED } }; }
    else { profitCell.font = { ...profitCell.font, color: { argb: C.GREEN } }; }
    const marginCell = row.getCell(9);
    if (r.margin >= 25) marginCell.font = { ...marginCell.font, color: { argb: C.GREEN }, bold: true };
    else if (r.margin < 0) marginCell.font = { ...marginCell.font, color: { argb: C.RED }, bold: true };
  });

  const totRev = prodRows.reduce((s, r) => s + r.revenue, 0);
  const totCogs = prodRows.reduce((s, r) => s + r.cost, 0);
  const totProfit = prodRows.reduce((s, r) => s + r.profit, 0);
  addTotalsRow(ws2,
    ['TOTALS', '',
      prodRows.reduce((s, r) => s + r.sold, 0),
      prodRows.reduce((s, r) => s + r.returned, 0),
      prodRows.reduce((s, r) => s + r.sold - r.returned, 0),
      totRev, totCogs, totProfit,
      netSales > 0 ? `${((totProfit / totRev) * 100).toFixed(1)}%` : '0%'],
    cols);

  await saveWorkbook(wb, `Profit-Loss-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GST / TAX
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportTax(invoices, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date));
  const totalTax  = sorted.reduce((s, i) => s + n(i.taxAmount), 0);
  const paidTax   = sorted.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + n(i.taxAmount), 0);
  const totalRev  = sorted.reduce((s, i) => s + n(i.grandTotal), 0);

  buildSummarySheet(wb, 'Summary', 'GST / TAX REPORT', period, [
    {
      title: 'Tax Summary',
      rows: [
        ['Total Invoices',           sorted.length, ''],
        ['Total Tax Billed',         totalTax,      'currency'],
        ['Tax Collected (Paid Inv.)',  paidTax,      'currency'],
        ['Tax Pending (Unpaid/Partial)', totalTax - paidTax, 'currency'],
        ['Gross Revenue',            totalRev,      'currency'],
        ['Effective Tax Rate',       totalRev > 0 ? `${((totalTax / totalRev) * 100).toFixed(2)}%` : '0%', 'pct'],
      ],
    },
  ]);

  const invCols = [
    { header: 'Invoice #',      key: 'inv',    width: 16, align: 'left'   },
    { header: 'Customer',       key: 'cust',   width: 22, align: 'left'   },
    { header: 'Date',           key: 'date',   width: 14, align: 'center'  },
    { header: 'Subtotal',       key: 'sub',    width: 14, align: 'right',  numFmt: CURR },
    { header: 'Discount',       key: 'disc',   width: 12, align: 'right',  numFmt: CURR },
    { header: 'Taxable Amt',    key: 'taxable',width: 14, align: 'right',  numFmt: CURR },
    { header: 'Tax Rate %',     key: 'rate',   width: 11, align: 'center'  },
    { header: 'CGST',           key: 'cgst',   width: 13, align: 'right',  numFmt: CURR },
    { header: 'SGST',           key: 'sgst',   width: 13, align: 'right',  numFmt: CURR },
    { header: 'IGST',           key: 'igst',   width: 13, align: 'right',  numFmt: CURR },
    { header: 'Total Tax',      key: 'tax',    width: 13, align: 'right',  numFmt: CURR },
    { header: 'Grand Total',    key: 'total',  width: 15, align: 'right',  numFmt: CURR },
    { header: 'Status',         key: 'status', width: 12, align: 'center'  },
  ];
  const ws2 = wb.addWorksheet('Invoice Tax Details');
  applyColConfig(ws2, invCols);
  addTitle(ws2, 'GST / TAX — Invoice Details', period, invCols.length);
  addHeaders(ws2, invCols);

  let totSub=0, totDisc=0, totTaxable=0, totCGST=0, totSGST=0, totTax=0, totTotal=0;
  sorted.forEach((inv, i) => {
    const taxable = Math.max(0, n(inv.subtotal) - n(inv.discountAmount));
    const rate    = taxable > 0 ? ((n(inv.taxAmount) / taxable) * 100) : 0;
    const half    = n(inv.taxAmount) / 2;
    const row = addDataRow(ws2, [
      inv.invoiceNumber, inv.customerName, fd(inv.date),
      n(inv.subtotal), n(inv.discountAmount), taxable,
      `${rate.toFixed(1)}%`, half, half, 0,
      n(inv.taxAmount), n(inv.grandTotal), cap(inv.paymentStatus),
    ], i, invCols);
    colorStatus(row.getCell(13), inv.paymentStatus);
    totSub += n(inv.subtotal); totDisc += n(inv.discountAmount); totTaxable += taxable;
    totCGST += half; totSGST += half; totTax += n(inv.taxAmount); totTotal += n(inv.grandTotal);
  });
  addTotalsRow(ws2, ['TOTALS', '', '', totSub, totDisc, totTaxable, '', totCGST, totSGST, 0, totTax, totTotal, ''], invCols);

  // Tax by rate
  const byRate = {};
  sorted.forEach((inv) => {
    (inv.items || []).forEach((item) => {
      const rate = n(item.taxPercent);
      const key  = `${rate}%`;
      if (!byRate[key]) byRate[key] = { taxable: 0, taxAmt: 0, lines: 0 };
      const lineNet = n(item.unitPrice) * n(item.quantity) - n(item.discount || 0);
      byRate[key].taxable += lineNet;
      byRate[key].taxAmt  += (lineNet * rate) / 100;
      byRate[key].lines++;
    });
  });
  const rateCols = [
    { header: 'Tax Rate',       key: 'rate',    width: 12, align: 'center' },
    { header: 'Taxable Amount', key: 'taxable', width: 18, align: 'right', numFmt: CURR },
    { header: 'Total Tax',      key: 'tax',     width: 16, align: 'right', numFmt: CURR },
    { header: 'CGST (50%)',     key: 'cgst',    width: 16, align: 'right', numFmt: CURR },
    { header: 'SGST (50%)',     key: 'sgst',    width: 16, align: 'right', numFmt: CURR },
    { header: 'IGST',           key: 'igst',    width: 14, align: 'right', numFmt: CURR },
    { header: 'No. of Lines',   key: 'lines',   width: 13, align: 'right', numFmt: INT  },
  ];
  const ws3 = wb.addWorksheet('Tax by Rate');
  applyColConfig(ws3, rateCols);
  addTitle(ws3, 'GST / TAX — Grouped by Rate', period, rateCols.length);
  addHeaders(ws3, rateCols);
  Object.entries(byRate).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).forEach(([rate, d], i) => {
    addDataRow(ws3, [rate, d.taxable, d.taxAmt, d.taxAmt / 2, d.taxAmt / 2, 0, d.lines], i, rateCols);
  });

  await saveWorkbook(wb, `GST-Tax-Report-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportPayments(invoices, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date));

  const byMethod = {};
  sorted.forEach((inv) => {
    const m = inv.paymentMethod || 'unspecified';
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
    byMethod[m].count++;
    byMethod[m].total += n(inv.paidAmount);
  });

  const totalCollected   = sorted.reduce((s, i) => s + n(i.paidAmount), 0);
  const totalOutstanding = sorted.reduce((s, i) => s + n(i.balanceAmount), 0);

  buildSummarySheet(wb, 'Summary', 'PAYMENT REPORT', period, [
    {
      title: 'Collection Summary',
      rows: [
        ['Total Invoices',    sorted.length,    ''],
        ['Total Collected',   totalCollected,   'currency'],
        ['Total Outstanding', totalOutstanding, 'currency'],
        ['Collection Rate',   totalCollected + totalOutstanding > 0
          ? `${((totalCollected / (totalCollected + totalOutstanding)) * 100).toFixed(1)}%`
          : '0%', 'pct'],
      ],
    },
    {
      title: 'By Payment Method',
      rows: Object.entries(byMethod).map(([m, d]) => [cap(m), `${d.count} invoices — ${d.total.toFixed(2)}`, '']),
    },
  ]);

  const cols = [
    { header: 'Invoice #',    key: 'inv',    width: 16, align: 'left'   },
    { header: 'Customer',     key: 'cust',   width: 22, align: 'left'   },
    { header: 'Date',         key: 'date',   width: 14, align: 'center'  },
    { header: 'Grand Total',  key: 'total',  width: 15, align: 'right',  numFmt: CURR },
    { header: 'Paid Amount',  key: 'paid',   width: 14, align: 'right',  numFmt: CURR },
    { header: 'Balance',      key: 'bal',    width: 13, align: 'right',  numFmt: CURR },
    { header: 'Pay Method',   key: 'method', width: 16, align: 'left'   },
    { header: 'Status',       key: 'status', width: 12, align: 'center'  },
    { header: 'Notes',        key: 'notes',  width: 24, align: 'left'   },
  ];
  const ws2 = wb.addWorksheet('Payment Details');
  applyColConfig(ws2, cols);
  addTitle(ws2, 'PAYMENTS — Invoice Details', period, cols.length);
  addHeaders(ws2, cols);
  let totTotal=0, totPaid=0, totBal=0;
  sorted.forEach((inv, i) => {
    const row = addDataRow(ws2, [
      inv.invoiceNumber, inv.customerName, fd(inv.date),
      n(inv.grandTotal), n(inv.paidAmount), n(inv.balanceAmount),
      cap(inv.paymentMethod), cap(inv.paymentStatus),
      inv.paymentNotes || inv.notes || '',
    ], i, cols);
    colorStatus(row.getCell(8), inv.paymentStatus);
    totTotal += n(inv.grandTotal); totPaid += n(inv.paidAmount); totBal += n(inv.balanceAmount);
  });
  addTotalsRow(ws2, ['TOTALS', '', '', totTotal, totPaid, totBal, '', '', ''], cols);

  await saveWorkbook(wb, `Payment-Report-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALES RETURNS
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportSalesReturns(salesReturns, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...salesReturns].sort((a, b) => b.date.localeCompare(a.date));
  const total  = sorted.reduce((s, r) => s + n(r.totalAmount), 0);

  buildSummarySheet(wb, 'Summary', 'SALES RETURNS REPORT', period, [
    {
      title: 'Returns Summary',
      rows: [
        ['Total Returns',    sorted.length, ''],
        ['Total Refund Amt', total,         'currency'],
        ['Avg Refund',       sorted.length ? total / sorted.length : 0, 'currency'],
      ],
    },
  ]);

  const retCols = [
    { header: 'Return #',     key: 'ret',   width: 16, align: 'left'   },
    { header: 'Invoice #',    key: 'inv',   width: 16, align: 'left'   },
    { header: 'Customer',     key: 'cust',  width: 22, align: 'left'   },
    { header: 'Date',         key: 'date',  width: 14, align: 'center'  },
    { header: 'Reason',       key: 'reason',width: 22, align: 'left'   },
    { header: 'No. Items',    key: 'items', width: 10, align: 'right',  numFmt: INT  },
    { header: 'Refund Amt',   key: 'refund',width: 15, align: 'right',  numFmt: CURR },
  ];
  const ws2 = wb.addWorksheet('Returns List');
  applyColConfig(ws2, retCols);
  addTitle(ws2, 'SALES RETURNS — List', period, retCols.length);
  addHeaders(ws2, retCols);
  sorted.forEach((r, i) => {
    addDataRow(ws2, [r.returnNumber, r.invoiceNumber, r.customerName, fd(r.date), cap(r.reason), r.items.length, n(r.totalAmount)], i, retCols);
  });
  addTotalsRow(ws2, ['TOTALS', '', '', '', '', sorted.reduce((s,r)=>s+r.items.length,0), total], retCols);

  const liCols = [
    { header: 'Return #',    key: 'ret',    width: 16, align: 'left'  },
    { header: 'Invoice #',   key: 'inv',    width: 16, align: 'left'  },
    { header: 'Customer',    key: 'cust',   width: 22, align: 'left'  },
    { header: 'Date',        key: 'date',   width: 14, align: 'center' },
    { header: 'Product',     key: 'prod',   width: 26, align: 'left'  },
    { header: 'Return Qty',  key: 'qty',    width: 11, align: 'right', numFmt: INT  },
    { header: 'Unit',        key: 'unit',   width: 8,  align: 'center' },
    { header: 'Unit Price',  key: 'price',  width: 13, align: 'right', numFmt: CURR },
    { header: 'Discount',    key: 'disc',   width: 12, align: 'right', numFmt: CURR },
    { header: 'Tax %',       key: 'taxpct', width: 9,  align: 'center' },
    { header: 'Line Total',  key: 'lt',     width: 14, align: 'right', numFmt: CURR },
  ];
  const ws3 = wb.addWorksheet('Line Items');
  applyColConfig(ws3, liCols);
  addTitle(ws3, 'SALES RETURNS — Line Items', period, liCols.length);
  addHeaders(ws3, liCols);
  let idx = 0;
  sorted.forEach((r) => {
    (r.items || []).forEach((item) => {
      const lineNet = n(item.unitPrice) * n(item.returnQty) - n(item.discount || 0);
      const lineTax = (lineNet * n(item.taxPercent || 0)) / 100;
      addDataRow(ws3, [
        r.returnNumber, r.invoiceNumber, r.customerName, fd(r.date),
        item.productName || item.name || '',
        n(item.returnQty), item.unit || '',
        n(item.unitPrice), n(item.discount || 0),
        `${n(item.taxPercent || 0)}%`, lineNet + lineTax,
      ], idx++, liCols);
    });
  });

  await saveWorkbook(wb, `Sales-Returns-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE RETURNS
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportPurchaseReturns(purchaseReturns, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...purchaseReturns].sort((a, b) => b.date.localeCompare(a.date));
  const total  = sorted.reduce((s, r) => s + n(r.totalAmount), 0);

  buildSummarySheet(wb, 'Summary', 'PURCHASE RETURNS REPORT', period, [
    {
      title: 'Returns Summary',
      rows: [
        ['Total Returns',    sorted.length, ''],
        ['Total Credit Amt', total,         'currency'],
        ['Avg Return',       sorted.length ? total / sorted.length : 0, 'currency'],
      ],
    },
  ]);

  const retCols = [
    { header: 'Return #',   key: 'ret',    width: 16, align: 'left'   },
    { header: 'PO #',       key: 'po',     width: 16, align: 'left'   },
    { header: 'Supplier',   key: 'supp',   width: 22, align: 'left'   },
    { header: 'Date',       key: 'date',   width: 14, align: 'center'  },
    { header: 'Reason',     key: 'reason', width: 22, align: 'left'   },
    { header: 'No. Items',  key: 'items',  width: 10, align: 'right',  numFmt: INT  },
    { header: 'Credit Amt', key: 'credit', width: 15, align: 'right',  numFmt: CURR },
  ];
  const ws2 = wb.addWorksheet('Returns List');
  applyColConfig(ws2, retCols);
  addTitle(ws2, 'PURCHASE RETURNS — List', period, retCols.length);
  addHeaders(ws2, retCols);
  sorted.forEach((r, i) => {
    addDataRow(ws2, [r.returnNumber, r.purchaseNumber, r.supplierName, fd(r.date), cap(r.reason), r.items.length, n(r.totalAmount)], i, retCols);
  });

  const liCols = [
    { header: 'Return #',   key: 'ret',  width: 16, align: 'left'  },
    { header: 'PO #',       key: 'po',   width: 16, align: 'left'  },
    { header: 'Supplier',   key: 'supp', width: 22, align: 'left'  },
    { header: 'Date',       key: 'date', width: 14, align: 'center' },
    { header: 'Product',    key: 'prod', width: 26, align: 'left'  },
    { header: 'SKU',        key: 'sku',  width: 14, align: 'left'  },
    { header: 'Return Qty', key: 'qty',  width: 11, align: 'right', numFmt: INT  },
    { header: 'Unit Cost',  key: 'cost', width: 13, align: 'right', numFmt: CURR },
    { header: 'Line Total', key: 'lt',   width: 14, align: 'right', numFmt: CURR },
  ];
  const ws3 = wb.addWorksheet('Line Items');
  applyColConfig(ws3, liCols);
  addTitle(ws3, 'PURCHASE RETURNS — Line Items', period, liCols.length);
  addHeaders(ws3, liCols);
  let idx = 0;
  sorted.forEach((r) => {
    (r.items || []).forEach((item) => {
      const uc = n(item.unitCost || item.unitPrice || 0);
      addDataRow(ws3, [
        r.returnNumber, r.purchaseNumber, r.supplierName, fd(r.date),
        item.productName || item.name || '', item.sku || '',
        n(item.returnQty), uc, uc * n(item.returnQty),
      ], idx++, liCols);
    });
  });

  await saveWorkbook(wb, `Purchase-Returns-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK LEDGER
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportStock(products, categories, period) {
  const wb = new ExcelJS.Workbook();

  const costValue   = products.reduce((s, p) => s + n(p.purchasePrice) * n(p.stock), 0);
  const retailValue = products.reduce((s, p) => s + n(p.sellingPrice)  * n(p.stock), 0);

  buildSummarySheet(wb, 'Summary', 'STOCK LEDGER REPORT', period, [
    {
      title: 'Inventory Overview',
      rows: [
        ['Total Products',           products.length, ''],
        ['Total Stock Units',         products.reduce((s, p) => s + n(p.stock), 0), ''],
        ['Inventory Value (Cost)',     costValue,   'currency'],
        ['Inventory Value (Retail)',   retailValue, 'currency'],
        ['Potential Gross Profit',     retailValue - costValue, 'currency'],
        ['Out of Stock Items',         products.filter((p) => p.stock === 0).length, 'bad'],
        ['Low Stock Items',            products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length, ''],
        ['Healthy Stock Items',        products.filter((p) => p.stock > p.minStock).length, 'good'],
      ],
    },
  ]);

  const cols = [
    { header: 'Product Name',    key: 'name',   width: 28, align: 'left'   },
    { header: 'SKU',             key: 'sku',    width: 14, align: 'left'   },
    { header: 'Category',        key: 'cat',    width: 16, align: 'left'   },
    { header: 'Unit',            key: 'unit',   width: 8,  align: 'center'  },
    { header: 'Current Stock',   key: 'stock',  width: 14, align: 'right',  numFmt: INT  },
    { header: 'Min Stock',       key: 'min',    width: 12, align: 'right',  numFmt: INT  },
    { header: 'Purchase Price',  key: 'pp',     width: 15, align: 'right',  numFmt: CURR },
    { header: 'Selling Price',   key: 'sp',     width: 14, align: 'right',  numFmt: CURR },
    { header: 'Margin %',        key: 'margin', width: 11, align: 'center'  },
    { header: 'Cost Value',      key: 'cval',   width: 14, align: 'right',  numFmt: CURR },
    { header: 'Retail Value',    key: 'rval',   width: 14, align: 'right',  numFmt: CURR },
    { header: 'Status',          key: 'status', width: 14, align: 'center'  },
  ];
  const ws2 = wb.addWorksheet('Stock Ledger');
  applyColConfig(ws2, cols);
  addTitle(ws2, 'STOCK LEDGER — All Products', period, cols.length);
  addHeaders(ws2, cols);

  let totStock=0, totCostVal=0, totRetailVal=0;
  products.forEach((p, i) => {
    const cat    = categories.find((c) => c.id === p.categoryId);
    const margin = n(p.sellingPrice) > 0 ? ((n(p.sellingPrice) - n(p.purchasePrice)) / n(p.sellingPrice)) * 100 : 0;
    const cval   = n(p.purchasePrice) * n(p.stock);
    const rval   = n(p.sellingPrice)  * n(p.stock);
    const status = p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStock ? 'Low Stock' : 'In Stock';
    const row = addDataRow(ws2, [
      p.name, p.sku, cat?.name || '', p.unit || '',
      n(p.stock), n(p.minStock),
      n(p.purchasePrice), n(p.sellingPrice), `${margin.toFixed(1)}%`,
      cval, rval, status,
    ], i, cols);
    colorStatus(row.getCell(12), status);
    totStock += n(p.stock); totCostVal += cval; totRetailVal += rval;
  });
  addTotalsRow(ws2, ['TOTALS', '', '', '', totStock, '', '', '', '', totCostVal, totRetailVal, ''], cols);

  await saveWorkbook(wb, `Stock-Ledger-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportStockMovements(transactions, period) {
  const wb     = new ExcelJS.Workbook();
  const sorted = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalIn  = sorted.reduce((s, t) => s + n(t.quantityIn), 0);
  const totalOut = sorted.reduce((s, t) => s + n(t.quantityOut), 0);

  buildSummarySheet(wb, 'Summary', 'STOCK MOVEMENTS REPORT', period, [
    {
      title: 'Movement Summary',
      rows: [
        ['Total Transactions', sorted.length, ''],
        ['Total Stock In',     totalIn,       'good'],
        ['Total Stock Out',    totalOut,      'bad'],
        ['Net Movement',       totalIn - totalOut, totalIn >= totalOut ? 'good' : 'bad'],
      ],
    },
  ]);

  const cols = [
    { header: 'Date',           key: 'date',  width: 16, align: 'center'  },
    { header: 'Product',        key: 'prod',  width: 26, align: 'left'   },
    { header: 'SKU',            key: 'sku',   width: 14, align: 'left'   },
    { header: 'Type',           key: 'type',  width: 18, align: 'left'   },
    { header: 'Reference #',    key: 'ref',   width: 16, align: 'left'   },
    { header: 'Qty In',         key: 'in',    width: 10, align: 'right',  numFmt: INT },
    { header: 'Qty Out',        key: 'out',   width: 10, align: 'right',  numFmt: INT },
    { header: 'Stock Before',   key: 'before',width: 14, align: 'right',  numFmt: INT },
    { header: 'Stock After',    key: 'after', width: 13, align: 'right',  numFmt: INT },
    { header: 'Notes',          key: 'notes', width: 22, align: 'left'   },
  ];
  const ws2 = wb.addWorksheet('Movements');
  applyColConfig(ws2, cols);
  addTitle(ws2, 'STOCK MOVEMENTS — Full Ledger', period, cols.length);
  addHeaders(ws2, cols);

  sorted.forEach((t, i) => {
    const after  = n(t.newStock);
    const before = after + n(t.quantityOut) - n(t.quantityIn);
    const row = addDataRow(ws2, [
      fd(t.createdAt), t.productName || '', t.sku || '',
      cap(t.transactionType?.replace(/_/g, ' ') || ''),
      t.referenceNumber || '',
      n(t.quantityIn) || '', n(t.quantityOut) || '',
      before, after, t.notes || '',
    ], i, cols);
    const inCell = row.getCell(6);
    if (n(t.quantityIn) > 0) { inCell.font = { ...inCell.font, color: { argb: C.GREEN }, bold: true }; }
    const outCell = row.getCell(7);
    if (n(t.quantityOut) > 0) { outCell.font = { ...outCell.font, color: { argb: C.RED }, bold: true }; }
  });
  addTotalsRow(ws2, ['TOTALS', '', '', '', '', totalIn, totalOut, '', '', ''], cols);

  await saveWorkbook(wb, `Stock-Movements-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOW STOCK
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportLowStock(products, categories, period) {
  const wb    = new ExcelJS.Workbook();
  const items = products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock);
  const totalRestock = items.reduce((s, p) => s + Math.max(0, p.minStock - p.stock) * n(p.purchasePrice), 0);

  buildSummarySheet(wb, 'Summary', 'LOW STOCK REPORT', period, [
    {
      title: 'Stock Alert Summary',
      rows: [
        ['Total Low / Out-of-Stock', items.length,                                          'bad'],
        ['Out of Stock',             items.filter((p) => p.stock === 0).length,             'bad'],
        ['Low Stock (above 0)',      items.filter((p) => p.stock > 0).length,               ''],
        ['Estimated Restock Cost',   totalRestock,                                          'currency'],
      ],
    },
  ]);

  const cols = [
    { header: 'Product',          key: 'name',   width: 28, align: 'left'   },
    { header: 'SKU',              key: 'sku',    width: 14, align: 'left'   },
    { header: 'Category',         key: 'cat',    width: 16, align: 'left'   },
    { header: 'Unit',             key: 'unit',   width: 8,  align: 'center'  },
    { header: 'Current Stock',    key: 'stock',  width: 14, align: 'right',  numFmt: INT  },
    { header: 'Min Stock',        key: 'min',    width: 12, align: 'right',  numFmt: INT  },
    { header: 'Qty Needed',       key: 'needed', width: 12, align: 'right',  numFmt: INT  },
    { header: 'Purchase Price',   key: 'pp',     width: 15, align: 'right',  numFmt: CURR },
    { header: 'Restock Cost',     key: 'rc',     width: 14, align: 'right',  numFmt: CURR },
    { header: 'Selling Price',    key: 'sp',     width: 14, align: 'right',  numFmt: CURR },
    { header: 'Status',           key: 'status', width: 14, align: 'center'  },
  ];
  const ws2 = wb.addWorksheet('Low Stock Items');
  applyColConfig(ws2, cols);
  addTitle(ws2, 'LOW STOCK — Items Requiring Restock', period, cols.length);
  addHeaders(ws2, cols);

  items.forEach((p, i) => {
    const cat    = categories.find((c) => c.id === p.categoryId);
    const needed = Math.max(0, p.minStock - p.stock);
    const status = p.stock === 0 ? 'Out of Stock' : 'Low Stock';
    const row = addDataRow(ws2, [
      p.name, p.sku, cat?.name || '', p.unit || '',
      n(p.stock), n(p.minStock), needed,
      n(p.purchasePrice), needed * n(p.purchasePrice),
      n(p.sellingPrice), status,
    ], i, cols);
    colorStatus(row.getCell(11), status);
    const stockCell = row.getCell(5);
    if (p.stock === 0) stockCell.font = { ...stockCell.font, color: { argb: C.RED }, bold: true };
    else stockCell.font = { ...stockCell.font, color: { argb: C.AMBER }, bold: true };
  });
  addTotalsRow(ws2, [
    'TOTALS', '', '', '',
    items.reduce((s, p) => s + n(p.stock), 0), '',
    items.reduce((s, p) => s + Math.max(0, p.minStock - p.stock), 0),
    '', totalRestock, '', '',
  ], cols);

  await saveWorkbook(wb, `Low-Stock-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER OUTSTANDING
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportCustomerOutstanding(invoices, period) {
  const wb = new ExcelJS.Workbook();

  const byCustomer = {};
  invoices
    .filter((i) => i.paymentStatus !== 'paid' && n(i.balanceAmount) > 0)
    .forEach((inv) => {
      const cid = inv.customerId || 'walkin';
      if (!byCustomer[cid]) byCustomer[cid] = { name: inv.customerName, phone: inv.customerPhone || '', invoices: [], totalBalance: 0, totalBilled: 0 };
      byCustomer[cid].invoices.push(inv);
      byCustomer[cid].totalBalance += n(inv.balanceAmount);
      byCustomer[cid].totalBilled  += n(inv.grandTotal);
    });
  const customers    = Object.values(byCustomer).sort((a, b) => b.totalBalance - a.totalBalance);
  const grandBalance = customers.reduce((s, c) => s + c.totalBalance, 0);
  const grandBilled  = customers.reduce((s, c) => s + c.totalBilled, 0);

  buildSummarySheet(wb, 'Summary', 'CUSTOMER OUTSTANDING REPORT', period, [
    {
      title: 'Outstanding Summary',
      rows: [
        ['Customers with Balance', customers.length, 'bad'],
        ['Total Outstanding',      grandBalance,     'currency'],
        ['Total Billed (Unpaid)',   grandBilled,      'currency'],
        ['Total Unpaid Invoices',   customers.reduce((s, c) => s + c.invoices.length, 0), ''],
      ],
    },
  ]);

  const custCols = [
    { header: 'Customer',         key: 'name',  width: 24, align: 'left'   },
    { header: 'Phone',            key: 'phone', width: 16, align: 'left'   },
    { header: 'No. of Invoices',  key: 'inv',   width: 15, align: 'right',  numFmt: INT  },
    { header: 'Total Billed',     key: 'billed',width: 16, align: 'right',  numFmt: CURR },
    { header: 'Total Outstanding',key: 'bal',   width: 18, align: 'right',  numFmt: CURR },
  ];
  const ws2 = wb.addWorksheet('By Customer');
  applyColConfig(ws2, custCols);
  addTitle(ws2, 'CUSTOMER OUTSTANDING — By Customer', period, custCols.length);
  addHeaders(ws2, custCols);
  customers.forEach((c, i) => {
    const row = addDataRow(ws2, [c.name, c.phone, c.invoices.length, c.totalBilled, c.totalBalance], i, custCols);
    row.getCell(5).font = { bold: true, color: { argb: C.AMBER } };
  });
  addTotalsRow(ws2, ['TOTALS', '', customers.reduce((s, c) => s + c.invoices.length, 0), grandBilled, grandBalance], custCols);

  const invCols = [
    { header: 'Customer',    key: 'cust',   width: 22, align: 'left'   },
    { header: 'Invoice #',   key: 'inv',    width: 16, align: 'left'   },
    { header: 'Date',        key: 'date',   width: 14, align: 'center'  },
    { header: 'Due Date',    key: 'due',    width: 14, align: 'center'  },
    { header: 'Grand Total', key: 'total',  width: 15, align: 'right',  numFmt: CURR },
    { header: 'Paid Amount', key: 'paid',   width: 14, align: 'right',  numFmt: CURR },
    { header: 'Balance',     key: 'bal',    width: 14, align: 'right',  numFmt: CURR },
    { header: 'Status',      key: 'status', width: 12, align: 'center'  },
  ];
  const ws3 = wb.addWorksheet('Invoice Details');
  applyColConfig(ws3, invCols);
  addTitle(ws3, 'CUSTOMER OUTSTANDING — Invoice Details', period, invCols.length);
  addHeaders(ws3, invCols);
  let idx = 0;
  customers.forEach((c) => {
    c.invoices.sort((a, b) => b.date.localeCompare(a.date)).forEach((inv) => {
      const row = addDataRow(ws3, [
        c.name, inv.invoiceNumber, fd(inv.date), fd(inv.dueDate),
        n(inv.grandTotal), n(inv.paidAmount), n(inv.balanceAmount), cap(inv.paymentStatus),
      ], idx++, invCols);
      colorStatus(row.getCell(8), inv.paymentStatus);
      row.getCell(7).font = { bold: true, color: { argb: C.AMBER } };
    });
  });

  await saveWorkbook(wb, `Customer-Outstanding-${period}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER OUTSTANDING
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportSupplierOutstanding(purchases, period) {
  const wb = new ExcelJS.Workbook();

  const bySupplier = {};
  purchases
    .filter((p) => p.paymentStatus !== 'paid' && n(p.balanceAmount) > 0)
    .forEach((pur) => {
      const sid = pur.supplierId || 'unknown';
      if (!bySupplier[sid]) bySupplier[sid] = { name: pur.supplierName, phone: pur.supplierPhone || '', purchases: [], totalBalance: 0, totalBilled: 0 };
      bySupplier[sid].purchases.push(pur);
      bySupplier[sid].totalBalance += n(pur.balanceAmount);
      bySupplier[sid].totalBilled  += n(pur.grandTotal);
    });
  const suppliers   = Object.values(bySupplier).sort((a, b) => b.totalBalance - a.totalBalance);
  const grandBalance = suppliers.reduce((s, c) => s + c.totalBalance, 0);
  const grandBilled  = suppliers.reduce((s, c) => s + c.totalBilled, 0);

  buildSummarySheet(wb, 'Summary', 'SUPPLIER OUTSTANDING REPORT', period, [
    {
      title: 'Outstanding Summary',
      rows: [
        ['Suppliers with Balance', suppliers.length, 'bad'],
        ['Total Outstanding',      grandBalance,     'currency'],
        ['Total Billed (Unpaid)',   grandBilled,      'currency'],
        ['Total Unpaid POs',        suppliers.reduce((s, c) => s + c.purchases.length, 0), ''],
      ],
    },
  ]);

  const suppCols = [
    { header: 'Supplier',         key: 'name',  width: 24, align: 'left'   },
    { header: 'Phone',            key: 'phone', width: 16, align: 'left'   },
    { header: 'No. of POs',       key: 'po',    width: 13, align: 'right',  numFmt: INT  },
    { header: 'Total Billed',     key: 'billed',width: 16, align: 'right',  numFmt: CURR },
    { header: 'Total Outstanding',key: 'bal',   width: 18, align: 'right',  numFmt: CURR },
  ];
  const ws2 = wb.addWorksheet('By Supplier');
  applyColConfig(ws2, suppCols);
  addTitle(ws2, 'SUPPLIER OUTSTANDING — By Supplier', period, suppCols.length);
  addHeaders(ws2, suppCols);
  suppliers.forEach((s, i) => {
    const row = addDataRow(ws2, [s.name, s.phone, s.purchases.length, s.totalBilled, s.totalBalance], i, suppCols);
    row.getCell(5).font = { bold: true, color: { argb: C.RED } };
  });
  addTotalsRow(ws2, ['TOTALS', '', suppliers.reduce((s, c) => s + c.purchases.length, 0), grandBilled, grandBalance], suppCols);

  const poCols = [
    { header: 'Supplier',    key: 'supp',   width: 22, align: 'left'   },
    { header: 'PO #',        key: 'po',     width: 16, align: 'left'   },
    { header: 'Date',        key: 'date',   width: 14, align: 'center'  },
    { header: 'Grand Total', key: 'total',  width: 15, align: 'right',  numFmt: CURR },
    { header: 'Paid Amount', key: 'paid',   width: 14, align: 'right',  numFmt: CURR },
    { header: 'Balance',     key: 'bal',    width: 14, align: 'right',  numFmt: CURR },
    { header: 'Status',      key: 'status', width: 12, align: 'center'  },
  ];
  const ws3 = wb.addWorksheet('PO Details');
  applyColConfig(ws3, poCols);
  addTitle(ws3, 'SUPPLIER OUTSTANDING — PO Details', period, poCols.length);
  addHeaders(ws3, poCols);
  let idx = 0;
  suppliers.forEach((s) => {
    s.purchases.sort((a, b) => b.date.localeCompare(a.date)).forEach((pur) => {
      const row = addDataRow(ws3, [
        s.name, pur.purchaseNumber, fd(pur.date),
        n(pur.grandTotal), n(pur.paidAmount), n(pur.balanceAmount), cap(pur.paymentStatus),
      ], idx++, poCols);
      colorStatus(row.getCell(7), pur.paymentStatus);
      row.getCell(6).font = { bold: true, color: { argb: C.RED } };
    });
  });

  await saveWorkbook(wb, `Supplier-Outstanding-${period}.xlsx`);
}
