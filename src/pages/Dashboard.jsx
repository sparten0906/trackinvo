import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Receipt, ShoppingCart,
  Package, Users, AlertTriangle, AlertCircle,
  DollarSign, Layers, Clock, Activity,
  Plus, ArrowRight, ChevronRight, BarChart2,
  Truck, UserPlus, Check, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, formatModalDateTime, isLowStock } from '../utils/helpers';
import AppIcon from '../components/icons/AppIcon';

/* ─── time-ago helper ───────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ─── Avatar ───────────────────────────────────────────────────────── */
function Avatar({ name = '?', size = 28 }) {
  const initial = name.charAt(0).toUpperCase();
  const palettes = [
    ['#EEF2FF','#4F46E5'],['#F0FDF4','#16A34A'],['#FEFCE8','#CA8A04'],
    ['#FEF2F2','#DC2626'],['#F5F3FF','#7C3AED'],['#FFF7ED','#EA580C'],
  ];
  const [bg, fg] = palettes[initial.charCodeAt(0) % palettes.length];
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.4, fontWeight:700, color:fg, flexShrink:0, userSelect:'none' }}>
      {initial}
    </div>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────── */
function KPICard({ icon: Icon, appIcon, label, value, trend, period, iconBg, iconColor, onClick }) {
  const [hov, setHov] = useState(false);
  const up   = trend !== null && trend !== undefined && trend > 0;
  const down = trend !== null && trend !== undefined && trend < 0;
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', borderRadius: 16, padding: '18px 20px',
        border: `1.5px solid ${hov && onClick ? 'var(--brand-light)' : 'var(--border)'}`,
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s var(--ease)',
        transform: hov && onClick ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* AppIcon (colorful) or lucide fallback */}
          {appIcon
            ? <AppIcon name={appIcon} size={38} />
            : (
              <div style={{ width:36, height:36, borderRadius:10, background: iconBg || 'var(--brand-faint)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={18} style={{ color: iconColor || 'var(--brand)' }} strokeWidth={1.75} />
              </div>
            )
          }
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text-tertiary)', lineHeight:1.3 }}>{label}</span>
        </div>
        {trend !== null && trend !== undefined && (
          <span style={{
            display:'inline-flex', alignItems:'center', gap:3,
            fontSize:11, fontWeight:700, borderRadius:20, padding:'2px 8px',
            color: up ? 'var(--success)' : down ? 'var(--error)' : 'var(--text-tertiary)',
            background: up ? 'var(--success-bg)' : down ? 'var(--error-bg)' : 'var(--canvas)',
            border: `1px solid ${up ? 'var(--success-border)' : down ? 'var(--error-border)' : 'var(--border)'}`,
          }}>
            {up ? <TrendingUp size={9}/> : down ? <TrendingDown size={9}/> : null}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', marginBottom:5 }}>
          {value}
        </p>
        <p style={{ fontSize:11, color:'var(--text-tertiary)' }}>{period}</p>
      </div>
    </div>
  );
}

/* ─── SVG Area Chart ───────────────────────────────────────────────── */
function AreaChart({ data, color = '#4F46E5' }) {
  if (!data || data.length === 0) return null;
  const W = 600, H = 110, padT = 8, padB = 0;
  const max = Math.max(...data.map(d => d.amount), 1);
  const pts = data.map((d, i) => ({
    x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
    y: padT + (1 - d.amount / max) * (H - padT - padB),
    label: d.label,
    amount: d.amount,
  }));
  const line = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, '');
  const area = `${line} L ${pts[pts.length-1].x},${H} L ${pts[0].x},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.14"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={padT + (1-f)*(H-padT)} x2={W} y2={padT + (1-f)*(H-padT)} stroke="var(--border-subtle, #F1F5F9)" strokeWidth="1"/>
      ))}
      <path d={area} fill="url(#dash-grad)"/>
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="2"/>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { state } = useApp();
  const { products, invoices, purchases, customers, suppliers, settings } = state;
  const nav = useNavigate();
  const sym = settings.currencySymbol || '₹';

  const [chartPeriod, setChartPeriod] = useState('6M');

  /* ── Date anchors ── */
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const thisMonthStr = todayStr.slice(0, 7);
  const lastMonthStr = useMemo(() => {
    const d = new Date(todayStr); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, [todayStr]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateDisplay = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const businessName = settings.businessName || settings.companyName || settings.shopName || 'Your Business';

  /* ── Invoice metrics ── */
  const todayInvoices = useMemo(() => invoices.filter(i => (i.date||'').startsWith(todayStr)), [invoices, todayStr]);
  const todaySales    = todayInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const yesterdaySales = useMemo(() => invoices.filter(i => (i.date||'').startsWith(yesterdayStr)).reduce((s,i) => s+(i.grandTotal||0), 0), [invoices, yesterdayStr]);
  const todayTrend    = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : null;

  const monthRevenue     = useMemo(() => invoices.filter(i => (i.date||'').startsWith(thisMonthStr)).reduce((s,i) => s+(i.grandTotal||0), 0), [invoices, thisMonthStr]);
  const lastMonthRevenue = useMemo(() => invoices.filter(i => (i.date||'').startsWith(lastMonthStr)).reduce((s,i) => s+(i.grandTotal||0), 0), [invoices, lastMonthStr]);
  const monthTrend       = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;

  const totalOutstanding = useMemo(() => invoices.reduce((s,i) => s+(i.balanceAmount||0), 0), [invoices]);
  const overdueCount     = useMemo(() => invoices.filter(i => i.paymentStatus !== 'paid' && i.date && i.date < todayStr).length, [invoices, todayStr]);

  /* ── Purchase metrics ── */
  const monthPurchases     = useMemo(() => purchases.filter(p => (p.date||'').startsWith(thisMonthStr)).reduce((s,p) => s+(p.grandTotal||p.totalAmount||0), 0), [purchases, thisMonthStr]);
  const lastMonthPurchases = useMemo(() => purchases.filter(p => (p.date||'').startsWith(lastMonthStr)).reduce((s,p) => s+(p.grandTotal||p.totalAmount||0), 0), [purchases, lastMonthStr]);
  const purchTrend         = lastMonthPurchases > 0 ? ((monthPurchases - lastMonthPurchases) / lastMonthPurchases) * 100 : null;

  /* ── Gross profit — COGS via averagePurchaseCost ── */
  const monthCOGS = useMemo(() => invoices
    .filter(i => (i.date||'').startsWith(thisMonthStr))
    .reduce((sum, inv) => sum + (inv.items||[]).reduce((s, item) => {
      const prod = products.find(p => p.id === item.productId);
      return s + (prod ? (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) : 0) * (item.quantity || 0);
    }, 0), 0), [invoices, products, thisMonthStr]);

  const lastMonthCOGS = useMemo(() => invoices
    .filter(i => (i.date||'').startsWith(lastMonthStr))
    .reduce((sum, inv) => sum + (inv.items||[]).reduce((s, item) => {
      const prod = products.find(p => p.id === item.productId);
      return s + (prod ? (prod.averagePurchaseCost || prod.costPrice || prod.purchasePrice || 0) : 0) * (item.quantity || 0);
    }, 0), 0), [invoices, products, lastMonthStr]);

  const monthProfit     = monthRevenue - monthCOGS;
  const lastMonthProfit = lastMonthRevenue - lastMonthCOGS;
  const profitTrend     = Math.abs(lastMonthProfit) > 0 ? ((monthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100 : null;

  /* ── Stock ── */
  const activeProducts  = useMemo(() => products.filter(p => p.status === 'active'), [products]);
  const lowStockItems   = useMemo(() => activeProducts.filter(isLowStock), [activeProducts]);
  const outOfStockItems = useMemo(() => activeProducts.filter(p => p.stock === 0), [activeProducts]);
  const inStockCount    = useMemo(() => activeProducts.filter(p => !isLowStock(p) && p.stock > 0).length, [activeProducts]);
  const stockValue      = useMemo(() => activeProducts.reduce((s,p) => s+(+(p.sellingPrice)||0)*(+(p.stock)||0), 0), [activeProducts]);

  /* ── Chart data (period-aware, actually works) ── */
  const chartData = useMemo(() => {
    if (chartPeriod === 'Week') {
      return Array.from({length:7}, (_,i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key   = d.toISOString().slice(0,10);
        const label = d.toLocaleDateString('en-IN', {weekday:'short'}).slice(0,3);
        const amount = invoices.filter(inv => (inv.date||'').startsWith(key)).reduce((s,inv) => s+(inv.grandTotal||0), 0);
        return {key, label, amount};
      });
    }
    if (chartPeriod === 'Year') {
      return Array.from({length:12}, (_,i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11-i));
        const key   = d.toISOString().slice(0,7);
        const label = d.toLocaleString('en-IN', {month:'short'});
        const amount = invoices.filter(inv => (inv.date||'').startsWith(key)).reduce((s,inv) => s+(inv.grandTotal||0), 0);
        return {key, label, amount};
      });
    }
    return Array.from({length:6}, (_,i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5-i));
      const key   = d.toISOString().slice(0,7);
      const label = d.toLocaleString('en-IN', {month:'short'});
      const amount = invoices.filter(inv => (inv.date||'').startsWith(key)).reduce((s,inv) => s+(inv.grandTotal||0), 0);
      return {key, label, amount};
    });
  }, [invoices, chartPeriod]);

  const chartTotal = chartData.reduce((s,d) => s+d.amount, 0);
  const chartMax   = Math.max(...chartData.map(d => d.amount), 1);

  /* ── Top customers ── */
  const topCustomers = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const key = inv.customerId || inv.customerName || 'unknown';
      if (!map[key]) map[key] = {name: inv.customerName || 'Unknown', total:0, count:0};
      map[key].total += inv.grandTotal || 0;
      map[key].count++;
    });
    return Object.values(map).sort((a,b) => b.total-a.total).slice(0,5);
  }, [invoices]);

  /* ── Recent activity (invoices + purchases merged) ── */
  const recentActivity = useMemo(() => {
    const items = [
      ...[...invoices].sort((a,b) => (b.createdAt||b.date||'').localeCompare(a.createdAt||a.date||'')).slice(0,6).map(inv => ({
        type:'invoice', id:inv.id,
        title: inv.customerName || 'Customer',
        sub:   inv.invoiceNumber || '',
        amount: inv.grandTotal,
        status: inv.paymentStatus,
        time:   inv.createdAt || inv.date,
      })),
      ...[...purchases].sort((a,b) => (b.createdAt||b.date||'').localeCompare(a.createdAt||a.date||'')).slice(0,4).map(p => ({
        type:'purchase', id:p.id,
        title: p.supplierName || 'Supplier',
        sub:   p.purchaseNumber || p.invoiceNumber || '',
        amount: p.grandTotal || p.totalAmount,
        status: p.paymentStatus,
        time:   p.createdAt || p.date,
      })),
      ...[...(customers||[])].filter(c=>c.createdAt).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,2).map(c => ({
        type:'customer', id:c.id,
        title: c.name,
        sub:   'Customer added',
        amount:null, status:null,
        time: c.createdAt,
      })),
    ];
    return items.sort((a,b) => (b.time||'').localeCompare(a.time||'')).slice(0,9);
  }, [invoices, purchases, customers]);

  /* ── Alerts ── */
  const alerts = useMemo(() => {
    const list = [];
    if (outOfStockItems.length)
      list.push({priority:'error', id:'oos', icon:AlertCircle, title:`${outOfStockItems.length} out of stock`, sub: outOfStockItems.slice(0,3).map(p=>p.name).join(', ')+(outOfStockItems.length>3?'…':''), to:'/products'});
    if (overdueCount)
      list.push({priority:'error', id:'overdue', icon:Clock, title:`${overdueCount} overdue invoice${overdueCount>1?'s':''}`, sub:'Payment past due date', to:'/invoices'});
    if (lowStockItems.length)
      list.push({priority:'warning', id:'low', icon:AlertTriangle, title:`${lowStockItems.length} running low`, sub: lowStockItems.slice(0,3).map(p=>p.name).join(', ')+(lowStockItems.length>3?'…':''), to:'/products'});
    const partial = invoices.filter(i=>i.paymentStatus==='partial').length;
    if (partial)
      list.push({priority:'warning', id:'partial', icon:Clock, title:`${partial} partial payment${partial>1?'s':''}`, sub:'Outstanding balance pending', to:'/invoices'});
    return list;
  }, [outOfStockItems, overdueCount, lowStockItems, invoices]);

  /* ── Daily summary line ── */
  const dailySummary = [
    todayInvoices.length && `${todayInvoices.length} sale${todayInvoices.length>1?'s':''}`,
    todaySales > 0 && `${formatCurrency(todaySales, sym)} revenue`,
    alerts.length && `${alerts.length} alert${alerts.length>1?'s':''}`,
  ].filter(Boolean).join(' · ') || 'No transactions today';

  /* ── Quick actions ── */
  const quickActions = [
    { label:'New Invoice',  appIcon:'new-invoice',  icon:Receipt,     to:'/billing',   accent:'#4F46E5', bg:'#EEF2FF' },
    { label:'Add Product',  appIcon:'add-product',  icon:Package,     to:'/products',  accent:'#16A34A', bg:'#F0FDF4' },
    { label:'New Purchase', appIcon:'new-purchase', icon:ShoppingCart,to:'/purchase-orders', accent:'#7C3AED', bg:'#F5F3FF' },
    { label:'Add Customer', appIcon:'add-customer', icon:UserPlus,    to:'/customers', accent:'#EA580C', bg:'#FFF7ED' },
  ];

  /* ── KPI cards definition ── */
  const kpis = [
    {
      appIcon: 'today-sales', label: "Today's Sales",
      value: formatCurrency(todaySales, sym),
      trend: todayTrend, period: 'vs yesterday',
      onClick: () => nav('/invoices'),
    },
    {
      appIcon: 'revenue', label: 'Revenue This Month',
      value: formatCurrency(monthRevenue, sym),
      trend: monthTrend, period: 'vs last month',
      onClick: () => nav('/reports'),
    },
    {
      appIcon: 'outstanding', label: 'Outstanding Receivables',
      value: formatCurrency(totalOutstanding, sym),
      trend: null, period: `${overdueCount} overdue invoice${overdueCount!==1?'s':''}`,
      onClick: () => nav('/invoices'),
    },
    {
      appIcon: 'profit', label: 'Gross Profit (Month)',
      value: formatCurrency(Math.max(0, monthProfit), sym),
      trend: profitTrend, period: 'vs last month',
      onClick: () => nav('/reports'),
    },
    {
      appIcon: 'purchases-cost', label: 'Purchase Cost (Month)',
      value: formatCurrency(monthPurchases, sym),
      trend: purchTrend !== null ? -purchTrend : null,
      period: 'vs last month',
      onClick: () => nav('/purchase-orders'),
    },
    {
      appIcon: 'stock-value', label: 'Inventory Value',
      value: formatCurrency(stockValue, sym),
      trend: null, period: `${activeProducts.length} active products`,
      onClick: () => nav('/products'),
    },
    {
      appIcon: 'low-stock', label: 'Low Stock Items',
      value: String(lowStockItems.length),
      trend: null, period: `${inStockCount} fully stocked`,
      onClick: () => nav('/products'),
    },
    {
      appIcon: 'out-of-stock', label: 'Out of Stock',
      value: String(outOfStockItems.length),
      trend: null, period: 'need restocking',
      onClick: () => nav('/products'),
    },
  ];

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--canvas)' }} className="animate-fadeIn">
      <div style={{ maxWidth:1440, margin:'0 auto', padding:'28px 28px 64px' }} className="dashboard-wrapper">

        {/* ══════════════════════════════════════════════════════════
            1. WELCOME SECTION
        ══════════════════════════════════════════════════════════ */}
        <div className="db-welcome" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:24, marginBottom:28, flexWrap:'wrap' }}>
          {/* Left: greeting + date + summary */}
          <div>
            <p style={{ fontSize:13, fontWeight:500, color:'var(--text-tertiary)', marginBottom:4 }}>
              {dateDisplay}
            </p>
            <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:'-0.04em', color:'var(--text-primary)', lineHeight:1.2, marginBottom:6 }}>
              {greeting} 👋
            </h1>
            <p style={{ fontSize:13.5, color:'var(--text-secondary)', fontWeight:500 }}>
              <span style={{ fontWeight:700, color:'var(--brand)' }}>{businessName}</span>
              {dailySummary && <span style={{ color:'var(--text-tertiary)' }}> · {dailySummary}</span>}
            </p>
          </div>

          {/* Right: Quick actions */}
          <div className="db-quick-actions" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {quickActions.map(a => (
              <QuickActionBtn
                key={a.to}
                label={a.label}
                icon={<AppIcon name={a.appIcon} size={18} />}
                bg={a.bg}
                accent={a.accent}
                onClick={() => nav(a.to)}
              />
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            2. KPI GRID — 4 per row, 2 rows
        ══════════════════════════════════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14, marginBottom:20 }}>
          {kpis.map((k, i) => <KPICard key={i} {...k}/>)}
        </div>

        {/* ══════════════════════════════════════════════════════════
            3. ANALYTICS ROW — chart (2fr) + inventory (1fr)
        ══════════════════════════════════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:20 }} className="db-analytics-row">

          {/* Revenue chart */}
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--border)', padding:'22px 24px', boxShadow:'var(--shadow-xs)' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Revenue Trend</p>
                <p style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>
                  {formatCurrency(chartTotal, sym)} total · {chartPeriod === 'Week' ? 'last 7 days' : chartPeriod === 'Year' ? 'last 12 months' : 'last 6 months'}
                </p>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {['Week','6M','Year'].map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)}
                    style={{
                      padding:'4px 12px', borderRadius:20, fontSize:11.5, fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.13s',
                      background: chartPeriod===p ? 'var(--brand)' : 'var(--canvas)',
                      color: chartPeriod===p ? '#fff' : 'var(--text-tertiary)',
                    }}
                  >{p}</button>
                ))}
              </div>
            </div>

            {/* Chart area */}
            <div style={{ height:120, margin:'14px 0 8px' }}>
              <AreaChart data={chartData}/>
            </div>

            {/* X-axis labels */}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:4 }}>
              {chartData.map((d, i) => {
                const showEvery = chartData.length > 8 ? Math.ceil(chartData.length / 6) : 1;
                if (i % showEvery !== 0 && i !== chartData.length - 1) return null;
                return (
                  <span key={d.key} style={{ fontSize:10.5, color:'var(--text-tertiary)', fontWeight:500 }}>{d.label}</span>
                );
              })}
            </div>

            {/* Bar row for monthly totals (alternative visual below chart) */}
            <div style={{ display:'flex', gap:4, marginTop:12, alignItems:'flex-end', height:32 }}>
              {chartData.map((d, i) => {
                const pct = d.amount / chartMax;
                const isCurrent = chartPeriod==='6M' && d.key===thisMonthStr;
                return (
                  <div key={d.key} title={`${d.label}: ${formatCurrency(d.amount,sym)}`}
                    style={{ flex:1, borderRadius:'3px 3px 0 0', background: isCurrent ? 'var(--brand)' : 'var(--brand-faint)', height: `${Math.max(pct*100, d.amount>0?10:3)}%`, transition:'height 0.3s', minHeight:3 }}/>
                );
              })}
            </div>
          </div>

          {/* Inventory health */}
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--border)', padding:'22px 24px', boxShadow:'var(--shadow-xs)', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Inventory Health</p>
              <button onClick={()=>nav('/products')}
                style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'var(--brand)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6, transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--brand-faint)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}
              >View all <ChevronRight size={12}/></button>
            </div>

            {/* Donut-style summary */}
            <div style={{ display:'flex', justifyContent:'center', gap:20, marginBottom:20 }}>
              {[
                {label:'In Stock', count:inStockCount,    color:'var(--success)', bg:'var(--success-bg)'},
                {label:'Low',      count:lowStockItems.length,    color:'var(--warning)', bg:'var(--warning-bg)'},
                {label:'Out',      count:outOfStockItems.length,  color:'var(--error)',   bg:'var(--error-bg)'},
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center' }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', border:`2px solid ${s.color}30` }}>
                    <span style={{ fontSize:20, fontWeight:900, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.count}</span>
                  </div>
                  <p style={{ fontSize:11.5, color:'var(--text-tertiary)', fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Health bars */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
              {[
                {label:'In Stock',    count:inStockCount,           total:activeProducts.length, color:'#16A34A'},
                {label:'Low Stock',   count:lowStockItems.length,   total:activeProducts.length, color:'#CA8A04'},
                {label:'Out of Stock',count:outOfStockItems.length, total:activeProducts.length, color:'#DC2626'},
              ].map(row => {
                const pct = activeProducts.length > 0 ? (row.count / activeProducts.length) * 100 : 0;
                return (
                  <div key={row.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>{row.label}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{row.count}</span>
                    </div>
                    <div style={{ height:6, background:'var(--canvas)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:row.color, transition:'width 0.5s var(--ease)' }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stock value */}
            <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <p style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Total Stock Value</p>
              <p style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.03em', color:'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>
                {formatCurrency(stockValue, sym)}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            4. BOTTOM ROW — activity · alerts · customers
        ══════════════════════════════════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr', gap:14 }} className="db-bottom-row">

          {/* Activity Timeline */}
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--border)', padding:'22px 24px', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Recent Activity</p>
              <button onClick={()=>nav('/invoices')}
                style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'var(--brand)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6, transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--brand-faint)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}
              >View all <ChevronRight size={12}/></button>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState icon={<Activity size={22} style={{color:'var(--text-tertiary)'}}/>} text="No recent activity"/>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {recentActivity.map((item, i) => {
                  const Icon = item.type==='invoice' ? Receipt : item.type==='purchase' ? ShoppingCart : UserPlus;
                  const iconColor = item.type==='invoice' ? '#4F46E5' : item.type==='purchase' ? '#7C3AED' : '#16A34A';
                  const iconBg = item.type==='invoice' ? '#EEF2FF' : item.type==='purchase' ? '#F5F3FF' : '#F0FDF4';
                  const isLast = i === recentActivity.length - 1;
                  return (
                    <div key={item.id||i} style={{ display:'flex', gap:12, paddingBottom: isLast?0:14, position:'relative' }}>
                      {/* Timeline line */}
                      {!isLast && <div style={{ position:'absolute', left:15, top:30, bottom:0, width:1, background:'var(--border)' }}/>}
                      {/* Icon */}
                      <div style={{ width:30, height:30, borderRadius:'50%', background:iconBg, border:`1.5px solid ${iconColor}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                        <Icon size={13} style={{color:iconColor}} strokeWidth={2}/>
                      </div>
                      {/* Content */}
                      <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
                        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {item.title}
                          </p>
                          {item.amount!=null && (
                            <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                              {formatCurrency(item.amount, sym)}
                            </span>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                          {item.sub && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{item.sub}</span>}
                          {item.status && (
                            <span style={{
                              fontSize:9.5, fontWeight:700, padding:'1px 6px', borderRadius:20, textTransform:'uppercase',
                              color: item.status==='paid'?'var(--success)':item.status==='partial'?'var(--warning)':'var(--error)',
                              background: item.status==='paid'?'var(--success-bg)':item.status==='partial'?'var(--warning-bg)':'var(--error-bg)',
                            }}>{item.status}</span>
                          )}
                          {item.time && (
                            <span style={{ marginLeft:'auto', flexShrink:0, fontSize:11, color:'var(--text-tertiary)', fontWeight:500, whiteSpace:'nowrap' }}>
                              {formatDateTime(item.time)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--border)', padding:'22px 24px', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Alerts</p>
                {alerts.length > 0 && (
                  <span style={{ fontSize:10.5, fontWeight:800, background:'var(--error-bg)', color:'var(--error)', border:'1px solid var(--error-border)', borderRadius:20, padding:'1px 7px' }}>
                    {alerts.length}
                  </span>
                )}
              </div>
            </div>

            {alerts.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:160, gap:10, textAlign:'center' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--success-bg)', border:'1.5px solid var(--success-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Check size={20} style={{color:'var(--success)'}} strokeWidth={2.5}/>
                </div>
                <p style={{ fontSize:13.5, fontWeight:600, color:'var(--text-secondary)' }}>All clear</p>
                <p style={{ fontSize:12, color:'var(--text-tertiary)', lineHeight:1.6 }}>No alerts requiring<br/>your attention</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {alerts.map(a => {
                  const Icon = a.icon;
                  const isError = a.priority === 'error';
                  return (
                    <div key={a.id} onClick={() => nav(a.to)}
                      style={{
                        display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', borderRadius:10,
                        background: isError ? 'var(--error-bg)' : 'var(--warning-bg)',
                        border: `1.5px solid ${isError ? 'var(--error-border)' : 'var(--warning-border)'}`,
                        cursor:'pointer', transition:'all 0.13s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-sm)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                    >
                      <Icon size={15} style={{color: isError?'var(--error)':'var(--warning)', flexShrink:0, marginTop:1}} strokeWidth={2}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12.5, fontWeight:700, color: isError?'var(--error)':'var(--warning)', marginBottom:2 }}>{a.title}</p>
                        <p style={{ fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.sub}</p>
                      </div>
                      <ChevronRight size={13} style={{color:'var(--text-tertiary)', flexShrink:0, marginTop:2}}/>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stock quick stats */}
            {alerts.length > 0 && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', gap:12 }}>
                <button onClick={()=>nav('/products')}
                  style={{ flex:1, height:34, borderRadius:8, background:'var(--brand)', border:'none', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#fff', transition:'background 0.13s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--brand-hover)'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--brand)'}
                >View products</button>
                <button onClick={()=>nav('/purchase-orders')}
                  style={{ flex:1, height:34, borderRadius:8, background:'var(--canvas)', border:'1.5px solid var(--border)', cursor:'pointer', fontSize:12.5, fontWeight:600, color:'var(--text-secondary)', transition:'all 0.13s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
                >Restock</button>
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--border)', padding:'22px 24px', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Top Customers</p>
              <button onClick={()=>nav('/customers')}
                style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'var(--brand)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6, transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--brand-faint)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}
              >View all <ChevronRight size={12}/></button>
            </div>

            {topCustomers.length === 0 ? (
              <EmptyState icon={<Users size={22} style={{color:'var(--text-tertiary)'}}/>} text="No customer data yet"/>
            ) : (
              <>
                {topCustomers.map((c, i) => {
                  const totalRev = topCustomers[0].total || 1;
                  const pct = (c.total / totalRev) * 100;
                  return (
                    <div key={c.name} style={{ marginBottom: i<topCustomers.length-1?16:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                        <Avatar name={c.name} size={28}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize:11, color:'var(--text-tertiary)' }}>{c.count} order{c.count!==1?'s':''}</p>
                        </div>
                        <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                          {formatCurrency(c.total, sym)}
                        </span>
                      </div>
                      <div style={{ height:3, background:'var(--canvas)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:'var(--brand)', borderRadius:2, opacity: 0.5+i*-0.08 }}/>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Summary footer */}
            <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <div>
                <p style={{ fontSize:10.5, color:'var(--text-tertiary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Total Customers</p>
                <p style={{ fontSize:18, fontWeight:900, color:'var(--text-primary)' }}>{(customers||[]).length}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:10.5, color:'var(--text-tertiary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Total Revenue</p>
                <p style={{ fontSize:18, fontWeight:900, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(invoices.reduce((s,i)=>s+(i.grandTotal||0),0), sym)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ LOW STOCK ALERT PANEL ══════════════════════════════════════ */}
        {lowStockItems.length > 0 && (
          <div style={{ marginTop:14, background:'var(--surface)', borderRadius:16, border:'1.5px solid var(--warning-border)', padding:'20px 24px', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:'var(--warning-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <AlertTriangle size={16} style={{color:'var(--warning)'}} strokeWidth={2}/>
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.2 }}>Low Stock Alert</p>
                  <p style={{ fontSize:11, color:'var(--text-tertiary)' }}>{lowStockItems.length} product{lowStockItems.length!==1?'s':''} need restocking</p>
                </div>
              </div>
              <button onClick={()=>nav('/purchase-orders')}
                style={{ display:'flex', alignItems:'center', gap:5, height:32, padding:'0 12px', borderRadius:8, background:'#CA8A04', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff', transition:'opacity 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}
              >
                <ShoppingCart size={13}/> Create PO
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10 }}>
              {lowStockItems.slice(0,8).map(p => {
                const isOut = p.stock === 0;
                return (
                  <div key={p.id} onClick={()=>nav('/products')}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
                      background: isOut?'var(--error-bg)':'var(--warning-bg)',
                      border:`1.5px solid ${isOut?'var(--error-border)':'var(--warning-border)'}`,
                      cursor:'pointer', transition:'box-shadow 0.13s' }}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-sm)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                  >
                    <div style={{ width:30, height:30, borderRadius:8, background: isOut?'rgba(220,38,38,0.12)':'rgba(202,138,4,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Package size={13} style={{color: isOut?'var(--error)':'#CA8A04'}}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                      <p style={{ fontSize:10, color: isOut?'var(--error)':'#CA8A04', fontWeight:700 }}>
                        {isOut ? 'Out of stock' : `${p.stock} / min ${p.minStock}`}
                      </p>
                    </div>
                    <ChevronRight size={11} style={{color:'var(--text-tertiary)', flexShrink:0}}/>
                  </div>
                );
              })}
              {lowStockItems.length > 8 && (
                <div onClick={()=>nav('/products')}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 12px', borderRadius:10, background:'var(--canvas)', border:'1.5px dashed var(--border)', cursor:'pointer', fontSize:12, fontWeight:600, color:'var(--text-tertiary)', transition:'color 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--brand)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}
                >
                  +{lowStockItems.length-8} more →
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Quick Action Button ────────────────────────────────────────────── */
function QuickActionBtn({ label, icon, bg, accent, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:8, height:36, padding:'0 14px',
        borderRadius:9, cursor:'pointer', border:'1.5px solid',
        transition:'all 0.14s var(--ease)',
        background: hov ? bg : 'var(--surface)',
        borderColor: hov ? `${accent}40` : 'var(--border)',
        boxShadow: hov ? `0 2px 12px ${accent}20` : 'none',
      }}
    >
      <span style={{ color: accent }}>{icon}</span>
      <span style={{ fontSize:12.5, fontWeight:600, color: hov ? accent : 'var(--text-secondary)', whiteSpace:'nowrap' }}>{label}</span>
    </button>
  );
}

/* ─── Empty State ─────────────────────────────────────────────────────── */
function EmptyState({ icon, text }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:120, gap:10, textAlign:'center' }}>
      <div style={{ width:44, height:44, borderRadius:12, background:'var(--canvas)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {icon}
      </div>
      <p style={{ fontSize:13, color:'var(--text-tertiary)', fontWeight:500 }}>{text}</p>
    </div>
  );
}
