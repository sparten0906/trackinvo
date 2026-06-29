import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Menu, Bell, ChevronDown, LogOut, Settings,
  Search, X, Plus, Receipt, Package, ShoppingCart,
  LayoutDashboard, Tag, Truck, Users, FileText,
  BarChart3, RotateCcw, PackageX, GitCompareArrows, TrendingUp,
  PanelLeft, PanelLeftClose, ClipboardList, AlertTriangle,
} from 'lucide-react';
import AppIcon from '../icons/AppIcon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isLowStock, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

/* ── Live clock ───────────────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Clock() {
  const now = useClock();
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="hidden lg:flex" style={{ flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, userSelect: 'none' }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1.25 }}>
        {time}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 500, lineHeight: 1.25 }}>
        {date}
      </span>
    </div>
  );
}

const PAGE_META = {
  '/dashboard':          { label: 'Dashboard',        Icon: LayoutDashboard,  appIcon: 'dashboard',        color: '#4F46E5', bg: '#EEF2FF' },
  '/products':           { label: 'Products',          Icon: Package,          appIcon: 'products',         color: '#059669', bg: '#ECFDF5' },
  '/categories':         { label: 'Categories',        Icon: Tag,              appIcon: 'categories',       color: '#0D9488', bg: '#F0FDFA' },
  '/suppliers':          { label: 'Suppliers',          Icon: Truck,            appIcon: 'suppliers',        color: '#EA580C', bg: '#FFF7ED' },
  '/customers':          { label: 'Customers',          Icon: Users,            appIcon: 'customers',        color: '#0284C7', bg: '#F0F9FF' },
  '/billing':            { label: 'Billing / POS',     Icon: Receipt,          appIcon: 'billing',          color: '#7C3AED', bg: '#F5F3FF' },
  '/invoices':           { label: 'Invoices',           Icon: FileText,         appIcon: 'invoices',         color: '#D97706', bg: '#FFFBEB' },
  '/purchases':          { label: 'Purchases',          Icon: ShoppingCart,     appIcon: 'purchases',        color: '#0891B2', bg: '#ECFEFF' },
  '/reports':            { label: 'Reports',            Icon: BarChart3,        appIcon: 'reports',          color: '#4F46E5', bg: '#EEF2FF' },
  '/settings':           { label: 'Settings',           Icon: Settings,         appIcon: 'settings',         color: '#475569', bg: '#F1F5F9' },
  '/sales-returns':      { label: 'Sales Returns',      Icon: RotateCcw,        appIcon: 'sales-returns',    color: '#E11D48', bg: '#FFF1F2' },
  '/purchase-returns':   { label: 'Purchase Returns',   Icon: PackageX,         appIcon: 'purchase-returns', color: '#DC2626', bg: '#FEF2F2' },
  '/stock-transactions': { label: 'Stock Ledger',       Icon: GitCompareArrows, appIcon: 'stock-ledger',     color: '#0D9488', bg: '#F0FDFA' },
  '/stock-movement':     { label: 'Stock Movement',     Icon: TrendingUp,       appIcon: 'stock-movement',   color: '#0891B2', bg: '#ECFEFF' },
  '/purchase-orders':    { label: 'Purchase Orders',    Icon: ClipboardList,    appIcon: 'purchase-orders',  color: '#9333EA', bg: '#FAF5FF' },
  '/damaged-stock':      { label: 'Damaged Stock',      Icon: AlertTriangle,    appIcon: 'damaged-stock',    color: '#DC2626', bg: '#FEF2F2' },
};

const QUICK_ACTIONS = [
  { label: 'New Invoice',  Icon: Receipt,      to: '/billing',    color: 'var(--brand)' },
  { label: 'Add Product',  Icon: Package,      to: '/products',   color: 'var(--success)' },
  { label: 'New Purchase', Icon: ShoppingCart, to: '/purchase-orders',  color: 'var(--warning)' },
];

/* ── Inline search bar with live dropdown ─────────────────────────── */
function InlineSearch({ products, customers, invoices, settings }) {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);
  const navigate  = useNavigate();
  const sym = settings?.currencySymbol || '₹';

  /* Ctrl+K focuses the inline input */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Live search results */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const prods = (products || []).filter(p =>
      p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    ).slice(0, 4).map(p => ({
      type: 'product', id: p.id, label: p.name,
      sub: p.sku ? `SKU: ${p.sku}` : `Stock: ${p.stock ?? 0}`,
      extra: formatCurrency(p.sellingPrice || 0, sym),
      to: '/products', Icon: Package, iconBg: '#EEF2FF', iconColor: '#4F46E5',
    }));

    const custs = (customers || []).filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 3).map(c => ({
      type: 'customer', id: c.id, label: c.name,
      sub: c.phone || c.email || 'Customer',
      extra: null,
      to: '/customers', Icon: Users, iconBg: '#F0FDF4', iconColor: '#16A34A',
    }));

    const invs = (invoices || []).filter(i =>
      i.invoiceNumber?.toLowerCase().includes(q) || i.customerName?.toLowerCase().includes(q)
    ).slice(0, 3).map(i => ({
      type: 'invoice', id: i.id, label: i.invoiceNumber || 'Invoice',
      sub: i.customerName || '',
      extra: formatCurrency(i.grandTotal || 0, sym),
      to: '/invoices', Icon: FileText, iconBg: '#F5F3FF', iconColor: '#7C3AED',
    }));

    return [...prods, ...custs, ...invs];
  }, [query, products, customers, invoices, sym]);

  const showDropdown = focused && query.trim().length > 0;
  const isFocusedOrFilled = focused || query.length > 0;

  const pick = (to) => {
    setQuery('');
    setFocused(false);
    navigate(to);
  };

  return (
    <div ref={wrapRef} className="hidden lg:block" style={{ position: 'relative', flexShrink: 0 }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 34, padding: '0 10px 0 10px',
        background: isFocusedOrFilled ? 'var(--surface)' : 'var(--canvas)',
        border: `1.5px solid ${isFocusedOrFilled ? 'var(--brand)' : 'var(--border)'}`,
        borderRadius: 10,
        boxShadow: isFocusedOrFilled ? '0 0 0 3px var(--brand-faint)' : 'none',
        transition: 'all 0.15s',
        width: isFocusedOrFilled ? 260 : 210,
      }}>
        <Search size={13} style={{ color: isFocusedOrFilled ? 'var(--brand)' : 'var(--text-tertiary)', flexShrink: 0, transition: 'color 0.15s' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text-primary)',
            minWidth: 0,
          }}
        />
        {query ? (
          <button
            onMouseDown={e => { e.preventDefault(); setQuery(''); inputRef.current?.focus(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--text-tertiary)', borderRadius: 4, flexShrink: 0 }}
          >
            <X size={12} />
          </button>
        ) : (
          <kbd style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontFamily: 'monospace', fontWeight: 700, background: 'var(--border)', borderRadius: 4, padding: '1px 5px', flexShrink: 0, lineHeight: 1.6 }}>
            
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          width: 320, zIndex: 9999,
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}>
          {results && results.length > 0 ? (
            <div style={{ padding: '6px' }}>
              {results.map((r, i) => {
                const Icon = r.Icon;
                return (
                  <button
                    key={`${r.type}-${r.id || i}`}
                    onMouseDown={e => { e.preventDefault(); pick(r.to); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: r.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} style={{ color: r.iconColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</p>
                    </div>
                    {r.extra && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.extra}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Search size={18} style={{ color: 'var(--border)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No results for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════════════ */
export default function Header({ onMenuClick, collapsed, onToggle }) {
  const { state }   = useApp();
  const { user, logout } = useAuth();
  const { pathname }     = useLocation();
  const navigate         = useNavigate();

  const [userOpen,  setUserOpen]  = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  /* Positions for fixed-positioned dropdowns (viewport coords) */
  const [quickPos, setQuickPos] = useState({ top: 0, right: 0 });
  const [notifPos, setNotifPos] = useState({ top: 0, right: 0 });
  const [userPos,  setUserPos]  = useState({ top: 0, right: 0 });

  const userRef  = useRef(null);
  const quickRef = useRef(null);
  const notifRef = useRef(null);

  const lowStockItems = state.products.filter(isLowStock);
  const pageMeta      = PAGE_META[pathname] || { label: 'TrackInvo', Icon: LayoutDashboard };
  const PageIcon      = pageMeta.Icon;

  /* Helper: compute { top, right } for a fixed dropdown anchored to a ref */
  const fixedPos = (ref) => {
    if (!ref.current) return { top: 0, right: 0 };
    const r = ref.current.getBoundingClientRect();
    return { top: r.bottom + 6, right: window.innerWidth - r.right };
  };

  /* Toggle handlers — compute position before opening */
  const toggleQuick = () => {
    const willOpen = !quickOpen;
    if (willOpen) setQuickPos(fixedPos(quickRef));
    setQuickOpen(willOpen);
    setUserOpen(false);
    setNotifOpen(false);
  };
  const toggleNotif = () => {
    const willOpen = !notifOpen;
    if (willOpen) setNotifPos(fixedPos(notifRef));
    setNotifOpen(willOpen);
    setUserOpen(false);
    setQuickOpen(false);
  };
  const toggleUser = () => {
    const willOpen = !userOpen;
    if (willOpen) setUserPos(fixedPos(userRef));
    setUserOpen(willOpen);
    setQuickOpen(false);
    setNotifOpen(false);
  };

  /* Close each dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (quickRef.current && !quickRef.current.contains(e.target)) setQuickOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setUserOpen(false);
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const closeAll = () => { setUserOpen(false); setQuickOpen(false); setNotifOpen(false); };

  const iconBtn = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 9, border: 'none',
    background: active ? 'var(--canvas)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.13s', flexShrink: 0,
    position: 'relative',
  });

  return (
    <header style={{
      height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6,
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 40,
    }}>

      {/* ── Left: toggle + page title ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        {/* Mobile hamburger — only on small screens */}
        <button onClick={onMenuClick} className="flex lg:hidden"
          style={{ ...iconBtn(false), display: undefined }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Menu size={17} />
        </button>

        {/* Desktop sidebar toggle — only on large screens */}
        <button onClick={onToggle} className="hidden lg:flex items-center justify-center"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ ...iconBtn(false), display: undefined }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <div className="hidden lg:block" style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Page title — desktop */}
        <div className="hidden lg:flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          {pageMeta.appIcon
            ? <AppIcon name={pageMeta.appIcon} size={24} />
            : (
              <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: pageMeta.bg || 'var(--brand-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PageIcon size={13} style={{ color: pageMeta.color || 'var(--brand)' }} />
              </div>
            )
          }
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {pageMeta.label}
          </span>
        </div>

        {/* Page title — mobile */}
        <span className="lg:hidden" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {pageMeta.label}
        </span>
      </div>

      {/* ── Spacer ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Right: inline search + clock + actions + user ────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Inline search — desktop */}
        <InlineSearch
          products={state.products}
          customers={state.customers}
          invoices={state.invoices}
          settings={state.settings}
        />

        {/* Live clock — desktop */}
        <div className="hidden lg:block" style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
        <Clock />
        <div className="hidden lg:block" style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Quick add */}
        <div ref={quickRef} style={{ position: 'relative' }}>
          <button
            onClick={toggleQuick}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px',
              background: quickOpen ? 'var(--brand-hover)' : 'var(--brand)',
              color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
              transition: 'all 0.13s', flexShrink: 0,
              boxShadow: '0 1px 4px rgba(79,70,229,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = quickOpen ? 'var(--brand-hover)' : 'var(--brand)'; }}
          >
            <Plus size={14} strokeWidth={2.5} /> New
          </button>
          {quickOpen && (
            <div style={{ position: 'fixed', top: quickPos.top, right: quickPos.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 200, zIndex: 9999, padding: '5px' }}>
              {QUICK_ACTIONS.map(({ label, Icon, to, color }) => (
                <button key={to} onClick={() => { closeAll(); navigate(to); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: 'transparent', border: 'none', fontSize: 13.5, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={toggleNotif}
            style={iconBtn(notifOpen)}
            onMouseEnter={e => { if (!notifOpen) { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
            onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
          >
            <Bell size={17} />
            {lowStockItems.length > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--error)', border: '1.5px solid var(--surface)' }} />
            )}
          </button>
          {notifOpen && (
            <div style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 300, zIndex: 9999 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</p>
                {lowStockItems.length > 0 && <span className="badge badge-error">{lowStockItems.length} alerts</span>}
              </div>
              {lowStockItems.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <Bell size={22} style={{ color: 'var(--border)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>All clear, no alerts</p>
                </div>
              ) : (
                <div>
                  {lowStockItems.slice(0, 5).map(p => (
                    <div key={p.id} onClick={() => { navigate('/products'); closeAll(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--canvas)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: p.stock === 0 ? 'var(--error-bg)' : 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={13} style={{ color: p.stock === 0 ? 'var(--error)' : 'var(--warning)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p style={{ fontSize: 11.5, color: p.stock === 0 ? 'var(--error)' : 'var(--warning)', fontWeight: 500 }}>
                          {p.stock === 0 ? 'Out of stock' : `Low stock · ${p.stock} remaining`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length > 5 && (
                    <button onClick={() => { navigate('/products'); closeAll(); }}
                      style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', fontSize: 13, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>
                      View all {lowStockItems.length} alerts →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

        {/* User menu */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            onClick={toggleUser}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 36,
              padding: '0 10px 0 6px',
              background: userOpen ? 'var(--canvas)' : 'transparent',
              border: `1px solid ${userOpen ? 'var(--border)' : 'transparent'}`,
              borderRadius: 10, cursor: 'pointer', transition: 'all 0.13s',
            }}
            onMouseEnter={e => { if (!userOpen) { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
            onMouseLeave={e => { if (!userOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12.5, fontWeight: 800, color: '#fff',
              boxShadow: '0 0 0 2px #fff, 0 0 0 3.5px rgba(99,102,241,0.4)',
              letterSpacing: '-0.01em',
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {/* Name + role */}
            <div className="hidden sm:block" style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                {user?.name || 'Admin'}
              </p>
              <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', lineHeight: 1.2, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                {user?.role || 'Administrator'}
              </p>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', transform: userOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} className="hidden sm:block" />
          </button>

          {userOpen && (
            <div style={{
              position: 'fixed', top: userPos.top, right: userPos.right,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
              width: 232, zIndex: 9999, overflow: 'hidden',
            }}>
              {/* Profile header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-subtle)', background: 'var(--canvas)' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: '#fff',
                  boxShadow: '0 0 0 2.5px rgba(99,102,241,0.25)',
                }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'Admin User'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                    {user?.email || '—'}
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: 4, padding: '1px 7px',
                    background: 'var(--brand-faint)', color: 'var(--brand)',
                    fontSize: 10, fontWeight: 700, borderRadius: 20,
                    textTransform: 'capitalize', letterSpacing: '0.02em',
                  }}>
                    {user?.role || 'Administrator'}
                  </span>
                </div>
              </div>
              {/* Actions */}
              <div style={{ padding: '6px' }}>
                {[
                  { Icon: Settings, label: 'Settings', action: () => { closeAll(); navigate('/settings'); }, danger: false },
                  { Icon: LogOut,   label: 'Sign out',  action: handleLogout, danger: true },
                ].map(({ Icon, label, action, danger }) => (
                  <button key={label} onClick={action}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 8,
                      background: 'transparent', border: 'none',
                      fontSize: 13.5, fontWeight: 500,
                      color: danger ? 'var(--error)' : 'var(--text-secondary)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = danger ? 'var(--error-bg)' : 'var(--canvas)'; e.currentTarget.style.color = danger ? 'var(--error)' : 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? 'var(--error)' : 'var(--text-secondary)'; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: danger ? 'var(--error-bg)' : 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} style={{ color: 'inherit' }} />
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
