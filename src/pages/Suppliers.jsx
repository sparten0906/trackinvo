import React, { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Truck, Mail, Phone, MapPin,
  Package, Search, Building2, ExternalLink, Star, Eye,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { searchFilter, validateSupplier, formatDate, formatDateTime, formatCurrency } from '../utils/helpers';

const empty = {
  name: '', email: '', phone: '', address: '',
  city: '', state: '', country: 'India', taxId: '', notes: '', status: 'active',
};

const PALETTE = [
  { bg: '#EEF2FF', fg: '#4F46E5' },
  { bg: '#F0F9FF', fg: '#0284C7' },
  { bg: '#F0FDF4', fg: '#16A34A' },
  { bg: '#FFFBEB', fg: '#D97706' },
  { bg: '#FDF4FF', fg: '#9333EA' },
  { bg: '#FEF2F2', fg: '#DC2626' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
  { bg: '#ECFDF5', fg: '#059669' },
];
const palette = (name) => PALETTE[(name?.charCodeAt(0) || 0) % PALETTE.length];

export default function Suppliers() {
  const { state, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const { suppliers, purchases, settings, supplierRatings = [], productSupplierPrices = [], products = [] } = state;
  const sym = settings.currencySymbol;

  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(empty);
  const [errors, setErrors]     = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [viewId, setViewId]     = useState(null);

  const filtered = useMemo(
    () => searchFilter(suppliers, search, ['name', 'email', 'phone', 'city']),
    [suppliers, search],
  );

  const purchaseCount = useMemo(() => {
    const map = {};
    for (const p of purchases) {
      if (!p.supplierId) continue;
      map[p.supplierId] = (map[p.supplierId] || 0) + 1;
    }
    return map;
  }, [purchases]);

  const purchaseTotal = useMemo(() => {
    const map = {};
    for (const p of purchases) {
      if (!p.supplierId) continue;
      map[p.supplierId] = (map[p.supplierId] || 0) + (p.grandTotal || 0);
    }
    return map;
  }, [purchases]);

  const ratingStats = useMemo(() => {
    const map = {};
    for (const r of supplierRatings) {
      if (!r.supplierId) continue;
      if (!map[r.supplierId]) map[r.supplierId] = { list: [], overallSum: 0, deliverySum: 0, qualitySum: 0, pricingSum: 0, commSum: 0, onTime: 0, wouldBuy: 0 };
      const m = map[r.supplierId];
      m.list.push(r);
      m.overallSum  += Number(r.overallRating || 0);
      m.deliverySum += Number(r.deliveryRating || 0);
      m.qualitySum  += Number(r.qualityRating  || 0);
      m.pricingSum  += Number(r.pricingRating  || 0);
      m.commSum     += Number(r.communicationRating || 0);
      if (r.onTimeDelivery === true  || r.onTimeDelivery === 'yes') m.onTime++;
      if (r.wouldBuyAgain  === true  || r.wouldBuyAgain  === 'yes') m.wouldBuy++;
    }
    const result = {};
    for (const [suppId, m] of Object.entries(map)) {
      const n = m.list.length;
      result[suppId] = {
        count:       n,
        avgOverall:  Math.round((m.overallSum  / n) * 10) / 10,
        avgDelivery: m.deliverySum ? Math.round((m.deliverySum / n) * 10) / 10 : null,
        avgQuality:  m.qualitySum  ? Math.round((m.qualitySum  / n) * 10) / 10 : null,
        avgPricing:  m.pricingSum  ? Math.round((m.pricingSum  / n) * 10) / 10 : null,
        avgComm:     m.commSum     ? Math.round((m.commSum     / n) * 10) / 10 : null,
        onTimePct:   Math.round((m.onTime   / n) * 100),
        wouldBuyPct: Math.round((m.wouldBuy / n) * 100),
        list: [...m.list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
      };
    }
    return result;
  }, [supplierRatings]);

  const pspBySupplier = useMemo(() => {
    const map = {};
    for (const r of productSupplierPrices) {
      if (!r.supplierId) continue;
      if (!map[r.supplierId]) map[r.supplierId] = [];
      map[r.supplierId].push(r);
    }
    return map;
  }, [productSupplierPrices]);

  const openAdd  = () => { setForm(empty); setErrors({}); setEditing(null); setModal(true); };
  const openEdit = (s) => { setForm({ ...s }); setErrors({}); setEditing(s.id); setModal(true); };
  const set = (field, val) => {
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };
  const handleSave = () => {
    const errs = validateSupplier(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (editing) updateSupplier({ id: editing, ...form });
    else addSupplier(form);
    setModal(false);
  };

  const activeCount = suppliers.filter((s) => s.status === 'active').length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* ── Sticky header bar ───────────────────────────────────────────────── */}
      <div className="suppliers-header" style={{
        flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ marginRight: 4 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} color="var(--brand)" /> Suppliers
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {activeCount} active · {suppliers.length} total
          </p>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32, height: 36 }}
            placeholder="Search name, email, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={openAdd} style={{ height: 36 }}>
            <Plus size={14} /> Add Supplier
          </button>
        </div>
      </div>

      {/* ── Card grid ───────────────────────────────────────────────────────── */}
      <div className="suppliers-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--brand-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={22} style={{ color: 'var(--brand)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {search ? 'No suppliers match your search' : 'No suppliers yet'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {search ? 'Try different keywords' : 'Add a supplier to track purchase orders'}
              </p>
            </div>
            {!search && (
              <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Supplier</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))', gap: 14 }}>
            {filtered.map((s) => {
              const av  = palette(s.name);
              const pc  = purchaseCount[s.id] ?? 0;
              const pt  = purchaseTotal[s.id] ?? 0;
              const initials = s.name.slice(0, 2).toUpperCase();
              const rs  = ratingStats[s.id];
              return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--surface)', borderRadius: 14,
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
                >
                  {/* Card top: color band */}
                  <div style={{ height: 4, background: av.fg, opacity: 0.7 }} />

                  {/* Card body */}
                  <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Header: avatar + name + status */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: av.bg, color: av.fg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em',
                        border: `1px solid ${av.fg}22`,
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </p>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: s.status === 'active' ? 'var(--success-bg)' : 'var(--canvas)',
                          color: s.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)',
                          border: `1px solid ${s.status === 'active' ? 'var(--success-border)' : 'var(--border)'}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                          {s.status}
                        </span>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {s.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          <Mail size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          <Phone size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          {s.phone}
                        </div>
                      )}
                      {(s.city || s.country) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          <MapPin size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          {[s.city, s.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {s.taxId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                          <Building2 size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          {s.taxId}
                        </div>
                      )}
                    </div>

                    {/* Rating badge */}
                    {rs && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} size={12} fill={rs.avgOverall >= n ? '#F59E0B' : rs.avgOverall >= n - 0.5 ? '#F59E0B' : 'none'} color="#F59E0B" opacity={rs.avgOverall >= n ? 1 : 0.3} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#F59E0B' }}>{rs.avgOverall.toFixed(1)}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>· {rs.count} {rs.count === 1 ? 'rating' : 'ratings'}</span>
                        {rs.onTimePct !== undefined && <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 4 }}>· On-time: {rs.onTimePct}%</span>}
                      </div>
                    )}

                    {/* Stats footer */}
                    <div style={{
                      marginTop: 'auto', paddingTop: 12,
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        {pc > 0 ? (
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 1 }}>Purchase Orders</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: av.fg, fontVariantNumeric: 'tabular-nums' }}>{pc}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>orders · {formatCurrency(pt, sym)}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Package size={12} style={{ color: 'var(--text-tertiary)' }} />
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No orders yet</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setViewId(s.id)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', transition: 'all 0.12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-faint)'; e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', transition: 'all 0.12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-faint)'; e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', transition: 'all 0.12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--error-bg)'; e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {editing ? 'Save changes' : 'Add Supplier'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FormField label="Supplier name" error={errors.name} required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Reliance Industries Ltd." autoFocus />
            </FormField>
            <FormField label="Email" error={errors.email} required>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="procurement@supplier.in" />
            </FormField>
            <FormField label="Phone" error={errors.phone} required>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Tax ID / GST">
              <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="27AAPFU0939F1ZV" />
            </FormField>
            <FormField label="City">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" />
            </FormField>
            <FormField label="State" error={errors.state}>
              <Select value={form.state || ''} onChange={(e) => set('state', e.target.value)} error={!!errors.state}>
                <option value="">Select state…</option>
                {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Country">
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="India" />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Street address">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Plot 12, MIDC Industrial Area, Pune" />
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Lead times, payment terms, special handling…" />
          </FormField>
        </div>
      </Modal>

      {/* ── Supplier Detail Modal ─────────────────────────────────────────────── */}
      {viewId && (() => {
        const vs  = suppliers.find(s => s.id === viewId);
        const vrs = ratingStats[viewId];
        const vpsp = pspBySupplier[viewId] || [];
        if (!vs) return null;
        const av = palette(vs.name);
        return (
          <Modal open onClose={() => setViewId(null)} title={`${vs.name} — Details`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Rating summary */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Supplier Ratings</div>
                {!vrs ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>No ratings yet — rate this supplier when closing a Purchase Order.</div>
                ) : (
                  <>
                    {/* Summary row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                      {[
                        { label: 'Overall',       val: vrs.avgOverall },
                        { label: 'Delivery',      val: vrs.avgDelivery },
                        { label: 'Quality',       val: vrs.avgQuality },
                        { label: 'Pricing',       val: vrs.avgPricing },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                          {val != null ? (
                            <>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{val.toFixed(1)}</div>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={10} fill={val >= n ? '#F59E0B' : 'none'} color="#F59E0B" opacity={val >= n ? 1 : 0.25} />)}
                              </div>
                            </>
                          ) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>On-time delivery: <strong style={{ color: vrs.onTimePct >= 80 ? '#16A34A' : vrs.onTimePct >= 50 ? '#D97706' : '#DC2626' }}>{vrs.onTimePct}%</strong></div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Would buy again: <strong style={{ color: vrs.wouldBuyPct >= 70 ? '#16A34A' : '#D97706' }}>{vrs.wouldBuyPct}%</strong></div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Total ratings: <strong>{vrs.count}</strong></div>
                    </div>

                    {/* Rating history */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--canvas)', padding: '6px 12px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rating History</div>
                      {vrs.list.map((r, i) => (
                        <div key={r.id || i} style={{ padding: '9px 12px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(n => <Star key={n} size={11} fill={r.overallRating >= n ? '#F59E0B' : 'none'} color="#F59E0B" opacity={r.overallRating >= n ? 1 : 0.25} />)}
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#F59E0B' }}>{r.overallRating}/5</span>
                            {r.onTimeDelivery !== undefined && <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 20, background: r.onTimeDelivery ? '#F0FDF4' : '#FEF2F2', color: r.onTimeDelivery ? '#16A34A' : '#DC2626' }}>{r.onTimeDelivery ? 'On-time' : 'Late'}</span>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {r.notes && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 2, maxWidth: 240, textAlign: 'right' }}>{r.notes}</div>}
                            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{r.createdAt ? formatDateTime(r.createdAt) : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Supplied products */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Supplied Products</div>
                {vpsp.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No products recorded — purchase history updates automatically on each receipt.</div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 80px 70px', background: 'var(--canvas)', padding: '6px 12px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', gap: 8 }}>
                      <div>Product</div>
                      <div style={{ textAlign: 'right' }}>Last Price</div>
                      <div style={{ textAlign: 'right' }}>Avg Price</div>
                      <div style={{ textAlign: 'right' }}>Min</div>
                      <div style={{ textAlign: 'right' }}>Max</div>
                      <div style={{ textAlign: 'right' }}>Total Qty</div>
                    </div>
                    {vpsp.map((r, i) => {
                      const prod = products.find(p => p.id === r.productId);
                      return (
                        <div key={r.id || i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 80px 70px', padding: '8px 12px', gap: 8, borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{prod?.name || r.productId}</div>
                            {prod?.sku && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{prod.sku}</div>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(r.lastPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{formatCurrency(r.averagePurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#16A34A' }}>{formatCurrency(r.lowestPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#DC2626' }}>{formatCurrency(r.highestPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{r.totalPurchasedQuantity} {prod?.unit || ''}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteSupplier(deleteId)}
        message="Remove this supplier? Purchase history stays intact — only the contact record is deleted."
      />
    </div>
  );
}
