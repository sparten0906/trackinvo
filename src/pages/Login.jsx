import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/icons/AppIcon';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const DEMO_EMAIL = 'demo@inventory.com';
const DEMO_PASS  = 'demo123';

const FEATURES = [
  { icon: 'products',        label: 'Inventory Management'  },
  { icon: 'billing',         label: 'Billing & POS'          },
  { icon: 'purchase-orders', label: 'Purchase Orders'        },
  { icon: 'tax',             label: 'GST & Tax'               },
  { icon: 'stock-ledger',    label: 'Stock Tracking'          },
  { icon: 'reports',         label: 'Reports & Analytics'     },
  { icon: 'sales-returns',   label: 'Returns Management'      },
  { icon: 'damaged-stock',   label: 'Damaged Stock'           },
];

const FEATURE_LIST = [
  'Inventory Management',
  'Purchase Orders',
  'Billing & POS',
  'Customers & Suppliers',
  'Stock Tracking',
  'GST & Tax',
  'Reports & Analytics',
];

/* ─── Status pill helper ─────────────────────────────────────────────────── */
function statusStyle(s) {
  return s === 'Paid'
    ? { color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0' }
    : s === 'Overdue'
    ? { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }
    : { color: '#CA8A04', background: '#FEFCE8', border: '1px solid #FDE68A' };
}

/* ─── Spinner ────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" style={{ animation: 'ti_spin 0.7s linear infinite', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Check icon ─────────────────────────────────────────────────────────── */
function CheckIcon({ size = 14, color = '#16A34A' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6.5" fill={color === '#16A34A' ? '#F0FDF4' : '#EEF2FF'} stroke={color === '#16A34A' ? '#BBF7D0' : '#C7D2FE'} strokeWidth="1" />
      <path d="M4 7l2.2 2.2L10 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Background dashboard preview ──────────────────────────────────────── */
function DashboardPreview() {
  const card = (extra) => ({
    background: '#FFFFFF',
    border: '1px solid #E4E4E7',
    borderRadius: 14,
    padding: '12px 14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    ...extra,
  });

  const row = (label, val, s, last) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: last ? 'none' : '1px solid #F4F4F5' }}>
      <span style={{ fontSize: 11, color: '#27272A', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {val && <span style={{ fontSize: 11, fontWeight: 600, color: '#18181B', fontVariantNumeric: 'tabular-nums' }}>{val}</span>}
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, ...statusStyle(s) }}>{s}</span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>

      {/* Workspace top bar fragment */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, background: '#FFFFFF', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 18, opacity: 0.3, filter: 'blur(1px)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg, #818CF8, #4F46E5)', flexShrink: 0 }} />
        {['Dashboard', 'Invoices', 'Products', 'Purchases', 'Reports'].map((n, i) => (
          <div key={n} style={{ fontSize: 11.5, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#4F46E5' : '#71717A', paddingBottom: 2, borderBottom: i === 0 ? '2px solid #4F46E5' : '2px solid transparent' }}>{n}</div>
        ))}
      </div>

      {/* KPI row */}
      <div style={{ position: 'absolute', top: 58, left: 36, right: 36, display: 'flex', gap: 10, opacity: 0.42, filter: 'blur(2px)' }}>
        {[
          { icon: 'today-sales',    label: "Today's Sales",  value: '₹42,850', trend: '+12%', up: true  },
          { icon: 'revenue',        label: 'Monthly Revenue', value: '₹3.2L',   trend: '+8%',  up: true  },
          { icon: 'outstanding',    label: 'Outstanding',     value: '₹18,200', trend: '-5%',  up: false },
          { icon: 'profit',         label: 'Gross Profit',    value: '₹94,400', trend: '+21%', up: true  },
          { icon: 'purchases-cost', label: 'Purchase Cost',   value: '₹1.1L',   trend: '+3%',  up: false },
        ].map(k => (
          <div key={k.icon} style={{ flex: 1, ...card({ padding: '10px 12px' }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon name={k.icon} size={12} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: k.up ? '#16A34A' : '#DC2626', background: k.up ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${k.up ? '#BBF7D0' : '#FECACA'}`, padding: '1px 5px', borderRadius: 20 }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#18181B', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
            <div style={{ fontSize: 8.5, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div style={{ position: 'absolute', top: 178, left: 36, width: 270, ...card({ opacity: 0.40, filter: 'blur(2px)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B' }}>Recent Invoices</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '2px 7px', borderRadius: 20 }}>4 today</div>
        </div>
        {row('Bright Supplies Co.', '₹12,400', 'Paid',    false)}
        {row('Metro Hardware Ltd',  '₹8,750',  'Pending', false)}
        {row('Apex Traders',        '₹5,300',  'Overdue', false)}
        {row('Global Parts Inc.',   '₹21,000', 'Paid',    true)}
      </div>

      {/* Low Stock */}
      <div style={{ position: 'absolute', top: 178, left: 326, width: 196, ...card({ opacity: 0.36, filter: 'blur(2px)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1.5L9 8.5H1L5 1.5Z" stroke="#D97706" strokeWidth="1" fill="#FEFCE8" strokeLinejoin="round"/><path d="M5 4.5v1.5M5 7.2v.3" stroke="#D97706" strokeWidth="1" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B' }}>Low Stock</div>
          <div style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '1px 5px', borderRadius: 20 }}>4 items</div>
        </div>
        {[
          { name: 'Steel Bolts M8',  qty: 4,  crit: true  },
          { name: 'PVC Pipe 20mm',   qty: 11, crit: false },
          { name: 'Cable Ties 10cm', qty: 2,  crit: true  },
          { name: 'Copper Wire 2.5', qty: 8,  crit: false },
        ].map((r, i, a) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < a.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
            <span style={{ fontSize: 11, color: '#27272A', fontWeight: 500 }}>{r.name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: r.crit ? '#DC2626' : '#CA8A04', background: r.crit ? '#FEF2F2' : '#FEFCE8', border: r.crit ? '1px solid #FECACA' : '1px solid #FDE68A', padding: '1px 6px', borderRadius: 20 }}>{r.qty} left</span>
          </div>
        ))}
      </div>

      {/* Stock Movements */}
      <div style={{ position: 'absolute', top: 178, left: 540, width: 194, ...card({ opacity: 0.33, filter: 'blur(2px)' }) }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B', marginBottom: 9 }}>Stock Movements</div>
        {[
          { name: 'Steel Rods 12mm', qty: '+50',  t: 'in'  },
          { name: 'PVC Pipe 25mm',   qty: '-20',  t: 'out' },
          { name: 'Bolts M10 × 40',  qty: '+100', t: 'in'  },
          { name: 'Cable Wire 4mm',  qty: '-8',   t: 'out' },
        ].map((r, i, a) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < a.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
            <span style={{ fontSize: 10.5, color: '#27272A', fontWeight: 500 }}>{r.name}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: r.t === 'in' ? '#16A34A' : '#DC2626' }}>{r.t === 'in' ? '▲' : '▼'} {r.qty}</span>
          </div>
        ))}
      </div>

      {/* Purchase Orders */}
      <div style={{ position: 'absolute', bottom: 40, left: 36, width: 262, ...card({ opacity: 0.34, filter: 'blur(2px)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B' }}>Purchase Orders</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '2px 7px', borderRadius: 20 }}>3 open</div>
        </div>
        {row('PO-2026-0089', '₹34,500', 'Pending', false)}
        {row('PO-2026-0088', '₹12,800', 'Paid',    false)}
        {row('PO-2026-0087', '₹7,200',  'Overdue', true)}
      </div>

      {/* Pending Returns */}
      <div style={{ position: 'absolute', bottom: 40, left: 318, width: 218, ...card({ opacity: 0.32, filter: 'blur(2px)' }) }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B', marginBottom: 5 }}>Pending Returns</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#CA8A04', letterSpacing: '-0.04em', lineHeight: 1 }}>7</div>
          <div style={{ fontSize: 9, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Awaiting</div>
        </div>
        {[
          { id: 'SR-2026-034', reason: 'Defective item'  },
          { id: 'PR-2026-012', reason: 'Wrong quantity'  },
          { id: 'SR-2026-033', reason: 'Damaged transit' },
        ].map((r, i) => (
          <div key={i} style={{ padding: '4px 0', borderTop: '1px solid #F4F4F5', fontSize: 10.5, color: '#52525B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#18181B', fontFamily: 'monospace', fontSize: 10 }}>{r.id}</span>
            <span style={{ fontSize: 9.5, color: '#71717A' }}>{r.reason}</span>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div style={{ position: 'absolute', bottom: 40, left: 556, width: 194, ...card({ opacity: 0.30, filter: 'blur(2px)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B' }}>Sales This Week</div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#16A34A' }}>+18%</div>
        </div>
        <svg width="100%" height="48" viewBox="0 0 170 48" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="ti_cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,40 C12,40 18,32 28,28 C38,24 48,20 58,22 C68,24 78,12 88,8 C98,4 108,6 118,4 C128,2 138,10 148,6 C158,2 165,1 170,0" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0,40 C12,40 18,32 28,28 C38,24 48,20 58,22 C68,24 78,12 88,8 C98,4 108,6 118,4 C128,2 138,10 148,6 C158,2 165,1 170,0 L170,48 L0,48 Z" fill="url(#ti_cg)" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <span key={i} style={{ fontSize: 8.5, color: '#A1A1AA', fontWeight: 600 }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Login ─────────────────────────────────────────────────────────── */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [rememberMe,  setRememberMe]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [demoApplied, setDemoApplied] = useState(false);

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    if (!demoApplied) return;
    const t = setTimeout(() => setDemoApplied(false), 3500);
    return () => clearTimeout(t);
  }, [demoApplied]);

  function fillDemo(e) {
    e.preventDefault();
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASS);
    setError('');
    setDemoApplied(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email address is required.'); return; }
    if (!password)     { setError('Password is required.'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const [bizName] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('trackinvo_state') || '{}');
      return s.settings?.businessName || 'TrackInvo';
    } catch { return 'TrackInvo'; }
  });

  const demoInputCls = `ti-input${demoApplied ? ' ti-input-demo' : ''}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#F4F6F8',
    }}>
      <style>{`
        html, body, #root { height: 100%; overflow: hidden; }

        @keyframes ti_spin    { to { transform: rotate(360deg); } }
        @keyframes ti_fade_up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ti_pop_in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ti_success_pulse {
          0%   { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.3); }
          70%  { box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
          100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
        }

        .ti-left-anim  { animation: ti_fade_up 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .ti-right-anim { animation: ti_pop_in  0.5s 0.07s cubic-bezier(0.22,1,0.36,1) both; }

        .ti-input {
          width: 100%; height: 40px; padding: 0 13px;
          border-radius: 10px; border: 1.5px solid #E4E4E7;
          background: #FAFAFA; color: #18181B;
          font-size: 13.5px; font-family: inherit;
          outline: none; box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s, transform 0.15s;
        }
        .ti-input::placeholder { color: #B4B4BC; }
        .ti-input:focus {
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.13);
          background: #FFFFFF;
          transform: translateY(-1px);
        }
        .ti-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .ti-input-demo {
          border-color: #16A34A !important;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.13) !important;
          background: #F0FDF4 !important;
          transform: none !important;
          animation: ti_success_pulse 0.5s ease-out;
        }

        .ti-btn-primary {
          width: 100%; height: 44px;
          background: linear-gradient(160deg, #5B52F0 0%, #4338CA 100%);
          color: #FFFFFF; border: none; border-radius: 11px;
          font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; letter-spacing: -0.01em;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          position: relative; overflow: hidden;
          box-shadow: 0 1px 3px rgba(79,70,229,0.2), 0 4px 14px rgba(79,70,229,0.28),
                      inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08);
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s;
        }
        .ti-btn-primary::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 55%);
          border-radius: inherit; pointer-events: none;
        }
        .ti-btn-primary:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 2px 6px rgba(79,70,229,0.25), 0 8px 24px rgba(79,70,229,0.36),
                      inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.08);
        }
        .ti-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .ti-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .ti-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(228,228,231,0.9);
          border-radius: 20px;
          font-size: 11.5px; font-weight: 600; color: #3F3F46;
          white-space: nowrap; backdrop-filter: blur(8px);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .ti-checkbox { accent-color: #4F46E5; width: 14px; height: 14px; cursor: pointer; }

        .ti-page-wrap {
          display: flex; align-items: center; justify-content: center;
          height: 100%; padding: 0 32px; box-sizing: border-box;
        }
        .ti-page-grid {
          display: grid;
          grid-template-columns: 1fr 408px;
          gap: 56px;
          align-items: center;
          max-width: 1080px;
          width: 100%;
        }
        .ti-chips-wrap { display: flex; flex-wrap: wrap; gap: 6px; }

        @media (max-width: 960px) {
          .ti-page-grid  { grid-template-columns: 1fr; gap: 20px; max-width: 420px; }
          .ti-left-col   { text-align: center; }
          .ti-chips-wrap { justify-content: center; }
          .ti-left-desc  { display: none !important; }
          .ti-bg-preview { display: none !important; }
          .ti-page-wrap  { padding: 16px; align-items: center; }
        }
        @media (max-width: 480px) {
          .ti-left-title { font-size: 28px !important; }
        }
      `}</style>

      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(79,70,229,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(79,70,229,0.022) 1px, transparent 1px)`,
        backgroundSize: '52px 52px',
      }} />

      {/* Dashboard preview */}
      <div className="ti-bg-preview" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <DashboardPreview />
      </div>

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        background: `
          radial-gradient(ellipse 75% 55% at 50% -5%, rgba(79,70,229,0.05) 0%, transparent 65%),
          linear-gradient(180deg, rgba(244,246,248,0.82) 0%, rgba(244,246,248,0.88) 60%, rgba(244,246,248,0.94) 100%)`,
        backdropFilter: 'blur(1px)',
      }} />

      {/* Main content */}
      <div className="ti-page-wrap" style={{ position: 'relative', zIndex: 10 }}>
        <div className="ti-page-grid">

          {/* ══ LEFT COLUMN ══ */}
          <div className="ti-left-col ti-left-anim">

            {/* Platform badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(238,242,255,0.9)',
              border: '1px solid rgba(199,210,254,0.9)',
              borderRadius: 20, padding: '4px 12px 4px 6px',
              marginBottom: 18,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 1px 4px rgba(79,70,229,0.1)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: 'linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(79,70,229,0.3)',
              }}>
                <AppIcon name="dashboard" size={12} style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4338CA', letterSpacing: '-0.01em' }}>
                TrackInvo Platform
              </span>
            </div>

            {/* Title */}
            <h1 className="ti-left-title" style={{
              fontSize: 42, fontWeight: 900, color: '#18181B',
              letterSpacing: '-0.046em', lineHeight: 1.02,
              margin: '0 0 8px',
            }}>
              TrackInvo{' '}
              <span style={{
                backgroundImage: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #4338CA 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>ERP</span>
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 15, fontWeight: 600, color: '#52525B',
              margin: '0 0 18px', letterSpacing: '-0.015em',
            }}>
              Manage your complete business from one secure platform.
            </p>

            {/* Feature list */}
            <ul className="ti-left-desc" style={{
              listStyle: 'none', margin: '0 0 20px', padding: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {FEATURE_LIST.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                    background: '#EEF2FF', border: '1px solid #C7D2FE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l1.8 1.8L6.5 2" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, color: '#3F3F46', fontWeight: 500 }}>{f}</span>
                </li>
              ))}
            </ul>

            {/* Feature chips */}
            <div className="ti-chips-wrap">
              {FEATURES.map(f => (
                <div key={f.label} className="ti-chip">
                  <AppIcon name={f.icon} size={11} />
                  {f.label}
                </div>
              ))}
            </div>

            {/* Security note */}
            <div className="ti-left-desc" style={{
              display: 'flex', alignItems: 'center', gap: 9, marginTop: 20,
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(228,228,231,0.8)',
              borderRadius: 11,
              backdropFilter: 'blur(8px)',
              maxWidth: 420,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5L12 3.8v3.5c0 2.9-2.2 4.8-5 5-2.8-.2-5-2.1-5-5V3.8L7 1.5Z" stroke="#16A34A" strokeWidth="1.1" strokeLinejoin="round" />
                  <path d="M4.5 7l1.8 1.8L9.5 5" stroke="#16A34A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B', marginBottom: 1 }}>Secure Business Workspace</div>
                <div style={{ fontSize: 11, color: '#71717A', lineHeight: 1.4 }}>
                  Your inventory and financial data are protected with enterprise-grade security.
                </div>
              </div>
            </div>

          </div>

          {/* ══ RIGHT COLUMN — Login card ══ */}
          <div className="ti-right-anim">
            <div style={{
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid rgba(228,228,231,0.8)',
              borderRadius: 20,
              boxShadow: `
                0 2px 4px rgba(0,0,0,0.04),
                0 8px 24px rgba(0,0,0,0.08),
                0 20px 48px rgba(79,70,229,0.07),
                inset 0 1px 0 rgba(255,255,255,0.98)`,
              backdropFilter: 'blur(24px)',
              overflow: 'hidden',
            }}>

              {/* Card header */}
              <div style={{
                background: 'linear-gradient(150deg, #5B52F0 0%, #4338CA 60%, #3730A3 100%)',
                padding: '16px 22px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.22)' }} />
                <div style={{ position: 'absolute', top: -24, right: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13, position: 'relative' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}>
                    <AppIcon name="dashboard" size={17} style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>{bizName}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.58)', marginTop: 2, fontWeight: 500 }}>Inventory & Business Management</div>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.032em', lineHeight: 1.15 }}>Welcome back</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginTop: 3, fontWeight: 400 }}>Sign in to continue to your workspace</div>
                </div>
              </div>

              {/* Form body */}
              <form onSubmit={handleSubmit} style={{ padding: '18px 22px 20px' }}>

                {/* Error */}
                {error && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 9, padding: '9px 12px', marginBottom: 12,
                    fontSize: 12, color: '#DC2626', fontWeight: 500,
                    display: 'flex', alignItems: 'flex-start', gap: 7,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 15 15" style={{ flexShrink: 0, marginTop: 0.5 }}>
                      <circle cx="7.5" cy="7.5" r="6.5" fill="#FEF2F2" stroke="#DC2626" strokeWidth="1.2" />
                      <path d="M7.5 4.5v3.5M7.5 10v.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Email */}
                <div style={{ marginBottom: 11 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 5 }}>Email address</label>
                  <input className={demoInputCls} type="email" placeholder="you@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoComplete="email" autoFocus />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 5 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className={demoInputCls} type={showPass ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      disabled={loading} autoComplete="current-password" style={{ paddingRight: 40 }} />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 3, cursor: 'pointer', color: '#A1A1AA', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#71717A'}
                      onMouseLeave={e => e.currentTarget.style.color = '#A1A1AA'}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                  <input className="ti-checkbox" type="checkbox" id="ti_rem"
                    checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} disabled={loading} />
                  <label htmlFor="ti_rem" style={{ fontSize: 12, color: '#52525B', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Keep me signed in</label>
                </div>

                {/* Sign in */}
                <button className="ti-btn-primary" type="submit" disabled={loading}>
                  {loading && <Spinner />}
                  {loading ? 'Signing in…' : 'Sign in to Workspace'}
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #E4E4E7 50%)' }} />
                  <span style={{ fontSize: 10, color: '#B4B4BC', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>demo access</span>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #E4E4E7 50%, transparent)' }} />
                </div>

                {/* Demo credentials row */}
                <button
                  type="button"
                  onClick={fillDemo}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', marginTop: 12,
                    padding: '12px 16px',
                    background: demoApplied ? '#F0FDF4' : '#F5F5FF',
                    border: `1.5px solid ${demoApplied ? '#86EFAC' : '#DDD6FE'}`,
                    borderRadius: 12, cursor: 'pointer',
                    transition: 'background 0.2s, border-color 0.2s, box-shadow 0.18s',
                    boxShadow: demoApplied ? '0 0 0 3px rgba(22,163,74,0.08)' : 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!demoApplied) {
                      e.currentTarget.style.background = '#EDEEFF';
                      e.currentTarget.style.borderColor = '#C4B5FD';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(79,70,229,0.10)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = demoApplied ? '#F0FDF4' : '#F5F5FF';
                    e.currentTarget.style.borderColor = demoApplied ? '#86EFAC' : '#DDD6FE';
                    e.currentTarget.style.boxShadow = demoApplied ? '0 0 0 3px rgba(22,163,74,0.08)' : 'none';
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: demoApplied ? '#16A34A' : '#4F46E5',
                      marginBottom: 3, letterSpacing: '-0.01em',
                    }}>
                      {demoApplied ? 'Demo credentials applied' : 'Use demo credentials'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#71717A', fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>
                      {DEMO_EMAIL}
                      <span style={{ margin: '0 5px', color: '#D4D4D8' }}>·</span>
                      {DEMO_PASS}
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: demoApplied ? '#DCFCE7' : '#EEF2FF',
                    border: `1px solid ${demoApplied ? '#86EFAC' : '#C7D2FE'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}>
                    {demoApplied ? (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2.5 6.5l3 3 5-5" stroke="#16A34A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M3 6.5h7M7 3.5l3 3-3 3" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Security note */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 13 }}>
                  <svg width="10" height="11" viewBox="0 0 11 12" fill="none">
                    <path d="M5.5 1L10 3.2v3.5c0 2.8-2 4.6-4.5 5C3 11.5 1 9.7 1 6.7V3.2L5.5 1Z" stroke="#A1A1AA" strokeWidth="0.95" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 10.5, color: '#A1A1AA', fontWeight: 500 }}>Enterprise-grade security · End-to-end encrypted</span>
                </div>

              </form>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 12, left: 0, right: 0,
        textAlign: 'center', zIndex: 10, pointerEvents: 'none',
        fontSize: 11, color: '#B4B4BC', fontWeight: 500,
      }}>
        {bizName} · Inventory Management System
      </div>

    </div>
  );
}
