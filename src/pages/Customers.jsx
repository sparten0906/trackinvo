import React, { useState, useMemo } from 'react';
import {
  Plus, Search, Users, TrendingUp, AlertTriangle, UserCheck,
  LayoutGrid, List, X, Phone, Mail, MapPin, FileText,
  Edit2, Trash2, Receipt, Clock, ChevronRight, DollarSign,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { searchFilter, validateCustomer, formatCurrency, formatDate, formatDateTime, formatDateTimeSplit } from '../utils/helpers';
import toast from 'react-hot-toast';

/* ── Avatar ─────────────────────────────────────────────────────────── */
const PALETTE = [
  { bg: '#EEF2FF', fg: '#4F46E5' }, { bg: '#F5F3FF', fg: '#7C3AED' },
  { bg: '#ECFDF5', fg: '#059669' }, { bg: '#FFFBEB', fg: '#D97706' },
  { bg: '#FEF2F2', fg: '#DC2626' }, { bg: '#F0F9FF', fg: '#0284C7' },
  { bg: '#FDF4FF', fg: '#9333EA' }, { bg: '#F0FDF4', fg: '#16A34A' },
];

function Av({ name = '?', size = 40 }) {
  const { bg, fg } = PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: fg, flexShrink: 0, userSelect: 'none' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatusPill({ status }) {
  const ok = status === 'active';
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ok ? '#F0FDF4' : '#F4F4F5', color: ok ? '#16A34A' : '#71717A', border: `1px solid ${ok ? '#BBF7D0' : '#E4E4E7'}` }}>
      {ok ? 'Active' : 'Inactive'}
    </span>
  );
}

function PayBadge({ status }) {
  const cfg = { paid: ['#F0FDF4','#16A34A'], partial: ['#FEFCE8','#CA8A04'], unpaid: ['#FEF2F2','#DC2626'] };
  const [bg, fg] = cfg[status] || cfg.unpaid;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: bg, color: fg }}>{status}</span>;
}

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', country: 'India', taxId: '', notes: '', status: 'active' };

/* ── Customer Card ────────────────────────────────────────────────────── */
function CustomerCard({ c, stats, sym, isSelected, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onSelect(c.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', borderRadius: 16, padding: '18px 20px',
        border: `1.5px solid ${isSelected ? 'var(--brand)' : hov ? 'var(--brand-light)' : 'var(--border)'}`,
        boxShadow: isSelected ? '0 0 0 3px var(--brand-faint)' : hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: 'pointer', transition: 'all 0.15s var(--ease)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Av name={c.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <StatusPill status={c.status} />
            {c.city && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {c.city}</span>}
          </div>
        </div>
        {stats.outstanding > 0 && (
          <div style={{ flexShrink: 0, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '3px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 11.5, fontWeight: 800, color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stats.outstanding, sym)}</p>
            <p style={{ fontSize: 9.5, color: '#DC2626', fontWeight: 600 }}>due</p>
          </div>
        )}
      </div>

      {(c.phone || c.email) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.phone}</span></div>}
          {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span></div>}
        </div>
      )}

      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatCurrency(stats.total, sym)}</p>
          <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 3 }}>Total Spend</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{stats.count}</p>
          <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 3 }}>Invoices</p>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: stats.lastDate ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: 500, lineHeight: 1, marginTop: 2 }}>{stats.lastDate ? formatDate(stats.lastDate) : '—'}</p>
          <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 3 }}>Last Invoice</p>
        </div>
      </div>
    </div>
  );
}

/* ── Customer Row (list view) ─────────────────────────────────────────── */
function CustomerRow({ c, stats, sym, isSelected, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onSelect(c.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 9, cursor: 'pointer', transition: 'background 0.12s', background: isSelected ? 'var(--brand-faint)' : hov ? 'var(--canvas)' : 'transparent' }}
    >
      <Av name={c.name} size={32} />
      <div style={{ flex: 2, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.phone || c.email || '—'}</p>
      </div>
      <StatusPill status={c.status} />
      <div style={{ flex: 1, textAlign: 'right' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stats.total, sym)}</p>
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        {stats.outstanding > 0
          ? <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stats.outstanding, sym)}</p>
          : <p style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ Cleared</p>}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', width: 88, textAlign: 'right', flexShrink: 0 }}>{stats.lastDate ? formatDate(stats.lastDate) : '—'}</p>
      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const { customers, invoices, settings } = state;
  const sym = settings.currencySymbol || '₹';
  const navigate = useNavigate();

  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [viewMode, setViewMode]   = useState('grid');
  const [selectedId, setSelected] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [errors, setErrors]       = useState({});
  const [deleteId, setDeleteId]   = useState(null);

  /* ── Per-customer stats ── */
  const custStats = useMemo(() => {
    const map = {};
    customers.forEach(c => { map[c.id] = { total: 0, outstanding: 0, count: 0, lastDate: '' }; });
    invoices.forEach(inv => {
      if (!map[inv.customerId]) return;
      map[inv.customerId].total       += inv.grandTotal    || 0;
      map[inv.customerId].outstanding += inv.balanceAmount || 0;
      map[inv.customerId].count++;
      if (inv.date > (map[inv.customerId].lastDate || '')) map[inv.customerId].lastDate = inv.date;
    });
    return map;
  }, [customers, invoices]);

  /* ── KPI ── */
  const thisMonth        = new Date().toISOString().slice(0, 7);
  const totalCustomers   = customers.length;
  const activeCustomers  = customers.filter(c => c.status === 'active').length;
  const newThisMonth     = customers.filter(c => (c.createdAt || '').startsWith(thisMonth)).length;
  const totalOutstanding = Object.values(custStats).reduce((s, v) => s + v.outstanding, 0);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = [...customers];
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (search) list = searchFilter(list, search, ['name', 'email', 'phone', 'city']);
    return list.sort((a, b) => (custStats[b.id]?.total || 0) - (custStats[a.id]?.total || 0));
  }, [customers, search, statusFilter, custStats]);

  /* ── Selected ── */
  const selCustomer = customers.find(c => c.id === selectedId) || null;
  const selInvoices = invoices.filter(inv => inv.customerId === selectedId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const selStats    = selCustomer ? (custStats[selCustomer.id] || { total: 0, outstanding: 0, count: 0 }) : null;

  const timeline = selCustomer ? selInvoices.flatMap(inv => [
    { date: inv.date, label: `Invoice ${inv.invoiceNumber} created`, amount: inv.grandTotal, kind: 'invoice', status: inv.paymentStatus },
    ...(inv.paymentStatus === 'paid' ? [{ date: inv.date, label: 'Payment received in full', amount: inv.grandTotal, kind: 'payment' }] : []),
  ]).slice(0, 12) : [];

  /* ── CRUD ── */
  const openAdd  = () => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); };
  const openEdit = c  => { setForm({ ...c }); setEditing(c); setErrors({}); setModal(true); };
  const set      = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    const errs = validateCustomer(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      if (editing) { await updateCustomer(editing.id, form); toast.success('Customer updated'); }
      else         { await addCustomer(form);                toast.success('Customer added');   }
      setModal(false);
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(deleteId);
      if (selectedId === deleteId) setSelected(null);
      toast.success('Customer deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  const handleSelect = id => {
    setSelected(prev => prev === id ? null : id);
    setDrawerTab('overview');
  };

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }}>

      {/* Top panel */}
      <div style={{ flexShrink: 0, padding: '20px 24px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} color="var(--brand)" /> Customers</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{totalCustomers} total · {activeCustomers} active</p>
          </div>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.5} /> Add Customer
          </button>
        </div>

        {/* KPI strip */}
        <div className="kpi-strip" style={{ marginBottom: 16 }}>
          {[
            { icon: Users,         label: 'Total Customers', value: totalCustomers,                      bg: '#EEF2FF', fg: '#4F46E5' },
            { icon: UserCheck,     label: 'Active',          value: activeCustomers,                     bg: '#F0FDF4', fg: '#16A34A' },
            { icon: TrendingUp,    label: 'New This Month',  value: newThisMonth,                        bg: '#F5F3FF', fg: '#7C3AED' },
            { icon: AlertTriangle, label: 'Outstanding',     value: formatCurrency(totalOutstanding, sym), bg: totalOutstanding > 0 ? '#FEFCE8' : '#F0FDF4', fg: totalOutstanding > 0 ? '#CA8A04' : '#16A34A' },
          ].map(({ icon: Icon, label, value, bg, fg }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--canvas)', borderRadius: 11, border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: fg }} strokeWidth={1.75} />
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
              style={{ width: '100%', height: 34, paddingLeft: 30, paddingRight: 10, border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--canvas)', outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)' }}
              onFocus={e => e.target.style.borderColor = 'var(--brand)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          {['all','active','inactive'].map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, transition: 'all 0.12s', background: statusFilter === s ? 'var(--brand)' : 'transparent', color: statusFilter === s ? '#fff' : 'var(--text-secondary)', borderColor: statusFilter === s ? 'var(--brand)' : 'var(--border)' }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[[LayoutGrid,'grid'],[List,'list']].map(([Icon, mode]) => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: viewMode === mode ? 'var(--brand)' : 'transparent', color: viewMode === mode ? '#fff' : 'var(--text-tertiary)', transition: 'all 0.12s' }}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Customer grid / list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 48px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <Users size={40} style={{ color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No customers found</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first customer to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <button onClick={openAdd} style={{ marginTop: 16, height: 36, padding: '0 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  + Add Customer
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 14 }}>
              {filtered.map(c => (
                <CustomerCard key={c.id} c={c} stats={custStats[c.id] || { total:0,outstanding:0,count:0,lastDate:'' }} sym={sym} isSelected={selectedId === c.id} onSelect={handleSelect} />
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 8px 60px', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Customer','Status','Total Spend','Outstanding','Last Invoice'].map(label => (
                  <p key={label} style={{ flex: label === 'Customer' ? 2 : 1, fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: label === 'Customer' ? 'left' : 'right' }}>{label}</p>
                ))}
                <div style={{ width: 22 }} />
              </div>
              <div style={{ padding: '6px' }}>
                {filtered.map(c => (
                  <CustomerRow key={c.id} c={c} stats={custStats[c.id] || { total:0,outstanding:0,count:0,lastDate:'' }} sym={sym} isSelected={selectedId === c.id} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {selCustomer && (
          <div className="cust-detail-drawer" style={{ width: 420, flexShrink: 0, borderLeft: '1.5px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Drawer header */}
            <div style={{ padding: '18px 20px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <Av name={selCustomer.name} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, letterSpacing: '-0.02em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selCustomer.name}</p>
                    <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0, marginLeft: 6 }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <StatusPill status={selCustomer.status} />
                    {selCustomer.city && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{selCustomer.city}</span>}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <button onClick={() => navigate('/billing')} style={{ display:'flex',alignItems:'center',gap:5,height:30,padding:'0 11px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>
                  <Receipt size={12}/> New Invoice
                </button>
                <button onClick={() => openEdit(selCustomer)} style={{ display:'flex',alignItems:'center',gap:5,height:30,padding:'0 11px',background:'var(--canvas)',color:'var(--text-secondary)',border:'1.5px solid var(--border)',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>
                  <Edit2 size={12}/> Edit
                </button>
                {selCustomer.phone && <a href={`tel:${selCustomer.phone}`} style={{ display:'flex',alignItems:'center',gap:5,height:30,padding:'0 11px',background:'var(--canvas)',color:'var(--text-secondary)',border:'1.5px solid var(--border)',borderRadius:7,textDecoration:'none',fontSize:12,fontWeight:600 }}><Phone size={12}/> Call</a>}
                {selCustomer.email && <a href={`mailto:${selCustomer.email}`} style={{ display:'flex',alignItems:'center',gap:5,height:30,padding:'0 11px',background:'var(--canvas)',color:'var(--text-secondary)',border:'1.5px solid var(--border)',borderRadius:7,textDecoration:'none',fontSize:12,fontWeight:600 }}><Mail size={12}/> Email</a>}
                <button onClick={() => setDeleteId(selCustomer.id)} style={{ display:'flex',alignItems:'center',gap:5,height:30,padding:'0 11px',background:'#FEF2F2',color:'#DC2626',border:'1.5px solid #FECACA',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>
                  <Trash2 size={12}/>
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex' }}>
                {[['overview','Overview'],['invoices','Invoices'],['timeline','Timeline']].map(([tab, label]) => (
                  <button key={tab} onClick={() => setDrawerTab(tab)} style={{ padding:'8px 14px',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:drawerTab===tab?700:500,color:drawerTab===tab?'var(--brand)':'var(--text-tertiary)',borderBottom:`2px solid ${drawerTab===tab?'var(--brand)':'transparent'}`,marginBottom:-1,transition:'all 0.12s' }}>
                    {label}
                    {tab === 'invoices' && selInvoices.length > 0 && (
                      <span style={{ marginLeft:5,fontSize:10,background:'var(--brand-faint)',color:'var(--brand)',borderRadius:10,padding:'1px 5px',fontWeight:700 }}>{selInvoices.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>

              {/* OVERVIEW */}
              {drawerTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Total Spend',  value: formatCurrency(selStats.total, sym),        color: 'var(--text-primary)' },
                      { label: 'Outstanding',  value: formatCurrency(selStats.outstanding, sym),  color: selStats.outstanding > 0 ? '#DC2626' : '#16A34A' },
                      { label: 'Invoices',     value: selStats.count,                             color: 'var(--text-primary)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background:'var(--canvas)',borderRadius:10,padding:'12px',textAlign:'center',border:'1px solid var(--border-subtle)' }}>
                        <p style={{ fontSize:17,fontWeight:900,color,fontVariantNumeric:'tabular-nums',lineHeight:1 }}>{value}</p>
                        <p style={{ fontSize:10.5,color:'var(--text-tertiary)',fontWeight:600,marginTop:4 }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {(selCustomer.phone || selCustomer.email || selCustomer.address) && (
                    <div style={{ background:'var(--canvas)',borderRadius:10,padding:'14px',border:'1px solid var(--border-subtle)' }}>
                      <p style={{ fontSize:10.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10 }}>Contact Details</p>
                      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                        {selCustomer.phone && <div style={{ display:'flex',alignItems:'center',gap:8 }}><Phone size={13} style={{ color:'var(--text-tertiary)',flexShrink:0 }}/><span style={{ fontSize:13,color:'var(--text-secondary)' }}>{selCustomer.phone}</span></div>}
                        {selCustomer.email && <div style={{ display:'flex',alignItems:'center',gap:8 }}><Mail size={13} style={{ color:'var(--text-tertiary)',flexShrink:0 }}/><span style={{ fontSize:13,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{selCustomer.email}</span></div>}
                        {selCustomer.address && <div style={{ display:'flex',alignItems:'flex-start',gap:8 }}><MapPin size={13} style={{ color:'var(--text-tertiary)',flexShrink:0,marginTop:2 }}/><span style={{ fontSize:13,color:'var(--text-secondary)',lineHeight:1.5 }}>{[selCustomer.address,selCustomer.city,selCustomer.country].filter(Boolean).join(', ')}</span></div>}
                      </div>
                    </div>
                  )}

                  {selCustomer.notes && (
                    <div style={{ background:'#FEFCE8',borderRadius:10,padding:'12px 14px',border:'1px solid #FEF08A' }}>
                      <p style={{ fontSize:10.5,fontWeight:700,color:'#A16207',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Notes</p>
                      <p style={{ fontSize:13,color:'var(--text-secondary)',lineHeight:1.6 }}>{selCustomer.notes}</p>
                    </div>
                  )}

                  {selInvoices.slice(0,3).length > 0 && (
                    <div>
                      <p style={{ fontSize:10.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Recent Invoices</p>
                      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                        {selInvoices.slice(0,3).map(inv => (
                          <div key={inv.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--canvas)',borderRadius:9,border:'1px solid var(--border-subtle)' }}>
                            <FileText size={13} style={{ color:'var(--brand)',flexShrink:0 }}/>
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ fontSize:12.5,fontWeight:600,color:'var(--text-primary)',fontFamily:'monospace' }}>{inv.invoiceNumber}</p>
                              <p style={{ fontSize:11,color:'var(--text-tertiary)' }}>{formatDate(inv.date)}</p>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',fontVariantNumeric:'tabular-nums' }}>{formatCurrency(inv.grandTotal||0,sym)}</p>
                              <PayBadge status={inv.paymentStatus}/>
                            </div>
                          </div>
                        ))}
                        {selInvoices.length > 3 && (
                          <button onClick={() => setDrawerTab('invoices')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12.5,color:'var(--brand)',fontWeight:600,textAlign:'left',padding:'4px 2px' }}>
                            View all {selInvoices.length} invoices →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* INVOICES TAB */}
              {drawerTab === 'invoices' && (
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {selInvoices.length === 0 ? (
                    <div style={{ textAlign:'center',padding:'40px 0' }}>
                      <FileText size={32} style={{ color:'var(--border)',margin:'0 auto 8px' }}/>
                      <p style={{ fontSize:13,color:'var(--text-tertiary)' }}>No invoices yet</p>
                    </div>
                  ) : selInvoices.map(inv => (
                    <div key={inv.id} style={{ padding:'12px 14px',background:'var(--canvas)',borderRadius:10,border:'1px solid var(--border-subtle)' }}>
                      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                        <div>
                          <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',fontFamily:'monospace' }}>{inv.invoiceNumber}</p>
                          <p style={{ fontSize:11.5,color:'var(--text-tertiary)',marginTop:2 }}>{formatDate(inv.date)}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontSize:14,fontWeight:800,color:'var(--text-primary)',fontVariantNumeric:'tabular-nums' }}>{formatCurrency(inv.grandTotal||0,sym)}</p>
                          {inv.balanceAmount > 0 && <p style={{ fontSize:11,color:'#DC2626',fontWeight:600 }}>{formatCurrency(inv.balanceAmount,sym)} due</p>}
                        </div>
                      </div>
                      <div style={{ marginTop:8 }}><PayBadge status={inv.paymentStatus}/></div>
                    </div>
                  ))}
                </div>
              )}

              {/* TIMELINE TAB */}
              {drawerTab === 'timeline' && (
                <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
                  {timeline.length === 0 ? (
                    <div style={{ textAlign:'center',padding:'40px 0' }}>
                      <Clock size={32} style={{ color:'var(--border)',margin:'0 auto 8px' }}/>
                      <p style={{ fontSize:13,color:'var(--text-tertiary)' }}>No activity yet</p>
                    </div>
                  ) : timeline.map((ev, i) => (
                    <div key={i} style={{ display:'flex',gap:12,paddingBottom:i<timeline.length-1?16:0,position:'relative' }}>
                      {i < timeline.length-1 && <div style={{ position:'absolute',left:14,top:28,bottom:0,width:1,background:'var(--border)' }}/>}
                      <div style={{ width:28,height:28,borderRadius:'50%',background:ev.kind==='payment'?'#F0FDF4':'var(--brand-faint)',border:`1.5px solid ${ev.kind==='payment'?'#BBF7D0':'var(--brand-light)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1 }}>
                        {ev.kind === 'payment' ? <DollarSign size={11} style={{ color:'#16A34A' }}/> : <FileText size={11} style={{ color:'var(--brand)' }}/>}
                      </div>
                      <div style={{ flex:1,paddingTop:3 }}>
                        <p style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{ev.label}</p>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:2 }}>
                          <p style={{ fontSize:11.5,color:'var(--text-tertiary)' }}>{formatDate(ev.date)}</p>
                          {ev.amount != null && <p style={{ fontSize:12,fontWeight:700,color:'var(--text-secondary)',fontVariantNumeric:'tabular-nums' }}>{formatCurrency(ev.amount,sym)}</p>}
                          {ev.status && <PayBadge status={ev.status}/>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Full Name *" error={errors.name}>
              <Input value={form.name} onChange={e => set('name',e.target.value)} placeholder="Full name" className={errors.name?'input-error':''}/>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => set('status',e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Phone" error={errors.phone}>
              <Input value={form.phone} onChange={e => set('phone',e.target.value)} placeholder="Mobile number" className={errors.phone?'input-error':''}/>
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="Email address" className={errors.email?'input-error':''}/>
            </FormField>
          </div>
          <FormField label="Address">
            <Input value={form.address} onChange={e => set('address',e.target.value)} placeholder="Street address"/>
          </FormField>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="City">
              <Input value={form.city} onChange={e => set('city',e.target.value)} placeholder="City"/>
            </FormField>
            <FormField label="Country">
              <Input value={form.country} onChange={e => set('country',e.target.value)} placeholder="Country"/>
            </FormField>
          </div>
          <FormField label="GST / Tax ID">
            <Input value={form.taxId} onChange={e => set('taxId',e.target.value)} placeholder="GSTIN (optional)"/>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => set('notes',e.target.value)} placeholder="Internal notes…" rows={3}/>
          </FormField>
        </div>
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:20,paddingTop:16,borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={() => setModal(false)} style={{ height:36,padding:'0 16px',background:'var(--canvas)',border:'1.5px solid var(--border)',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} style={{ height:36,padding:'0 20px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600 }}>
            {editing ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Customer" message="This will permanently delete this customer. Their invoice history will remain." confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
    </div>
  );
}
