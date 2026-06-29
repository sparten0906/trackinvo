import React from 'react';
import { NavLink } from 'react-router-dom';
import AppIcon from '../icons/AppIcon';

const TABS = [
  { to: '/dashboard', appIcon: 'dashboard', label: 'Home',     color: '#4F46E5', bg: '#EEF2FF' },
  { to: '/products',  appIcon: 'products',  label: 'Stock',    color: '#059669', bg: '#ECFDF5' },
  { to: '/billing',   appIcon: 'billing',   label: 'POS',      color: '#7C3AED', bg: '#F5F3FF' },
  { to: '/invoices',  appIcon: 'invoices',  label: 'Invoices', color: '#D97706', bg: '#FFFBEB' },
  { to: '/reports',   appIcon: 'reports',   label: 'Reports',  color: '#4F46E5', bg: '#EEF2FF' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', height: 60 }}>
        {TABS.map(({ to, appIcon, label, color, bg }) => (
          <NavLink
            key={to}
            to={to}
            style={{ flex: 1, textDecoration: 'none', position: 'relative' }}
          >
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, height: '100%', padding: '6px 4px',
                transition: 'all 0.15s',
              }}>
                {/* Top indicator bar */}
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: isActive ? 30 : 0, height: 2.5, borderRadius: 2,
                  background: color, transition: 'width 0.22s ease-out',
                }} />

                {/* Icon bubble */}
                <div style={{
                  width: isActive ? 44 : 30, height: 30,
                  borderRadius: isActive ? 12 : 8,
                  background: isActive ? bg : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.22s ease-out',
                  opacity: isActive ? 1 : 0.55,
                }}>
                  <AppIcon name={appIcon} size={22} />
                </div>

                <span style={{
                  fontSize: 10.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.01em',
                  color: isActive ? color : 'var(--text-tertiary)',
                  transition: 'color 0.15s',
                }}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
