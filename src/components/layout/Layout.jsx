import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

const KEY_MAP = {
  d: '/dashboard', b: '/billing',   p: '/products',
  i: '/invoices',  u: '/purchase-orders', c: '/customers',
  r: '/reports',   s: '/settings',
};

export default function Layout() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ti-sidebar-collapsed') ?? 'false'); }
    catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(v => {
      const next = !v;
      localStorage.setItem('ti-sidebar-collapsed', JSON.stringify(next));
      return next;
    });
  };

  const handleKey = useCallback((e) => {
    const busy = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)
      || document.activeElement?.isContentEditable;
    if (busy) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const dest = KEY_MAP[e.key?.toLowerCase()];
      if (dest) { e.preventDefault(); navigate(dest); }
    }
  }, [navigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--canvas)' }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <main
          style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          className="mb-bottom-nav lg:mb-0"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
