import React, { useState, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  ClipboardList, Plus, Search, X, Truck, Package,
  CheckCircle2, Clock, XCircle, AlertTriangle, Inbox,
  PackageCheck, FileText, Info, Link, Send, Printer,
  Download, Image as ImageIcon, ShoppingCart,
  ChevronDown, Eye, MoreHorizontal, Receipt,
  TrendingUp, TrendingDown, Minus, DollarSign, Star, Pencil,
} from 'lucide-react';

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, formatTableDateTime, formatModalDateTime, generateId, today, validateSupplier } from '../utils/helpers';
import toast from 'react-hot-toast';

/* ── Status config ─────────────────────────────────────────────────────── */
const STATUS_CFG = {
  // PO statuses
  created:            { bg: '#EEF2FF', fg: '#4F46E5', border: '#C7D2FE', label: 'Draft',         icon: FileText },
  sent:               { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', label: 'Sent',          icon: Send },
  approved:           { bg: '#ECFDF5', fg: '#059669', border: '#A7F3D0', label: 'Approved',       icon: CheckCircle2 },
  partially_received: { bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A', label: 'Partial',        icon: PackageCheck },
  fully_received:     { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0', label: 'Received',       icon: PackageCheck },
  closed:             { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Closed',         icon: CheckCircle2 },
  cancelled:          { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Cancelled',      icon: XCircle },
  rejected:           { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Rejected',       icon: XCircle },
  // GP statuses
  pending:            { bg: '#EEF2FF', fg: '#4F46E5', border: '#C7D2FE', label: 'Pending',        icon: Clock },
  completed:          { bg: '#F4F4F5', fg: '#71717A', border: '#D4D4D8', label: 'Completed',      icon: CheckCircle2 },
};

const COND_CFG = {
  good:      { label: 'Good',      color: '#16A34A', bg: '#F0FDF4' },
  damaged:   { label: 'Damaged',   color: '#DC2626', bg: '#FEF2F2' },
  defective: { label: 'Defective', color: '#D97706', bg: '#FFFBEB' },
  rejected:  { label: 'Rejected',  color: '#7C3AED', bg: '#F5F3FF' },
};

/* ── GST mode helper ─────────────────────────────────────────────────────── */
function getGSTMode(supplierId, suppliers, settings) {
  const sup = suppliers.find(s => s.id === supplierId);
  const bizState = (settings?.businessState || settings?.placeOfSupply || '').trim().toLowerCase();
  const supState = (sup?.state || '').trim().toLowerCase();
  if (!supplierId) return { isInterstate: null, noSupplier: true };
  if (!supState)   return { isInterstate: null, noSupplierState: true, label: 'Supplier state missing' };
  if (!bizState)   return { isInterstate: null, noBusinessState: true, label: 'Business state missing' };
  const interstate = bizState !== supState;
  return {
    isInterstate:    interstate,
    noSupplierState: false,
    noBusinessState: false,
    label:           interstate ? 'Interstate — IGST applies' : 'Intrastate — CGST + SGST applies',
    taxLabel:        interstate ? 'IGST' : 'CGST+SGST',
  };
}

function StatusBadge({ status, small }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.created;
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: small ? 10 : 11, fontWeight: 700, padding: small ? '2px 7px' : '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      <Icon size={small ? 9 : 11} strokeWidth={2.5} /> {cfg.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS — used only inside POSlipPreview (hardcoded for html2canvas)
══════════════════════════════════════════════════════════════════════════ */
function numToWordsIN(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (n === 0) return '';
  if (n < 20)  return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
  return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+numToWordsIN(n%100) : '');
}
function amountInWords(amount) {
  const n = Math.round(Math.abs(amount || 0));
  if (n === 0) return 'Zero Rupees Only';
  const cr  = Math.floor(n / 10000000);
  const lac = Math.floor((n % 10000000) / 100000);
  const th  = Math.floor((n % 100000) / 1000);
  const rem = n % 1000;
  let w = '';
  if (cr)  w += numToWordsIN(cr)  + ' Crore ';
  if (lac) w += numToWordsIN(lac) + ' Lakh ';
  if (th)  w += numToWordsIN(th)  + ' Thousand ';
  if (rem) w += numToWordsIN(rem);
  return w.trim() + ' Rupees Only';
}

/* ══════════════════════════════════════════════════════════════════════════
   PO SLIP — professional A4 document (all inline styles for html2canvas)
══════════════════════════════════════════════════════════════════════════ */
const POSlipPreview = React.forwardRef(function POSlipPreview({ po, settings, supplier }, ref) {
  const sym  = settings?.currencySymbol || '₹';
  const items = po?.items || [];

  /* ── Calculations (tax after discount) ── */
  const subtotal    = items.reduce((s,it) => s + Number(it.quantity||0)*Number(it.unitCost||0), 0);
  const totalDisc   = items.reduce((s,it) => s + Number(it.discount||0), 0);
  const taxableAmt  = Math.max(0, subtotal - totalDisc);
  const taxTotal    = items.reduce((s,it) => {
    const lineTaxable = Math.max(0, Number(it.quantity||0)*Number(it.unitCost||0) - Number(it.discount||0));
    return s + lineTaxable * (Number(it.taxPercent||0)/100);
  }, 0);
  const freightAmt     = Number(po?.freightCharge || 0);
  const freightGstAmt  = Number(po?.freightGstAmount || 0);
  const freightTotal   = Number(po?.freightTotal || 0) || (freightAmt + freightGstAmt);
  const preRound    = taxableAmt + taxTotal + freightTotal;
  const grandTotal  = po?.grandTotal ? Number(po.grandTotal) : Math.round(preRound);
  const roundOff    = grandTotal - preRound;

  /* ── GST breakdown ── */
  const isInterstate = po?.isInterstate ?? (settings?.transactionType || '').toLowerCase().includes('inter');
  const taxByRate = {};
  items.forEach(it => {
    const rate = Number(it.taxPercent||0);
    if (!rate) return;
    const lineTaxable = Math.max(0, Number(it.quantity||0)*Number(it.unitCost||0) - Number(it.discount||0));
    const tax = lineTaxable * rate / 100;
    if (!taxByRate[rate]) taxByRate[rate] = { rate, tax: 0, taxable: 0 };
    taxByRate[rate].tax     += tax;
    taxByRate[rate].taxable += lineTaxable;
  });
  const taxRows = Object.values(taxByRate).sort((a,b) => a.rate-b.rate);

  /* ── Format helpers ── */
  const fmtN = n => `${sym}${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const scfg = STATUS_CFG[po?.status] || STATUS_CFG.created;

  const defaultTerms = [
    'All prices are in Indian Rupees and exclusive of applicable taxes.',
    'Goods must be delivered to the address mentioned above within the expected delivery date.',
    'Supplier must provide a tax invoice/bill for all deliveries.',
    "Damaged, defective, or rejected goods will be returned at the supplier's cost.",
    'Payment will be processed within the agreed credit period after receipt and acceptance of goods.',
  ];
  const termsList = po?.termsAndConditions
    ? po.termsAndConditions.split('\n').filter(Boolean)
    : defaultTerms;

  /* ── Shared style tokens ── */
  const C = { navy:'#0C1E3C', navyLight:'#1A3566', accent:'#2563EB', text:'#111827', muted:'#6B7280', faint:'#F9FAFB', border:'#E5E7EB', white:'#FFFFFF' };
  const label8 = { fontSize:8, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:'0.12em' };
  const divider = { borderBottom:`1px solid ${C.border}`, paddingBottom:4, marginBottom:6 };

  return (
    <div ref={ref} style={{ background:C.white, color:C.text, fontFamily:"'Segoe UI',Arial,sans-serif", fontSize:11, width:'100%', minWidth:640, boxSizing:'border-box', lineHeight:1.5 }}>

      {/* ── Top rule ── */}
      <div style={{ height:4, background:`linear-gradient(90deg,${C.navy} 0%,${C.accent} 55%,${C.navy} 100%)` }}/>

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'24px 32px 20px', background:C.faint, borderBottom:`1px solid ${C.border}` }}>

        {/* Left — business identity */}
        <div style={{ flex:1, minWidth:0, paddingRight:24 }}>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" style={{ height:52, objectFit:'contain', display:'block', marginBottom:10 }}/>
          ) : (
            <div style={{ width:52, height:52, borderRadius:10, background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              <span style={{ fontSize:22, fontWeight:900, color:C.white, letterSpacing:'-0.04em' }}>
                {(settings?.businessName||'B').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ fontSize:16, fontWeight:900, color:C.navy, letterSpacing:'-0.025em', marginBottom:4 }}>
            {settings?.businessName || 'Your Business'}
          </div>
          <div style={{ fontSize:10, color:C.muted, lineHeight:1.8 }}>
            {settings?.address && <div>{settings.address}</div>}
            {(settings?.phone||settings?.email) && (
              <div>
                {settings?.phone && `Ph: ${settings.phone}`}
                {settings?.phone && settings?.email && '  |  '}
                {settings?.email && settings.email}
              </div>
            )}
            {settings?.gst && <div>GSTIN: <span style={{ fontWeight:700, color:C.text }}>{settings.gst}</span></div>}
            {settings?.pan && <div>PAN: <span style={{ fontWeight:700, color:C.text }}>{settings.pan}</span></div>}
          </div>
        </div>

        {/* Right — document identity */}
        <div style={{ flexShrink:0, textAlign:'right' }}>
          <div style={{ fontSize:24, fontWeight:900, color:C.navy, letterSpacing:'-0.04em', lineHeight:1 }}>PURCHASE</div>
          <div style={{ fontSize:24, fontWeight:900, color:C.navy, letterSpacing:'-0.04em', marginBottom:8 }}>ORDER</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 12px', borderRadius:20, background:scfg.bg, color:scfg.fg, fontSize:9.5, fontWeight:800, border:`1px solid ${scfg.border}`, marginBottom:10 }}>
            {scfg.label.toUpperCase()}
          </div>
          <table style={{ fontSize:10, borderCollapse:'collapse', marginLeft:'auto' }}>
            <tbody>
              {[
                ['PO Number',   po?.poNumber],
                ['PO Date',     formatDate(po?.orderDate)],
                po?.expectedDate ? ['Exp. Delivery', formatDate(po.expectedDate)] : null,
                po?.supplierRef  ? ['Supplier Ref',  po.supplierRef]              : null,
                po?.paymentTerms ? ['Payment Terms', `Net ${po.paymentTerms} days`] : null,
              ].filter(Boolean).map(([k,v]) => (
                <tr key={k}>
                  <td style={{ color:C.muted, paddingRight:12, paddingBottom:3, textAlign:'right', whiteSpace:'nowrap' }}>{k}:</td>
                  <td style={{ color:C.text, fontWeight:700, textAlign:'right', whiteSpace:'nowrap' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ SUPPLIER + DELIVER TO ═══════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ padding:'14px 32px', borderRight:`1px solid ${C.border}` }}>
          <div style={{ ...label8, ...divider }}>BILL TO (SUPPLIER)</div>
          <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:4 }}>{po?.supplierName || '—'}</div>
          <div style={{ fontSize:10, color:C.muted, lineHeight:1.8 }}>
            {supplier?.address && <div>{supplier.address}</div>}
            {supplier?.phone   && <div>Ph: {supplier.phone}</div>}
            {supplier?.email   && <div>{supplier.email}</div>}
            {supplier?.gst     && <div>GSTIN: <span style={{ fontWeight:700, color:C.text }}>{supplier.gst}</span></div>}
          </div>
        </div>
        <div style={{ padding:'14px 32px' }}>
          <div style={{ ...label8, ...divider }}>DELIVER TO</div>
          <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:4 }}>{settings?.businessName || '—'}</div>
          <div style={{ fontSize:10, color:C.muted, lineHeight:1.8 }}>
            {settings?.address && <div>{settings.address}</div>}
            {settings?.phone   && <div>Ph: {settings.phone}</div>}
            {settings?.gst     && <div>GSTIN: <span style={{ fontWeight:700, color:C.text }}>{settings.gst}</span></div>}
            {po?.deliveryContact && <div>Contact: <span style={{ fontWeight:600, color:C.text }}>{po.deliveryContact}</span></div>}
            {po?.deliveryTerms  && <div>Terms: <span style={{ fontWeight:600, color:C.text }}>{po.deliveryTerms}</span></div>}
          </div>
        </div>
      </div>

      {/* ══ ITEMS TABLE ═════════════════════════════════════════════════ */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5 }}>
        <thead>
          <tr style={{ background:C.navy }}>
            {[
              ['#',              'center', 28 ],
              ['Product / Description', 'left',   null],
              ['SKU',            'left',   70 ],
              ['HSN/SAC',        'left',   60 ],
              ['Unit',           'center', 40 ],
              ['Qty',            'right',  40 ],
              ['Rate',           'right',  70 ],
              ['Disc',           'right',  55 ],
              ['Tax%',           'right',  42 ],
              ['Tax Amt',        'right',  65 ],
              ['Line Total',     'right',  75 ],
            ].map(([h,align,w]) => (
              <th key={h} style={{ padding:'8px 7px', textAlign:align, fontWeight:700, fontSize:9, color:C.white, letterSpacing:'0.05em', whiteSpace:'nowrap', width:w||undefined }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const lineSub     = Number(it.quantity||0) * Number(it.unitCost||0);
            const lineDisc    = Number(it.discount||0);
            const lineTaxable = Math.max(0, lineSub - lineDisc);
            const lineTax     = lineTaxable * (Number(it.taxPercent||0)/100);
            const lineTotal   = lineSub - lineDisc + lineTax;
            return (
              <tr key={it.id||i} style={{ borderBottom:`1px solid ${C.border}`, background: i%2===0 ? C.white : '#F9FAFB' }}>
                <td style={{ padding:'9px 7px', textAlign:'center', color:C.muted, fontSize:10 }}>{i+1}</td>
                <td style={{ padding:'9px 7px' }}>
                  <div style={{ fontWeight:700, color:C.text }}>{it.productName}</div>
                  {it.description && <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>{it.description}</div>}
                </td>
                <td style={{ padding:'9px 7px', color:C.muted, fontFamily:'monospace', fontSize:10 }}>{it.sku||'—'}</td>
                <td style={{ padding:'9px 7px', color:C.muted }}>{it.hsnSac||'—'}</td>
                <td style={{ padding:'9px 7px', textAlign:'center', color:C.muted }}>{it.unit||'pcs'}</td>
                <td style={{ padding:'9px 7px', textAlign:'right', fontWeight:700, color:C.text }}>{it.quantity}</td>
                <td style={{ padding:'9px 7px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtN(it.unitCost)}</td>
                <td style={{ padding:'9px 7px', textAlign:'right', color: lineDisc>0?'#DC2626':C.muted, fontVariantNumeric:'tabular-nums' }}>
                  {lineDisc > 0 ? fmtN(lineDisc) : '—'}
                </td>
                <td style={{ padding:'9px 7px', textAlign:'right', color:C.muted }}>{it.taxPercent||0}%</td>
                <td style={{ padding:'9px 7px', textAlign:'right', color:C.muted, fontVariantNumeric:'tabular-nums' }}>{fmtN(lineTax)}</td>
                <td style={{ padding:'9px 7px', textAlign:'right', fontWeight:800, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{fmtN(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ══ SUMMARY + TAX BREAKDOWN ═════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', borderTop:`2px solid ${C.border}`, background:C.faint }}>

        {/* Left — tax breakdown table */}
        <div style={{ padding:'16px 32px', borderRight:`1px solid ${C.border}` }}>
          {taxRows.length > 0 && (
            <>
              <div style={{ ...label8, marginBottom:8 }}>GST BREAKDOWN</div>
              <table style={{ fontSize:10, borderCollapse:'collapse', width:'100%', maxWidth:340 }}>
                <thead>
                  <tr style={{ background:'#F1F5F9' }}>
                    <th style={{ padding:'5px 8px', textAlign:'left',  fontSize:9, fontWeight:700, color:C.muted }}>HSN / Tax Rate</th>
                    <th style={{ padding:'5px 8px', textAlign:'right', fontSize:9, fontWeight:700, color:C.muted }}>Taxable Value</th>
                    {isInterstate ? (
                      <th style={{ padding:'5px 8px', textAlign:'right', fontSize:9, fontWeight:700, color:C.muted }}>IGST</th>
                    ) : (
                      <>
                        <th style={{ padding:'5px 8px', textAlign:'right', fontSize:9, fontWeight:700, color:C.muted }}>CGST</th>
                        <th style={{ padding:'5px 8px', textAlign:'right', fontSize:9, fontWeight:700, color:C.muted }}>SGST</th>
                      </>
                    )}
                    <th style={{ padding:'5px 8px', textAlign:'right', fontSize:9, fontWeight:700, color:C.muted }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {taxRows.map(row => (
                    <tr key={row.rate} style={{ borderTop:`1px solid ${C.border}` }}>
                      <td style={{ padding:'5px 8px', color:C.text, fontWeight:600 }}>{row.rate}%</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtN(row.taxable)}</td>
                      {isInterstate ? (
                        <td style={{ padding:'5px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtN(row.tax)}</td>
                      ) : (
                        <>
                          <td style={{ padding:'5px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtN(row.tax/2)}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtN(row.tax/2)}</td>
                        </>
                      )}
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtN(row.tax)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop:`2px solid ${C.border}`, background:'#F1F5F9' }}>
                    <td style={{ padding:'5px 8px', fontWeight:700 }}>Total</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtN(taxableAmt)}</td>
                    {isInterstate ? (
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtN(taxTotal)}</td>
                    ) : (
                      <>
                        <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtN(taxTotal/2)}</td>
                        <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtN(taxTotal/2)}</td>
                      </>
                    )}
                    <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{fmtN(taxTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Right — totals column */}
        <div style={{ padding:'16px 32px 16px 28px', minWidth:260 }}>
          {[
            { label:'Subtotal',           value: fmtN(subtotal),   color:C.muted },
            totalDisc > 0 ? { label:'Total Discount', value:`– ${fmtN(totalDisc)}`, color:'#DC2626' } : null,
            { label:'Taxable Amount',     value: fmtN(taxableAmt), color:C.muted },
            taxRows.length > 0 && !isInterstate ? { label:`CGST (${taxRows.map(r=>r.rate/2+'%').join(', ')})`, value: fmtN(taxTotal/2), color:C.muted } : null,
            taxRows.length > 0 && !isInterstate ? { label:`SGST (${taxRows.map(r=>r.rate/2+'%').join(', ')})`, value: fmtN(taxTotal/2), color:C.muted } : null,
            taxRows.length > 0 &&  isInterstate ? { label:`IGST (${taxRows.map(r=>r.rate+'%').join(', ')})`,  value: fmtN(taxTotal),   color:C.muted } : null,
            taxRows.length === 0 && taxTotal > 0  ? { label:'Tax Total',          value: fmtN(taxTotal),   color:C.muted } : null,
            freightAmt > 0 ? { label:'Freight Charge', value: fmtN(freightAmt), color:C.muted } : null,
            freightGstAmt > 0 ? { label:'Freight GST', value: fmtN(freightGstAmt), color:C.muted } : null,
            Math.abs(roundOff) >= 0.005 ? { label:'Round Off', value: (roundOff>=0?'+ ':'– ')+fmtN(Math.abs(roundOff)), color:C.muted } : null,
          ].filter(Boolean).map(row => (
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:5, marginBottom:5, borderBottom:`1px solid ${C.border}`, fontSize:10.5 }}>
              <span style={{ color:row.color }}>{row.label}</span>
              <span style={{ fontVariantNumeric:'tabular-nums', color:row.color, fontWeight:600 }}>{row.value}</span>
            </div>
          ))}

          {/* Grand Total */}
          <div style={{ background:C.navy, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
            <span style={{ fontSize:10.5, fontWeight:800, color:'#A5B4FC', letterSpacing:'0.06em' }}>GRAND TOTAL</span>
            <span style={{ fontSize:16, fontWeight:900, color:C.white, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>
              {fmtN(grandTotal)}
            </span>
          </div>

          {/* Amount in words */}
          <div style={{ marginTop:10, padding:'8px 10px', background:'#EFF6FF', borderRadius:6, border:'1px solid #BFDBFE' }}>
            <div style={{ fontSize:8.5, fontWeight:800, color:C.accent, letterSpacing:'0.1em', marginBottom:3 }}>AMOUNT IN WORDS</div>
            <div style={{ fontSize:10, color:C.text, fontWeight:600, lineHeight:1.5 }}>{amountInWords(grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* ══ TERMS · NOTES ═══════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', borderTop:`1px solid ${C.border}`, background:C.faint }}>
        <div style={{ padding:'16px 32px', borderRight:`1px solid ${C.border}` }}>
          <div style={{ ...label8, ...divider }}>TERMS &amp; CONDITIONS</div>
          <ol style={{ paddingLeft:14, margin:0 }}>
            {termsList.map((t,i) => (
              <li key={i} style={{ fontSize:9.5, color:C.muted, marginBottom:4, lineHeight:1.55 }}>{t}</li>
            ))}
          </ol>
        </div>
        <div style={{ padding:'16px 32px' }}>
          <div style={{ ...label8, ...divider }}>NOTES</div>
          <div style={{ fontSize:10, color:'#374151', lineHeight:1.65, minHeight:32 }}>{po?.notes || '—'}</div>
          {po?.paymentTerms && (
            <div style={{ marginTop:14 }}>
              <div style={{ ...label8, marginBottom:4 }}>PAYMENT TERMS</div>
              <div style={{ fontSize:10, color:C.text, fontWeight:700 }}>Net {po.paymentTerms} days</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ SIGNATURE AREA ══════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0, borderTop:`1px solid ${C.border}`, background:C.white }}>
        {[
          { label:'Prepared By',         sub:'' },
          { label:'Authorized Signatory', sub: settings?.authorizedSignatory || settings?.businessName || '' },
          { label:'Supplier Acknowledgement', sub:'Date: ___________' },
        ].map((sig, i) => (
          <div key={sig.label} style={{ padding:'16px 24px', textAlign:'center', borderRight: i<2 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ height:44, borderBottom:`1px dashed #9CA3AF`, marginBottom:8 }}/>
            <div style={{ fontSize:9.5, color:C.muted, fontWeight:700, letterSpacing:'0.04em' }}>{sig.label}</div>
            {sig.sub && <div style={{ fontSize:9, color:'#9CA3AF', marginTop:3 }}>{sig.sub}</div>}
          </div>
        ))}
      </div>

      {/* ══ FOOTER BAR ══════════════════════════════════════════════════ */}
      <div style={{ background:C.navy, padding:'7px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:8.5, color:'#A5B4FC' }}>This is a computer-generated Purchase Order. No physical signature required.</span>
        <span style={{ fontSize:8.5, color:'#6474A8' }}>
          {settings?.businessName || ''}
          {settings?.gst ? ` · GSTIN: ${settings.gst}` : ''}
        </span>
      </div>

    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function PurchaseOrders() {
  const {
    state,
    addPurchase,
    addPurchaseOrder, sendPurchaseOrder, approvePurchaseOrder,
    cancelPurchaseOrder, rejectPurchaseOrder, closePurchaseOrder,
    receivePurchaseOrderItems, receivePOItemReplacement, linkPOItemToProduct, addProduct,
    receiveGeneralPurchase, cancelGeneralPurchase, completeGeneralPurchase,
    addSupplierRating, addSupplier, updateSupplier,
  } = useApp();
  const { purchaseOrders, purchaseReceipts, purchases, purchaseReturns, suppliers, products, categories, settings, productSupplierPrices, supplierRatings = [] } = state;
  const sym = settings?.currencySymbol || '₹';

  /* ── Filter state ── */
  const [typeFilter, setTypeFilter]     = useState('all');   // 'all'|'purchase_order'|'general_purchase'
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [suppFilter, setSuppFilter]     = useState('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');

  /* ── Modal / selection state ── */
  const [selectedId, setSelectedId]       = useState(null);   // PO detail modal
  const [selectedGPId, setSelectedGPId]   = useState(null);   // GP detail modal
  const [newPOModal, setNewPOModal]       = useState(false);
  const [slipModal, setSlipModal]         = useState(false);
  const [receiveModal, setReceiveModal]   = useState(false);
  const [gpModal, setGPModal]             = useState(false);   // general purchase create
  const [gpReceiveModal, setGPReceiveModal] = useState(false); // general purchase receive
  const [createProdModal, setCreateProd]  = useState(false);
  const [linkItemRef, setLinkItemRef]     = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [exporting, setExporting]         = useState(false);
  const [openMenuId, setOpenMenuId]       = useState(null);   // row action dropdown

  /* ── Supplier Rating modal ── */
  const blankRating = { overallRating: 0, deliveryRating: 0, qualityRating: 0, pricingRating: 0, communicationRating: 0, onTimeDelivery: '', wouldBuyAgain: '', notes: '' };
  const [ratingModal, setRatingModal]   = useState(false);
  const [ratingPOId, setRatingPOId]     = useState(null);
  const [ratingForm, setRatingForm]     = useState(blankRating);
  const [ratingErrors, setRatingErrors] = useState({});

  /* ── Supplier combobox (New PO form) ── */
  const [suppSearch, setSuppSearch]     = useState('');
  const [suppOpen, setSuppOpen]         = useState(false);

  /* ── Supplier combobox (General Purchase form) ── */
  const [gpSuppSearch, setGPSuppSearch] = useState('');
  const [gpSuppOpen, setGPSuppOpen]     = useState(false);

  /* ── Product filter per item (New PO form) ── */
  const [prodFilters, setProdFilters]   = useState({});   // { idx: filterString }
  const [prodDropState, setProdDropState] = useState(null); // { form: 'po'|'gp', idx, rect }
  const prodInputRefs = useRef({});

  /* ── New Supplier quick-create (shared blank) ── */
  const blankNewSupp = { name: '', email: '', phone: '', address: '', city: '', state: '', country: 'India', taxId: '', notes: '', status: 'active' };

  /* ── New Supplier from PO form ── */
  const [newSuppModal, setNewSuppModal]       = useState(false);
  const [newSuppForm, setNewSuppForm]         = useState(blankNewSupp);
  const [newSuppErrors, setNewSuppErrors]     = useState({});

  /* ── New Supplier from GP form ── */
  const [gpNewSuppModal, setGPNewSuppModal]   = useState(false);
  const [gpNewSuppForm, setGPNewSuppForm]     = useState(blankNewSupp);
  const [gpNewSuppErrors, setGPNewSuppErrors] = useState({});

  /* ── Edit Supplier from PO form ── */
  const [editSuppPO, setEditSuppPO]           = useState(false);
  const [editSuppPOForm, setEditSuppPOForm]   = useState(null);
  const [editSuppPOErrors, setEditSuppPOErrors] = useState({});

  /* ── GP Receive form ── */
  const [gpRcvRows, setGPRcvRows]   = useState([]);
  const [gpRcvNotes, setGPRcvNotes] = useState('');

  const slipRef = useRef(null);

  /* ── New PO form ── */
  const emptyPOItem = () => ({
    id: generateId('poi'), productId: '', productName: '', sku: '',
    description: '', unit: 'pcs', quantity: 1, unitCost: 0,
    sellingPrice: 0, taxPercent: 0, hsnSac: '', categoryId: '',
    isNewProduct: false, productLinked: false, receivedQty: 0,
    // UI helpers (stripped before saving)
    _prevPrice: null, _prevAvgPrice: null, _prevSellingPrice: null, _prevLastPurchasedAt: null,
  });
  const [poForm, setPOForm] = useState({
    supplierId: '', orderDate: today(), expectedDate: '',
    supplierRef: '',
    paymentTerms: settings?.poPaymentTerms || '30',
    deliveryTerms: settings?.poDeliveryTerms || '',
    termsAndConditions: settings?.poTerms || '',
    freightCharge: 0, freightTaxable: false, freightGstRate: 18,
    notes: '',
    items: [emptyPOItem()],
  });
  const [poErrors, setPOErrors] = useState({});

  /* ── General Purchase form ── */
  const emptyGPItem = () => ({
    id: generateId('gpi'),
    itemType: 'existing_product', // 'existing_product' | 'new_product' | 'non_stock_item'
    productId: '', productName: '', sku: '', description: '',
    categoryId: '', brand: '', unit: 'pcs', hsn: '',
    quantity: 1, unitCost: 0, sellingPrice: 0, taxPercent: 0,
    condition: 'good',
    createAsProduct: true,  // for new_product: create in Products on save
    affects_stock: true,
  });
  const [gpForm, setGPForm]     = useState({ supplierId: '', date: today(), paymentStatus: 'paid', notes: '', items: [emptyGPItem()] });
  const [gpErrors, setGPErrors] = useState({});

  /* ── Receive form ── */
  const [rcvRows, setRcvRows]   = useState([]);
  const [rcvNotes, setRcvNotes] = useState('');

  /* ── Replacement form ── */
  const [replModal, setReplModal]   = useState(false);
  const [replRows, setReplRows]     = useState([]);
  const [replNotes, setReplNotes]   = useState('');

  /* ── Create & link product form ── */
  const [prodForm, setProdForm]     = useState({ name: '', sku: '', unit: 'pcs', categoryId: '', costPrice: 0, sellingPrice: 0 });
  const [prodErrors, setProdErrors] = useState({});

  /* ── Derived data ── */
  const selectedPO       = purchaseOrders.find(po => po.id === selectedId) || null;
  const selectedGP       = purchases.find(gp => gp.id === selectedGPId) || null;
  const selectedReceipts = purchaseReceipts.filter(r => r.poId === selectedId);
  const selSupplier      = selectedPO ? suppliers.find(s => s.id === selectedPO.supplierId) : null;
  const selGPSupplier    = selectedGP ? suppliers.find(s => s.id === selectedGP.supplierId) : null;

  const supplierIncomplete = useCallback((suppId) => {
    const s = suppliers.find(x => x.id === suppId);
    return !s || !s.name || (!s.phone && !s.email);
  }, [suppliers]);

  /* ── Supplier rating avg map (for combobox display) ── */
  const suppRatingMap = useMemo(() => {
    const map = {};
    for (const r of supplierRatings) {
      if (!r.supplierId) continue;
      if (!map[r.supplierId]) map[r.supplierId] = { sum: 0, count: 0 };
      map[r.supplierId].sum   += Number(r.overallRating || 0);
      map[r.supplierId].count += 1;
    }
    const out = {};
    for (const [id, m] of Object.entries(map)) {
      out[id] = { avg: Math.round((m.sum / m.count) * 10) / 10, count: m.count };
    }
    return out;
  }, [supplierRatings]);

  /* ── Filtered suppliers for PO combobox ── */
  const filteredSuppList = useMemo(() => {
    if (!suppSearch.trim()) return suppliers;
    const q = suppSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.city  || '').toLowerCase().includes(q)
    );
  }, [suppliers, suppSearch]);

  /* ── Filtered suppliers for GP combobox ── */
  const filteredGPSuppList = useMemo(() => {
    if (!gpSuppSearch.trim()) return suppliers;
    const q = gpSuppSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.city  || '').toLowerCase().includes(q)
    );
  }, [suppliers, gpSuppSearch]);

  /* ── Combined PO + GP list ── */
  const combinedList = useMemo(() => {
    const poList = purchaseOrders.map(po => ({ ...po, document_type: 'purchase_order', _ref: po.poNumber, _date: po.orderDate || po.createdAt }));
    const gpList = purchases.map(gp => ({ ...gp, document_type: gp.document_type || 'general_purchase', _ref: gp.gpNumber || gp.purchaseNumber, _date: gp.date || gp.createdAt, status: gp.fulfillmentStatus || 'pending' }));
    return [...poList, ...gpList];
  }, [purchaseOrders, purchases]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const s = { total: 0, po: 0, gp: 0, created: 0, sent: 0, approved: 0, partially_received: 0, fully_received: 0, closed: 0, cancelled: 0, rejected: 0, pending: 0, completed: 0, orderedVal: 0, acceptedVal: 0 };
    combinedList.forEach(item => {
      s.total++;
      if (item.document_type === 'purchase_order') s.po++; else s.gp++;
      if (s[item.status] !== undefined) s[item.status]++;
      s.orderedVal  += item.grandTotal || 0;
      s.acceptedVal += (item.items || []).reduce((sum, it) => sum + (it.acceptedQty || 0) * (it.unitCost || 0), 0);
    });
    return s;
  }, [combinedList]);

  /* ── Filtered list ── */
  const filteredPOs = useMemo(() => {
    let list = [...combinedList];
    if (typeFilter !== 'all')   list = list.filter(item => item.document_type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(item => item.status === statusFilter);
    if (suppFilter) list = list.filter(item => item.supplierId === suppFilter);
    if (fromDate)   list = list.filter(item => (item._date || '') >= fromDate);
    if (toDate)     list = list.filter(item => (item._date || '') <= toDate);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item =>
        (item._ref || '').toLowerCase().includes(q) ||
        (item.poNumber || '').toLowerCase().includes(q) ||
        (item.gpNumber || '').toLowerCase().includes(q) ||
        (item.supplierName || '').toLowerCase().includes(q) ||
        (item.items || []).some(it => (it.productName || '').toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [combinedList, typeFilter, statusFilter, suppFilter, fromDate, toDate, search]);

  /* ── PO form helpers ── */
  const setPoItem = useCallback((idx, patch) =>
    setPOForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) })), []);

  const handleSelectProduct = (idx, productId) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      const suppId    = poForm.supplierId;
      const pspRecord = (productSupplierPrices || []).find(r => r.productId === productId && r.supplierId === suppId);
      const supplierLastPrice = pspRecord?.lastPurchasePrice || null;
      const lastCost  = supplierLastPrice || p.lastPurchasePrice || null;
      const avgCost   = pspRecord?.averagePurchasePrice || p.averagePurchaseCost || null;
      const curCost   = supplierLastPrice || p.costPrice || p.purchasePrice || 0;
      setPoItem(idx, {
        productId, productName: p.name, sku: p.sku || '',
        unit: p.unit || 'pcs',
        unitCost: curCost,
        sellingPrice: p.sellingPrice || 0,
        taxPercent: p.taxPercent || 0,
        isNewProduct: false, productLinked: true,
        _prevPrice: lastCost,
        _prevAvgPrice: avgCost,
        _prevSellingPrice: p.sellingPrice || 0,
        _prevLastPurchasedAt: pspRecord?.lastPurchaseDate || p.lastPurchasedAt || null,
        _supplierPSP: pspRecord || null,
      });
    } else {
      setPoItem(idx, { productId: '', productName: '', sku: '', unitCost: 0, isNewProduct: false, productLinked: false, _prevPrice: null, _prevAvgPrice: null, _supplierPSP: null });
    }
  };

  const poSubtotal = useMemo(() =>
    poForm.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0), [poForm.items]);

  const poItemsTax = useMemo(() =>
    poForm.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (Number(it.taxPercent || 0) / 100), 0), [poForm.items]);

  const poGSTMode = useMemo(() => getGSTMode(poForm.supplierId, suppliers, settings), [poForm.supplierId, suppliers, settings]);

  const poFreightTax = useMemo(() => {
    const f = Number(poForm.freightCharge || 0);
    if (!f || !poForm.freightTaxable) return 0;
    return f * (Number(poForm.freightGstRate || 0) / 100);
  }, [poForm.freightCharge, poForm.freightTaxable, poForm.freightGstRate]);

  const poGrandTotal = useMemo(() =>
    poSubtotal + poItemsTax + Number(poForm.freightCharge || 0) + poFreightTax,
    [poSubtotal, poItemsTax, poForm.freightCharge, poFreightTax]);

  const handleCreatePO = async () => {
    const errs = {};
    if (!poForm.supplierId) errs.supplierId = 'Supplier required';
    if (!poForm.orderDate)  errs.orderDate  = 'Required';
    poForm.items.forEach((it, i) => {
      if (!it.productName)             errs[`in${i}`] = 'Name required';
      if (!(Number(it.quantity) > 0))  errs[`iq${i}`] = 'Qty > 0';
    });
    if (Object.keys(errs).length) { setPOErrors(errs); return; }
    const sup = suppliers.find(s => s.id === poForm.supplierId);
    const freightAmt   = Number(poForm.freightCharge || 0);
    const freightGstAmt = poForm.freightTaxable ? freightAmt * (Number(poForm.freightGstRate || 0) / 100) : 0;
    const cleanItems = poForm.items.map(({ _prevPrice, _prevAvgPrice, _prevSellingPrice, _prevLastPurchasedAt, ...rest }) => ({
      ...rest,
      quantity:  Number(rest.quantity),
      unitCost:  Number(rest.unitCost),
      taxPercent: Number(rest.taxPercent || 0),
    }));
    await addPurchaseOrder({
      ...poForm,
      items: cleanItems,
      supplierName: sup?.name || '',
      isInterstate: poGSTMode.isInterstate,
      subtotal:     poSubtotal,
      itemsTax:     poItemsTax,
      freightCharge:    freightAmt,
      freightGstAmount: freightGstAmt,
      freightTotal:     freightAmt + freightGstAmt,
      grandTotal:       poGrandTotal,
    });
    setNewPOModal(false);
    setPOForm({
      supplierId: '', orderDate: today(), expectedDate: '',
      supplierRef: '',
      paymentTerms: settings?.poPaymentTerms || '30',
      deliveryTerms: settings?.poDeliveryTerms || '',
      termsAndConditions: settings?.poTerms || '',
      freightCharge: 0, freightTaxable: false, freightGstRate: 18,
      notes: '',
      items: [emptyPOItem()],
    });
    setPOErrors({});
  };

  /* ── General Purchase ── */
  const setGPItem = (idx, patch) =>
    setGPForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));

  const handleSelectGPProduct = (idx, productId) => {
    const p = products.find(x => x.id === productId);
    if (p) setGPItem(idx, {
      productId, productName: p.name, sku: p.sku || '',
      unitCost: p.costPrice || p.purchasePrice || 0,
      sellingPrice: p.sellingPrice || 0,
      taxPercent: p.taxPercent || 0,
      _prevPrice: p.lastPurchasePrice || null,
      _prevAvgPrice: p.averagePurchaseCost || null,
      _prevLastPurchasedAt: p.lastPurchasedAt || null,
    });
    else setGPItem(idx, { productId: '', productName: '', sku: '', unitCost: 0, sellingPrice: 0, taxPercent: 0, _prevPrice: null, _prevAvgPrice: null, _prevLastPurchasedAt: null });
  };

  const gpSubtotal = useMemo(() =>
    gpForm.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0), [gpForm.items]);
  const gpTax = useMemo(() =>
    gpForm.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (Number(it.taxPercent) / 100), 0), [gpForm.items]);
  const gpStockSubtotal = useMemo(() =>
    gpForm.items.filter(it => it.itemType !== 'non_stock_item').reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0), [gpForm.items]);
  const gpExpenseSubtotal = useMemo(() =>
    gpForm.items.filter(it => it.itemType === 'non_stock_item').reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0), [gpForm.items]);

  const gpGSTMode = useMemo(() => getGSTMode(gpForm.supplierId, suppliers, settings), [gpForm.supplierId, suppliers, settings]);

  const handleGPSave = async () => {
    const errs = {};
    if (!gpForm.supplierId) errs.supplierId = 'Supplier required';
    gpForm.items.forEach((it, i) => {
      const isExisting = it.itemType === 'existing_product' || !it.itemType;
      if (isExisting && !it.productId) errs[`gp_p${i}`] = 'Select product';
      if (!isExisting && !it.productName?.trim()) errs[`gp_p${i}`] = it.itemType === 'non_stock_item' ? 'Item name required' : 'Product name required';
      if (!(Number(it.quantity) > 0))  errs[`gp_q${i}`] = 'Qty > 0';
      if (!(Number(it.unitCost) >= 0)) errs[`gp_c${i}`] = 'Enter amount';
    });
    if (Object.keys(errs).length) { setGPErrors(errs); return; }

    // Resolve final items: create products for new_product items where requested
    let finalItems = gpForm.items.map(it => ({ ...it }));
    for (let i = 0; i < finalItems.length; i++) {
      const it = finalItems[i];
      if (it.itemType === 'new_product' && it.createAsProduct !== false) {
        const newProdId = generateId('prod');
        await addProduct({
          id: newProdId,
          name: it.productName,
          sku: it.sku || '',
          categoryId: it.categoryId || '',
          brand: it.brand || '',
          unit: it.unit || 'pcs',
          hsn: it.hsn || '',
          costPrice:    Number(it.unitCost) || 0,
          sellingPrice: Number(it.sellingPrice) || 0,
          taxPercent:   Number(it.taxPercent) || 0,
          stock: 0, status: 'active', createdAt: today(),
        });
        finalItems[i] = { ...it, productId: newProdId, affects_stock: true };
      } else if (it.itemType === 'non_stock_item' || (it.itemType === 'new_product' && it.createAsProduct === false)) {
        finalItems[i] = { ...it, affects_stock: false };
      }
    }

    const hasStockItems = finalItems.some(it => it.affects_stock !== false);
    const allTax = finalItems.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (Number(it.taxPercent) / 100), 0);
    const allSubtotal = finalItems.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0);
    const sup = suppliers.find(s => s.id === gpForm.supplierId);

    await addPurchase({
      id: generateId('purch'),
      document_type: 'general_purchase',
      fulfillmentStatus: hasStockItems ? 'pending' : 'fully_received',
      supplierId: gpForm.supplierId,
      supplierName: sup?.name || '',
      date: gpForm.date,
      paymentStatus: gpForm.paymentStatus,
      notes: gpForm.notes,
      isInterstate: gpGSTMode.isInterstate,
      subtotal: allSubtotal,
      grandTotal: allSubtotal + allTax,
      createdAt: today(),
      items: finalItems.map(({ _prevPrice, _prevAvgPrice, _prevLastPurchasedAt, createAsProduct, ...it }) => ({
        ...it,
        id:           it.id || generateId('gpi'),
        quantity:     Number(it.quantity),
        unitCost:     Number(it.unitCost),
        sellingPrice: Number(it.sellingPrice || 0),
        taxPercent:   Number(it.taxPercent || 0),
        // non-stock items are auto-received (nothing physical to receive)
        receivedQty: it.affects_stock === false ? Number(it.quantity) : 0,
        acceptedQty: it.affects_stock === false ? Number(it.quantity) : 0,
      })),
    });
    setGPModal(false);
    setGPForm({ supplierId: '', date: today(), paymentStatus: 'paid', notes: '', items: [emptyGPItem()] });
    setGPErrors({});
    setGPSuppSearch('');
    setGPSuppOpen(false);
  };

  /* ── Receive ── */
  const openReceive = useCallback(() => {
    if (!selectedPO) return;
    // Show all items where physical receipt is not yet complete OR pendingCompletion > 0
    const itemsToShow = (selectedPO.items || []).filter(it => {
      const physReceived = (it.acceptedQty||0) + (it.damagedQty||0) + (it.defectiveQty||0) + (it.rejectedQty||0);
      const pendingPhys  = it.quantity - physReceived;
      return pendingPhys > 0;  // only items that still need physical delivery
    });
    setRcvRows(itemsToShow.map(it => {
      const physReceived     = (it.acceptedQty||0) + (it.damagedQty||0) + (it.defectiveQty||0) + (it.rejectedQty||0);
      const pendingPhysical  = Math.max(0, it.quantity - physReceived);
      const pendingCompletion = Math.max(0, it.quantity - ((it.acceptedQty||0) + (it.rejectedQty||0)));
      return {
        poItemId:    it.id,
        productId:   it.productId,
        productName: it.productName,
        sku:         it.sku || '',
        unitCost:    it.unitCost || 0,
        orderedQty:  it.quantity,
        // historical totals
        histAccepted:           it.acceptedQty           || 0,
        histDamaged:            it.damagedQty            || 0,
        histDefective:          it.defectiveQty          || 0,
        histRejected:           it.rejectedQty           || 0,
        histPendingReplacement: it.pendingReplacementQty || 0,
        pendingPhysical,
        pendingCompletion,
        // new receipt fields
        newAcceptedQty:  0,
        newDamagedQty:   0,
        newDefectiveQty: 0,
        newRejectedQty:  0,
        // extra quantity (supplier sent more than ordered)
        extraAcceptedQty:  0,
        extraDamagedQty:   0,
        extraDefectiveQty: 0,
        extraRejectedQty:  0,
        showExtra:    false,
        itemNotes:    '',
        isNewProduct: it.isNewProduct  || false,
        productLinked: it.productLinked !== false,
      };
    }));
    setRcvNotes('');
    setReceiveModal(true);
  }, [selectedPO]);

  const setRcvRow = (idx, patch) => setRcvRows(rows => rows.map((r, i) => {
    if (i !== idx) return r;
    const u = { ...r, ...patch };
    // Regular section: total must not exceed pendingPhysical
    const regTotal = Number(u.newAcceptedQty||0) + Number(u.newDamagedQty||0) + Number(u.newDefectiveQty||0) + Number(u.newRejectedQty||0);
    if (regTotal > r.pendingPhysical) {
      // Check if this specific patch would violate — revert just the changed field(s)
      return { ...r, showExtra: u.showExtra, itemNotes: u.itemNotes,
        // allow extra fields to change freely
        extraAcceptedQty: Math.max(0, u.extraAcceptedQty || 0),
        extraDamagedQty:  Math.max(0, u.extraDamagedQty  || 0),
        extraDefectiveQty: Math.max(0, u.extraDefectiveQty || 0),
        extraRejectedQty: Math.max(0, u.extraRejectedQty  || 0),
      };
    }
    return u;
  }));

  const setRcvRowExtra = (idx, patch) => setRcvRows(rows => rows.map((r, i) => {
    if (i !== idx) return r;
    const u = { ...r, ...patch };
    // Extra fields: clamped to >= 0, no upper limit
    return {
      ...u,
      extraAcceptedQty:  Math.max(0, u.extraAcceptedQty  || 0),
      extraDamagedQty:   Math.max(0, u.extraDamagedQty   || 0),
      extraDefectiveQty: Math.max(0, u.extraDefectiveQty || 0),
      extraRejectedQty:  Math.max(0, u.extraRejectedQty  || 0),
    };
  }));

  const handleReceive = async () => {
    const toReceive = rcvRows.filter(r => r.productLinked && (
      Number(r.newAcceptedQty) + Number(r.newDamagedQty) + Number(r.newDefectiveQty) + Number(r.newRejectedQty) +
      Number(r.extraAcceptedQty) + Number(r.extraDamagedQty) + Number(r.extraDefectiveQty) + Number(r.extraRejectedQty)
    ) > 0);
    if (!toReceive.length) { toast.error('Enter at least one quantity'); return; }
    await receivePurchaseOrderItems(
      selectedPO.id,
      toReceive.map(r => ({
        poItemId:    r.poItemId,
        productId:   r.productId,
        productName: r.productName,
        sku:         r.sku,
        orderedQty:  r.orderedQty,
        unitCost:    r.unitCost,
        acceptedQty:      Number(r.newAcceptedQty  || 0),
        damagedQty:       Number(r.newDamagedQty   || 0),
        defectiveQty:     Number(r.newDefectiveQty || 0),
        rejectedQty:      Number(r.newRejectedQty  || 0),
        extraAcceptedQty:  Number(r.extraAcceptedQty  || 0),
        extraDamagedQty:   Number(r.extraDamagedQty   || 0),
        extraDefectiveQty: Number(r.extraDefectiveQty || 0),
        extraRejectedQty:  Number(r.extraRejectedQty  || 0),
        notes: r.itemNotes,
      })),
      rcvNotes, today()
    );
    setReceiveModal(false);
  };

  /* ── Replacement Receive ── */
  const openReplacement = useCallback(() => {
    if (!selectedPO) return;
    const pendingReturns = (purchaseReturns || []).filter(ret =>
      ret.purchaseOrderId === selectedPO.id &&
      ret.replacementRequired !== false &&
      (ret.pendingReplacementQty || 0) > 0 &&
      ['pending_replacement', 'partially_replaced'].includes(ret.status)
    );
    if (!pendingReturns.length) { toast.error('No pending replacements for this PO'); return; }
    setReplRows(pendingReturns.flatMap(ret =>
      (ret.items || []).map(item => ({
        returnId:             ret.id,
        returnNumber:         ret.returnNumber,
        condition:            ret.condition || ret.conditionType || 'damaged',
        poItemId:             item.poItemId || '',
        productId:            item.productId,
        productName:          item.productName,
        sku:                  item.sku || '',
        unitCost:             item.unitCost || 0,
        pendingReplacementQty: ret.pendingReplacementQty || 0,
        replacedQty:          0,
      }))
    ));
    setReplNotes('');
    setReplModal(true);
  }, [selectedPO, purchaseReturns]);

  const setReplRow = (idx, val) => setReplRows(rows => rows.map((r, i) => {
    if (i !== idx) return r;
    return { ...r, replacedQty: Math.max(0, Math.min(Number(val) || 0, r.pendingReplacementQty)) };
  }));

  const handleReplacement = async () => {
    const toReplace = replRows.filter(r => Number(r.replacedQty) > 0);
    if (!toReplace.length) { toast.error('Enter at least one replacement quantity'); return; }
    await receivePOItemReplacement(
      selectedPO.id,
      toReplace.map(r => ({
        returnId:    r.returnId,
        poItemId:    r.poItemId,
        productId:   r.productId,
        productName: r.productName,
        sku:         r.sku,
        unitCost:    r.unitCost,
        replacedQty: Number(r.replacedQty),
      })),
      replNotes, today()
    );
    setReplModal(false);
  };

  /* ── GP Receive ── */
  const openGPReceive = useCallback((gp) => {
    setSelectedGPId(gp.id);
    const pending = (gp.items || []).filter(it => (it.receivedQty || 0) < it.quantity);
    setGPRcvRows(pending.map(it => ({
      gpItemId: it.id, productId: it.productId, productName: it.productName, sku: it.sku || '',
      orderedQty: it.quantity, alreadyReceived: it.receivedQty || 0,
      pendingQty: it.quantity - (it.receivedQty || 0),
      unitCost: it.unitCost || 0,
      acceptedQty: 0, damagedQty: 0, defectiveQty: 0, rejectedQty: 0,
    })));
    setGPRcvNotes('');
    setGPReceiveModal(true);
  }, []);

  const setGPRcvRow = (idx, patch) => setGPRcvRows(rows => rows.map((r, i) => {
    if (i !== idx) return r;
    const u = { ...r, ...patch };
    const total = Number(u.acceptedQty||0) + Number(u.damagedQty||0) + Number(u.defectiveQty||0) + Number(u.rejectedQty||0);
    return total <= r.pendingQty ? u : r;
  }));

  const handleGPReceive = async () => {
    const toReceive = gpRcvRows.filter(r =>
      (Number(r.acceptedQty) + Number(r.damagedQty) + Number(r.defectiveQty) + Number(r.rejectedQty)) > 0
    );
    if (!toReceive.length) { toast.error('Enter at least one quantity'); return; }
    await receiveGeneralPurchase(
      selectedGPId,
      toReceive.map(r => ({
        gpItemId: r.gpItemId, productId: r.productId, productName: r.productName, sku: r.sku,
        orderedQty: r.orderedQty, unitCost: r.unitCost,
        acceptedQty: Number(r.acceptedQty||0), damagedQty: Number(r.damagedQty||0),
        defectiveQty: Number(r.defectiveQty||0), rejectedQty: Number(r.rejectedQty||0),
      })),
      gpRcvNotes, today()
    );
    setGPReceiveModal(false);
  };

  /* ── Create & Link product ── */
  const openCreateProd = (row) => {
    setLinkItemRef({ poId: selectedPO.id, itemId: row.poItemId });
    setProdForm({ name: row.productName, sku: row.sku || '', unit: 'pcs', categoryId: '', costPrice: Number(row.unitCost || 0), sellingPrice: 0 });
    setProdErrors({});
    setCreateProd(true);
  };

  const handleCreateAndLink = async () => {
    if (!prodForm.name) { setProdErrors({ name: 'Required' }); return; }
    const newProd = { id: generateId('prd'), ...prodForm, stock: 0, lowStockThreshold: 5, status: 'active', createdAt: today() };
    await addProduct(newProd);
    await linkPOItemToProduct(linkItemRef.poId, linkItemRef.itemId, newProd.id);
    setRcvRows(rows => rows.map(r => r.poItemId === linkItemRef.itemId ? { ...r, productId: newProd.id, productLinked: true } : r));
    setCreateProd(false);
    setLinkItemRef(null);
  };

  /* ── Status actions ── */
  const doConfirm = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    if (type === 'send')       await sendPurchaseOrder(id);
    if (type === 'approve')    await approvePurchaseOrder(id);
    if (type === 'cancel')     await cancelPurchaseOrder(id);
    if (type === 'reject')     await rejectPurchaseOrder(id);
    if (type === 'gp_cancel')  await cancelGeneralPurchase(id);
    if (type === 'gp_complete') await completeGeneralPurchase(id);
    setConfirmAction(null);
  };

  const openRatingModal = (poId) => {
    setRatingPOId(poId);
    setRatingForm(blankRating);
    setRatingErrors({});
    setRatingModal(true);
  };

  const handleSubmitRating = async () => {
    const errs = {};
    if (!ratingForm.overallRating) errs.overall = 'Overall rating is required';
    if (!ratingForm.onTimeDelivery) errs.onTime = 'Required';
    if (!ratingForm.wouldBuyAgain) errs.wouldBuy = 'Required';
    if (Object.keys(errs).length) { setRatingErrors(errs); return; }
    const po = purchaseOrders.find(p => p.id === ratingPOId);
    await addSupplierRating({
      supplierId:           po?.supplierId || null,
      purchaseOrderId:      ratingPOId,
      overallRating:        ratingForm.overallRating,
      deliveryRating:       ratingForm.deliveryRating || null,
      qualityRating:        ratingForm.qualityRating || null,
      pricingRating:        ratingForm.pricingRating || null,
      communicationRating:  ratingForm.communicationRating || null,
      onTimeDelivery:       ratingForm.onTimeDelivery === 'yes',
      wouldBuyAgain:        ratingForm.wouldBuyAgain === 'yes',
      notes:                ratingForm.notes,
    });
    await closePurchaseOrder(ratingPOId);
    setRatingModal(false);
    setRatingPOId(null);
  };

  const handleSkipRating = async () => {
    await closePurchaseOrder(ratingPOId);
    setRatingModal(false);
    setRatingPOId(null);
  };

  /* ── Supplier combobox handlers ── */
  const handleSuppSelect = (s) => {
    setPOForm(f => ({ ...f, supplierId: s.id }));
    setSuppSearch(s.name);
    setSuppOpen(false);
  };

  const handleSuppBlur = () => {
    setSuppOpen(false);
    if (poForm.supplierId) {
      const s = suppliers.find(x => x.id === poForm.supplierId);
      if (s) setSuppSearch(s.name);
    }
  };

  /* ── New Supplier from PO ── */
  const handleCreateSupplierInPO = async () => {
    const errs = validateSupplier(newSuppForm);
    if (Object.keys(errs).length) { setNewSuppErrors(errs); return; }
    const newId = generateId('sup');
    await addSupplier({ id: newId, ...newSuppForm, createdAt: today() });
    setPOForm(f => ({ ...f, supplierId: newId }));
    setSuppSearch(newSuppForm.name);
    setNewSuppModal(false);
    setNewSuppForm(blankNewSupp);
    setNewSuppErrors({});
  };

  /* ── GP supplier combobox handlers ── */
  const handleGPSuppSelect = (s) => {
    setGPForm(f => ({ ...f, supplierId: s.id }));
    setGPSuppSearch(s.name);
    setGPSuppOpen(false);
  };

  const handleGPSuppBlur = () => {
    setGPSuppOpen(false);
    if (gpForm.supplierId) {
      const s = suppliers.find(x => x.id === gpForm.supplierId);
      if (s) setGPSuppSearch(s.name);
    }
  };

  /* ── New Supplier from GP ── */
  const handleCreateSupplierInGP = async () => {
    const errs = validateSupplier(gpNewSuppForm);
    if (Object.keys(errs).length) { setGPNewSuppErrors(errs); return; }
    const newId = generateId('sup');
    await addSupplier({ id: newId, ...gpNewSuppForm, createdAt: today() });
    setGPForm(f => ({ ...f, supplierId: newId }));
    setGPSuppSearch(gpNewSuppForm.name);
    setGPNewSuppModal(false);
    setGPNewSuppForm(blankNewSupp);
    setGPNewSuppErrors({});
  };

  /* ── Edit Supplier from PO ── */
  const openEditSuppPO = () => {
    const s = suppliers.find(x => x.id === poForm.supplierId);
    if (!s) return;
    setEditSuppPOForm({ ...s });
    setEditSuppPOErrors({});
    setEditSuppPO(true);
  };

  const handleEditSuppPO = async () => {
    if (!editSuppPOForm?.name?.trim()) { setEditSuppPOErrors({ name: 'Required' }); return; }
    await updateSupplier(editSuppPOForm);
    setSuppSearch(editSuppPOForm.name);
    setEditSuppPO(false);
  };

  /* ── PO Slip export ── */
  const handlePrint = () => {
    const content = slipRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>PO ${selectedPO?.poNumber}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif}@media print{@page{size:A4;margin:8mm}}</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 350);
  };

  const handlePDFDownload = async () => {
    if (!slipRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ]);
      const canvas = await html2canvas(slipRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = (canvas.height * pW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pW, Math.min(pH, pdf.internal.pageSize.getHeight()));
      pdf.save(`${selectedPO?.poNumber || 'PO'}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed — use Print instead');
    } finally {
      setExporting(false);
    }
  };

  const handleJPGDownload = async () => {
    if (!slipRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(slipRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${selectedPO?.poNumber || 'PO'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('Image downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Image export failed');
    } finally {
      setExporting(false);
    }
  };

  /* ── Status tabs ── */
  const STATUS_TABS = [
    { value: 'all',                label: 'All',       count: stats.total },
    { value: 'pending',            label: 'Pending',   count: stats.pending },
    { value: 'created',            label: 'Draft',     count: stats.created },
    { value: 'sent',               label: 'Sent',      count: stats.sent },
    { value: 'approved',           label: 'Approved',  count: stats.approved },
    { value: 'partially_received', label: 'Partial',   count: stats.partially_received },
    { value: 'fully_received',     label: 'Received',  count: stats.fully_received },
    { value: 'closed',             label: 'Closed',    count: stats.closed },
    { value: 'completed',          label: 'Completed', count: stats.completed },
    { value: 'cancelled',          label: 'Cancelled', count: stats.cancelled },
  ];

  /* ── Per-PO action buttons (used inside detail modal) ── */
  function renderActions(po) {
    const s = po.status;
    // hasPendingPhysical: items where supplier has not yet delivered all ordered units
    const hasPendingPhysical = (po.items || []).some(it => {
      const phys = (it.acceptedQty||0) + (it.damagedQty||0) + (it.defectiveQty||0) + (it.rejectedQty||0);
      return phys < it.quantity;
    });
    // hasPendingReplacement: any open purchase return with pending replacement qty
    const hasPendingReplacement = (purchaseReturns || []).some(ret =>
      ret.purchaseOrderId === po.id &&
      ret.replacementRequired !== false &&
      (ret.pendingReplacementQty || 0) > 0 &&
      ['pending_replacement', 'partially_replaced'].includes(ret.status)
    );
    const incomplete = supplierIncomplete(po.supplierId);
    return (
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <button onClick={() => { setSelectedId(po.id); setSlipModal(true); }} style={outBtnStyle('#4F46E5')}>
          <Eye size={12} /> Preview Slip
        </button>
        {s === 'created' && <>
          <button onClick={() => {
            if (incomplete) { toast.error('Add supplier phone/email before sending'); return; }
            setConfirmAction({ type: 'send', id: po.id, label: `Send "${po.poNumber}" to ${po.supplierName}?` });
          }} style={solidBtnStyle('#1D4ED8')}><Send size={12} /> Send</button>
          <button onClick={() => setConfirmAction({ type: 'approve', id: po.id, label: 'Approve this PO?' })} style={solidBtnStyle('#059669')}><CheckCircle2 size={12} /> Approve</button>
          <button onClick={() => setConfirmAction({ type: 'cancel', id: po.id, label: 'Cancel this PO?' })} style={outBtnStyle('#DC2626')}><X size={12} /> Cancel</button>
        </>}
        {s === 'sent' && <>
          <button onClick={() => setConfirmAction({ type: 'approve', id: po.id, label: 'Approve this PO?' })} style={solidBtnStyle('#059669')}><CheckCircle2 size={12} /> Approve</button>
          <button onClick={() => setConfirmAction({ type: 'reject', id: po.id, label: 'Reject this PO?' })} style={outBtnStyle('#DC2626')}><XCircle size={12} /> Reject</button>
        </>}
        {(s === 'approved' || s === 'partially_received') && hasPendingPhysical && (
          <button onClick={openReceive} style={solidBtnStyle('#B45309')}><PackageCheck size={12} /> Receive Items</button>
        )}
        {hasPendingReplacement && (
          <button onClick={openReplacement} style={solidBtnStyle('#7C3AED')}><PackageCheck size={12} /> Receive Replacement</button>
        )}
        {(s === 'fully_received' || s === 'partially_received') && (
          <button onClick={() => openRatingModal(po.id)} style={outBtnStyle('#71717A')}><CheckCircle2 size={12} /> Close PO</button>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}
      onClick={() => { if (openMenuId) setOpenMenuId(null); }}
    >

      {/* ── Page header ── */}
      <div style={{ flexShrink: 0, padding: '16px 24px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <ClipboardList size={20} color="var(--brand)" /> Purchase Orders
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>Plan, send, approve, and receive. Stock updates only on accepted items.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setGPModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', background: 'var(--canvas)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              <ShoppingCart size={14} /> General Purchase
            </button>
            <button onClick={() => setNewPOModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} strokeWidth={2.5} /> New PO
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          {[
            { l: 'Total',         v: stats.total,                            fg: '#4F46E5', bg: '#EEF2FF' },
            { l: 'POs',           v: stats.po,                               fg: '#1D4ED8', bg: '#EFF6FF' },
            { l: 'Gen. Purchases',v: stats.gp,                               fg: '#7C3AED', bg: '#F5F3FF' },
            { l: 'In Progress',   v: stats.partially_received + stats.pending, fg: '#B45309', bg: '#FFFBEB' },
            { l: 'Received',      v: stats.fully_received + stats.completed, fg: '#16A34A', bg: '#F0FDF4' },
            { l: 'Ordered Value', v: formatCurrency(stats.orderedVal, sym),  fg: '#1D4ED8', bg: '#EFF6FF' },
            { l: 'Accepted Value',v: formatCurrency(stats.acceptedVal, sym), fg: '#16A34A', bg: '#F0FDF4' },
          ].map(c => (
            <div key={c.l} style={{ flexShrink: 0, minWidth: 100, padding: '7px 11px', borderRadius: 9, background: c.bg, border: `1px solid ${c.fg}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{c.l}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: c.fg }}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={fltSel}>
            <option value="all">All Types</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="general_purchase">General Purchases</option>
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="PO/GP #, supplier, product…" style={{ width: '100%', paddingLeft: 27, height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          <select value={suppFilter} onChange={e => setSuppFilter(e.target.value)} style={fltSel}>
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...fltSel, padding: '0 6px' }} />
          <input type="date" value={toDate}   onChange={e => setToDate(e.target.value)}   style={{ ...fltSel, padding: '0 6px' }} />
          {(search || suppFilter || fromDate || toDate || typeFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setSuppFilter(''); setFromDate(''); setToDate(''); setTypeFilter('all'); }} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)} style={{ flexShrink: 0, padding: '6px 10px', fontSize: 11.5, fontWeight: statusFilter === tab.value ? 700 : 500, color: statusFilter === tab.value ? 'var(--brand)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: statusFilter === tab.value ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Full-width table ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredPOs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.15 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No purchase orders</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{search || suppFilter ? 'No results — clear filters' : 'Create your first PO'}</div>
            <button onClick={() => setNewPOModal(true)} style={{ marginTop: 14, padding: '7px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>+ New PO</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 820 }}>
            <thead>
              <tr style={{ background: 'var(--canvas)', position: 'sticky', top: 0, zIndex: 10 }}>
                {[
                  ['Type', 'left'],
                  ['Reference', 'left'],
                  ['Order Date', 'left'],
                  ['Supplier', 'left'],
                  ['Items', 'right'],
                  ['Total Value', 'right'],
                  ['Acc / Ord', 'right'],
                  ['Pending', 'right'],
                  ['Status', 'left'],
                  ['', 'center'],
                ].map(([h, align]) => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: align, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map(item => {
                const isGP   = item.document_type === 'general_purchase';
                const ref    = isGP ? (item.gpNumber || item.purchaseNumber) : item.poNumber;
                const date   = isGP ? item.date : item.orderDate;
                const accepted = (item.items || []).reduce((s, it) => s + (it.acceptedQty || 0), 0);
                const ordered  = (item.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
                const pending  = ordered - accepted;
                return (
                  <tr
                    key={item.id}
                    onClick={() => { if (isGP) setSelectedGPId(item.id); else setSelectedId(item.id); }}
                    style={{ cursor: 'pointer', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', background: isGP ? '#F5F3FF' : '#EFF6FF', color: isGP ? '#7C3AED' : '#1D4ED8', border: `1px solid ${isGP ? '#DDD6FE' : '#BFDBFE'}` }}>
                        {isGP ? 'GP' : 'PO'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ref}</td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDate(isGP ? item.date : item.orderDate)}</div>
                    </td>
                    <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.supplierName || '—'}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(item.items || []).length}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.grandTotal || 0, sym)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', color: accepted > 0 ? '#16A34A' : 'var(--text-tertiary)', fontWeight: accepted > 0 ? 700 : 400 }}>{accepted}/{ordered}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', color: pending > 0 ? '#B45309' : '#16A34A', fontWeight: 700 }}>{pending}</td>
                    <td style={{ padding: '11px 12px' }}><StatusBadge status={item.status} small /></td>
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === item.id ? null : item.id); }}
                          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenuId === item.id && (
                          <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 170, overflow: 'hidden' }}>
                            {(isGP ? [
                              { label: 'View Details', action: () => { setSelectedGPId(item.id); setOpenMenuId(null); } },
                              ['pending','partially_received'].includes(item.status) ? { label: 'Receive Items', action: () => { openGPReceive(item); setOpenMenuId(null); } } : null,
                              ['pending','partially_received'].includes(item.status) ? { label: 'Cancel Purchase', action: () => { setConfirmAction({ type: 'gp_cancel', id: item.id, label: 'Cancel this general purchase?' }); setOpenMenuId(null); } } : null,
                              item.status === 'fully_received' ? { label: 'Mark Complete', action: () => { setConfirmAction({ type: 'gp_complete', id: item.id, label: 'Mark as completed?' }); setOpenMenuId(null); } } : null,
                            ] : [
                              { label: 'View Details', action: () => { setSelectedId(item.id); setOpenMenuId(null); } },
                              { label: 'Preview Slip', action: () => { setSelectedId(item.id); setSlipModal(true); setOpenMenuId(null); } },
                              item.status === 'created' ? { label: 'Send PO', action: () => { setConfirmAction({ type: 'send', id: item.id, label: `Send "${item.poNumber}"?` }); setOpenMenuId(null); } } : null,
                              (item.status === 'created' || item.status === 'sent') ? { label: 'Approve', action: () => { setConfirmAction({ type: 'approve', id: item.id, label: 'Approve this PO?' }); setOpenMenuId(null); } } : null,
                              (item.status === 'approved' || item.status === 'partially_received') ? { label: 'Receive Items', action: () => { setSelectedId(item.id); setTimeout(openReceive, 0); setOpenMenuId(null); } } : null,
                              item.status === 'created' ? { label: 'Cancel', action: () => { setConfirmAction({ type: 'cancel', id: item.id, label: 'Cancel this PO?' }); setOpenMenuId(null); } } : null,
                            ]).filter(Boolean).map(menuItem => (
                              <button key={menuItem.label} onClick={menuItem.action} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-primary)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {menuItem.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════ PO DETAIL MODAL ══════ */}
      <Modal
        open={!!selectedId && !slipModal && !receiveModal && !replModal && !selectedGPId}
        onClose={() => setSelectedId(null)}
        title={selectedPO ? `${selectedPO.poNumber} — ${selectedPO.supplierName}` : ''}
        size="lg"
      >
        {selectedPO && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status + action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedPO.status} />
              {renderActions(selectedPO)}
            </div>

            {/* Supplier incomplete warning */}
            {supplierIncomplete(selectedPO.supplierId) && (
              <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11.5, color: '#92400E' }}>Supplier details incomplete — add phone/email in <strong>Suppliers</strong> before sending.</div>
              </div>
            )}

            {/* Info cards: Supplier + Order details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Supplier</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Truck size={14} color="var(--brand)" /> {selectedPO.supplierName || '—'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.7 }}>
                  {selSupplier?.phone && <div>Ph: {selSupplier.phone}</div>}
                  {selSupplier?.email && <div>{selSupplier.email}</div>}
                  {selSupplier?.address && <div>{selSupplier.address}</div>}
                  {selSupplier?.gst    && <div>GSTIN: {selSupplier.gst}</div>}
                </div>
              </div>
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Order Details</div>
                <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {[
                      ['Order Date',    formatModalDateTime(selectedPO.orderDate, selectedPO.createdAt)],
                      ['Expected',      selectedPO.expectedDate ? formatDate(selectedPO.expectedDate) : '—'],
                      ['Order Value',   formatCurrency(selectedPO.grandTotal || 0, sym)],
                      selectedPO.paymentTerms ? ['Payment Terms', `Net ${selectedPO.paymentTerms} days`] : null,
                      selectedPO.supplierRef  ? ['Supplier Ref', selectedPO.supplierRef]                  : null,
                    ].filter(Boolean).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: 'var(--text-tertiary)', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>{k}</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v}</td>
                      </tr>
                    ))}
                    {selectedPO.approvedAt && (
                      <tr>
                        <td style={{ color: 'var(--text-tertiary)', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>Approved</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(selectedPO.approvedAt)}</td>
                      </tr>
                    )}
                    {selectedPO.receivedAt && (
                      <tr>
                        <td style={{ color: 'var(--text-tertiary)', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>Received</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(selectedPO.receivedAt)}</td>
                      </tr>
                    )}
                    {selectedPO.closedAt && (
                      <tr>
                        <td style={{ color: 'var(--text-tertiary)', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>Closed</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(selectedPO.closedAt)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Items table */}
            {(() => {
              const items = selectedPO.items || [];
              const hasRepl = items.some(it =>
                (it.replacementAcceptedQty||0) + (it.replacementDamagedQty||0) +
                (it.replacementDefectiveQty||0) + (it.replacementRejectedQty||0) > 0
              );
              return (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--canvas)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Items
                    {hasRepl && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>Replacement activity</span>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--canvas)' }}>
                          {[
                            { h: 'Product',    right: false },
                            { h: 'SKU',        right: false },
                            { h: 'Ordered',    right: true  },
                            { h: 'Accepted',   right: true  },
                            { h: 'Damaged',    right: true  },
                            { h: 'Defective',  right: true  },
                            { h: 'Rejected',   right: true  },
                            ...(hasRepl ? [
                              { h: 'Repl. Rcvd',    right: true },
                              { h: 'Repl. Accepted', right: true, accent: '#16A34A' },
                              { h: 'Repl. Damaged',  right: true, accent: '#DC2626' },
                              { h: 'Repl. Defective',right: true, accent: '#D97706' },
                              { h: 'Repl. Rejected', right: true, accent: '#7C3AED' },
                            ] : []),
                            { h: 'Pend. Repl', right: true  },
                            { h: 'Pending',    right: true  },
                            { h: 'Rate',       right: true  },
                            { h: 'Total',      right: true  },
                          ].map(({ h, right, accent }) => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: right ? 'right' : 'left', fontSize: 9.5, fontWeight: 700, color: accent || 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(it => {
                          const completionQty = (it.acceptedQty||0) + (it.rejectedQty||0);
                          const pendingComp   = Math.max(0, it.quantity - completionQty);
                          const pendingRepl   = it.pendingReplacementQty || 0;
                          const replRcvd      = it.replacementReceivedQty  || 0;
                          const replAccepted  = it.replacementAcceptedQty  || 0;
                          const replDamaged   = it.replacementDamagedQty   || 0;
                          const replDefective = it.replacementDefectiveQty || 0;
                          const replRejected  = it.replacementRejectedQty  || 0;
                          return (
                            <tr key={it.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: 10.5 }}>{it.sku || '—'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{it.quantity}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.acceptedQty||0)>0 ? '#16A34A' : 'var(--text-tertiary)', fontWeight: 600 }}>{it.acceptedQty || 0}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.damagedQty||0)>0 ? '#DC2626' : 'var(--text-tertiary)' }}>{it.damagedQty || 0}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.defectiveQty||0)>0 ? '#D97706' : 'var(--text-tertiary)' }}>{it.defectiveQty || 0}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.rejectedQty||0)>0 ? '#7C3AED' : 'var(--text-tertiary)' }}>{it.rejectedQty || 0}</td>
                              {hasRepl && <>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: replRcvd>0 ? '#1D4ED8' : 'var(--text-tertiary)' }}>{replRcvd || '—'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: replAccepted>0 ? '#16A34A' : 'var(--text-tertiary)', fontWeight: replAccepted>0?700:400 }}>{replAccepted || '—'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: replDamaged>0 ? '#DC2626' : 'var(--text-tertiary)' }}>{replDamaged || '—'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: replDefective>0 ? '#D97706' : 'var(--text-tertiary)' }}>{replDefective || '—'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: replRejected>0 ? '#7C3AED' : 'var(--text-tertiary)' }}>{replRejected || '—'}</td>
                              </>}
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: pendingRepl>0 ? '#7C3AED' : 'var(--text-tertiary)', fontWeight: pendingRepl>0?700:400 }}>{pendingRepl || '—'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: pendingComp>0 ? '#B45309' : '#16A34A', fontWeight: 700 }}>{pendingComp}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(it.unitCost || 0, sym)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(it.quantity * (it.unitCost || 0), sym)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Receipts history */}
            {selectedReceipts.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--canvas)' }}>Receiving History</div>
                {selectedReceipts.map(r => {
                  const acc = (r.items || []).reduce((s, it) => s + (it.acceptedQty || 0), 0);
                  const bad = (r.items || []).reduce((s, it) => s + (it.damagedQty || 0) + (it.defectiveQty || 0) + (it.rejectedQty || 0), 0);
                  return (
                    <div key={r.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{r.receiptNumber}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(r.receiptDate)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {acc > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>{acc} acc</span>}
                        {bad > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{bad} rej</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            {selectedPO.notes && (
              <div style={{ background: 'var(--brand-faint)', border: '1px solid var(--brand-light)', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--brand)' }}>Notes:</strong> {selectedPO.notes}
              </div>
            )}

            {/* Audit section */}
            {selectedPO.createdAt && (
              <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Audit</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Created On</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{formatDateTime(selectedPO.createdAt)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            {(selectedPO.timeline || []).length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Timeline</div>
                {[...(selectedPO.timeline || [])].reverse().map((entry, i, arr) => {
                  const cfg = STATUS_CFG[entry.status] || STATUS_CFG.created;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: i < arr.length - 1 ? 10 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.fg, border: `2px solid ${cfg.border}`, marginTop: 2 }} />
                        {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 3 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.fg }}>{cfg.label}</div>
                        {entry.note && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{entry.note}</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{formatDateTime(entry.date || entry.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ══════ NEW PO MODAL ══════ */}
      <Modal open={newPOModal} onClose={() => { setNewPOModal(false); setPOErrors({}); }} title="New Purchase Order" size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setNewPOModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreatePO} style={primaryBtnStyle}>Create Draft PO</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Supplier combobox + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Searchable supplier combobox */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Supplier <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    value={suppSearch}
                    onChange={e => { setSuppSearch(e.target.value); setSuppOpen(true); if (!e.target.value.trim()) setPOForm(f => ({ ...f, supplierId: '' })); }}
                    onFocus={() => setSuppOpen(true)}
                    onBlur={handleSuppBlur}
                    placeholder="Search supplier…"
                    style={{ paddingLeft: 28, width: '100%', height: 34, fontSize: 12.5, border: `1px solid ${poErrors.supplierId ? 'var(--error)' : 'var(--border)'}`, borderRadius: 7, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setNewSuppModal(true); setSuppOpen(false); }}
                  style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1.5px dashed var(--brand)', background: 'var(--brand-faint)', color: 'var(--brand)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <Plus size={12} /> New
                </button>
              </div>
              {poErrors.supplierId && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 3 }}>{poErrors.supplierId}</div>}

              {/* Inline supplier list (document flow — no overflow clip issues) */}
              {suppOpen && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto' }}
                >
                  {filteredSuppList.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>No suppliers found — use "+ New" to add one.</div>
                  ) : filteredSuppList.map(s => {
                    const sr = suppRatingMap[s.id];
                    const isSelected = s.id === poForm.supplierId;
                    const pspCount = (productSupplierPrices || []).filter(r => r.supplierId === s.id).length;
                    return (
                      <div key={s.id}
                        onClick={() => handleSuppSelect(s)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', background: isSelected ? 'var(--brand-faint)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--canvas)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {[s.phone, s.state].filter(Boolean).join(' · ')}
                            {pspCount > 0 && <span style={{ marginLeft: 6, color: 'var(--brand)', fontWeight: 600 }}>{pspCount} products</span>}
                          </div>
                        </div>
                        {sr && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <Star size={11} fill="#F59E0B" color="#F59E0B" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>{sr.avg.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FormField label="Order Date *" error={poErrors.orderDate}>
              <Input type="date" value={poForm.orderDate} onChange={e => setPOForm(f => ({ ...f, orderDate: e.target.value }))} error={!!poErrors.orderDate} />
            </FormField>
          </div>

          {/* GST Mode Banner */}
          {poForm.supplierId && (() => {
            const gm = poGSTMode;
            if (gm.noSupplierState || gm.noBusinessState) {
              return (
                <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} />
                  {gm.noBusinessState ? 'Business state not set in Settings — GST type unknown.' : 'Supplier state missing — GST type (CGST/SGST vs IGST) cannot be determined.'}
                  <button type="button" onClick={openEditSuppPO} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#B45309', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Edit Supplier</button>
                </div>
              );
            }
            if (gm.isInterstate !== null) {
              return (
                <div style={{ padding: '8px 12px', background: gm.isInterstate ? '#EFF6FF' : '#F0FDF4', border: `1px solid ${gm.isInterstate ? '#BFDBFE' : '#BBF7D0'}`, borderRadius: 8, fontSize: 12, color: gm.isInterstate ? '#1D4ED8' : '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={13} />
                  <strong>{gm.taxLabel}</strong>&nbsp;— {gm.label}
                </div>
              );
            }
            return null;
          })()}

          {/* Row 2: Expected, Supplier Ref, Payment Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Expected Delivery">
              <Input type="date" value={poForm.expectedDate} onChange={e => setPOForm(f => ({ ...f, expectedDate: e.target.value }))} />
            </FormField>
            <FormField label="Supplier Reference">
              <Input value={poForm.supplierRef} onChange={e => setPOForm(f => ({ ...f, supplierRef: e.target.value }))} placeholder="Their PO # (optional)" />
            </FormField>
            <FormField label="Payment Terms (days)">
              <Input type="number" value={poForm.paymentTerms} onChange={e => setPOForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="30" />
            </FormField>
          </div>
          <FormField label="Delivery Terms">
            <Input value={poForm.deliveryTerms} onChange={e => setPOForm(f => ({ ...f, deliveryTerms: e.target.value }))} placeholder="e.g. Delivery at buyer's warehouse" />
          </FormField>

          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Items</div>
              <button onClick={() => setPOForm(f => ({ ...f, items: [...f.items, emptyPOItem()] }))} style={{ ...primaryBtnStyle, padding: '4px 10px', fontSize: 11.5 }}><Plus size={11} /> Add Item</button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 90px 60px 70px 28px', background: 'var(--canvas)', padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Product</div><div style={{ textAlign: 'right' }}>Qty</div><div style={{ textAlign: 'right' }}>Unit Cost</div><div style={{ textAlign: 'right' }}>Tax%</div><div style={{ textAlign: 'right' }}>Total</div><div />
              </div>
              {poForm.items.map((item, idx) => {
                const prevP = item._prevPrice;
                const avgP  = item._prevAvgPrice;
                const curP  = Number(item.unitCost || 0);
                const pctChange = prevP && curP ? ((curP - prevP) / prevP) * 100 : null;
                const priceIncreased = pctChange !== null && pctChange > 0.5;
                const priceDecreased = pctChange !== null && pctChange < -0.5;
                return (
                  <div key={item.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px', background: priceIncreased ? '#FFFBEB' : 'transparent' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 90px 60px 70px 28px', gap: 8, alignItems: 'start' }}>
                      <div>
                        {!item.isNewProduct ? (() => {
                          const selProd = products.find(p => p.id === item.productId);
                          const pspMap  = Object.fromEntries((productSupplierPrices || []).filter(r => r.supplierId === poForm.supplierId).map(r => [r.productId, r]));
                          const selPsp  = selProd ? pspMap[selProd.id] : null;
                          return (
                            <div>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                  <Search size={10} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                  <input
                                    ref={el => { if (el) prodInputRefs.current[idx] = el; }}
                                    value={selProd ? selProd.name : (prodFilters[`po_${idx}`] || '')}
                                    onChange={e => {
                                      if (item.productId) setPoItem(idx, { productId: '', productName: '', unitCost: '', _prevPrice: null, _prevAvgPrice: null, _prevLastPurchasedAt: null, _supplierPSP: null });
                                      setProdFilters(f => ({ ...f, [`po_${idx}`]: e.target.value }));
                                      const el = prodInputRefs.current[idx];
                                      if (el) setProdDropState({ form: 'po', idx, rect: el.getBoundingClientRect() });
                                    }}
                                    onFocus={() => {
                                      const el = prodInputRefs.current[idx];
                                      if (el) setProdDropState({ form: 'po', idx, rect: el.getBoundingClientRect() });
                                    }}
                                    onBlur={() => setTimeout(() => setProdDropState(s => s?.form === 'po' && s?.idx === idx ? null : s), 120)}
                                    placeholder="Search product…"
                                    style={{ paddingLeft: 22, width: '100%', height: 28, fontSize: 11.5, border: `1px solid ${poErrors[`in${idx}`] ? 'var(--error)' : selProd ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 5, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                  />
                                </div>
                                {selProd && (
                                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setPoItem(idx, { productId: '', productName: '', unitCost: '', _prevPrice: null, _prevAvgPrice: null, _prevLastPurchasedAt: null, _supplierPSP: null }); setProdFilters(f => ({ ...f, [`po_${idx}`]: '' })); setProdDropState(s => s?.form === 'po' && s?.idx === idx ? null : s); }}
                                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}>
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                              {selProd && selPsp && (
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  {selPsp.lastPurchasePrice ? <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Last: {formatCurrency(selPsp.lastPurchasePrice, sym)}</span> : null}
                                  {selPsp.averagePurchasePrice ? <span style={{ marginLeft: 6 }}>Avg: {formatCurrency(selPsp.averagePurchasePrice, sym)}</span> : null}
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <input value={item.productName} onChange={e => setPoItem(idx, { productName: e.target.value })} placeholder="New product name *" style={inpStyle(!!poErrors[`in${idx}`])} />
                        )}
                        <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, cursor: 'pointer' }}>
                          <input type="checkbox" checked={item.isNewProduct} onChange={e => { setPoItem(idx, { isNewProduct: e.target.checked, productId: '', productName: '', productLinked: false }); setProdFilters(f => ({ ...f, [idx]: '' })); }} />
                          New unlisted product
                        </label>
                        {/* Price history + comparison card */}
                        {item.productId && (() => {
                          const allPrices = (productSupplierPrices || []).filter(r => r.productId === item.productId);
                          const sortedPrices = [...allPrices].sort((a, b) => a.lastPurchasePrice - b.lastPurchasePrice);
                          const currentSuppPSP = allPrices.find(r => r.supplierId === poForm.supplierId);
                          const cheapestPSP = sortedPrices[0];
                          const isCurrentCheapest = cheapestPSP?.supplierId === poForm.supplierId;
                          const isMoreExpensive = currentSuppPSP && cheapestPSP && !isCurrentCheapest;
                          return (
                            <div style={{ marginTop: 4 }}>
                              {/* This supplier's price history */}
                              {(prevP || avgP) && (
                                <div style={{ padding: '4px 7px', background: priceIncreased ? '#FEF3C7' : priceDecreased ? '#F0FDF4' : 'var(--canvas)', border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 10, marginBottom: allPrices.length > 1 ? 3 : 0 }}>
                                  {prevP && (
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-secondary)' }}>
                                      <span>{currentSuppPSP ? 'This supplier last:' : 'Last price:'}</span>
                                      <strong>{formatCurrency(prevP, sym)}</strong>
                                      {pctChange !== null && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: priceIncreased ? '#B45309' : priceDecreased ? '#15803D' : 'var(--text-tertiary)', fontWeight: 700 }}>
                                          {priceIncreased ? <TrendingUp size={10} /> : priceDecreased ? <TrendingDown size={10} /> : <Minus size={10} />}
                                          {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {avgP && <div style={{ color: 'var(--text-tertiary)' }}>Avg: {formatCurrency(avgP, sym)}</div>}
                                  {item._prevLastPurchasedAt && <div style={{ color: 'var(--text-tertiary)' }}>Last bought: {item._prevLastPurchasedAt}</div>}
                                  {priceIncreased && <div style={{ color: '#B45309', fontWeight: 600 }}>Price increased — verify with supplier</div>}
                                </div>
                              )}
                              {/* Multi-supplier comparison */}
                              {allPrices.length > 1 && (
                                <div style={{ padding: '5px 7px', background: '#F8FAFC', border: `1px solid ${isMoreExpensive ? '#FDE68A' : '#E2E8F0'}`, borderRadius: 5, fontSize: 10 }}>
                                  {isMoreExpensive && (
                                    <div style={{ color: '#B45309', fontWeight: 700, marginBottom: 3, display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <AlertTriangle size={10} /> Selected supplier is not the cheapest — {formatCurrency(cheapestPSP.lastPurchasePrice, sym)} available from {suppliers.find(s => s.id === cheapestPSP.supplierId)?.name || 'another supplier'}
                                    </div>
                                  )}
                                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>Price comparison:</div>
                                  {sortedPrices.map(r => {
                                    const supp = suppliers.find(s => s.id === r.supplierId);
                                    const isCurrent  = r.supplierId === poForm.supplierId;
                                    const isCheapest = r.supplierId === sortedPrices[0].supplierId;
                                    const sr = suppRatingMap[r.supplierId];
                                    return (
                                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0', color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <span style={{ fontWeight: isCurrent ? 700 : 400 }}>{supp?.name || 'Unknown'}{isCurrent ? ' ✓' : ''}</span>
                                          {sr && <span style={{ fontSize: 9.5, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 1 }}><Star size={8} fill="#F59E0B" color="#F59E0B" />{sr.avg.toFixed(1)}</span>}
                                        </div>
                                        <span style={{ fontWeight: 700, color: isCheapest ? '#15803D' : isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{formatCurrency(r.lastPurchasePrice, sym)}</span>
                                      </div>
                                    );
                                  })}
                                  <div style={{ marginTop: 3, color: 'var(--text-tertiary)', display: 'flex', gap: 10 }}>
                                    <span>Lowest: <strong style={{ color: '#15803D' }}>{formatCurrency(sortedPrices[0].lastPurchasePrice, sym)}</strong></span>
                                    <span>Highest: <strong style={{ color: '#DC2626' }}>{formatCurrency(sortedPrices[sortedPrices.length-1].lastPurchasePrice, sym)}</strong></span>
                                    {allPrices.length > 0 && <span>Avg: <strong>{formatCurrency(allPrices.reduce((s,r) => s + r.lastPurchasePrice, 0) / allPrices.length, sym)}</strong></span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <input type="number" min="1" value={item.quantity} onChange={e => setPoItem(idx, { quantity: e.target.value })} style={{ ...inpStyle(!!poErrors[`iq${idx}`]), textAlign: 'right' }} />
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setPoItem(idx, { unitCost: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                      <input type="number" min="0" max="100" value={item.taxPercent} onChange={e => setPoItem(idx, { taxPercent: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(Number(item.quantity) * Number(item.unitCost), sym)}</div>
                      <button onClick={() => setPOForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 5, cursor: 'pointer' }}><X size={12} /></button>
                    </div>
                  </div>
                );
              })}
              {/* Summary */}
              <div style={{ padding: '10px 12px', background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
                {[
                  ['Subtotal', poSubtotal],
                  ['Item Tax', poItemsTax],
                  ...(Number(poForm.freightCharge || 0) > 0 ? [
                    [`Freight${poForm.freightTaxable ? ` (+ ${poForm.freightGstRate}% GST)` : ''}`, Number(poForm.freightCharge || 0) + poFreightTax],
                  ] : []),
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    <span>{label}</span><span style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{formatCurrency(val, sym)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                  <span>Grand Total</span><span style={{ minWidth: 80, textAlign: 'right' }}>{formatCurrency(poGrandTotal, sym)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Freight Charge */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Freight / Shipping Charge</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px', gap: 10, alignItems: 'end' }}>
              <FormField label="Freight Amount">
                <Input type="number" min="0" step="0.01" value={poForm.freightCharge} onChange={e => setPOForm(f => ({ ...f, freightCharge: e.target.value }))} placeholder="0.00" />
              </FormField>
              <div style={{ paddingBottom: 2 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
                  <span>Taxable?</span>
                  <input type="checkbox" checked={poForm.freightTaxable} onChange={e => setPOForm(f => ({ ...f, freightTaxable: e.target.checked }))} style={{ width: 16, height: 16 }} />
                </label>
              </div>
              {poForm.freightTaxable && (
                <FormField label="GST Rate %">
                  <Input type="number" min="0" max="100" value={poForm.freightGstRate} onChange={e => setPOForm(f => ({ ...f, freightGstRate: e.target.value }))} />
                </FormField>
              )}
            </div>
            {Number(poForm.freightCharge || 0) > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                Freight: {formatCurrency(Number(poForm.freightCharge), sym)}{poForm.freightTaxable ? ` + GST ${formatCurrency(poFreightTax, sym)} = ${formatCurrency(Number(poForm.freightCharge) + poFreightTax, sym)}` : ''}
              </div>
            )}
          </div>

          {/* Notes */}
          <FormField label="Notes"><Textarea value={poForm.notes} onChange={e => setPOForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>

          {/* Terms & Conditions */}
          <FormField label="Terms & Conditions">
            <Textarea value={poForm.termsAndConditions} onChange={e => setPOForm(f => ({ ...f, termsAndConditions: e.target.value }))} rows={4} placeholder="Payment terms, delivery conditions, return policy…" />
          </FormField>
        </div>
      </Modal>

      {/* ══════ GENERAL PURCHASE MODAL ══════ */}
      <Modal
        open={gpModal}
        onClose={() => { setGPModal(false); setGPErrors({}); setGPSuppSearch(''); setGPSuppOpen(false); }}
        title="General Purchase"
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Good items → stock. Damaged/Defective/Rejected → Purchase Return.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setGPModal(false); setGPErrors({}); }} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleGPSave} style={primaryBtnStyle}><Receipt size={13} /> Save Purchase</button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {/* Searchable supplier combobox */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Supplier <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    value={gpSuppSearch}
                    onChange={e => { setGPSuppSearch(e.target.value); setGPSuppOpen(true); if (!e.target.value.trim()) setGPForm(f => ({ ...f, supplierId: '' })); }}
                    onFocus={() => setGPSuppOpen(true)}
                    onBlur={handleGPSuppBlur}
                    placeholder="Search supplier…"
                    style={{ paddingLeft: 28, width: '100%', height: 34, fontSize: 12.5, border: `1px solid ${gpErrors.supplierId ? 'var(--error)' : 'var(--border)'}`, borderRadius: 7, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); setGPNewSuppModal(true); setGPSuppOpen(false); }}
                  style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1.5px dashed var(--brand)', background: 'var(--brand-faint)', color: 'var(--brand)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <Plus size={12} /> New
                </button>
              </div>
              {gpErrors.supplierId && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 3 }}>{gpErrors.supplierId}</div>}
              {/* Inline supplier list */}
              {gpSuppOpen && (
                <div
                  onMouseDown={e => e.preventDefault()}
                  style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto' }}
                >
                  {filteredGPSuppList.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>No suppliers found — use "+ New" to add one.</div>
                  ) : filteredGPSuppList.map(s => {
                    const sr = suppRatingMap[s.id];
                    const isSelected = s.id === gpForm.supplierId;
                    return (
                      <div key={s.id}
                        onClick={() => handleGPSuppSelect(s)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', background: isSelected ? 'var(--brand-faint)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--canvas)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {[s.phone, s.state].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {sr && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <Star size={11} fill="#F59E0B" color="#F59E0B" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>{sr.avg.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FormField label="Purchase Date">
              <Input type="date" value={gpForm.date} onChange={e => setGPForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Payment Status">
              <Select value={gpForm.paymentStatus} onChange={e => setGPForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </FormField>
          </div>

          {/* GST Mode Banner */}
          {gpForm.supplierId && (() => {
            const gm = gpGSTMode;
            if (gm.noSupplierState || gm.noBusinessState) {
              return (
                <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} />
                  {gm.noBusinessState ? 'Business state not set in Settings → GST type unknown.' : 'Supplier state missing → GST type (CGST/SGST vs IGST) cannot be determined.'}
                </div>
              );
            }
            if (gm.isInterstate !== null) {
              return (
                <div style={{ padding: '8px 12px', background: gm.isInterstate ? '#EFF6FF' : '#F0FDF4', border: `1px solid ${gm.isInterstate ? '#BFDBFE' : '#BBF7D0'}`, borderRadius: 8, fontSize: 12, color: gm.isInterstate ? '#1D4ED8' : '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={13} />
                  <strong>{gm.taxLabel}</strong>&nbsp;— {gm.label}
                </div>
              );
            }
            return null;
          })()}

          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Items</div>
              <button onClick={() => setGPForm(f => ({ ...f, items: [...f.items, emptyGPItem()] }))} style={{ ...primaryBtnStyle, padding: '4px 10px', fontSize: 11.5 }}><Plus size={11} /> Add Item</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gpForm.items.map((item, idx) => {
                const iType  = item.itemType || 'existing_product';
                const isExisting = iType === 'existing_product';
                const isNew      = iType === 'new_product';
                const isExpense  = iType === 'non_stock_item';
                const condCfg = COND_CFG[item.condition] || COND_CFG.good;
                const prevP = item._prevPrice;
                const curP  = Number(item.unitCost || 0);
                const gpPctChange = prevP && curP ? ((curP - prevP) / prevP) * 100 : null;
                const gpPriceUp   = gpPctChange !== null && gpPctChange > 0.5;
                const gpPriceDown = gpPctChange !== null && gpPctChange < -0.5;
                const lineTotal = Number(item.quantity) * Number(item.unitCost) * (1 + Number(item.taxPercent) / 100);
                const gpInputRef = el => { if (el) prodInputRefs.current[`gp_${idx}`] = el; };
                const selGPProd  = isExisting && item.productId ? products.find(p => p.id === item.productId) : null;
                const gpFilter   = prodFilters[`gp_${idx}`] || '';

                const typePill = (type, label, icon) => (
                  <button
                    type="button"
                    onClick={() => setGPItem(idx, { itemType: type, productId: '', productName: '', sku: '', description: '', categoryId: '', brand: '', hsn: '', affects_stock: type !== 'non_stock_item' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${iType === type ? 'var(--brand)' : 'var(--border)'}`, background: iType === type ? 'var(--brand-faint)' : 'var(--canvas)', color: iType === type ? 'var(--brand)' : 'var(--text-secondary)' }}
                  >{icon} {label}</button>
                );

                return (
                  <div key={item.id} style={{ border: `1.5px solid ${isExpense ? '#E0E7FF' : isNew ? '#D1FAE5' : 'var(--border)'}`, borderRadius: 10, background: isExpense ? '#F5F3FF08' : 'var(--surface)', overflow: 'visible' }}>
                    {/* Card header: type pills + line total + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--canvas)', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Type:</span>
                      {typePill('existing_product', 'Stock Item', '📦')}
                      {typePill('new_product', 'New Product', '✨')}
                      {typePill('non_stock_item', 'Expense', '📄')}
                      <div style={{ flex: 1 }} />
                      {lineTotal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{formatCurrency(lineTotal, sym)}</span>}
                      <button
                        type="button"
                        onClick={() => setGPForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}
                      ><X size={12} /></button>
                    </div>

                    <div style={{ padding: '10px 10px 10px' }}>

                      {/* ── EXISTING PRODUCT ── */}
                      {isExisting && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 80px 100px', gap: 8, alignItems: 'start' }}>
                            {/* Product search */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Product</div>
                              <div style={{ position: 'relative' }}>
                                <Search size={10} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                <input
                                  ref={gpInputRef}
                                  value={selGPProd ? selGPProd.name : gpFilter}
                                  onChange={e => {
                                    if (item.productId) setGPItem(idx, { productId: '', productName: '', unitCost: 0, sellingPrice: 0, taxPercent: 0, _prevPrice: null, _prevAvgPrice: null, _prevLastPurchasedAt: null });
                                    setProdFilters(f => ({ ...f, [`gp_${idx}`]: e.target.value }));
                                    const el = prodInputRefs.current[`gp_${idx}`];
                                    if (el) setProdDropState({ form: 'gp', idx, rect: el.getBoundingClientRect() });
                                  }}
                                  onFocus={() => {
                                    const el = prodInputRefs.current[`gp_${idx}`];
                                    if (el) setProdDropState({ form: 'gp', idx, rect: el.getBoundingClientRect() });
                                  }}
                                  onBlur={() => setTimeout(() => setProdDropState(s => s?.form === 'gp' && s?.idx === idx ? null : s), 120)}
                                  placeholder="Search product…"
                                  style={{ paddingLeft: 22, width: '100%', height: 28, fontSize: 11.5, border: `1px solid ${gpErrors[`gp_p${idx}`] ? 'var(--error)' : selGPProd ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 5, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                />
                              </div>
                              {gpErrors[`gp_p${idx}`] && <div style={{ fontSize: 9.5, color: 'var(--error)', marginTop: 2 }}>{gpErrors[`gp_p${idx}`]}</div>}
                              {/* Price change badge */}
                              {item.productId && prevP && (
                                <div style={{ marginTop: 3, padding: '2px 5px', background: gpPriceUp ? '#FEF3C7' : gpPriceDown ? '#F0FDF4' : 'var(--canvas)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Last: <strong>{formatCurrency(prevP, sym)}</strong></span>
                                  {gpPctChange !== null && (
                                    <span style={{ color: gpPriceUp ? '#B45309' : gpPriceDown ? '#15803D' : 'var(--text-tertiary)', fontWeight: 700 }}>
                                      {gpPriceUp ? <TrendingUp size={9} style={{ display: 'inline' }} /> : gpPriceDown ? <TrendingDown size={9} style={{ display: 'inline' }} /> : <Minus size={9} style={{ display: 'inline' }} />}
                                      {gpPctChange > 0 ? '+' : ''}{gpPctChange.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Qty */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Qty</div>
                              <input type="number" min="1" value={item.quantity} onChange={e => setGPItem(idx, { quantity: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_q${idx}`]), textAlign: 'right' }} />
                            </div>
                            {/* Cost */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Purchase Cost</div>
                              <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setGPItem(idx, { unitCost: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_c${idx}`]), textAlign: 'right' }} />
                            </div>
                            {/* Sell */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Sell Price</div>
                              <input type="number" min="0" step="0.01" value={item.sellingPrice} onChange={e => setGPItem(idx, { sellingPrice: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                            </div>
                            {/* Tax */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Tax %</div>
                              <input type="number" min="0" max="100" step="0.01" value={item.taxPercent} onChange={e => setGPItem(idx, { taxPercent: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                            </div>
                            {/* Condition */}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Condition</div>
                              <select value={item.condition} onChange={e => setGPItem(idx, { condition: e.target.value })} style={{ width: '100%', height: 30, fontSize: 11.5, border: `1.5px solid ${condCfg.color}30`, borderRadius: 6, background: condCfg.bg, color: condCfg.color, padding: '0 6px', fontWeight: 700 }}>
                                {Object.entries(COND_CFG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* ── NEW PRODUCT ── */}
                      {isNew && (
                        <>
                          {/* Row 1: name, sku, qty, unit, condition */}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 70px 70px 100px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Product Name <span style={{ color: 'var(--error)' }}>*</span></div>
                              <input value={item.productName || ''} onChange={e => setGPItem(idx, { productName: e.target.value })} placeholder="e.g. Widget Pro 500g" style={inpStyle(!!gpErrors[`gp_p${idx}`])} />
                              {gpErrors[`gp_p${idx}`] && <div style={{ fontSize: 9.5, color: 'var(--error)', marginTop: 2 }}>{gpErrors[`gp_p${idx}`]}</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>SKU</div>
                              <input value={item.sku || ''} onChange={e => setGPItem(idx, { sku: e.target.value })} placeholder="optional" style={inpStyle(false)} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Qty</div>
                              <input type="number" min="1" value={item.quantity} onChange={e => setGPItem(idx, { quantity: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_q${idx}`]), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Unit</div>
                              <select value={item.unit || 'pcs'} onChange={e => setGPItem(idx, { unit: e.target.value })} style={{ width: '100%', height: 30, fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 6px' }}>
                                {['pcs','kg','g','L','mL','m','box','pack','set','pair','dozen','roll'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Condition</div>
                              <select value={item.condition} onChange={e => setGPItem(idx, { condition: e.target.value })} style={{ width: '100%', height: 30, fontSize: 11.5, border: `1.5px solid ${condCfg.color}30`, borderRadius: 6, background: condCfg.bg, color: condCfg.color, padding: '0 6px', fontWeight: 700 }}>
                                {Object.entries(COND_CFG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* Row 2: cost, sell, tax, category, brand, hsn */}
                          <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 70px 1fr 100px 90px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Purchase Cost</div>
                              <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setGPItem(idx, { unitCost: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_c${idx}`]), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Sell Price</div>
                              <input type="number" min="0" step="0.01" value={item.sellingPrice} onChange={e => setGPItem(idx, { sellingPrice: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Tax %</div>
                              <input type="number" min="0" max="100" step="0.01" value={item.taxPercent} onChange={e => setGPItem(idx, { taxPercent: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Category</div>
                              <select value={item.categoryId || ''} onChange={e => setGPItem(idx, { categoryId: e.target.value })} style={{ width: '100%', height: 30, fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 6px' }}>
                                <option value="">— none —</option>
                                {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Brand</div>
                              <input value={item.brand || ''} onChange={e => setGPItem(idx, { brand: e.target.value })} placeholder="optional" style={inpStyle(false)} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>HSN</div>
                              <input value={item.hsn || ''} onChange={e => setGPItem(idx, { hsn: e.target.value })} placeholder="optional" style={inpStyle(false)} />
                            </div>
                          </div>
                          {/* Create as product toggle */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11.5, color: 'var(--text-secondary)', padding: '6px 8px', background: item.createAsProduct !== false ? '#F0FDF4' : 'var(--canvas)', border: `1px solid ${item.createAsProduct !== false ? '#BBF7D0' : 'var(--border)'}`, borderRadius: 7 }}>
                            <input type="checkbox" checked={item.createAsProduct !== false} onChange={e => setGPItem(idx, { createAsProduct: e.target.checked })} style={{ accentColor: 'var(--brand)', width: 14, height: 14 }} />
                            <span><strong>Create as product & add to stock</strong> — product record will be created and stock will update on receive</span>
                          </label>
                          {item.createAsProduct === false && (
                            <div style={{ marginTop: 6, padding: '4px 8px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 10.5, color: '#92400E' }}>
                              Will be saved as a non-stock expense — no product record or stock update will happen.
                            </div>
                          )}
                        </>
                      )}

                      {/* ── NON-STOCK EXPENSE ── */}
                      {isExpense && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 70px 70px 70px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Item Name <span style={{ color: 'var(--error)' }}>*</span></div>
                              <input value={item.productName || ''} onChange={e => setGPItem(idx, { productName: e.target.value })} placeholder="e.g. Freight charges, Labour" style={inpStyle(!!gpErrors[`gp_p${idx}`])} />
                              {gpErrors[`gp_p${idx}`] && <div style={{ fontSize: 9.5, color: 'var(--error)', marginTop: 2 }}>{gpErrors[`gp_p${idx}`]}</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Description</div>
                              <input value={item.description || ''} onChange={e => setGPItem(idx, { description: e.target.value })} placeholder="optional" style={inpStyle(false)} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Qty</div>
                              <input type="number" min="1" value={item.quantity} onChange={e => setGPItem(idx, { quantity: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_q${idx}`]), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Amount</div>
                              <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setGPItem(idx, { unitCost: e.target.value })} style={{ ...inpStyle(!!gpErrors[`gp_c${idx}`]), textAlign: 'right' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Tax %</div>
                              <input type="number" min="0" max="100" step="0.01" value={item.taxPercent} onChange={e => setGPItem(idx, { taxPercent: e.target.value })} style={{ ...inpStyle(false), textAlign: 'right' }} />
                            </div>
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: '#EDE9FE', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                            📄 Non-Stock Expense — included in totals, no stock update
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
            {/* GP summary */}
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', fontSize: 12 }}>
                {gpExpenseSubtotal > 0 && (
                  <>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Stock items:</span>
                      <strong>{formatCurrency(gpStockSubtotal, sym)}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Expenses:</span>
                      <strong style={{ color: '#7C3AED' }}>{formatCurrency(gpExpenseSubtotal, sym)}</strong>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Subtotal:</span>
                  <strong>{formatCurrency(gpSubtotal, sym)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Tax:</span>
                  <strong>{formatCurrency(gpTax, sym)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
                  <span style={{ fontWeight: 700 }}>Grand Total:</span>
                  <strong style={{ fontSize: 14, color: 'var(--brand)' }}>{formatCurrency(gpSubtotal + gpTax, sym)}</strong>
                </div>
              </div>
            </div>
          </div>

          <FormField label="Notes">
            <Textarea value={gpForm.notes} onChange={e => setGPForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ PO SLIP MODAL ══════ */}
      <Modal open={slipModal && !!selectedPO} onClose={() => setSlipModal(false)} title={`PO Slip — ${selectedPO?.poNumber || ''}`} size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', flex: 1 }}>{exporting ? 'Exporting…' : 'Preview · Print · Download'}</span>
            <button onClick={handlePrint} disabled={exporting} style={outBtnStyle('#4F46E5')}><Printer size={13} /> Print</button>
            <button onClick={handlePDFDownload} disabled={exporting} style={outBtnStyle('#1D4ED8')}><Download size={13} /> {exporting ? '…' : 'PDF'}</button>
            <button onClick={handleJPGDownload} disabled={exporting} style={outBtnStyle('#059669')}><ImageIcon size={13} /> JPG</button>
            <button onClick={() => setSlipModal(false)} style={cancelBtnStyle}>Close</button>
          </div>
        }
      >
        <div style={{ overflowX: 'auto', background: '#f1f5f9', borderRadius: 8, padding: 16 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
            <POSlipPreview ref={slipRef} po={selectedPO} settings={settings} supplier={selSupplier} />
          </div>
        </div>
      </Modal>

      {/* ══════ RECEIVE MODAL ══════ */}
      <Modal open={receiveModal} onClose={() => setReceiveModal(false)} title={`Receive Items — ${selectedPO?.poNumber || ''}`} size="xl"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setReceiveModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleReceive} style={primaryBtnStyle}><PackageCheck size={13} /> Confirm Receipt</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Info banner */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { icon: '✓', label: 'Accepted', desc: 'Goes to product stock immediately', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
              { icon: '⚠', label: 'Damaged / Defective', desc: 'Creates purchase return — keeps PO partially received until replaced', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
              { icon: '✗', label: 'Rejected', desc: 'Creates purchase return — counts as closed (no replacement expected)', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
            ].map(b => (
              <div key={b.label} style={{ padding: '8px 12px', background: b.bg, border: `1px solid ${b.border}`, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: b.color, flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.label}</div>
                  <div style={{ fontSize: 10, color: b.color, opacity: 0.8, lineHeight: 1.4 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Per-item cards */}
          {rcvRows.map((row, idx) => {
            const regEntered  = Number(row.newAcceptedQty||0) + Number(row.newDamagedQty||0) + Number(row.newDefectiveQty||0) + Number(row.newRejectedQty||0);
            const regRemaining = row.pendingPhysical - regEntered;
            const extraEntered = Number(row.extraAcceptedQty||0) + Number(row.extraDamagedQty||0) + Number(row.extraDefectiveQty||0) + Number(row.extraRejectedQty||0);
            const isLinked = row.productLinked && !row.isNewProduct;
            return (
              <div key={row.poItemId} style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Item header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', background: 'var(--canvas)', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{row.productName}</div>
                    {row.sku && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{row.sku}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: 10 }}>
                    {[
                      { l: 'Ordered',   v: row.orderedQty,              c: 'var(--text-primary)',  bold: true },
                      { l: 'Accepted',  v: row.histAccepted,            c: '#16A34A',              bold: false },
                      { l: 'Damaged',   v: row.histDamaged,             c: '#DC2626',              bold: false },
                      { l: 'Defective', v: row.histDefective,           c: '#D97706',              bold: false },
                      { l: 'Rejected',  v: row.histRejected,            c: '#7C3AED',              bold: false },
                      { l: 'Pending',   v: row.pendingPhysical,         c: row.pendingPhysical>0?'#B45309':'#16A34A', bold: true },
                      row.histPendingReplacement > 0 ? { l: 'Awgt Repl', v: row.histPendingReplacement, c: '#7C3AED', bold: true } : null,
                    ].filter(Boolean).map(({l,v,c,bold}) => (
                      <div key={l} style={{ textAlign: 'center', padding: '2px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{l}</div>
                        <div style={{ fontWeight: bold?800:600, color: c, fontSize: 12 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {row.isNewProduct && !row.productLinked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA' }}>
                      <AlertTriangle size={13} color="#C2410C" />
                      <span style={{ fontSize: 12, color: '#C2410C', flex: 1 }}>New product — create and link before receiving.</span>
                      <button onClick={() => openCreateProd(row)} style={{ padding: '4px 10px', background: '#C2410C', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Link size={11} /> Create & Link</button>
                    </div>
                  ) : (
                    <>
                      {/* Regular receive section */}
                      {row.pendingPhysical > 0 ? (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Receive Now (max {row.pendingPhysical} units)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                            {[
                              { label: '✓ Accepted',  field: 'newAcceptedQty',  color: '#16A34A' },
                              { label: '✗ Damaged',   field: 'newDamagedQty',   color: '#DC2626' },
                              { label: '⚡ Defective', field: 'newDefectiveQty', color: '#D97706' },
                              { label: '⊘ Rejected',  field: 'newRejectedQty',  color: '#7C3AED' },
                            ].map(({ label, field, color }) => (
                              <div key={field}>
                                <label style={{ fontSize: 10, fontWeight: 700, color, display: 'block', marginBottom: 3 }}>{label}</label>
                                <input type="number" min="0" max={row.pendingPhysical} value={row[field]}
                                  onChange={e => setRcvRow(idx, { [field]: Math.max(0, Number(e.target.value)) })}
                                  style={{ width: '100%', height: 36, fontSize: 15, fontWeight: 700, textAlign: 'center', border: `2px solid ${color}30`, borderRadius: 8, background: `${color}08`, color, boxSizing: 'border-box', outline: 'none' }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 5, fontSize: 10.5, color: regRemaining < 0 ? '#DC2626' : regRemaining === 0 && regEntered > 0 ? '#16A34A' : 'var(--text-tertiary)' }}>
                            {regEntered > 0 ? `${regEntered} of ${row.pendingPhysical} entered` : `0 entered`}
                            {regRemaining > 0 && regEntered > 0 && ` · ${regRemaining} still unaccounted`}
                            {regEntered === row.pendingPhysical && ' ✓ all accounted'}
                            {regRemaining < 0 && ' — exceeds pending!'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, padding: '6px 10px', background: '#F0FDF4', borderRadius: 6, border: '1px solid #BBF7D0' }}>
                          All ordered units have been physically received. Use Extra Quantity below if supplier sent additional units.
                        </div>
                      )}

                      {/* Extra quantity toggle */}
                      <button
                        onClick={() => setRcvRows(rows => rows.map((r, i) => i===idx ? {...r, showExtra: !r.showExtra} : r))}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', alignSelf: 'flex-start' }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{row.showExtra ? '▾' : '▸'}</span>
                        Extra Quantity {extraEntered > 0 ? `(${extraEntered} entered)` : '(supplier sent more than ordered)'}
                      </button>

                      {row.showExtra && (
                        <div style={{ border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', background: '#FFFBEB' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                            Extra Quantity — Supplier sent more than ordered quantity
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                            {[
                              { label: '✓ Extra Good',      field: 'extraAcceptedQty',  color: '#16A34A' },
                              { label: '✗ Extra Damaged',   field: 'extraDamagedQty',   color: '#DC2626' },
                              { label: '⚡ Extra Defective', field: 'extraDefectiveQty', color: '#D97706' },
                              { label: '⊘ Extra Rejected',  field: 'extraRejectedQty',  color: '#7C3AED' },
                            ].map(({ label, field, color }) => (
                              <div key={field}>
                                <label style={{ fontSize: 10, fontWeight: 700, color, display: 'block', marginBottom: 3 }}>{label}</label>
                                <input type="number" min="0" value={row[field]}
                                  onChange={e => setRcvRowExtra(idx, { [field]: Math.max(0, Number(e.target.value)) })}
                                  style={{ width: '100%', height: 36, fontSize: 15, fontWeight: 700, textAlign: 'center', border: `2px solid ${color}30`, borderRadius: 8, background: `${color}08`, color, boxSizing: 'border-box', outline: 'none' }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 10, color: '#92400E' }}>
                            Extra accepted goes to stock. Extra damaged/defective creates purchase return.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <FormField label="Receipt Notes">
            <Textarea value={rcvNotes} onChange={e => setRcvNotes(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ REPLACEMENT RECEIVE MODAL ══════ */}
      <Modal open={replModal} onClose={() => setReplModal(false)}
        title={`Receive Replacement — ${selectedPO?.poNumber || ''}`} size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setReplModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleReplacement} style={solidBtnStyle('#7C3AED')}><PackageCheck size={13} /> Confirm Replacement Receipt</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '9px 13px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, fontSize: 12.5, color: '#5B21B6', display: 'flex', gap: 8 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Enter the quantity of replacement (good) units received from the supplier. Each accepted replacement unit adds to stock and moves toward completing the PO.</span>
          </div>

          {replRows.map((row, idx) => (
            <div key={`${row.returnId}-${idx}`} style={{ border: '1.5px solid #DDD6FE', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', background: '#F5F3FF', borderBottom: '1px solid #DDD6FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{row.productName}</div>
                  <div style={{ fontSize: 10.5, color: '#7C3AED', display: 'flex', gap: 10, marginTop: 2 }}>
                    <span style={{ fontFamily: 'monospace' }}>{row.returnNumber}</span>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>● {row.condition}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11 }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Pending Replacement</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#7C3AED' }}>{row.pendingReplacementQty}</div>
                </div>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: 4 }}>
                    ✓ Replacement Received (Good Units)
                  </label>
                  <input type="number" min="0" max={row.pendingReplacementQty} value={row.replacedQty}
                    onChange={e => setReplRow(idx, e.target.value)}
                    style={{ width: '100%', maxWidth: 140, height: 40, fontSize: 16, fontWeight: 700, textAlign: 'center', border: '2px solid #16A34A40', borderRadius: 8, background: '#16A34A08', color: '#16A34A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: 220 }}>
                  Only good/accepted units count. Enter 0 if no replacement received yet for this item.
                </div>
              </div>
            </div>
          ))}

          {replRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
              No pending replacements found for this PO.
            </div>
          )}

          <FormField label="Replacement Notes">
            <Textarea value={replNotes} onChange={e => setReplNotes(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ CREATE & LINK PRODUCT ══════ */}
      <Modal open={createProdModal} onClose={() => setCreateProd(false)} title="Create & Link Product"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setCreateProd(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreateAndLink} style={primaryBtnStyle}><Link size={13} /> Create & Link</button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Name *" error={prodErrors.name}><Input value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} error={!!prodErrors.name} /></FormField>
          <FormField label="SKU"><Input value={prodForm.sku} onChange={e => setProdForm(f => ({ ...f, sku: e.target.value }))} /></FormField>
          <FormField label="Category">
            <Select value={prodForm.categoryId} onChange={e => setProdForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Select…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Unit"><Input value={prodForm.unit} onChange={e => setProdForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs" /></FormField>
          <FormField label="Cost Price"><Input type="number" value={prodForm.costPrice} onChange={e => setProdForm(f => ({ ...f, costPrice: e.target.value }))} /></FormField>
          <FormField label="Selling Price"><Input type="number" value={prodForm.sellingPrice} onChange={e => setProdForm(f => ({ ...f, sellingPrice: e.target.value }))} /></FormField>
        </div>
      </Modal>

      {/* ══════ GP DETAIL MODAL ══════ */}
      <Modal
        open={!!selectedGPId && !gpReceiveModal}
        onClose={() => setSelectedGPId(null)}
        title={selectedGP ? `${selectedGP.gpNumber || selectedGP.purchaseNumber} — ${selectedGP.supplierName}` : ''}
        size="lg"
      >
        {selectedGP && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status + actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedGP.fulfillmentStatus || 'pending'} />
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>General Purchase</span>
              <div style={{ flex: 1 }} />
              {['pending','partially_received'].includes(selectedGP.fulfillmentStatus || 'pending') && (
                <button onClick={() => openGPReceive(selectedGP)} style={solidBtnStyle('#B45309')}><PackageCheck size={12} /> Receive Items</button>
              )}
              {selectedGP.fulfillmentStatus === 'fully_received' && (
                <button onClick={() => setConfirmAction({ type: 'gp_complete', id: selectedGP.id, label: 'Mark as completed?' })} style={outBtnStyle('#71717A')}><CheckCircle2 size={12} /> Mark Complete</button>
              )}
              {['pending','partially_received'].includes(selectedGP.fulfillmentStatus || 'pending') && (
                <button onClick={() => setConfirmAction({ type: 'gp_cancel', id: selectedGP.id, label: 'Cancel this general purchase?' })} style={outBtnStyle('#DC2626')}><X size={12} /> Cancel</button>
              )}
            </div>

            {/* Info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Supplier</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Truck size={14} color="var(--brand)" /> {selectedGP.supplierName || '—'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.7 }}>
                  {selGPSupplier?.phone && <div>Ph: {selGPSupplier.phone}</div>}
                  {selGPSupplier?.email && <div>{selGPSupplier.email}</div>}
                </div>
              </div>
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Purchase Details</div>
                <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {[
                      ['Reference',      selectedGP.gpNumber || selectedGP.purchaseNumber],
                      ['Date',           formatModalDateTime(selectedGP.date, selectedGP.createdAt)],
                      ['Total Value',    formatCurrency(selectedGP.grandTotal || 0, sym)],
                      ['Payment Status', selectedGP.paymentStatus || '—'],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: 'var(--text-tertiary)', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>{k}</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Items */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--canvas)' }}>Items</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas)' }}>
                      {['Product', 'Qty', 'Acc', 'Dmg', 'Def', 'Rej', 'Pending', 'Cost', 'Total'].map((h, i) => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedGP.items || []).map(it => {
                      const pend = it.quantity - (it.acceptedQty || 0);
                      return (
                        <tr key={it.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{it.quantity}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.acceptedQty||0) > 0 ? '#16A34A' : 'var(--text-tertiary)', fontWeight: 600 }}>{it.acceptedQty || 0}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.damagedQty||0) > 0 ? '#DC2626' : 'var(--text-tertiary)' }}>{it.damagedQty || 0}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.defectiveQty||0) > 0 ? '#D97706' : 'var(--text-tertiary)' }}>{it.defectiveQty || 0}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: (it.rejectedQty||0) > 0 ? '#7C3AED' : 'var(--text-tertiary)' }}>{it.rejectedQty || 0}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: pend > 0 ? '#B45309' : '#16A34A', fontWeight: 700 }}>{pend}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(it.unitCost || 0, sym)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(it.quantity * (it.unitCost || 0), sym)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--canvas)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 12 }}>
                <span>Subtotal: <strong>{formatCurrency(selectedGP.subtotal || 0, sym)}</strong></span>
                <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--brand)' }}>Total: {formatCurrency(selectedGP.grandTotal || 0, sym)}</span>
              </div>
            </div>

            {selectedGP.notes && (
              <div style={{ background: 'var(--brand-faint)', border: '1px solid var(--brand-light)', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--brand)' }}>Notes:</strong> {selectedGP.notes}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ══════ GP RECEIVE MODAL ══════ */}
      <Modal
        open={gpReceiveModal}
        onClose={() => setGPReceiveModal(false)}
        title={`Receive Items — ${selectedGP?.gpNumber || selectedGP?.purchaseNumber || ''}`}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setGPReceiveModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleGPReceive} style={primaryBtnStyle}><PackageCheck size={13} /> Confirm Receipt</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--brand-faint)', borderRadius: 8, padding: '9px 13px', fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
            <Info size={14} color="var(--brand)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Accepted</strong> items update stock. <strong>Damaged / Defective / Rejected</strong> items create a Purchase Return.</span>
          </div>
          {gpRcvRows.map((row, idx) => {
            const entered = Number(row.acceptedQty||0) + Number(row.damagedQty||0) + Number(row.defectiveQty||0) + Number(row.rejectedQty||0);
            const remaining = row.pendingQty - entered;
            return (
              <div key={row.gpItemId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{row.productName}</div>
                    {row.sku && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{row.sku}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                    Ordered: <strong>{row.orderedQty}</strong> · Received: <strong style={{ color: '#16A34A' }}>{row.alreadyReceived}</strong> · Pending: <strong style={{ color: '#DC2626' }}>{row.pendingQty}</strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[
                    { label: '✓ Accepted',  field: 'acceptedQty',  color: '#16A34A' },
                    { label: '✗ Damaged',   field: 'damagedQty',   color: '#DC2626' },
                    { label: '✗ Defective', field: 'defectiveQty', color: '#D97706' },
                    { label: '✗ Rejected',  field: 'rejectedQty',  color: '#7C3AED' },
                  ].map(({ label, field, color }) => (
                    <div key={field}>
                      <label style={{ fontSize: 10.5, fontWeight: 700, color, display: 'block', marginBottom: 3 }}>{label}</label>
                      <input type="number" min="0" value={row[field]}
                        onChange={e => setGPRcvRow(idx, { [field]: Math.max(0, Number(e.target.value)) })}
                        style={{ width: '100%', height: 34, fontSize: 14, fontWeight: 700, textAlign: 'center', border: `2px solid ${color}30`, borderRadius: 8, background: `${color}08`, color, boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: remaining < 0 ? '#DC2626' : 'var(--text-tertiary)' }}>
                  {entered} of {row.pendingQty} accounted{remaining > 0 ? ` · ${remaining} unaccounted` : remaining < 0 ? ' — exceeds pending!' : ' ✓'}
                </div>
              </div>
            );
          })}
          <FormField label="Receipt Notes">
            <Textarea value={gpRcvNotes} onChange={e => setGPRcvNotes(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════ NEW SUPPLIER FROM PO ══════ */}
      <Modal
        open={newSuppModal}
        onClose={() => { setNewSuppModal(false); setNewSuppErrors({}); }}
        title="Add Supplier"
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setNewSuppModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreateSupplierInPO} style={primaryBtnStyle}><Plus size={13} /> Add Supplier</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FormField label="Supplier name" error={newSuppErrors.name} required>
              <Input value={newSuppForm.name} onChange={e => { setNewSuppForm(f => ({ ...f, name: e.target.value })); setNewSuppErrors(v => ({ ...v, name: '' })); }} error={newSuppErrors.name} autoFocus placeholder="e.g. Reliance Industries Ltd." />
            </FormField>
            <FormField label="Email" error={newSuppErrors.email} required>
              <Input type="email" value={newSuppForm.email} onChange={e => { setNewSuppForm(f => ({ ...f, email: e.target.value })); setNewSuppErrors(v => ({ ...v, email: '' })); }} error={newSuppErrors.email} placeholder="procurement@supplier.in" />
            </FormField>
            <FormField label="Phone" error={newSuppErrors.phone} required>
              <Input value={newSuppForm.phone} onChange={e => { setNewSuppForm(f => ({ ...f, phone: e.target.value })); setNewSuppErrors(v => ({ ...v, phone: '' })); }} error={newSuppErrors.phone} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Tax ID / GST">
              <Input value={newSuppForm.taxId} onChange={e => setNewSuppForm(f => ({ ...f, taxId: e.target.value }))} placeholder="27AAPFU0939F1ZV" />
            </FormField>
            <FormField label="City">
              <Input value={newSuppForm.city} onChange={e => setNewSuppForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
            </FormField>
            <FormField label="State" error={newSuppErrors.state}>
              <Select value={newSuppForm.state} onChange={e => setNewSuppForm(f => ({ ...f, state: e.target.value }))} error={!!newSuppErrors.state}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
              </Select>
            </FormField>
            <FormField label="Country">
              <Input value={newSuppForm.country} onChange={e => setNewSuppForm(f => ({ ...f, country: e.target.value }))} placeholder="India" />
            </FormField>
            <FormField label="Status">
              <Select value={newSuppForm.status} onChange={e => setNewSuppForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Street address">
            <Input value={newSuppForm.address} onChange={e => setNewSuppForm(f => ({ ...f, address: e.target.value }))} placeholder="Plot 12, MIDC Industrial Area, Pune" />
          </FormField>
          <FormField label="Notes">
            <Textarea value={newSuppForm.notes} onChange={e => setNewSuppForm(f => ({ ...f, notes: e.target.value }))} placeholder="Lead times, payment terms, special handling…" />
          </FormField>
        </div>
      </Modal>

      {/* ══════ ADD SUPPLIER FROM GP ══════ */}
      <Modal
        open={gpNewSuppModal}
        onClose={() => { setGPNewSuppModal(false); setGPNewSuppErrors({}); }}
        title="Add Supplier"
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setGPNewSuppModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreateSupplierInGP} style={primaryBtnStyle}><Plus size={13} /> Add Supplier</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FormField label="Supplier name" error={gpNewSuppErrors.name} required>
              <Input value={gpNewSuppForm.name} onChange={e => { setGPNewSuppForm(f => ({ ...f, name: e.target.value })); setGPNewSuppErrors(v => ({ ...v, name: '' })); }} error={gpNewSuppErrors.name} autoFocus placeholder="e.g. Reliance Industries Ltd." />
            </FormField>
            <FormField label="Email" error={gpNewSuppErrors.email} required>
              <Input type="email" value={gpNewSuppForm.email} onChange={e => { setGPNewSuppForm(f => ({ ...f, email: e.target.value })); setGPNewSuppErrors(v => ({ ...v, email: '' })); }} error={gpNewSuppErrors.email} placeholder="procurement@supplier.in" />
            </FormField>
            <FormField label="Phone" error={gpNewSuppErrors.phone} required>
              <Input value={gpNewSuppForm.phone} onChange={e => { setGPNewSuppForm(f => ({ ...f, phone: e.target.value })); setGPNewSuppErrors(v => ({ ...v, phone: '' })); }} error={gpNewSuppErrors.phone} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Tax ID / GST">
              <Input value={gpNewSuppForm.taxId} onChange={e => setGPNewSuppForm(f => ({ ...f, taxId: e.target.value }))} placeholder="27AAPFU0939F1ZV" />
            </FormField>
            <FormField label="City">
              <Input value={gpNewSuppForm.city} onChange={e => setGPNewSuppForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
            </FormField>
            <FormField label="State" error={gpNewSuppErrors.state}>
              <Select value={gpNewSuppForm.state} onChange={e => setGPNewSuppForm(f => ({ ...f, state: e.target.value }))} error={!!gpNewSuppErrors.state}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
              </Select>
            </FormField>
            <FormField label="Country">
              <Input value={gpNewSuppForm.country} onChange={e => setGPNewSuppForm(f => ({ ...f, country: e.target.value }))} placeholder="India" />
            </FormField>
            <FormField label="Status">
              <Select value={gpNewSuppForm.status} onChange={e => setGPNewSuppForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Street address">
            <Input value={gpNewSuppForm.address} onChange={e => setGPNewSuppForm(f => ({ ...f, address: e.target.value }))} placeholder="Plot 12, MIDC Industrial Area, Pune" />
          </FormField>
          <FormField label="Notes">
            <Textarea value={gpNewSuppForm.notes} onChange={e => setGPNewSuppForm(f => ({ ...f, notes: e.target.value }))} placeholder="Lead times, payment terms, special handling…" />
          </FormField>
        </div>
      </Modal>

      {/* ══════ EDIT SUPPLIER FROM PO ══════ */}
      <Modal
        open={editSuppPO}
        onClose={() => { setEditSuppPO(false); setEditSuppPOErrors({}); }}
        title="Edit Supplier Details"
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditSuppPO(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleEditSuppPO} style={primaryBtnStyle}>Save Changes</button>
          </div>
        }
      >
        {editSuppPOForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Supplier name *" error={editSuppPOErrors.name}>
                <Input value={editSuppPOForm.name} onChange={e => setEditSuppPOForm(f => ({ ...f, name: e.target.value }))} error={editSuppPOErrors.name} autoFocus />
              </FormField>
              <FormField label="Status">
                <Select value={editSuppPOForm.status || 'active'} onChange={e => setEditSuppPOForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Phone">
                <Input value={editSuppPOForm.phone || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </FormField>
              <FormField label="Email">
                <Input type="email" value={editSuppPOForm.email || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@example.com" />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="State (for GST)">
                <Select value={editSuppPOForm.state || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                </Select>
              </FormField>
              <FormField label="GST Number">
                <Input value={editSuppPOForm.taxId || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, taxId: e.target.value }))} placeholder="27AAPFU0939F1ZV" />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="City">
                <Input value={editSuppPOForm.city || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
              </FormField>
              <FormField label="Contact Person">
                <Input value={editSuppPOForm.contactPerson || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Contact name" />
              </FormField>
            </div>
            <FormField label="Street Address">
              <Input value={editSuppPOForm.address || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, address: e.target.value }))} placeholder="Plot 12, Industrial Area" />
            </FormField>
            <FormField label="Notes">
              <Textarea value={editSuppPOForm.notes || ''} onChange={e => setEditSuppPOForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ══════ SUPPLIER RATING MODAL ══════ */}
      <Modal
        open={ratingModal}
        onClose={() => setRatingModal(false)}
        title="Rate Supplier Before Closing PO"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button onClick={handleSkipRating} style={{ ...cancelBtnStyle, color: 'var(--text-tertiary)', fontSize: 11.5 }}>Skip &amp; Close PO</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRatingModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleSubmitRating} style={primaryBtnStyle}><Star size={13} /> Submit Rating &amp; Close PO</button>
            </div>
          </div>
        }
      >
        {(() => {
          const ratingPO = purchaseOrders.find(p => p.id === ratingPOId);
          const ratingSupplier = suppliers.find(s => s.id === ratingPO?.supplierId);
          const StarRow = ({ label, field }) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', minWidth: 140 }}>{label}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRatingForm(f => ({ ...f, [field]: f[field] === n ? 0 : n }))}
                    style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: ratingForm[field] >= n ? '#F59E0B' : '#D1D5DB' }}>
                    <Star size={20} fill={ratingForm[field] >= n ? '#F59E0B' : 'none'} />
                  </button>
                ))}
                {ratingForm[field] > 0 && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, marginLeft: 4, alignSelf: 'center' }}>{ratingForm[field]}/5</span>}
              </div>
            </div>
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ratingSupplier && (
                <div style={{ background: 'var(--brand-faint)', border: '1px solid var(--brand-light)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
                  <strong style={{ color: 'var(--brand)' }}>{ratingSupplier.name}</strong>
                  {ratingPO?.poNumber && <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>· {ratingPO.poNumber}</span>}
                </div>
              )}

              {/* Overall rating — required */}
              <div style={{ border: `1.5px solid ${ratingErrors.overall ? '#DC2626' : 'var(--border)'}`, borderRadius: 9, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Rating <span style={{ color: '#DC2626' }}>*</span></div>
                <StarRow label="Overall" field="overallRating" />
                {ratingErrors.overall && <div style={{ fontSize: 11, color: '#DC2626' }}>{ratingErrors.overall}</div>}
              </div>

              {/* Sub-ratings */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Detailed Ratings (optional)</div>
                <StarRow label="Delivery"      field="deliveryRating" />
                <StarRow label="Quality"       field="qualityRating" />
                <StarRow label="Pricing"       field="pricingRating" />
                <StarRow label="Communication" field="communicationRating" />
              </div>

              {/* Yes/No questions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'On-time delivery?', field: 'onTimeDelivery', err: ratingErrors.onTime },
                  { label: 'Would buy again?',  field: 'wouldBuyAgain',  err: ratingErrors.wouldBuy },
                ].map(({ label, field, err }) => (
                  <div key={field} style={{ border: `1.5px solid ${err ? '#DC2626' : 'var(--border)'}`, borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label} <span style={{ color: '#DC2626' }}>*</span></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['yes', 'no'].map(v => (
                        <button key={v} onClick={() => setRatingForm(f => ({ ...f, [field]: f[field] === v ? '' : v }))}
                          style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${ratingForm[field] === v ? (v === 'yes' ? '#16A34A' : '#DC2626') : 'var(--border)'}`, background: ratingForm[field] === v ? (v === 'yes' ? '#F0FDF4' : '#FEF2F2') : 'var(--surface)', color: ratingForm[field] === v ? (v === 'yes' ? '#16A34A' : '#DC2626') : 'var(--text-secondary)', cursor: 'pointer' }}>
                          {v === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                    {err && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{err}</div>}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                <textarea value={ratingForm.notes} onChange={e => setRatingForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Comments about this supplier…"
                  style={{ width: '100%', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', background: 'var(--surface)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════ PRODUCT SEARCH PORTAL DROPDOWN ══════ */}
      {prodDropState && (() => {
        const { form: dropForm, idx, rect } = prodDropState;
        const isGP    = dropForm === 'gp';
        const suppId  = isGP ? gpForm.supplierId : poForm.supplierId;
        const filter  = (prodFilters[`${dropForm}_${idx}`] || '').toLowerCase();
        const pspMap  = Object.fromEntries((productSupplierPrices || []).filter(r => r.supplierId === suppId).map(r => [r.productId, r]));
        const matchP  = p => !filter || p.name.toLowerCase().includes(filter) || (p.sku || '').toLowerCase().includes(filter);
        const suppProds  = products.filter(p => pspMap[p.id] && matchP(p));
        const otherProds = products.filter(p => !pspMap[p.id] && matchP(p));
        const suppName   = suppId ? (suppliers.find(s => s.id === suppId)?.name || 'supplier') : null;
        const handlePick = productId => {
          if (isGP) handleSelectGPProduct(idx, productId);
          else handleSelectProduct(idx, productId);
          setProdFilters(f => ({ ...f, [`${dropForm}_${idx}`]: '' }));
          setProdDropState(null);
        };
        return ReactDOM.createPortal(
          <div
            onMouseDown={e => e.preventDefault()}
            style={{ position: 'fixed', top: rect.bottom + 3, left: rect.left, width: Math.max(rect.width + 80, 360), maxWidth: 480, zIndex: 99999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: 280, overflowY: 'auto', fontSize: 12 }}
          >
            {suppProds.length === 0 && otherProds.length === 0 ? (
              <div style={{ padding: '14px 16px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {filter ? `No products match "${filter}"` : 'No products — add one in the Products page'}
              </div>
            ) : (
              <>
                {suppId && suppProds.length > 0 && (
                  <>
                    <div style={{ padding: '5px 12px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0 }}>
                      ★ Previously from {suppName} ({suppProds.length})
                    </div>
                    {suppProds.map(p => {
                      const psp = pspMap[p.id];
                      return (
                        <div key={p.id} onClick={() => handlePick(p.id)}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-faint)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1.5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {p.sku && <span style={{ fontFamily: 'monospace', background: 'var(--canvas)', padding: '0 4px', borderRadius: 3 }}>{p.sku}</span>}
                              <span>Stock: {p.stock ?? 0}{p.unit ? ` ${p.unit}` : ''}</span>
                              {psp?.lastPurchaseDate && <span>Last: {psp.lastPurchaseDate}</span>}
                            </div>
                          </div>
                          {psp && (
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                              <div style={{ fontWeight: 700, color: 'var(--brand)' }}>{formatCurrency(psp.lastPurchasePrice, sym)}</div>
                              {psp.averagePurchasePrice ? <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Avg {formatCurrency(psp.averagePurchasePrice, sym)}</div> : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
                {otherProds.length > 0 && (
                  <>
                    <div style={{ padding: '5px 12px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--canvas)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)', borderTop: suppProds.length > 0 ? '2px solid var(--border)' : undefined, position: 'sticky', top: 0 }}>
                      {suppId ? `+ New for this supplier (${otherProds.length})` : `All products (${otherProds.length})`}
                    </div>
                    {otherProds.map(p => (
                      <div key={p.id} onClick={() => handlePick(p.id)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            {suppId && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, flexShrink: 0 }}>New</span>}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1.5, display: 'flex', gap: 8 }}>
                            {p.sku && <span style={{ fontFamily: 'monospace', background: 'var(--canvas)', padding: '0 4px', borderRadius: 3 }}>{p.sku}</span>}
                            <span>Stock: {p.stock ?? 0}{p.unit ? ` ${p.unit}` : ''}</span>
                          </div>
                        </div>
                        {(p.sellingPrice || 0) > 0 && (
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>MRP {formatCurrency(p.sellingPrice || 0, sym)}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>,
          document.body
        );
      })()}

      {/* ══════ CONFIRM DIALOG ══════ */}
      <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={doConfirm} title="Confirm Action" message={confirmAction?.label || ''} confirmLabel="Confirm" />
    </div>
  );
}

/* ── Shared style constants ──────────────────────────────────────────────── */
const fltSel        = { height: 30, fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--canvas)', color: 'var(--text-primary)', padding: '0 8px', cursor: 'pointer' };
const primaryBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer' };
const cancelBtnStyle  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', cursor: 'pointer' };
const inpStyle = (err) => ({ width: '100%', height: 30, fontSize: 12, border: `1px solid ${err ? 'var(--error)' : 'var(--border)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', padding: '0 7px', boxSizing: 'border-box' });
function solidBtnStyle(color) { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: color, color: '#fff', border: `1.5px solid ${color}`, cursor: 'pointer', whiteSpace: 'nowrap' }; }
function outBtnStyle(color)   { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'transparent', color, border: `1.5px solid ${color}`, cursor: 'pointer', whiteSpace: 'nowrap' }; }
