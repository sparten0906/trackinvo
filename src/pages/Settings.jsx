import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Save, Building2, Receipt, Coins, ShoppingCart, Package,
  Shield, Printer, SlidersHorizontal, Upload, X, Image as ImageIcon,
  CheckCircle2, AlertCircle, ChevronLeft, Search, RotateCcw, LogOut, Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import toast from 'react-hot-toast';

// ─── Constants ─────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'business', icon: Building2,        label: 'Business Profile',  desc: 'Name, logo, address, tax IDs',  color: '#4F46E5' },
  { id: 'tax',      icon: Coins,             label: 'Tax & Currency',     desc: 'GST, currency, tax rates',      color: '#059669' },
  { id: 'invoice',  icon: Receipt,           label: 'Invoice Settings',   desc: 'Prefix, numbering, display',    color: '#D97706' },
  { id: 'purchase', icon: ShoppingCart,      label: 'Purchase Settings',  desc: 'PO prefix, return prefix',      color: '#7C3AED' },
  { id: 'stock',    icon: Package,           label: 'Stock Settings',     desc: 'Low stock alerts, stock rules', color: '#DC2626' },
  { id: 'security', icon: Shield,            label: 'Users & Security',   desc: 'Profile, role, logout',         color: '#0369A1' },
  { id: 'print',    icon: Printer,           label: 'Print & Documents',  desc: 'Invoice layout, terms, footer', color: '#65A30D' },
  { id: 'system',   icon: SlidersHorizontal, label: 'System Preferences', desc: 'Date format, theme, backup',    color: '#9333EA' },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹',   label: 'Indian Rupee (INR)' },
  { code: 'USD', symbol: '$',   label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€',   label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£',   label: 'British Pound (GBP)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar (AUD)' },
  { code: 'JPY', symbol: '¥',   label: 'Japanese Yen (JPY)' },
];

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },     { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },               { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },          { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },               { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },        { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },              { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },            { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },             { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },           { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },         { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },              { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },      { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },         { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },           { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },         { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },          { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },      { code: '38', name: 'Ladakh' },
];

const GST_TYPES = [
  { value: 'regular',     label: 'Regular Taxpayer' },
  { value: 'composition', label: 'Composition Scheme' },
  { value: 'exempt',      label: 'Exempt / Not Registered' },
];

// ─── Shared UI primitives ──────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 0, border: 'none',
        background: value ? 'var(--brand)' : '#D1D5DB',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.18s', flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div style={{
        position: 'absolute', width: 18, height: 18, borderRadius: 9,
        background: '#fff', top: 3, left: value ? 23 : 3,
        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      {title && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--canvas)' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{title}</span>
        </div>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, desc, children, last = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, paddingTop: 13, paddingBottom: 13,
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function PlaceholderRow({ label, desc, last = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, paddingTop: 13, paddingBottom: 13,
      borderBottom: last ? 'none' : '1px solid var(--border)', opacity: 0.5,
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>Soon</span>
    </div>
  );
}

function InfoTile({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, marginTop: 4 }}>
      <Info size={14} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 12.5, color: '#1E40AF', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ─── Section panels ────────────────────────────────────────────────────────────

function BusinessSection({ form, set, handleStateChange, handleLogoUpload, logoInputRef }) {
  return (
    <>
      <SectionCard title="Company Logo">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            onClick={() => !form.logoUrl && logoInputRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: 12, flexShrink: 0,
              border: form.logoUrl ? '2px solid var(--brand)' : '2px dashed var(--border)',
              background: form.logoUrl ? '#fff' : 'var(--canvas)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', cursor: form.logoUrl ? 'default' : 'pointer',
            }}
          >
            {form.logoUrl
              ? <img src={form.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
              : <div style={{ textAlign: 'center' }}>
                  <ImageIcon size={20} style={{ color: 'var(--text-tertiary)', display: 'block', margin: '0 auto 4px' }} />
                  <p style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: 0 }}>No logo</p>
                </div>
            }
          </div>
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
              PNG, JPG, or SVG · Max 1 MB<br />Square format with transparent background works best
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Upload size={12} /> {form.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </button>
              {form.logoUrl && (
                <button className="btn btn-secondary btn-sm" onClick={() => set('logoUrl', '')}
                  style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <X size={12} /> Remove
                </button>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Business Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Business Name">
            <Input value={form.businessName || ''} onChange={e => set('businessName', e.target.value)} placeholder="Acme Pvt. Ltd." />
          </FormField>
          <FormField label="Business Email">
            <Input type="email" value={form.businessEmail || ''} onChange={e => set('businessEmail', e.target.value)} placeholder="hello@acme.in" />
          </FormField>
          <FormField label="Phone Number">
            <Input value={form.businessPhone || ''} onChange={e => set('businessPhone', e.target.value)} placeholder="+91-98000-00000" />
          </FormField>
          <FormField label="Website" hint="Optional — shown on invoice header">
            <Input value={form.businessWebsite || ''} onChange={e => set('businessWebsite', e.target.value)} placeholder="www.acme.in" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Business Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Street Address">
              <Input value={form.businessAddress || ''} onChange={e => set('businessAddress', e.target.value)} placeholder="Shop No., Building, Street Name" />
            </FormField>
          </div>
          <FormField label="City">
            <Input value={form.businessCity || ''} onChange={e => set('businessCity', e.target.value)} />
          </FormField>
          <FormField label="State">
            <Select value={form.businessState || ''} onChange={e => handleStateChange(e.target.value)}>
              <option value="">Select State…</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.code} – {s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="PIN Code">
            <Input value={form.businessPinCode || ''} onChange={e => set('businessPinCode', e.target.value)} placeholder="400 001" maxLength={7} />
          </FormField>
          <FormField label="Country">
            <Input value={form.businessCountry || ''} onChange={e => set('businessCountry', e.target.value)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Tax Registration">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="GSTIN" hint="15-character GST Identification Number">
            <Input
              value={form.gstin || form.taxNumber || ''}
              onChange={e => { set('gstin', e.target.value.toUpperCase()); set('taxNumber', e.target.value.toUpperCase()); }}
              placeholder="27AAACR1234M1Z5" maxLength={15}
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
          </FormField>
          <FormField label="PAN Number" hint="10-character Permanent Account Number">
            <Input value={form.pan || ''} onChange={e => set('pan', e.target.value.toUpperCase())}
              placeholder="AAACR1234M" maxLength={10}
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
          </FormField>
          <FormField label="MSME / Udyam Reg. No." hint="Optional — printed on invoice if provided">
            <Input value={form.msme || ''} onChange={e => set('msme', e.target.value)} placeholder="UDYAM-MH-00-0000000" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Bank & Payment Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Bank Name">
            <Input value={form.bankName || ''} onChange={e => set('bankName', e.target.value)} placeholder="HDFC Bank, SBI, ICICI…" />
          </FormField>
          <FormField label="Account Type">
            <Select value={form.bankAccountType || 'current'} onChange={e => set('bankAccountType', e.target.value)}>
              <option value="current">Current Account</option>
              <option value="savings">Savings Account</option>
              <option value="od">Overdraft Account</option>
            </Select>
          </FormField>
          <FormField label="Account Number">
            <Input value={form.bankAccount || ''} onChange={e => set('bankAccount', e.target.value)}
              placeholder="50100 0123 4567 8" style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }} />
          </FormField>
          <FormField label="IFSC Code">
            <Input value={form.bankIfsc || ''} onChange={e => set('bankIfsc', e.target.value.toUpperCase())}
              placeholder="HDFC0001234" maxLength={11} style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Branch Name / Address">
              <Input value={form.bankBranch || ''} onChange={e => set('bankBranch', e.target.value)} placeholder="Andheri East Branch, Mumbai" />
            </FormField>
          </div>
          <FormField label="UPI ID" hint="Shown on invoice for quick customer payment">
            <Input value={form.upiId || ''} onChange={e => set('upiId', e.target.value)} placeholder="business@upi" />
          </FormField>
        </div>
      </SectionCard>
    </>
  );
}

function TaxSection({ form, set }) {
  const taxRate = form.taxRate ?? 18;
  const gstTypeLabel = GST_TYPES.find(t => t.value === (form.gstType || 'regular'))?.label;
  return (
    <>
      <SectionCard title="Currency">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Currency">
            <Select value={form.currency || 'INR'} onChange={e => {
              const c = CURRENCIES.find(x => x.code === e.target.value);
              if (c) { set('currency', c.code); set('currencySymbol', c.symbol); }
            }}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Currency Symbol" hint="Override the auto-filled symbol if needed">
            <Input value={form.currencySymbol || ''} onChange={e => set('currencySymbol', e.target.value)} placeholder="₹" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="GST Configuration">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="GST Registration Type" hint="Determines how tax is shown on invoices">
            <Select value={form.gstType || 'regular'} onChange={e => set('gstType', e.target.value)}>
              {GST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Default Tax Rate (%)" hint="Applied to new invoice line items">
            <Input type="number" min="0" max="100" step="0.5" value={taxRate}
              onChange={e => set('taxRate', Number(e.target.value))} />
          </FormField>
          <FormField label="Default Place of Supply" hint="Default state for new invoices">
            <Select value={form.placeOfSupply || form.businessState || ''} onChange={e => {
              const found = INDIAN_STATES.find(s => s.name === e.target.value);
              set('placeOfSupply', e.target.value);
              if (found) set('stateCode', found.code);
            }}>
              <option value="">Select State…</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.code} – {s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Transaction Type" hint="Determines CGST+SGST vs IGST split on invoices">
            <Select value={form.transactionType || 'intrastate'} onChange={e => set('transactionType', e.target.value)}>
              <option value="intrastate">Intrastate (CGST + SGST)</option>
              <option value="interstate">Interstate (IGST)</option>
            </Select>
          </FormField>
        </div>
      </SectionCard>

      <div style={{ padding: '14px 16px', background: 'var(--brand-faint)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Active Configuration
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <div>Currency: <strong>{form.currencySymbol} ({form.currency})</strong></div>
          <div>GST Type: <strong>{gstTypeLabel}</strong></div>
          <div>Tax Rate: <strong>{taxRate}%</strong>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
              {form.transactionType !== 'interstate' ? `(CGST ${taxRate / 2}% + SGST ${taxRate / 2}%)` : `(IGST ${taxRate}%)`}
            </span>
          </div>
          <div>State: <strong>{form.placeOfSupply || '—'}</strong>
            {form.stateCode && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>({form.stateCode})</span>}
          </div>
        </div>
      </div>
    </>
  );
}

function InvoiceSection({ form, set }) {
  const yr = new Date().getFullYear();
  return (
    <>
      <SectionCard title="Invoice Numbering">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Invoice Prefix" hint="Used to auto-generate invoice numbers">
            <Input value={form.invoicePrefix || ''} onChange={e => set('invoicePrefix', e.target.value)} placeholder="INV" />
          </FormField>
          <FormField label="Sales Return Prefix" hint="Used for customer return reference numbers">
            <Input value={form.returnPrefix || ''} onChange={e => set('returnPrefix', e.target.value)} placeholder="RET" />
          </FormField>
        </div>
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--brand-faint)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 9, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700 }}>Preview:</span>
          <code style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{form.invoicePrefix || 'INV'}-{yr}-0001</code>
          <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{form.returnPrefix || 'RET'}-{yr}-0001</code>
        </div>
      </SectionCard>

      <SectionCard title="Display Options">
        <SettingRow label="Show Business Logo" desc="Display your logo in the invoice header when printing">
          <Toggle value={form.showLogo ?? true} onChange={v => set('showLogo', v)} />
        </SettingRow>
        <SettingRow label="Show Tax Breakdown" desc="Display CGST / SGST / IGST line-by-line on the invoice" last>
          <Toggle value={form.showTaxBreakdown ?? true} onChange={v => set('showTaxBreakdown', v)} />
        </SettingRow>
      </SectionCard>

      <InfoTile>
        Invoice footer text and terms & conditions are configured in <strong>Print &amp; Documents</strong>.
      </InfoTile>
    </>
  );
}

function PurchaseSection({ form, set }) {
  const yr = new Date().getFullYear();
  return (
    <>
      <SectionCard title="Purchase Numbering">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Purchase / PO Prefix" hint="Used to auto-generate purchase order numbers">
            <Input value={form.purchasePrefix || ''} onChange={e => set('purchasePrefix', e.target.value)} placeholder="PUR" />
          </FormField>
          <FormField label="Purchase Return Prefix" hint="Used for supplier return reference numbers">
            <Input value={form.purReturnPrefix || ''} onChange={e => set('purReturnPrefix', e.target.value)} placeholder="PRR" />
          </FormField>
        </div>
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 9, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#7C3AED', fontWeight: 700 }}>Preview:</span>
          <code style={{ fontSize: 13, fontWeight: 800, color: '#7C3AED' }}>{form.purchasePrefix || 'PUR'}-{yr}-0001</code>
          <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{form.purReturnPrefix || 'PRR'}-{yr}-0001</code>
        </div>
      </SectionCard>

      <SectionCard title="Purchase Defaults">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Default Payment Terms" hint="e.g. Net 30 days, Immediate, Net 60 days">
            <Input value={form.poPaymentTerms || ''} onChange={e => set('poPaymentTerms', e.target.value)} placeholder="Net 30 days" />
          </FormField>
          <FormField label="Default Delivery Terms" hint="e.g. Delivery at buyer's warehouse, FOB supplier, CIF">
            <Input value={form.poDeliveryTerms || ''} onChange={e => set('poDeliveryTerms', e.target.value)} placeholder="Delivery at buyer's warehouse" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="PO Terms & Conditions">
        <FormField label="Default Terms & Conditions" hint="Pre-filled in every new Purchase Order and shown on PO Slip">
          <Textarea value={form.poTerms || ''} onChange={e => set('poTerms', e.target.value)}
            placeholder="1. All prices are exclusive of taxes.&#10;2. Delivery must be within the expected date.&#10;3. Damaged goods will be returned at supplier's cost." rows={5} />
        </FormField>
      </SectionCard>

      <SectionCard title="Payables & Payment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Purchase Payment Basis" hint="Controls how payable amount is calculated for Purchase Orders">
            <Select value={form.purchasePaymentBasis || 'received_value'} onChange={e => set('purchasePaymentBasis', e.target.value)}>
              <option value="received_value">Pay on Received Value — Payable = value of goods actually received</option>
              <option value="ordered_value">Pay on Ordered Value — Payable = full PO value regardless of receipt</option>
            </Select>
          </FormField>
          <div style={{ padding: '8px 12px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 9, fontSize: 12.5, color: '#7C3AED' }}>
            {(form.purchasePaymentBasis || 'received_value') === 'received_value'
              ? 'Payable amount is based on accepted/received items. Advance payments are tracked separately before goods arrive.'
              : 'Payable amount equals the full PO amount from the moment the PO is created or approved.'}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Pricing Strategy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Selling Price Strategy" hint="How selling price should be calculated when purchase cost changes">
            <Select value={form.pricingStrategy || 'manual'} onChange={e => set('pricingStrategy', e.target.value)}>
              <option value="manual">Manual — I'll update selling price manually</option>
              <option value="fixed_margin">Fixed Margin % — Selling price = Cost × (1 + Margin)</option>
              <option value="markup_latest">Markup on Latest Cost</option>
              <option value="markup_average">Markup on Average Cost</option>
            </Select>
          </FormField>
          {form.pricingStrategy !== 'manual' && (
            <FormField label="Default Margin %" hint="Used to suggest a selling price when purchase cost changes">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Input type="number" min="0" max="500" step="1" value={form.defaultMarginPercent ?? 30}
                  onChange={e => set('defaultMarginPercent', Number(e.target.value))} style={{ width: 100 }} />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
              </div>
            </FormField>
          )}
          <SettingRow label="Include Freight in Product Cost" desc="Allocate freight proportionally to accepted item cost when calculating average purchase cost" last>
            <Toggle value={form.includeFreightInCost ?? false} onChange={v => set('includeFreightInCost', v)} />
          </SettingRow>
        </div>
      </SectionCard>
    </>
  );
}

function StockSection({ form, set }) {
  return (
    <>
      <SectionCard title="Stock Alerts">
        <FormField label="Low Stock Alert Threshold" hint="Warning shown on Products page when stock falls below this quantity">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input type="number" min="0" value={form.lowStockThreshold ?? 10}
              onChange={e => set('lowStockThreshold', Number(e.target.value))}
              style={{ width: 100 }} />
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>units</span>
          </div>
        </FormField>
      </SectionCard>

      <SectionCard title="Stock Control">
        <SettingRow label="Prevent Negative Stock" desc="Block sales if a product's stock would go below zero">
          <Toggle value={form.preventNegativeStock ?? false} onChange={v => set('preventNegativeStock', v)} />
        </SettingRow>
        <SettingRow label="Track Damaged Stock" desc="Maintain a separate damaged stock register alongside sellable stock" last>
          <Toggle value={form.trackDamagedStock ?? true} onChange={v => set('trackDamagedStock', v)} />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Stock Rules">
        <PlaceholderRow label="Stock Valuation Method" desc="FIFO, LIFO, or Weighted Average cost calculation" />
        <PlaceholderRow label="Opening Stock Date" desc="The date from which opening stock is calculated" last />
      </SectionCard>
    </>
  );
}

function SecuritySection({ form, setProfile, onLogout }) {
  const initial = form.userProfile?.name?.charAt(0)?.toUpperCase() || 'A';
  return (
    <>
      <SectionCard title="User Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, padding: '12px 14px', background: 'var(--canvas)', borderRadius: 10 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{form.userProfile?.name || 'Unknown User'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{form.userProfile?.role}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{form.userProfile?.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name">
            <Input value={form.userProfile?.name || ''} onChange={e => setProfile('name', e.target.value)} />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={form.userProfile?.email || ''} onChange={e => setProfile('email', e.target.value)} />
          </FormField>
          <FormField label="Role">
            <Input value={form.userProfile?.role || ''} onChange={e => setProfile('role', e.target.value)} placeholder="Admin, Manager…" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Security">
        <SettingRow label="Password" desc="Password management is handled by Supabase authentication">
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Managed by Supabase</span>
        </SettingRow>
        <PlaceholderRow label="Two-Factor Authentication" desc="Add an extra layer of security to your account" last />
      </SectionCard>

      <SectionCard title="Session">
        <SettingRow label="Sign Out" desc="Sign out from the current session on this device" last>
          <button onClick={onLogout}
            style={{ height: 32, padding: '0 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={12} /> Sign Out
          </button>
        </SettingRow>
      </SectionCard>

      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 9 }}>
        <Shield size={14} style={{ color: '#CA8A04', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
          Authentication and roles are managed by Supabase. Configure credentials via environment variables to enable login, permissions, and multi-user support.
        </div>
      </div>
    </>
  );
}

function PrintSection({ form, set }) {
  return (
    <>
      <SectionCard title="Invoice Content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Invoice Footer Text" hint="Short message shown at the bottom of every invoice">
            <Input value={form.invoiceFooter || ''} onChange={e => set('invoiceFooter', e.target.value)} placeholder="Thank you for your business!" />
          </FormField>
          <FormField label="Invoice Terms & Conditions" hint="Printed on each invoice — payment terms, return policy, etc.">
            <Textarea value={form.invoiceTerms || ''} onChange={e => set('invoiceTerms', e.target.value)}
              placeholder="Goods once sold will not be taken back. Payment is due within 30 days." rows={4} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Purchase Order Documents">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="PO Footer Note" hint="Appears at the bottom of every Purchase Order slip">
            <Input value={form.poFooterNote || ''} onChange={e => set('poFooterNote', e.target.value)} placeholder="This is a computer-generated purchase order." />
          </FormField>
          <FormField label="Authorized Signatory Name" hint="Shown in the signature section of the PO Slip">
            <Input value={form.authorizedSignatory || ''} onChange={e => set('authorizedSignatory', e.target.value)} placeholder="e.g. Rajesh Kumar, Purchase Manager" />
          </FormField>
          <SettingRow label="Show Terms on PO Slip" desc="Print the terms & conditions at the bottom of Purchase Order slips" last>
            <Toggle value={form.showTermsOnSlip ?? true} onChange={v => set('showTermsOnSlip', v)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard title="Document Layout">
        <PlaceholderRow label="Invoice Print Template" desc="Choose from default, compact, or detailed invoice layout" />
        <PlaceholderRow label="Purchase Order Slip Layout" desc="Standard or detailed PO slip format" last />
      </SectionCard>
    </>
  );
}

function SystemSection({ form, set }) {
  return (
    <>
      <SectionCard title="Format Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Business Timezone" hint="All dates and times are displayed in this timezone">
            <Select value={form.businessTimezone || 'Asia/Kolkata'} onChange={e => set('businessTimezone', e.target.value)}>
              <option value="Asia/Kolkata">Asia/Kolkata — IST (UTC +5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai — GST (UTC +4:00)</option>
              <option value="Asia/Singapore">Asia/Singapore — SGT (UTC +8:00)</option>
              <option value="Asia/Tokyo">Asia/Tokyo — JST (UTC +9:00)</option>
              <option value="Europe/London">Europe/London — GMT/BST</option>
              <option value="Europe/Paris">Europe/Paris — CET (UTC +1:00)</option>
              <option value="America/New_York">America/New_York — EST/EDT</option>
              <option value="America/Chicago">America/Chicago — CST/CDT</option>
              <option value="America/Los_Angeles">America/Los_Angeles — PST/PDT</option>
              <option value="UTC">UTC — Coordinated Universal Time</option>
            </Select>
          </FormField>
          <FormField label="Date Format" hint="How dates are displayed throughout the app">
            <Select value={form.dateFormat || 'DD/MM/YYYY'} onChange={e => set('dateFormat', e.target.value)}>
              <option value="DD/MM/YYYY">DD/MM/YYYY  (31/12/2025)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY  (12/31/2025)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD  (2025-12-31)</option>
              <option value="D MMM YYYY">D MMM YYYY  (31 Dec 2025)</option>
            </Select>
          </FormField>
          <FormField label="Decimal Places" hint="How many decimal places to show in currency amounts">
            <Select value={String(form.decimalPlaces ?? 2)} onChange={e => set('decimalPlaces', Number(e.target.value))}>
              <option value="0">0 — Whole numbers only</option>
              <option value="2">2 — Standard (₹1,234.56)</option>
              <option value="3">3 — High precision</option>
            </Select>
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Appearance">
        <PlaceholderRow label="Theme" desc="Light, dark, or match system preference" />
        <PlaceholderRow label="Language" desc="Interface language — English, Hindi, and more coming soon" last />
      </SectionCard>

      <SectionCard title="Data & Backup">
        <PlaceholderRow label="Export All Data" desc="Download a full backup of your business data as JSON or CSV" />
        <PlaceholderRow label="Data Retention" desc="Configure how long historical records are stored" last />
      </SectionCard>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { state, updateSettings } = useApp();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (!isMobile && activeSection === null) setActiveSection('business');
  }, [isMobile]); // eslint-disable-line

  const [activeSection, setActiveSection] = useState(window.innerWidth < 768 ? null : 'business');
  const [form, setForm]   = useState({ ...state.settings });
  const [saveState, setSaveState] = useState(null);
  const [searchQ, setSearchQ]     = useState('');
  const logoInputRef = useRef(null);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(state.settings),
    [form, state.settings]
  );

  const filteredNav = useMemo(() => {
    if (!searchQ) return NAV_SECTIONS;
    const q = searchQ.toLowerCase();
    return NAV_SECTIONS.filter(s => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }, [searchQ]);

  const set        = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setProfile = (field, val) => setForm(f => ({ ...f, userProfile: { ...f.userProfile, [field]: val } }));

  const handleStateChange = name => {
    const found = INDIAN_STATES.find(s => s.name === name);
    setForm(f => ({ ...f, businessState: name, placeOfSupply: name, stateCode: found ? found.code : f.stateCode }));
  };

  const handleLogoUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error('Logo must be under 1 MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onload = ev => { set('logoUrl', ev.target.result); toast.success('Logo uploaded — save to apply'); };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setSaveState('saving');
    try {
      const toSave = { ...form };
      if (toSave.gstin) toSave.taxNumber = toSave.gstin;
      updateSettings(toSave);
      setSaveState('success');
      toast.success('Settings saved');
      setTimeout(() => setSaveState(null), 3000);
    } catch {
      setSaveState('error');
      toast.error('Failed to save settings');
      setTimeout(() => setSaveState(null), 3000);
    }
  };

  const handleReset = () => {
    setForm({ ...state.settings });
    toast('Changes discarded', { icon: '↩' });
  };

  const handleLogout = () => {
    toast('Logout requires Supabase auth to be configured.');
  };

  const goToSection = id => { setActiveSection(id); setSearchQ(''); };

  const currentNav   = NAV_SECTIONS.find(s => s.id === activeSection);
  const showCardGrid = isMobile && activeSection === null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Page header ── */}
      <div style={{ flexShrink: 0, padding: '16px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><SlidersHorizontal size={20} color="var(--brand)" /> Settings</h1>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
          Manage your business configuration, taxes, documents, and preferences
        </p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left nav — desktop only ── */}
        {!isMobile && (
          <nav style={{
            width: 252, flexShrink: 0, borderRight: '1px solid var(--border)',
            background: 'var(--surface)', overflowY: 'auto',
            padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search settings…"
                style={{ width: '100%', height: 32, padding: '0 10px 0 27px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--canvas)', fontSize: 12, color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }} />
            </div>

            {filteredNav.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 4px' }}>No settings found</p>
              : filteredNav.map(({ id, icon: Icon, label, desc, color }) => {
                  const active = activeSection === id;
                  return (
                    <button key={id} onClick={() => goToSection(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 9px', borderRadius: 9, border: 'none',
                        background: active ? 'var(--brand)' : 'transparent',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--canvas)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(255,255,255,0.18)' : color + '18' }}>
                        <Icon size={15} style={{ color: active ? '#fff' : color }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{label}</div>
                        <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
                      </div>
                    </button>
                  );
                })
            }
          </nav>
        )}

        {/* ── Right content ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {showCardGrid ? (
              /* ── Mobile: card grid ── */
              <div style={{ padding: 16 }}>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search settings…"
                    style={{ width: '100%', height: 40, padding: '0 12px 0 34px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {filteredNav.map(({ id, icon: Icon, label, desc, color }) => (
                    <button key={id} onClick={() => goToSection(id)}
                      style={{ padding: '16px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={17} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Section content ── */
              <div style={{ maxWidth: 720, padding: '20px 24px', paddingBottom: 80 }}>

                {/* Mobile back */}
                {isMobile && activeSection && (
                  <button onClick={() => setActiveSection(null)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 13, fontWeight: 600, padding: 0 }}>
                    <ChevronLeft size={16} /> All Settings
                  </button>
                )}

                {/* Section header */}
                {currentNav && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: currentNav.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <currentNav.icon size={20} style={{ color: currentNav.color }} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{currentNav.label}</h2>
                      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{currentNav.desc}</p>
                    </div>
                  </div>
                )}

                {activeSection === 'business' && <BusinessSection form={form} set={set} handleStateChange={handleStateChange} handleLogoUpload={handleLogoUpload} logoInputRef={logoInputRef} />}
                {activeSection === 'tax'      && <TaxSection      form={form} set={set} />}
                {activeSection === 'invoice'  && <InvoiceSection  form={form} set={set} />}
                {activeSection === 'purchase' && <PurchaseSection form={form} set={set} />}
                {activeSection === 'stock'    && <StockSection    form={form} set={set} />}
                {activeSection === 'security' && <SecuritySection form={form} setProfile={setProfile} onLogout={handleLogout} />}
                {activeSection === 'print'    && <PrintSection    form={form} set={set} />}
                {activeSection === 'system'   && <SystemSection   form={form} set={set} />}
              </div>
            )}
          </div>

          {/* ── Sticky save bar (always rendered, hides on mobile grid with no changes) ── */}
          {(!showCardGrid || isDirty) && (
            <div style={{
              position: 'sticky', bottom: 0, zIndex: 20,
              background: 'var(--surface)',
              borderTop: `1px solid ${isDirty ? '#FDE68A' : 'var(--border)'}`,
              padding: '11px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              transition: 'border-color 0.2s',
            }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isDirty && !saveState && (
                  <>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
                    <span style={{ fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>Unsaved changes</span>
                  </>
                )}
                {saveState === 'saving' && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Saving…</span>}
                {saveState === 'success' && (
                  <>
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 600 }}>Saved successfully</span>
                  </>
                )}
                {saveState === 'error' && (
                  <>
                    <AlertCircle size={14} style={{ color: 'var(--error)' }} />
                    <span style={{ fontSize: 12.5, color: 'var(--error)', fontWeight: 600 }}>Save failed — try again</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleReset} disabled={!isDirty}
                  style={{ height: 34, padding: '0 13px', borderRadius: 8, background: 'var(--canvas)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: isDirty ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isDirty ? 1 : 0.45 }}>
                  <RotateCcw size={12} /> Reset
                </button>
                <button onClick={handleSave} disabled={!isDirty || saveState === 'saving'}
                  style={{ height: 34, padding: '0 16px', borderRadius: 8, background: isDirty ? 'var(--brand)' : '#D1D5DB', color: isDirty ? '#fff' : '#9CA3AF', border: 'none', cursor: isDirty ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}>
                  <Save size={13} /> {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
