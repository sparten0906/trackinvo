import React, { useRef, useState } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─── Amount in Words (Indian format) ─────────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function cvt100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function cvt1000(n) {
  if (!n) return '';
  return n < 100 ? cvt100(n) : ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + cvt100(n % 100) : '');
}
function cvtIndian(n) {
  if (!n) return 'Zero';
  let r = '';
  if (n >= 10000000) { r += cvt1000(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
  if (n >= 100000)   { r += cvt1000(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
  if (n >= 1000)     { r += cvt1000(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
  if (n > 0)         { r += cvt1000(n); }
  return r.trim();
}
function amountInWords(amount) {
  const total  = Math.round(Number(amount) * 100);
  const rupees = Math.floor(total / 100);
  const paise  = total % 100;
  let words    = 'Rupees ' + cvtIndian(rupees);
  if (paise > 0) words += ' and ' + cvt100(paise) + ' Paise';
  return words + ' Only';
}

const PAY_MODE_LABELS = {
  cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer / NEFT',
  card: 'Card / Debit Card', cheque: 'Cheque', other: 'Other',
};

// ─── PayableReceiptDocument ───────────────────────────────────────────────────
// A4 width (794px). Uses table + float only — html2canvas 1.4.1 safe (no flex/grid/gap).
export function PayableReceiptDocument({ data }) {
  const {
    businessName = '', businessAddress = '', businessPhone = '',
    businessEmail = '', businessGST = '', logoUrl = '',
    receiptNumber = '', paymentDate = '', payableType = '',
    referenceNo = '', paidTo = '', payableName = '',
    paymentMode = '', transactionReference = '', notes = '',
    totalPayable = 0, prevPaidAmount = 0, currentPaidAmount = 0,
    balanceAmount = 0, paymentStatus = 'unpaid', sym = '₹',
  } = data;

  const ff   = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const mono = '"Courier New", Courier, monospace';

  const statusBg    = paymentStatus === 'paid' ? '#DCFCE7' : paymentStatus === 'partial' ? '#FEF9C3' : '#FEE2E2';
  const statusColor = paymentStatus === 'paid' ? '#166534' : paymentStatus === 'partial' ? '#92400E' : '#991B1B';
  const statusText  = paymentStatus === 'paid' ? 'PAID'   : paymentStatus === 'partial' ? 'PARTIAL' : 'UNPAID';

  const balBg    = balanceAmount === 0 ? '#F0FDF4' : '#FFF7ED';
  const balColor = balanceAmount === 0 ? '#166534' : '#DC2626';

  const displayPaidTo = paidTo || payableName || '—';

  return (
    <div
      data-receipt
      style={{ width: 794, background: '#FFFFFF', fontFamily: ff, color: '#0F172A', boxSizing: 'border-box' }}
    >
      {/* Top accent bar */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #1E3A5F 0%, #2563EB 100%)' }} />

      <div style={{ padding: '26px 36px 22px' }}>

        {/* ── Header: Business info (left floated) | Receipt title (right floated) ── */}
        <div style={{ overflow: 'hidden', marginBottom: 16, paddingBottom: 16, borderBottom: '2px solid #E2E8F0' }}>

          {/* Right floated: title + receipt # + date + status */}
          <div style={{ float: 'right', textAlign: 'right', maxWidth: 300 }}>
            <div style={{ display: 'inline-block', background: '#1E3A5F', borderRadius: 6, padding: '4px 14px', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Payment Receipt
              </span>
            </div>
            <p style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '0.01em', lineHeight: 1.2, marginBottom: 4 }}>
              {receiptNumber}
            </p>
            <table style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingRight: 10, paddingBottom: 3 }}>Date</td>
                  <td style={{ fontSize: 11.5, color: '#0F172A', fontWeight: 700, paddingBottom: 3, textAlign: 'right' }}>{formatDate(paymentDate)}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingRight: 10, paddingBottom: 3 }}>Type</td>
                  <td style={{ fontSize: 11.5, color: '#0F172A', fontWeight: 700, paddingBottom: 3, textAlign: 'right' }}>{payableType}</td>
                </tr>
              </tbody>
            </table>
            {/* Status badge */}
            <div style={{ marginTop: 10 }}>
              <span style={{ display: 'inline-block', padding: '4px 16px', background: statusBg, color: statusColor, fontWeight: 800, fontSize: 12, borderRadius: 99, letterSpacing: '0.06em', border: `1px solid ${statusColor}22` }}>
                {statusText}
              </span>
            </div>
          </div>

          {/* Left: logo + business info */}
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt="logo" style={{ height: 46, maxWidth: 120, objectFit: 'contain', display: 'block', marginBottom: 8 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1E3A5F', display: 'block', marginBottom: 8 }} />
            )}
            <p style={{ fontSize: 17, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: 4 }}>
              {businessName || 'Your Business'}
            </p>
            {businessAddress && (
              <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>{businessAddress}</p>
            )}
            {(businessPhone || businessEmail) && (
              <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>
                {businessPhone}
                {businessPhone && businessEmail && <span style={{ margin: '0 5px', color: '#CBD5E1' }}>|</span>}
                {businessEmail}
              </p>
            )}
            {businessGST && (
              <p style={{ fontSize: 10, color: '#0F172A', fontWeight: 700, fontFamily: mono, marginBottom: 0 }}>
                GSTIN: {businessGST}
              </p>
            )}
          </div>
        </div>

        {/* ── Paid To | Payment Details (2-col via table) ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, border: '1px solid #E2E8F0', borderRadius: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: '46%', verticalAlign: 'top', padding: '14px 16px', borderRight: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Paid To</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{displayPaidTo}</p>
                {paidTo && paidTo !== payableName && (
                  <p style={{ fontSize: 11.5, color: '#475569' }}>{payableName}</p>
                )}
                {referenceNo && referenceNo !== payableName && (
                  <p style={{ fontSize: 10.5, color: '#64748B', fontFamily: mono, marginTop: 4 }}>Ref: {referenceNo}</p>
                )}
              </td>
              <td style={{ verticalAlign: 'top', padding: '14px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Payment Details</p>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontSize: 11, color: '#64748B', paddingRight: 12, paddingBottom: 5 }}>Payment Mode</td>
                      <td style={{ fontSize: 11, color: '#0F172A', fontWeight: 700, paddingBottom: 5 }}>{PAY_MODE_LABELS[paymentMode] || paymentMode || '—'}</td>
                    </tr>
                    {transactionReference && (
                      <tr>
                        <td style={{ fontSize: 11, color: '#64748B', paddingRight: 12, paddingBottom: 5 }}>Txn / Ref No.</td>
                        <td style={{ fontSize: 11, color: '#0F172A', fontWeight: 700, fontFamily: mono, paddingBottom: 5 }}>{transactionReference}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ fontSize: 11, color: '#64748B', paddingRight: 12, paddingBottom: 5 }}>Payable Type</td>
                      <td style={{ fontSize: 11, color: '#0F172A', fontWeight: 700, paddingBottom: 5 }}>{payableType}</td>
                    </tr>
                    {referenceNo && (
                      <tr>
                        <td style={{ fontSize: 11, color: '#64748B', paddingRight: 12, paddingBottom: 0 }}>Reference No.</td>
                        <td style={{ fontSize: 11, color: '#0F172A', fontWeight: 700, fontFamily: mono, paddingBottom: 0 }}>{referenceNo}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Payment Summary ── */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 18px', marginBottom: 14 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Payment Summary</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ fontSize: 12, color: '#475569', paddingBottom: 8 }}>Total Payable Amount</td>
                <td style={{ fontSize: 12, color: '#0F172A', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 8 }}>{formatCurrency(totalPayable, sym)}</td>
              </tr>
              <tr>
                <td style={{ fontSize: 12, color: '#475569', paddingBottom: 8 }}>Previously Paid</td>
                <td style={{ fontSize: 12, color: '#0F172A', fontFamily: mono, fontWeight: 600, textAlign: 'right', paddingBottom: 8 }}>{formatCurrency(prevPaidAmount, sym)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <div style={{ borderTop: '1px solid #CBD5E1', marginBottom: 8 }} />
                </td>
              </tr>
              {/* Current payment highlighted */}
              <tr style={{ background: '#EFF6FF' }}>
                <td style={{ fontSize: 14, color: '#1E40AF', fontWeight: 800, padding: '10px 10px' }}>Current Payment</td>
                <td style={{ fontSize: 18, color: '#2563EB', fontFamily: mono, fontWeight: 900, textAlign: 'right', padding: '10px 10px' }}>{formatCurrency(currentPaidAmount, sym)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <div style={{ borderTop: '2px solid #1E3A5F', marginBottom: 0 }} />
                </td>
              </tr>
              {/* Balance */}
              <tr style={{ background: balBg }}>
                <td style={{ fontSize: 12, color: balColor, fontWeight: 700, padding: '8px 10px' }}>Balance Remaining</td>
                <td style={{ fontSize: 14, color: balColor, fontFamily: mono, fontWeight: 800, textAlign: 'right', padding: '8px 10px' }}>{formatCurrency(balanceAmount, sym)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Amount in Words ── */}
        <div style={{ padding: '8px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amount Paid in Words: </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>{amountInWords(currentPaidAmount)}</span>
        </div>

        {/* ── Notes ── */}
        {notes && (
          <div style={{ padding: '8px 14px', background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 6, marginBottom: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Notes</p>
            <p style={{ fontSize: 11.5, color: '#475569' }}>{notes}</p>
          </div>
        )}

        {/* ── Signature + Footer ── */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, marginTop: 6, overflow: 'hidden' }}>
          {/* Right: signature block (floated) */}
          <div style={{ float: 'right', textAlign: 'center', minWidth: 180 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', marginBottom: 30 }}>For {businessName || 'Company'}</p>
            <div style={{ borderTop: '1px solid #64748B', paddingTop: 5 }}>
              <p style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.04em' }}>Authorized Signatory</p>
            </div>
          </div>
          {/* Left: legal note */}
          <div>
            <p style={{ fontSize: 9.5, color: '#94A3B8', marginBottom: 2 }}>This is a computer-generated payment receipt.</p>
            <p style={{ fontSize: 9.5, color: '#94A3B8' }}>No physical signature is required for this document.</p>
          </div>
        </div>

        {/* Receipt # footer */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: '#94A3B8', fontFamily: mono, letterSpacing: '0.06em' }}>
            {receiptNumber} · {businessName}
          </p>
        </div>

      </div>

      {/* Bottom accent bar */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #2563EB 0%, #1E3A5F 100%)' }} />
    </div>
  );
}

// ─── PDF / JPG icon SVGs ──────────────────────────────────────────────────────

function PdfIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 18 15 15" />
    </svg>
  );
}

function ImgIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function Spin() {
  return (
    <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
  );
}

// ─── PayableReceiptViewer ─────────────────────────────────────────────────────

export default function PayableReceiptViewer({ data, onClose }) {
  const wrapRef = useRef(null);
  const [dlState, setDlState] = useState('');

  const filename = data?.receiptNumber || 'receipt';

  const capture = async () => {
    const wrapper = wrapRef.current;
    if (!wrapper) throw new Error('no ref');
    const source = wrapper.querySelector('[data-receipt]') ?? wrapper;

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

  const downloadPDF = async () => {
    setDlState('pdf');
    try {
      const canvas  = await capture();
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const ratio   = canvas.height / canvas.width;
      let imgW      = pageW;
      let imgH      = pageW * ratio;
      if (imgH > pageH) { imgH = pageH; imgW = pageH / ratio; }
      const x = (pageW - imgW) / 2;
      pdf.addImage(imgData, 'JPEG', x, 0, imgW, imgH);
      pdf.save(`${filename}.pdf`);
      toast.success('PDF downloaded');
    } catch { toast.error('PDF generation failed'); }
    finally  { setDlState(''); }
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
    } catch { toast.error('Image download failed'); }
    finally  { setDlState(''); }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    try {
      const canvas  = await capture();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], `${filename}.jpg`, { type: 'image/jpeg' })] })) {
          await navigator.share({ files: [new File([blob], `${filename}.jpg`, { type: 'image/jpeg' })], title: filename });
        } else {
          toast('Share not supported on this device — try Download instead');
        }
      }, 'image/jpeg', 0.92);
    } catch { /* user cancelled */ }
  };

  const btnBase = {
    height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  };

  if (!data) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>

      {/* ── Action bar ── */}
      <div className="print:hidden" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {onClose && (
            <button onClick={onClose} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)' }}>
              <X size={13} /> Close
            </button>
          )}

          <button onClick={handlePrint} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)' }}>
            <Printer size={13} /> Print
          </button>

          <button
            onClick={downloadPDF}
            disabled={!!dlState}
            style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', opacity: dlState === 'pdf' ? 0.7 : 1 }}
          >
            {dlState === 'pdf' ? <Spin /> : <PdfIcon />}
            {dlState === 'pdf' ? 'Generating…' : 'Download PDF'}
          </button>

          <button
            onClick={downloadJPG}
            disabled={!!dlState}
            style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)', opacity: dlState === 'jpg' ? 0.7 : 1 }}
          >
            {dlState === 'jpg' ? <Spin /> : <ImgIcon />}
            {dlState === 'jpg' ? 'Generating…' : 'Download JPG'}
          </button>

          <button onClick={handleShare} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text)' }}>
            <Share2 size={13} /> Share
          </button>
        </div>
      </div>

      {/* ── Receipt preview ── */}
      <div
        ref={wrapRef}
        style={{ overflowX: 'auto', background: '#e5e7eb', padding: 16, borderRadius: 10 }}
      >
        <div style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.13)', display: 'inline-block', minWidth: 794 }}>
          <PayableReceiptDocument data={data} />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
