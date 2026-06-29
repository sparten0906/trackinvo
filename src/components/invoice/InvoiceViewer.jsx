import React, { useRef, useState } from 'react';
import { CheckCircle2, Plus, X, Printer, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const PAY_LABELS = {
  cash: 'Cash', upi: 'UPI', card: 'Card / Debit Card',
  bank_transfer: 'Bank Transfer / NEFT', credit: 'Credit', cheque: 'Cheque',
};

// ─── Amount in words (Indian format) ─────────────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertBelow100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function convertBelow1000(n) {
  if (n === 0) return '';
  return n < 100 ? convertBelow100(n) : ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow100(n % 100) : '');
}
function convertIndian(n) {
  if (n === 0) return 'Zero';
  let result = '';
  if (n >= 10000000) { result += convertBelow1000(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
  if (n >= 100000)   { result += convertBelow1000(Math.floor(n / 100000))   + ' Lakh ';  n %= 100000; }
  if (n >= 1000)     { result += convertBelow1000(Math.floor(n / 1000))     + ' Thousand '; n %= 1000; }
  if (n > 0)         { result += convertBelow1000(n); }
  return result.trim();
}
function amountInWords(amount) {
  const total  = Math.round(Number(amount) * 100);
  const rupees = Math.floor(total / 100);
  const paise  = total % 100;
  let words    = 'Rupees ' + convertIndian(rupees);
  if (paise > 0) words += ' and ' + convertBelow100(paise) + ' Paise';
  return words + ' Only';
}

// ─── InvoiceDocument ─────────────────────────────────────────────────────────
// A4 width (794px). Uses table + float only — html2canvas 1.4.1 safe (no flex/grid/gap).
export function InvoiceDocument({ invoice, settings, sym, customer }) {
  const {
    invoiceNumber, customerName, date, dueDate, createdAt, items = [],
    subtotal = 0, itemDiscounts = 0, invoiceDiscount = 0,
    taxAmount = 0, grandTotal = 0,
    paidAmount = 0, balanceAmount = 0,
    paymentStatus, paymentMethod, notes,
  } = invoice;

  const s = settings || {};
  const isIntrastate  = s.transactionType !== 'interstate';
  const totalDiscount = (Number(itemDiscounts) || 0) + (Number(invoiceDiscount) || 0);
  const taxableTotal  = Number(grandTotal) - Number(taxAmount);

  const isPaid    = paymentStatus === 'paid';
  const isPartial = paymentStatus === 'partial';

  const hasTime = createdAt && createdAt.includes('T');
  const timeStr = hasTime
    ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(createdAt))
    : null;

  const badgeBg    = isPaid ? '#DCFCE7' : isPartial ? '#FEF9C3' : '#FEE2E2';
  const badgeColor = isPaid ? '#166534' : isPartial ? '#92400E' : '#991B1B';
  const badgeText  = isPaid ? 'PAID'   : isPartial ? 'PARTIAL' : 'UNPAID';

  // ── Tax summary grouped by HSN+rate ──────────────────────────────────────
  const taxGroups = {};
  items.forEach((item) => {
    const taxable = Math.max(0, item.unitPrice * item.quantity - Number(item.discount || 0));
    const rate    = Number(item.taxPercent || 0);
    const hsn     = item.hsn || item.sku || '—';
    const key     = `${hsn}_${rate}`;
    if (!taxGroups[key]) taxGroups[key] = { hsn, rate, taxable: 0 };
    taxGroups[key].taxable += taxable;
  });
  const taxGroupRows = Object.values(taxGroups);
  const cgstTot  = isIntrastate ? Number(taxAmount) / 2 : 0;
  const sgstTot  = isIntrastate ? Number(taxAmount) / 2 : 0;
  const igstTot  = isIntrastate ? 0 : Number(taxAmount);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const ff   = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const mono = '"Courier New", Courier, monospace';

  const thBase = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '7px 6px', textAlign: 'left', background: '#1E293B', color: '#CBD5E1',
    whiteSpace: 'nowrap',
  };
  const tdBase = { fontSize: 11, color: '#0F172A', padding: '7px 6px', verticalAlign: 'top', borderBottom: '1px solid #F1F5F9' };
  const metaL  = { fontSize: 11, color: '#64748B', paddingBottom: 3, paddingRight: 8, whiteSpace: 'nowrap' };
  const metaV  = { fontSize: 11, color: '#0F172A', fontWeight: 600, paddingBottom: 3, textAlign: 'right' };

  const businessAddr = [s.businessAddress, s.businessCity, s.businessState, s.businessPinCode].filter(Boolean).join(', ');
  const displayGstin = s.gstin || s.taxNumber;

  const hasBankDetails = s.bankName || s.bankAccount || s.upiId;

  return (
    <div
      data-invoice
      style={{ background: '#ffffff', fontFamily: ff, width: 794, boxSizing: 'border-box', color: '#0F172A' }}
    >
      {/* ─── Top accent bar ─────────────────────────────────────────── */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #4F62E5, #7C3AED)' }} />

      <div style={{ padding: '18px 36px 14px' }}>

        {/* ─── Header: Business (left) | Invoice Label+# (right) ──── */}
        <div style={{ overflow: 'hidden', paddingBottom: 12, marginBottom: 12, borderBottom: '2px solid #E2E8F0' }}>
          {/* Right (float first in DOM) */}
          <div style={{ float: 'right', textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#4F62E5', borderRadius: 6, padding: '3px 14px', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Tax Invoice
              </span>
            </div>
            <p style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '0.01em', lineHeight: 1.2 }}>
              {invoiceNumber}
            </p>
            {s.gstType === 'composition' && (
              <p style={{ fontSize: 9, color: '#6366F1', fontWeight: 700, marginTop: 4 }}>
                (Composition Taxable Person)
              </p>
            )}
          </div>

          {/* Left: logo + business info */}
          <div>
            {s.logoUrl ? (
              <img src={s.logoUrl} alt="logo"
                style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', borderRadius: 8, marginBottom: 10 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#4F62E5', display: 'block', marginBottom: 10, textAlign: 'center', paddingTop: 11, boxSizing: 'border-box' }}>
                <Receipt size={18} color="#fff" style={{ display: 'inline-block', verticalAlign: 'top' }} />
              </div>
            )}
            <p style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: 4 }}>
              {s.businessName || 'Your Business'}
            </p>
            {businessAddr && (
              <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>{businessAddr}</p>
            )}
            {(s.businessPhone || s.businessEmail) && (
              <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>
                {s.businessPhone}
                {s.businessPhone && s.businessEmail && <span style={{ margin: '0 5px', color: '#CBD5E1' }}>|</span>}
                {s.businessEmail}
              </p>
            )}
            {displayGstin && (
              <p style={{ fontSize: 10, color: '#0F172A', fontWeight: 700, fontFamily: mono, marginBottom: 2 }}>
                GSTIN: {displayGstin}
              </p>
            )}
            {s.pan && (
              <p style={{ fontSize: 10, color: '#475569', fontFamily: mono }}>PAN: {s.pan}</p>
            )}
          </div>
        </div>

        {/* ─── Bill To | Invoice Details (2-col) ──────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr>
              {/* Bill To */}
              <td style={{ verticalAlign: 'top', width: '50%', paddingRight: 24, borderRight: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#6366F1', marginBottom: 8, borderBottom: '1.5px solid #6366F1', paddingBottom: 4, display: 'inline-block' }}>
                  Bill To
                </p>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 4 }}>{customerName}</p>
                {customer?.address && <p style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{customer.address}</p>}
                {customer?.city && <p style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{customer.city}{customer.country ? `, ${customer.country}` : ''}</p>}
                {customer?.phone && <p style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>Ph: {customer.phone}</p>}
                {customer?.email && <p style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{customer.email}</p>}
                {(customer?.gstNumber || customer?.taxId) && (
                  <p style={{ fontSize: 10, color: '#0F172A', fontWeight: 700, fontFamily: mono, marginTop: 4 }}>
                    GSTIN: {customer.gstNumber || customer.taxId}
                  </p>
                )}
              </td>

              {/* Invoice Details */}
              <td style={{ verticalAlign: 'top', paddingLeft: 24 }}>
                <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#6366F1', marginBottom: 8, borderBottom: '1.5px solid #6366F1', paddingBottom: 4, display: 'inline-block' }}>
                  Invoice Details
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={metaL}>Invoice No.</td>
                      <td style={{ ...metaV, fontFamily: mono }}>{invoiceNumber}</td>
                    </tr>
                    <tr>
                      <td style={metaL}>Invoice Date</td>
                      <td style={metaV}>{formatDate(date)}</td>
                    </tr>
                    {timeStr && (
                      <tr>
                        <td style={metaL}>Time</td>
                        <td style={metaV}>{timeStr}</td>
                      </tr>
                    )}
                    {dueDate && (
                      <tr>
                        <td style={metaL}>Due Date</td>
                        <td style={{ ...metaV, color: '#C2410C' }}>{formatDate(dueDate)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={metaL}>Place of Supply</td>
                      <td style={metaV}>{s.placeOfSupply || s.businessState || '—'}</td>
                    </tr>
                    <tr>
                      <td style={metaL}>Payment Mode</td>
                      <td style={metaV}>{PAY_LABELS[paymentMethod] || (paymentMethod || '—').replace('_', ' ')}</td>
                    </tr>
                    <tr>
                      <td style={metaL}>Reverse Charge</td>
                      <td style={metaV}>No</td>
                    </tr>
                    <tr>
                      <td style={metaL}>Status</td>
                      <td style={{ ...metaV, paddingBottom: 0 }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', background: badgeBg, color: badgeColor }}>
                          {badgeText}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ─── Items Table ─────────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, width: 28, borderRadius: '4px 0 0 4px' }}>#</th>
              <th style={{ ...thBase }}>Description of Goods / Services</th>
              <th style={{ ...thBase, width: 68 }}>HSN / SAC</th>
              <th style={{ ...thBase, width: 52, textAlign: 'center' }}>Qty</th>
              <th style={{ ...thBase, width: 76, textAlign: 'right' }}>Rate</th>
              <th style={{ ...thBase, width: 86, textAlign: 'right' }}>Taxable Value</th>
              <th style={{ ...thBase, width: 44, textAlign: 'center' }}>Tax%</th>
              <th style={{ ...thBase, width: 72, textAlign: 'right' }}>Tax Amt</th>
              <th style={{ ...thBase, width: 84, textAlign: 'right', borderRadius: '0 4px 4px 0' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const taxable   = Math.max(0, item.unitPrice * item.quantity - Number(item.discount || 0));
              const taxPct    = Number(item.taxPercent || 0);
              const taxAmt    = (taxable * taxPct) / 100;
              const lineTotal = taxable + taxAmt;
              const hsn       = item.hsn || item.sku || '—';
              return (
                <tr key={item.productId || idx}>
                  <td style={{ ...tdBase, fontFamily: mono, color: '#94A3B8', fontSize: 10 }}>{idx + 1}</td>
                  <td style={tdBase}>
                    <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{item.productName}</p>
                    {item.unit && (
                      <p style={{ fontSize: 9.5, color: '#64748B' }}>Unit: {item.unit}</p>
                    )}
                    {Number(item.discount || 0) > 0 && (
                      <p style={{ fontSize: 9.5, color: '#DC2626' }}>Disc: −{formatCurrency(item.discount, sym)}</p>
                    )}
                  </td>
                  <td style={{ ...tdBase, fontFamily: mono, fontSize: 10, color: '#475569' }}>{hsn}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontFamily: mono }}>{item.quantity}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: mono }}>{formatCurrency(item.unitPrice, sym)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: mono }}>{formatCurrency(taxable, sym)}</td>
                  <td style={{ ...tdBase, textAlign: 'center', color: '#6366F1', fontFamily: mono }}>
                    {taxPct > 0 ? `${taxPct}%` : '—'}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: mono, color: '#6366F1' }}>
                    {taxPct > 0 ? formatCurrency(taxAmt, sym) : '—'}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: mono, fontWeight: 700 }}>
                    {formatCurrency(lineTotal, sym)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ─── Tax Summary Table ───────────────────────────────────── */}
        {taxGroupRows.some(r => r.rate > 0) && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 8.5, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              Tax Summary (HSN / SAC wise)
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0', borderRadius: 6 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>HSN/SAC</th>
                  <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>Taxable Value</th>
                  {isIntrastate ? (
                    <>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>CGST %</th>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>CGST Amt</th>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>SGST %</th>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>SGST Amt</th>
                    </>
                  ) : (
                    <>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>IGST %</th>
                      <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>IGST Amt</th>
                    </>
                  )}
                  <th style={{ fontSize: 9, fontWeight: 700, color: '#64748B', padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {taxGroupRows.map((row, i) => {
                  const halfRate = row.rate / 2;
                  const cgst     = isIntrastate ? (row.taxable * halfRate) / 100 : 0;
                  const sgst     = isIntrastate ? (row.taxable * halfRate) / 100 : 0;
                  const igst     = isIntrastate ? 0 : (row.taxable * row.rate) / 100;
                  const totalTax = cgst + sgst + igst;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ fontSize: 11, fontFamily: mono, color: '#475569', padding: '7px 8px' }}>{row.hsn}</td>
                      <td style={{ fontSize: 11, fontFamily: mono, color: '#0F172A', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(row.taxable, sym)}</td>
                      {isIntrastate ? (
                        <>
                          <td style={{ fontSize: 11, color: '#6366F1', padding: '7px 8px', textAlign: 'center' }}>{halfRate}%</td>
                          <td style={{ fontSize: 11, fontFamily: mono, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(cgst, sym)}</td>
                          <td style={{ fontSize: 11, color: '#6366F1', padding: '7px 8px', textAlign: 'center' }}>{halfRate}%</td>
                          <td style={{ fontSize: 11, fontFamily: mono, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(sgst, sym)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontSize: 11, color: '#6366F1', padding: '7px 8px', textAlign: 'center' }}>{row.rate}%</td>
                          <td style={{ fontSize: 11, fontFamily: mono, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(igst, sym)}</td>
                        </>
                      )}
                      <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#0F172A', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(totalTax, sym)}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ background: '#F8FAFC' }}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', padding: '7px 8px' }}>Total</td>
                  <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#0F172A', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(taxableTotal, sym)}</td>
                  {isIntrastate ? (
                    <>
                      <td />
                      <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(cgstTot, sym)}</td>
                      <td />
                      <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(sgstTot, sym)}</td>
                    </>
                  ) : (
                    <>
                      <td />
                      <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#6366F1', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(igstTot, sym)}</td>
                    </>
                  )}
                  <td style={{ fontSize: 11, fontFamily: mono, fontWeight: 700, color: '#0F172A', padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(Number(taxAmount), sym)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Totals block (right-aligned, float) ─────────────────── */}
        <div style={{ overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ float: 'right', width: 290 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {totalDiscount > 0 && (
                  <tr>
                    <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>Subtotal</td>
                    <td style={{ fontSize: 11.5, color: '#0F172A', fontFamily: mono, fontWeight: 500, textAlign: 'right', paddingBottom: 5 }}>{formatCurrency(subtotal, sym)}</td>
                  </tr>
                )}
                {totalDiscount > 0 && (
                  <tr>
                    <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>Discount</td>
                    <td style={{ fontSize: 11.5, color: '#DC2626', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 5 }}>−{formatCurrency(totalDiscount, sym)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>Taxable Amount</td>
                  <td style={{ fontSize: 11.5, color: '#0F172A', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 5 }}>{formatCurrency(taxableTotal, sym)}</td>
                </tr>
                {isIntrastate && Number(taxAmount) > 0 && (
                  <>
                    <tr>
                      <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>CGST</td>
                      <td style={{ fontSize: 11.5, color: '#6366F1', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 5 }}>+{formatCurrency(cgstTot, sym)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>SGST</td>
                      <td style={{ fontSize: 11.5, color: '#6366F1', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 5 }}>+{formatCurrency(sgstTot, sym)}</td>
                    </tr>
                  </>
                )}
                {!isIntrastate && Number(taxAmount) > 0 && (
                  <tr>
                    <td style={{ fontSize: 11.5, color: '#64748B', paddingBottom: 5 }}>IGST</td>
                    <td style={{ fontSize: 11.5, color: '#6366F1', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 5 }}>+{formatCurrency(igstTot, sym)}</td>
                  </tr>
                )}
                {/* Grand Total */}
                <tr>
                  <td colSpan={2} style={{ padding: 0 }}>
                    <div style={{ borderTop: '2px solid #0F172A', marginTop: 4 }} />
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 0' }}>Grand Total</td>
                  <td style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, color: '#4F62E5', textAlign: 'right', padding: '10px 0' }}>
                    {formatCurrency(grandTotal, sym)}
                  </td>
                </tr>
                {/* Payment */}
                <tr>
                  <td colSpan={2} style={{ padding: 0 }}>
                    <div style={{ borderTop: '1px solid #E2E8F0' }} />
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 11.5, color: '#64748B', padding: '7px 0 4px', fontWeight: 600 }}>Amount Paid</td>
                  <td style={{ fontSize: 11.5, color: '#059669', fontFamily: mono, fontWeight: 700, textAlign: 'right', padding: '7px 0 4px' }}>
                    {formatCurrency(paidAmount, sym)}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 11.5, color: '#64748B', padding: '3px 0 8px', fontWeight: 600 }}>
                    {balanceAmount > 0 ? 'Balance Due' : 'Balance'}
                  </td>
                  <td style={{ fontSize: 13, fontFamily: mono, fontWeight: 800, textAlign: 'right', padding: '3px 0 8px', color: balanceAmount > 0 ? '#D97706' : '#059669' }}>
                    {balanceAmount > 0 ? formatCurrency(balanceAmount, sym) : 'CLEARED'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Amount in Words ─────────────────────────────────────── */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 14px', marginBottom: 12 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amount in Words: </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{amountInWords(grandTotal)}</span>
        </div>

        {/* ─── Bank Details | Payment Summary (2-col) ──────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, border: '1px solid #E2E8F0', borderRadius: 8 }}>
          <tbody>
            <tr>
              {hasBankDetails ? (
                <td style={{ verticalAlign: 'top', width: '52%', padding: '10px 14px', borderRight: '1px solid #E2E8F0' }}>
                  <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6366F1', marginBottom: 6 }}>Bank Details</p>
                  {s.bankName    && <p style={{ fontSize: 11, color: '#0F172A', fontWeight: 600, marginBottom: 2 }}>{s.bankName}</p>}
                  {s.bankAccount && <p style={{ fontSize: 10.5, color: '#475569', fontFamily: mono, marginBottom: 2 }}>A/C: {s.bankAccount}{s.bankAccountType ? ` (${s.bankAccountType.charAt(0).toUpperCase() + s.bankAccountType.slice(1)})` : ''}</p>}
                  {s.bankIfsc    && <p style={{ fontSize: 10.5, color: '#475569', fontFamily: mono, marginBottom: 2 }}>IFSC: {s.bankIfsc}</p>}
                  {s.bankBranch  && <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>Branch: {s.bankBranch}</p>}
                  {s.upiId       && <p style={{ fontSize: 10.5, color: '#6366F1', fontWeight: 600, marginTop: 4 }}>UPI: {s.upiId}</p>}
                </td>
              ) : (
                <td style={{ verticalAlign: 'top', width: '52%', padding: '10px 14px', borderRight: '1px solid #E2E8F0' }}>
                  <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6366F1', marginBottom: 6 }}>Payment Info</p>
                  <p style={{ fontSize: 11, color: '#475569' }}>Mode: {PAY_LABELS[paymentMethod] || (paymentMethod || '—').replace('_', ' ')}</p>
                  {notes && <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Ref: {notes}</p>}
                </td>
              )}
              <td style={{ verticalAlign: 'top', padding: '10px 14px' }}>
                <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6366F1', marginBottom: 6 }}>Payment Summary</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontSize: 11, color: '#64748B', paddingBottom: 4 }}>Grand Total</td>
                      <td style={{ fontSize: 11, color: '#0F172A', fontFamily: mono, fontWeight: 700, textAlign: 'right', paddingBottom: 4 }}>{formatCurrency(grandTotal, sym)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontSize: 11, color: '#64748B', paddingBottom: 4 }}>Amount Paid</td>
                      <td style={{ fontSize: 11, color: '#059669', fontFamily: mono, fontWeight: 700, textAlign: 'right', paddingBottom: 4 }}>{formatCurrency(paidAmount, sym)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: 0 }}>
                        <div style={{ borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                        {balanceAmount > 0 ? 'Balance Due' : 'Balance'}
                      </td>
                      <td style={{ fontSize: 13, fontFamily: mono, fontWeight: 800, textAlign: 'right', color: balanceAmount > 0 ? '#D97706' : '#059669' }}>
                        {balanceAmount > 0 ? formatCurrency(balanceAmount, sym) : 'CLEARED'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ─── Terms & Notes ───────────────────────────────────────── */}
        {(notes || s.invoiceTerms) && (
          <div style={{ marginBottom: 10 }}>
            {notes && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>Notes: </span>
                <span style={{ fontSize: 11, color: '#475569' }}>{notes}</span>
              </div>
            )}
            {s.invoiceTerms && (
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>Terms: </span>
                <span style={{ fontSize: 11, color: '#475569' }}>{s.invoiceTerms}</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Declaration + Signature ─────────────────────────────── */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'bottom', width: '60%', paddingRight: 20 }}>
                  <p style={{ fontSize: 9, color: '#94A3B8', marginBottom: 3 }}>This is a computer generated invoice. No signature required for digital copy.</p>
                  <p style={{ fontSize: 9, color: '#94A3B8', marginBottom: 3 }}>Reverse Charge: No</p>
                  {s.businessState && (
                    <p style={{ fontSize: 9, color: '#94A3B8' }}>Subject to {s.businessState} jurisdiction.</p>
                  )}
                  {s.msme && (
                    <p style={{ fontSize: 9, color: '#94A3B8', marginTop: 4 }}>MSME/Udyam Reg.: {s.msme}</p>
                  )}
                </td>
                <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 30 }}>For {s.businessName || 'Company'}</p>
                  <div style={{ borderTop: '1px solid #64748B', paddingTop: 5 }}>
                    <p style={{ fontSize: 9.5, color: '#64748B' }}>Authorized Signatory</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginBottom: 4 }}>
            {s.invoiceFooter || 'Thank you for your business!'}
          </p>
          <p style={{ fontSize: 9, color: '#94A3B8', fontFamily: mono, letterSpacing: '0.06em' }}>{invoiceNumber}</p>
        </div>

      </div>
      {/* ─── Bottom accent bar ──────────────────────────────────────── */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #7C3AED, #4F62E5)' }} />
    </div>
  );
}

// ─── InvoiceViewer ────────────────────────────────────────────────────────────
export default function InvoiceViewer({ invoice, settings, sym, customer, onReset, onClose }) {
  const invoiceRef = useRef(null);
  const [dlState, setDlState] = useState('');

  const filename = invoice?.invoiceNumber || 'invoice';

  // Clone invoice to a fixed off-screen div (position: fixed, top: 0) so
  // html2canvas always starts from y=0 — modal scroll position never interferes.
  const capture = async () => {
    const wrapper = invoiceRef.current;
    if (!wrapper) throw new Error('no ref');
    const source = wrapper.querySelector('[data-invoice]') ?? wrapper;

    const offscreen = document.createElement('div');
    Object.assign(offscreen.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         source.offsetWidth + 'px',
      background:    '#ffffff',
      zIndex:        '-9999',
      pointerEvents: 'none',
    });
    const clone = source.cloneNode(true);
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);

    try {
      return await html2canvas(clone, {
        scale:           2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#ffffff',
        logging:         false,
        imageTimeout:    8000,
        scrollX:         0,
        scrollY:         0,
        windowWidth:     source.offsetWidth,
        windowHeight:    clone.scrollHeight,
      });
    } finally {
      document.body.removeChild(offscreen);
    }
  };

  // A4 PDF — always fits on one page by scaling to fit
  const downloadPDF = async () => {
    setDlState('pdf');
    try {
      const canvas  = await capture();
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW   = pdf.internal.pageSize.getWidth();   // 210mm
      const pageH   = pdf.internal.pageSize.getHeight();  // 297mm

      // Scale to fit within one page — shrink if taller than A4, otherwise fill width
      const ratio = canvas.height / canvas.width;
      let imgW    = pageW;
      let imgH    = pageW * ratio;
      if (imgH > pageH) {
        imgH = pageH;
        imgW = pageH / ratio;
      }
      const x = (pageW - imgW) / 2;
      pdf.addImage(imgData, 'JPEG', x, 0, imgW, imgH);
      pdf.save(`${filename}.pdf`);
      toast.success('PDF downloaded');
    } catch { toast.error('PDF generation failed'); } finally { setDlState(''); }
  };

  const downloadJPG = async () => {
    setDlState('jpg');
    try {
      const canvas = await capture();
      const link   = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href     = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('Image downloaded');
    } catch { toast.error('Image download failed'); } finally { setDlState(''); }
  };

  const Spin = () => (
    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
  );

  const PdfIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <polyline points="9 15 12 18 15 15"/>
    </svg>
  );

  const ImgIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>

      {/* ── Action bar ── */}
      <div className="print:hidden mb-4">
        {onReset && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl"
            style={{ background: 'var(--emerald-faint)', border: '1px solid var(--emerald)' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--emerald)' }}>
                Invoice {invoice.invoiceNumber} saved!
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {(invoice.items || []).length} item{(invoice.items || []).length !== 1 ? 's' : ''} · {formatCurrency(invoice.grandTotal, sym)} · Stock updated
              </p>
            </div>
            <button className="btn btn-primary btn-sm shrink-0" onClick={onReset}>
              <Plus size={13} /> New Sale
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {onClose && (
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={13} /> Close
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
          <button className="btn btn-secondary btn-sm" onClick={downloadPDF} disabled={!!dlState} style={{ minWidth: 100 }}>
            {dlState === 'pdf' ? <Spin /> : <PdfIcon />}
            {dlState === 'pdf' ? 'Rendering…' : 'PDF'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={downloadJPG} disabled={!!dlState} style={{ minWidth: 96 }}>
            {dlState === 'jpg' ? <Spin /> : <ImgIcon />}
            {dlState === 'jpg' ? 'Rendering…' : 'JPG'}
          </button>
        </div>
        {dlState && (
          <p className="text-xs mt-2 flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <Spin /> Generating invoice…
          </p>
        )}
      </div>

      {/* ── Invoice preview ── */}
      <div style={{
        background: 'var(--ground)',
        borderRadius: 16,
        padding: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        overflowX: 'auto',
      }}>
        <div ref={invoiceRef}>
          <InvoiceDocument invoice={invoice} settings={settings} sym={sym} customer={customer} />
        </div>
      </div>
    </div>
  );
}
