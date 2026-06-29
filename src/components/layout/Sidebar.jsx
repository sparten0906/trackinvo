import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, Users, Receipt,
  FileText, BarChart3, Settings,
  RotateCcw, PackageX, GitCompareArrows, TrendingUp,
  Boxes, ClipboardList, AlertTriangle, Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isLowStock } from '../../utils/helpers';
import AppIcon from '../icons/AppIcon';

/* ── Module color accents for dark sidebar ────────────────────── */
const DARK_COLORS = {
  indigo:  { activeBg: 'rgba(129,140,248,0.18)', hoverBg: 'rgba(129,140,248,0.08)', iconColor: '#818CF8', barColor: '#818CF8' },
  emerald: { activeBg: 'rgba(52,211,153,0.18)',  hoverBg: 'rgba(52,211,153,0.08)',  iconColor: '#34D399', barColor: '#34D399' },
  teal:    { activeBg: 'rgba(45,212,191,0.18)',  hoverBg: 'rgba(45,212,191,0.08)',  iconColor: '#2DD4BF', barColor: '#2DD4BF' },
  violet:  { activeBg: 'rgba(167,139,250,0.18)', hoverBg: 'rgba(167,139,250,0.08)', iconColor: '#A78BFA', barColor: '#A78BFA' },
  amber:   { activeBg: 'rgba(251,191,36,0.18)',  hoverBg: 'rgba(251,191,36,0.08)',  iconColor: '#FBBF24', barColor: '#FBBF24' },
  sky:     { activeBg: 'rgba(56,189,248,0.18)',  hoverBg: 'rgba(56,189,248,0.08)',  iconColor: '#38BDF8', barColor: '#38BDF8' },
  orange:  { activeBg: 'rgba(251,146,60,0.18)',  hoverBg: 'rgba(251,146,60,0.08)',  iconColor: '#FB923C', barColor: '#FB923C' },
  purple:  { activeBg: 'rgba(192,132,252,0.18)', hoverBg: 'rgba(192,132,252,0.08)', iconColor: '#C084FC', barColor: '#C084FC' },
  cyan:    { activeBg: 'rgba(34,211,238,0.18)',  hoverBg: 'rgba(34,211,238,0.08)',  iconColor: '#22D3EE', barColor: '#22D3EE' },
  rose:    { activeBg: 'rgba(251,113,133,0.18)', hoverBg: 'rgba(251,113,133,0.08)', iconColor: '#FB7185', barColor: '#FB7185' },
  red:     { activeBg: 'rgba(248,113,113,0.18)', hoverBg: 'rgba(248,113,113,0.08)', iconColor: '#F87171', barColor: '#F87171' },
  slate:   { activeBg: 'rgba(148,163,184,0.18)', hoverBg: 'rgba(148,163,184,0.08)', iconColor: '#94A3B8', barColor: '#94A3B8' },
};

/* ── Nav data ─────────────────────────────────────────────────── */
const NAV = [
  {
    group: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, appIcon: 'dashboard', label: 'Dashboard', color: 'indigo' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { to: '/products',   icon: Package, appIcon: 'products',   label: 'Products',   color: 'emerald' },
      { to: '/categories', icon: Tag,     appIcon: 'categories', label: 'Categories', color: 'teal'    },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/suppliers', icon: Truck, appIcon: 'suppliers', label: 'Suppliers', color: 'orange' },
      { to: '/customers', icon: Users, appIcon: 'customers', label: 'Customers', color: 'sky'    },
    ],
  },
  {
    group: 'Transactions',
    items: [
      { to: '/billing',         icon: Receipt,       appIcon: 'billing',         label: 'Billing / POS',  color: 'violet' },
      { to: '/invoices',        icon: FileText,      appIcon: 'invoices',        label: 'Invoices',        color: 'amber'  },
      { to: '/purchase-orders',    icon: ClipboardList, appIcon: 'purchase-orders',    label: 'Purchase Orders', color: 'purple' },
      { to: '/supplier-payments', icon: Wallet,        appIcon: 'supplier-payments', label: 'Payables',        color: 'amber'  },
    ],
  },
  {
    group: 'Returns',
    items: [
      { to: '/sales-returns',    icon: RotateCcw, appIcon: 'sales-returns',    label: 'Sales Returns',    color: 'rose' },
      { to: '/purchase-returns', icon: PackageX,  appIcon: 'purchase-returns', label: 'Purchase Returns', color: 'red'  },
    ],
  },
  {
    group: 'Stock',
    items: [
      { to: '/stock-transactions', icon: GitCompareArrows, appIcon: 'stock-ledger',   label: 'Ledger',        color: 'teal'  },
      { to: '/stock-movement',     icon: TrendingUp,       appIcon: 'stock-movement', label: 'Movement',      color: 'cyan'  },
      { to: '/damaged-stock',      icon: AlertTriangle,    appIcon: 'damaged-stock',  label: 'Damaged Stock', color: 'red'   },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { to: '/reports', icon: BarChart3, appIcon: 'reports', label: 'Reports', color: 'indigo' },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/settings', icon: Settings, appIcon: 'settings', label: 'Settings', color: 'slate' },
    ],
  },
];

/* ── NavItem ──────────────────────────────────────────────────── */
function NavItem({ to, icon: Icon, appIcon, label, color = 'indigo', collapsed, onClick, badge }) {
  const [hovered, setHovered] = useState(false);
  const c = DARK_COLORS[color] || DARK_COLORS.indigo;
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '0' : '0 10px',
        height: 36,
        borderRadius: 8,
        margin: '1px 0',
        color: isActive ? '#FAFAFA'
             : hovered   ? '#D4D4D8'
             : 'var(--sidebar-text)',
        background: isActive ? c.activeBg
                  : hovered  ? c.hoverBg
                  : 'transparent',
        textDecoration: 'none',
        fontSize: 13.5,
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.13s ease-out',
        position: 'relative',
        justifyContent: collapsed ? 'center' : 'flex-start',
        overflow: 'visible',
        whiteSpace: 'nowrap',
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {({ isActive }) => (
        <>
          {/* Module-color active bar */}
          {isActive && !collapsed && (
            <span style={{
              position: 'absolute', left: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 3, height: '60%', borderRadius: 2,
              background: c.barColor, flexShrink: 0,
            }} />
          )}

          {/* Icon — AppIcon if available, else lucide fallback */}
          <div style={{
            position: 'relative', flexShrink: 0,
            width: 26, height: 26, borderRadius: 7,
            background: isActive ? `rgba(255,255,255,0.1)` : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.13s',
            opacity: isActive ? 1 : hovered ? 0.88 : 0.65,
          }}>
            {appIcon
              ? <AppIcon name={appIcon} size={20} />
              : (
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.2 : 1.75}
                  style={{ color: isActive ? c.iconColor : hovered ? '#D4D4D8' : 'var(--sidebar-text)', display: 'block' }}
                />
              )
            }
            {/* Badge dot on icon when collapsed */}
            {collapsed && badge > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                width: 7, height: 7, borderRadius: '50%',
                background: '#EAB308', border: '1.5px solid var(--sidebar-bg)',
              }}/>
            )}
          </div>

          {!collapsed && <span style={{ flex: 1 }}>{label}</span>}

          {/* Badge count when expanded */}
          {!collapsed && badge > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 800, lineHeight: 1,
              padding: '2px 6px', borderRadius: 10,
              background: 'rgba(234,179,8,0.18)',
              color: '#EAB308',
              border: '1px solid rgba(234,179,8,0.3)',
              flexShrink: 0,
            }}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}

          {/* Collapsed tooltip */}
          {collapsed && hovered && (
            <div style={{
              position: 'absolute', left: 52, top: '50%', transform: 'translateY(-50%)',
              background: '#27272A', color: '#FAFAFA',
              fontSize: 12.5, fontWeight: 600, padding: '5px 10px',
              borderRadius: 7, whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 9999, pointerEvents: 'none',
            }}>
              {label}{badge > 0 ? ` (${badge} low stock)` : ''}
              <span style={{
                position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
                width: 7, height: 7, background: '#27272A',
                rotate: '45deg', border: '1px solid rgba(255,255,255,0.1)',
                borderRight: 'none', borderTop: 'none',
              }} />
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────── */
export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { state } = useApp();

  const logoUrl       = state.settings?.logoUrl || '';
  const businessName  = state.settings?.businessName || state.settings?.companyName || '';
  const lowStockCount = useMemo(() =>
    (state.products || []).filter(p => p.active !== false && isLowStock(p)).length
  , [state.products]);

  const w = collapsed ? 64 : 232;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        style={{
          width: w,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
        className={`
          fixed top-0 left-0 h-full z-40
          lg:static lg:z-auto lg:translate-x-0
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          padding: collapsed ? 0 : '0 16px',
          borderBottom: '1px solid var(--sidebar-border)',
          flexShrink: 0,
        }}>
          {collapsed ? (
            logoUrl ? (
              /* Custom logo — collapsed: square image */
              <div style={{ width: 30, height: 30, borderRadius: 7, overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              /* Default brand icon — collapsed */
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.4)' }}>
                <Boxes size={15} strokeWidth={2} style={{ color: '#fff' }} />
              </div>
            )
          ) : (
            logoUrl ? (
              /* Custom logo — expanded: image + business name */
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#FAFAFA', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {businessName || 'My Business'}
                </span>
              </div>
            ) : (
              /* Default brand — expanded */
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.4)' }}>
                  <Boxes size={15} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#FAFAFA', letterSpacing: '-0.03em' }}>
                  Track<span style={{ color: '#818CF8' }}>Invo</span>
                </span>
              </div>
            )
          )}
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: collapsed ? '8px 10px' : '8px 8px',
        }}>
          {NAV.map((section, si) => (
            <div key={si} style={{ marginTop: si === 0 ? 0 : 4 }}>
              {!collapsed && section.group && (
                <p style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--sidebar-section)',
                  padding: '10px 10px 3px',
                }}>
                  {section.group}
                </p>
              )}
              {collapsed && section.group && si > 0 && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />
              )}
              {section.items.map(item => (
                <NavItem
                  key={item.to}
                  {...item}
                  collapsed={collapsed}
                  badge={item.to === '/products' ? lowStockCount : 0}
                  onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                />
              ))}
            </div>
          ))}
        </nav>

      </aside>
    </>
  );
}
