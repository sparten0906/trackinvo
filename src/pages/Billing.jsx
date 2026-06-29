import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, Receipt, Check, X, Tag,
  ShoppingCart, User, ScanLine, Keyboard, ArrowRight, RotateCcw,
  Package, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatCurrency, calcInvoiceTotals, calcBalance,
  derivePaymentStatus, today, isLowStock, generateInvoiceNumber,
} from '../utils/helpers';
import toast from 'react-hot-toast';
import InvoiceViewer from '../components/invoice/InvoiceViewer';

/* ─── Constants ─────────────────────────────────────────────────────── */
const PAY_METHODS = [
  { value: 'cash',   label: 'Cash',   color: '#16A34A' },
  { value: 'upi',    label: 'UPI',    color: '#2563EB' },
  { value: 'card',   label: 'Card',   color: '#7C3AED' },
  { value: 'credit', label: 'Credit', color: '#D97706' },
];

const EMPTY = {
  customerId: '', customerName: '', isWalkIn: false,
  date: today(), dueDate: '',
  discountType: 'fixed', discountValue: '',
  paidAmount: '', paymentMethod: 'cash', notes: '',
};

const PALETTE = [
  '#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981',
  '#3B82F6','#EF4444','#14B8A6','#F97316','#06B6D4',
];

/* ─── Billing ───────────────────────────────────────────────────────── */
export default function Billing() {
  const { state, addInvoice } = useApp();
  const { products, customers, categories, settings } = state;
  const sym = settings.currencySymbol || '₹';

  const [cart, setCart]                 = useState([]);
  const [form, setForm]                 = useState(EMPTY);
  const [search, setSearch]             = useState('');
  const [activeCat, setActiveCat]       = useState('');
  const [custQuery, setCustQuery]       = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [saved, setSaved]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [mobileCartOpen, setMobileCart] = useState(false);
  const [scanMode, setScanMode]         = useState(false);
  const [scanQuery, setScanQuery]       = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [showShortcuts, setShortcuts]   = useState(false);

  const searchRef   = useRef(null);
  const scanRef     = useRef(null);
  const custDropRef = useRef(null);

  /* ── close customer dropdown on outside click ── */
  useEffect(() => {
    const h = e => { if (custDropRef.current && !custDropRef.current.contains(e.target)) setShowCustDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const h = e => {
      const busy = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (!busy && e.key === '?')                           { setShortcuts(v => !v); return; }
      if (e.key === 'Escape') {
        if (showShortcuts)  { setShortcuts(false); return; }
        if (showCustDrop)   { setShowCustDrop(false); return; }
        if (scanMode)       { setScanMode(false); return; }
        if (search)         { setSearch(''); return; }
        return;
      }
      if (!busy && e.key === '/')                           { e.preventDefault(); searchRef.current?.focus(); return; }
      if (!busy && e.key === 'F2')                          { e.preventDefault(); setShowCustDrop(true); return; }
      if ((e.ctrlKey||e.metaKey) && e.key === 'Enter')     { e.preventDefault(); cart.length > 0 ? handleSave() : toast.error('Add products first'); return; }
      if ((e.ctrlKey||e.metaKey) && e.key === 'Backspace') { e.preventDefault(); if (cart.length) { setCart([]); toast.success('Order cleared'); } return; }
      if (!busy && e.altKey && e.key.toLowerCase()==='s')  { e.preventDefault(); setScanMode(v => !v); return; }
      if (e.altKey && ['1','2','3','4'].includes(e.key))   { setF('paymentMethod', PAY_METHODS[+e.key-1].value); return; }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showShortcuts, showCustDrop, scanMode, search, cart.length]);

  useEffect(() => {
    if (scanMode) setTimeout(() => scanRef.current?.focus(), 60);
    else { setScanQuery(''); setScanFeedback(null); }
  }, [scanMode]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── derived ── */
  const activeCustomers = useMemo(() => customers.filter(c => c.status === 'active'), [customers]);
  const custResults     = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    const src = q
      ? activeCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q))
      : activeCustomers;
    return src.slice(0, 8);
  }, [activeCustomers, custQuery]);

  const selectedCust   = customers.find(c => c.id === form.customerId);
  const activeProducts = useMemo(() => products.filter(p => p.status === 'active'), [products]);
  const displayed      = useMemo(() => {
    let list = activeProducts;
    if (activeCat) list = list.filter(p => p.categoryId === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode||'').includes(q)
      );
    }
    return list;
  }, [activeProducts, activeCat, search]);

  const totals    = useMemo(() => calcInvoiceTotals(cart, form.discountType, form.discountValue), [cart, form.discountType, form.discountValue]);
  const effPaid   = form.paidAmount === '' ? totals.grandTotal : +form.paidAmount;
  const balAmt    = calcBalance(totals.grandTotal, effPaid);
  const payStatus = derivePaymentStatus(totals.grandTotal, effPaid);
  const cartUnits = cart.reduce((s, i) => s + i.quantity, 0);
  const change    = effPaid > totals.grandTotal ? effPaid - totals.grandTotal : 0;

  /* ── handlers ── */
  const pickCustomer  = c => { setForm(f => ({...f, customerId:c.id, customerName:c.name, isWalkIn:false})); setCustQuery(c.name); setShowCustDrop(false); };
  const clearCustomer = () => { setForm(f => ({...f, customerId:'', customerName:'', isWalkIn:false})); setCustQuery(''); };

  const addToCart = useCallback(product => {
    if (product.stock === 0) { toast.error(`${product.name} is out of stock`); return; }
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) {
        if (ex.quantity >= product.stock) { toast.error(`Only ${product.stock} available`); return prev; }
        return prev.map(i => i.productId === product.id ? {...i, quantity: i.quantity + 1} : i);
      }
      if (!prev.length && window.innerWidth < 1024) setMobileCart(true);
      return [...prev, {
        productId: product.id, productName: product.name, sku: product.sku,
        quantity: 1, unitPrice: +product.sellingPrice,
        taxPercent: +(product.taxPercent||0), discount: 0,
        availableStock: product.stock,
        _color: PALETTE[products.findIndex(p => p.id === product.id) % PALETTE.length],
      }];
    });
  }, [products]);

  const updateQty  = (id, qty) => {
    const item = cart.find(i => i.productId === id);
    const n = Math.max(1, Math.min(+qty||1, item?.availableStock||9999));
    setCart(prev => prev.map(i => i.productId === id ? {...i, quantity: n} : i));
  };
  const updateDisc = (id, val) => setCart(prev => prev.map(i => i.productId === id ? {...i, discount: Math.max(0, +val||0)} : i));
  const removeItem = id => {
    const item = cart.find(i => i.productId === id);
    if (item) {
      toast((t) => (
        <span style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
          Removed <strong>{item.productName}</strong>
          <button onClick={() => { setCart(c => [...c, item]); toast.dismiss(t.id); }}
            style={{padding:'3px 10px',borderRadius:6,background:'var(--brand)',border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <RotateCcw size={10}/> Undo
          </button>
        </span>
      ), {duration:4000});
    }
    setCart(prev => prev.filter(i => i.productId !== id));
  };

  const handleScanSubmit = raw => {
    const q = raw.trim(); setScanQuery('');
    if (!q) return;
    const match = activeProducts.find(p => (p.barcode && p.barcode===q) || p.sku===q);
    if (match) { addToCart(match); setScanFeedback({ok:true, name:match.name}); }
    else setScanFeedback({ok:false, name:q});
    setTimeout(()=>setScanFeedback(null), 2200);
    scanRef.current?.focus();
  };

  const handleSave = async () => {
    if (!cart.length) { toast.error('Add at least one product'); return; }
    if (form.paidAmount !== '' && +form.paidAmount < 0) { toast.error('Amount must be ≥ 0'); return; }
    for (const item of cart) {
      const p = products.find(p => p.id === item.productId);
      if (!p || p.stock < item.quantity) { toast.error(`Insufficient stock: ${item.productName}`); return; }
    }
    setSaving(true);
    const customer      = customers.find(c => c.id === form.customerId);
    const invoiceNumber = generateInvoiceNumber(settings.invoicePrefix, state.invoices);
    const data = {
      invoiceNumber,
      customerId:    form.isWalkIn ? null : (form.customerId || null),
      customerName:  form.isWalkIn ? (form.customerName.trim()||'Walk-in') : (customer?.name||'Walk-in'),
      date: form.date, dueDate: form.dueDate || null,
      discountType: form.discountType, discountValue: +form.discountValue||0,
      paymentMethod: form.paymentMethod, notes: form.notes,
      items: cart, ...totals,
      paidAmount: effPaid, balanceAmount: balAmt,
      paymentStatus: payStatus, returnStatus: 'none',
      createdAt: new Date().toISOString(),
    };
    const ok = await addInvoice(data);
    setSaving(false);
    if (ok !== false) { setSaved({...data, _customer:customer}); setCart([]); setForm(EMPTY); setCustQuery(''); setSearch(''); }
  };

  const reset = () => { setCart([]); setForm(EMPTY); setCustQuery(''); setSaved(null); setSearch(''); setMobileCart(false); };

  /* ══════════════════════════════════════════════════════════════
     SAVED INVOICE — full-screen view after charge
  ══════════════════════════════════════════════════════════════ */
  if (saved) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--canvas)'}} className="animate-fadeIn">
      <div style={{flexShrink:0,height:52,padding:'0 20px',display:'flex',alignItems:'center',gap:14,background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
        <div style={{width:30,height:30,borderRadius:'50%',background:'var(--success-bg)',border:'1.5px solid var(--success-border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Check size={14} strokeWidth={2.5} style={{color:'var(--success)'}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>
            Invoice <span style={{color:'var(--brand)'}}>{saved.invoiceNumber}</span> saved
          </p>
          <p style={{fontSize:12,color:'var(--text-tertiary)',marginTop:1}}>
            {saved.items.length} item{saved.items.length!==1?'s':''} · {formatCurrency(saved.grandTotal,sym)} · {saved.paymentMethod}
          </p>
        </div>
        <button onClick={reset}
          style={{display:'flex',alignItems:'center',gap:7,height:34,padding:'0 16px',borderRadius:8,background:'var(--brand)',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',transition:'background 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--brand-hover)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--brand)'}
        ><Receipt size={13}/> New Sale</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'24px 20px 40px',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:'100%',maxWidth:860}}>
          <InvoiceViewer invoice={saved} settings={settings} sym={sym} customer={saved._customer}/>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     CUSTOMER WIDGET — defined as function to avoid remount bug
  ══════════════════════════════════════════════════════════════ */
  const CustomerWidget = () => (
    <div ref={custDropRef} style={{position:'relative'}}>
      {form.customerId ? (
        /* selected */
        <div style={{display:'flex',alignItems:'center',gap:8,height:36,padding:'0 10px',borderRadius:8,background:'rgba(79,70,229,0.08)',border:'1.5px solid rgba(79,70,229,0.2)'}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#fff',flexShrink:0}}>
            {(selectedCust?.name||'?').charAt(0).toUpperCase()}
          </div>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {selectedCust?.name}
          </span>
          {selectedCust?.phone && <span style={{fontSize:11,color:'var(--text-tertiary)',flexShrink:0}}>{selectedCust.phone}</span>}
          <button onClick={e=>{e.stopPropagation();clearCustomer();}}
            style={{width:18,height:18,borderRadius:4,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',padding:0,flexShrink:0,transition:'color 0.1s'}}
            onMouseEnter={e=>e.currentTarget.style.color='var(--error)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}
          ><X size={11}/></button>
        </div>
      ) : form.isWalkIn ? (
        /* walk-in */
        <div style={{display:'flex',alignItems:'center',gap:8,height:36,padding:'0 10px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)'}}>
          <User size={12} style={{color:'var(--text-tertiary)',flexShrink:0}}/>
          <input value={form.customerName} onChange={e=>setF('customerName',e.target.value)}
            placeholder="Walk-in customer name"
            style={{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--text-primary)',fontSize:13,minWidth:0}}/>
          <button onClick={clearCustomer}
            style={{width:18,height:18,borderRadius:4,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',padding:0,flexShrink:0}}>
            <X size={11}/>
          </button>
        </div>
      ) : (
        /* default — pick or walk-in */
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setShowCustDrop(true)}
            style={{flex:1,display:'flex',alignItems:'center',gap:7,height:36,padding:'0 10px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)',cursor:'pointer',transition:'border-color 0.12s',textAlign:'left'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
          >
            <User size={12} style={{color:'var(--text-tertiary)',flexShrink:0}}/>
            <span style={{fontSize:12.5,color:'var(--text-tertiary)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Add customer</span>
            <kbd style={{fontSize:9,fontFamily:'monospace',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 4px',color:'var(--text-tertiary)',flexShrink:0}}>F2</kbd>
          </button>
          <button onClick={()=>setF('isWalkIn',true)}
            style={{height:36,padding:'0 10px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)',cursor:'pointer',fontSize:12,fontWeight:500,color:'var(--text-tertiary)',whiteSpace:'nowrap',transition:'all 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-primary)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-tertiary)';}}
          >Walk-in</button>
        </div>
      )}

      {/* Dropdown */}
      {showCustDrop && !form.customerId && !form.isWalkIn && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:500,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow-xl)',overflow:'hidden'}}>
          <div style={{padding:'8px 8px 4px'}}>
            <div style={{position:'relative'}}>
              <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
              <input autoFocus value={custQuery} onChange={e=>setCustQuery(e.target.value)}
                placeholder="Search by name, phone, email…"
                style={{width:'100%',height:34,paddingLeft:28,paddingRight:10,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:7,outline:'none',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{maxHeight:200,overflowY:'auto',borderTop:'1px solid var(--border)'}}>
            {custResults.map((c,i) => (
              <button key={c.id} onClick={()=>pickCustomer(c)}
                style={{width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:9,padding:'8px 12px',background:'transparent',border:'none',cursor:'pointer',borderTop:i>0?'1px solid var(--border)':'none',transition:'background 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--canvas)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <div style={{width:28,height:28,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700,flexShrink:0}}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{c.name}</p>
                  {(c.phone||c.email) && <p style={{fontSize:11,color:'var(--text-tertiary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{[c.phone,c.email].filter(Boolean).join(' · ')}</p>}
                </div>
              </button>
            ))}
            {custResults.length===0 && <p style={{padding:'12px',textAlign:'center',fontSize:13,color:'var(--text-tertiary)'}}>No customers found</p>}
          </div>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     ORDER PANEL — right panel, defined as function
  ══════════════════════════════════════════════════════════════ */
  const OrderPanel = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#111114',borderLeft:'1px solid rgba(255,255,255,0.07)'}}>

      {/* ─── Customer row ─────────────────────────────── */}
      <div style={{flexShrink:0,padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        {CustomerWidget()}
      </div>

      {/* ─── Cart items ───────────────────────────────── */}
      <div style={{flex:1,overflowY:'auto',overflowX:'hidden'}}>
        {!cart.length ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,padding:'0 20px 60px',textAlign:'center'}}>
            <div style={{width:52,height:52,borderRadius:14,background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ShoppingCart size={20} style={{color:'rgba(255,255,255,0.08)'}}/>
            </div>
            <p style={{fontSize:13.5,fontWeight:600,color:'rgba(255,255,255,0.14)'}}>Cart is empty</p>
            <p style={{fontSize:11.5,color:'rgba(255,255,255,0.08)',lineHeight:1.8}}>
              Click a product to add<br/>
              <kbd style={{fontFamily:'monospace',fontSize:10,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,padding:'1px 5px',color:'rgba(255,255,255,0.2)'}}>/</kbd> to search &nbsp;·&nbsp;
              <kbd style={{fontFamily:'monospace',fontSize:10,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,padding:'1px 5px',color:'rgba(255,255,255,0.2)'}}>Alt+S</kbd> to scan
            </p>
          </div>
        ) : (
          <>
            {/* Items header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px 4px'}}>
              <span style={{fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.2)'}}>
                {cart.length} item{cart.length!==1?'s':''} · {cartUnits} unit{cartUnits!==1?'s':''}
              </span>
              <button onClick={()=>{setCart([]);toast.success('Order cleared');}}
                style={{fontSize:11,color:'rgba(255,255,255,0.18)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3,padding:'2px 6px',borderRadius:4,transition:'color 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.color='#F87171'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.18)'}
              ><Trash2 size={9}/> Clear</button>
            </div>

            {/* Each item — one row */}
            {cart.map(item => {
              const lineNet = Math.max(0, item.unitPrice*item.quantity - item.discount);
              const lineTax = lineNet * item.taxPercent / 100;
              const total   = lineNet + lineTax;
              const clr     = item._color || PALETTE[0];
              return (
                <div key={item.productId}
                  style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  {/* Color swatch */}
                  <div style={{width:6,flexShrink:0,alignSelf:'stretch',borderRadius:3,background:clr,opacity:0.7}}/>

                  {/* Name + sku */}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12.5,fontWeight:600,color:'rgba(255,255,255,0.85)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>
                      {item.productName}
                    </p>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                      {/* Qty stepper */}
                      <div style={{display:'flex',alignItems:'center',borderRadius:6,border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden',flexShrink:0}}>
                        <button onClick={()=>item.quantity===1?removeItem(item.productId):updateQty(item.productId,item.quantity-1)}
                          style={{width:24,height:22,background:'rgba(255,255,255,0.04)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:item.quantity===1?'#F87171':'rgba(255,255,255,0.4)',transition:'background 0.1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.09)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                        >{item.quantity===1?<Trash2 size={9}/>:<Minus size={9}/>}</button>
                        <span style={{fontSize:11.5,fontWeight:700,color:'#fff',minWidth:24,textAlign:'center',lineHeight:'22px',fontVariantNumeric:'tabular-nums',borderLeft:'1px solid rgba(255,255,255,0.07)',borderRight:'1px solid rgba(255,255,255,0.07)'}}>
                          {item.quantity}
                        </span>
                        <button onClick={()=>updateQty(item.productId,item.quantity+1)} disabled={item.quantity>=item.availableStock}
                          style={{width:24,height:22,background:'rgba(255,255,255,0.04)',border:'none',cursor:item.quantity>=item.availableStock?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.4)',opacity:item.quantity>=item.availableStock?0.25:1,transition:'background 0.1s'}}
                          onMouseEnter={e=>{if(item.quantity<item.availableStock)e.currentTarget.style.background='rgba(255,255,255,0.09)';}}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                        ><Plus size={9}/></button>
                      </div>
                      {/* Discount */}
                      <div style={{display:'flex',alignItems:'center',gap:3,padding:'0 6px',height:22,borderRadius:5,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)',flexShrink:0}}>
                        <Tag size={8} style={{color:'rgba(255,255,255,0.2)',flexShrink:0}}/>
                        <input type="number" min="0" step="0.01" value={item.discount||''} onChange={e=>updateDisc(item.productId,e.target.value)} placeholder="0"
                          style={{width:32,background:'transparent',border:'none',color:item.discount>0?'#FDBA74':'rgba(255,255,255,0.25)',fontSize:11,outline:'none',fontVariantNumeric:'tabular-nums',padding:0}}/>
                      </div>
                    </div>
                  </div>

                  {/* Line total + remove */}
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:700,color:'#A5B4FC',fontVariantNumeric:'tabular-nums'}}>
                      {formatCurrency(total,sym)}
                    </span>
                    <button onClick={()=>removeItem(item.productId)}
                      style={{width:18,height:18,borderRadius:4,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.15)',padding:0,transition:'color 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.color='#F87171'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.15)'}
                    ><X size={10}/></button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ─── Totals + payment + charge ────────────────── */}
      <div style={{flexShrink:0,borderTop:'1px solid rgba(255,255,255,0.07)',background:'#0D0D10'}}>

        {/* Breakdown — only show when there's something to break down */}
        {cart.length>0 && (totals.itemDiscounts>0||totals.taxAmount>0) && (
          <div style={{padding:'10px 14px 0',display:'flex',flexDirection:'column',gap:3}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.3)'}}>
              <span>Subtotal</span>
              <span style={{fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totals.subtotal,sym)}</span>
            </div>
            {totals.itemDiscounts>0 && (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#4ADE80'}}>
                <span>Discount</span>
                <span style={{fontVariantNumeric:'tabular-nums'}}>−{formatCurrency(Math.min(totals.itemDiscounts,totals.subtotal),sym)}</span>
              </div>
            )}
            {totals.itemDiscounts>totals.subtotal && (
              <div style={{fontSize:10.5,color:'#FB923C',background:'rgba(251,146,60,0.1)',borderRadius:4,padding:'3px 8px',display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontWeight:800}}>⚠</span> Discount capped to {formatCurrency(totals.subtotal,sym)}
              </div>
            )}
            {totals.taxAmount>0 && (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.3)'}}>
                <span>Tax</span>
                <span style={{fontVariantNumeric:'tabular-nums'}}>+{formatCurrency(totals.taxAmount,sym)}</span>
              </div>
            )}
          </div>
        )}

        {/* Grand total */}
        <div style={{padding:'10px 14px 8px',display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
          <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)'}}>Total</span>
          <span style={{fontSize:26,fontWeight:900,letterSpacing:'-0.04em',lineHeight:1,fontVariantNumeric:'tabular-nums',color:cart.length?'#fff':'rgba(255,255,255,0.1)'}}>
            {formatCurrency(totals.grandTotal,sym)}
          </span>
        </div>

        {/* Payment method — compact horizontal pills */}
        <div style={{padding:'0 14px 8px',display:'flex',gap:5}}>
          {PAY_METHODS.map((m,i)=>{
            const active = form.paymentMethod===m.value;
            return (
              <button key={m.value} onClick={()=>setF('paymentMethod',m.value)}
                style={{flex:1,height:30,borderRadius:7,border:'none',cursor:'pointer',fontSize:11.5,fontWeight:active?700:500,transition:'all 0.13s',
                  background:active?`${m.color}22`:'rgba(255,255,255,0.04)',
                  color:active?'#fff':'rgba(255,255,255,0.3)',
                  outline:active?`1.5px solid ${m.color}55`:'1.5px solid rgba(255,255,255,0.07)',
                }}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.7)';}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.3)';}}}
                title={`Alt+${i+1}`}
              >{m.label}</button>
            );
          })}
        </div>

        {/* Amount received */}
        <div style={{padding:'0 14px 8px'}}>
          <div style={{position:'relative',borderRadius:8,border:'1.5px solid rgba(255,255,255,0.09)',background:'rgba(255,255,255,0.04)',transition:'border-color 0.15s'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.18)',pointerEvents:'none'}}>{sym}</span>
            <input type="number" min="0" step="0.01" value={form.paidAmount}
              onChange={e=>setF('paidAmount',e.target.value)}
              placeholder={totals.grandTotal>0?totals.grandTotal.toFixed(2):'0.00'}
              style={{width:'100%',height:42,paddingLeft:28,paddingRight:form.paidAmount&&cart.length?90:12,background:'transparent',border:'none',color:'#fff',fontSize:18,fontWeight:800,outline:'none',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.03em',boxSizing:'border-box'}}
              onFocus={e=>e.currentTarget.parentElement.style.borderColor='rgba(129,140,248,0.5)'}
              onBlur={e=>e.currentTarget.parentElement.style.borderColor='rgba(255,255,255,0.09)'}
            />
            {form.paidAmount!==''&&cart.length>0&&(
              <div style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                {change>0
                  ? <span style={{fontSize:11,fontWeight:700,color:'#4ADE80',background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:5,padding:'2px 7px',whiteSpace:'nowrap'}}>Chg {formatCurrency(change,sym)}</span>
                  : balAmt>0
                    ? <span style={{fontSize:11,fontWeight:700,color:'#FB923C',background:'rgba(251,146,60,0.12)',border:'1px solid rgba(251,146,60,0.25)',borderRadius:5,padding:'2px 7px',whiteSpace:'nowrap'}}>Due {formatCurrency(balAmt,sym)}</span>
                    : <Check size={14} strokeWidth={2.5} style={{color:'#4ADE80'}}/>
                }
              </div>
            )}
          </div>
        </div>

        {/* Charge CTA */}
        <div style={{padding:'0 14px 14px'}}>
          <button onClick={()=>cart.length?handleSave():toast.error('Add products to start')}
            disabled={!cart.length||saving}
            style={{
              width:'100%',height:50,borderRadius:10,border:'none',
              cursor:cart.length&&!saving?'pointer':'not-allowed',
              display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              fontSize:15,fontWeight:800,letterSpacing:'0.01em',
              transition:'all 0.18s',
              background:cart.length?'linear-gradient(135deg,#4F46E5,#7C3AED)':'rgba(255,255,255,0.05)',
              color:cart.length?'#fff':'rgba(255,255,255,0.1)',
              boxShadow:cart.length&&!saving?'0 4px 20px rgba(79,70,229,0.4)':'none',
            }}
            onMouseEnter={e=>{if(cart.length&&!saving)e.currentTarget.style.boxShadow='0 8px 28px rgba(79,70,229,0.6)';}}
            onMouseLeave={e=>{if(cart.length)e.currentTarget.style.boxShadow='0 4px 20px rgba(79,70,229,0.4)';}}
          >
            {saving?(
              <><span style={{width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> Saving…</>
            ):cart.length?(
              <><Receipt size={15} strokeWidth={2.5}/> Charge {formatCurrency(totals.grandTotal,sym)} <ArrowRight size={14} strokeWidth={2.5}/></>
            ):(
              <><ShoppingCart size={15}/> Add products to begin</>
            )}
          </button>
          {cart.length>0&&<p style={{textAlign:'center',fontSize:10,color:'rgba(255,255,255,0.14)',marginTop:5}}>Ctrl+Enter to charge</p>}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════════ */
  const cats = [{id:'',name:'All'}, ...categories];

  return (
    <div className="animate-fadeIn" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

      {/* ─────────────────────────────────────────────────────────
          TOP TOOLBAR — search / scan / shortcuts only
          No branding, no user info, no date duplication.
      ───────────────────────────────────────────────────────── */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>

        {/* Search */}
        <div style={{flex:1,position:'relative'}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
          <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search products by name, SKU, or barcode…"
            style={{width:'100%',height:38,paddingLeft:36,paddingRight:search?34:40,background:'var(--canvas)',border:'1.5px solid var(--border)',borderRadius:9,fontSize:13.5,color:'var(--text-primary)',outline:'none',boxSizing:'border-box',transition:'all 0.15s'}}
            onFocus={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(79,70,229,0.1)';e.currentTarget.style.background='#fff';}}
            onBlur={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='var(--canvas)';}}
          />
          {search?(
            <button onClick={()=>{setSearch('');searchRef.current?.focus();}}
              style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'var(--zinc-200)',border:'none',borderRadius:4,cursor:'pointer',color:'var(--text-secondary)',display:'flex',padding:'3px'}}>
              <X size={11}/>
            </button>
          ):(
            <kbd style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',fontSize:10.5,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,padding:'2px 6px',color:'var(--text-tertiary)',fontFamily:'monospace',pointerEvents:'none'}}>/</kbd>
          )}
        </div>

        {/* Scan toggle */}
        {scanMode?(
          <div style={{display:'flex',alignItems:'center',gap:7,height:38,padding:'0 12px',background:'rgba(74,222,128,0.06)',border:'1.5px solid rgba(74,222,128,0.3)',borderRadius:9,flexShrink:0}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#4ADE80',display:'inline-block',flexShrink:0}}/>
            <input ref={scanRef} value={scanQuery}
              onChange={e=>setScanQuery(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleScanSubmit(scanQuery);}}}
              placeholder="Scan barcode…"
              style={{background:'transparent',border:'none',outline:'none',color:'#166534',fontSize:13,width:120}}/>
            {scanFeedback&&<span style={{fontSize:11,fontWeight:700,color:scanFeedback.ok?'#16A34A':'#DC2626',flexShrink:0}}>{scanFeedback.ok?'✓ Added':'✗ Not found'}</span>}
            <button onClick={()=>setScanMode(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#166534',display:'flex',padding:0,flexShrink:0}}><X size={11}/></button>
          </div>
        ):(
          <button onClick={()=>setScanMode(true)}
            style={{display:'flex',alignItems:'center',gap:6,height:38,padding:'0 12px',borderRadius:9,background:'var(--canvas)',border:'1.5px solid var(--border)',color:'var(--text-secondary)',fontSize:13,fontWeight:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',transition:'all 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
          ><ScanLine size={14}/> Scan</button>
        )}

        {/* Shortcuts */}
        <button onClick={()=>setShortcuts(true)}
          style={{width:38,height:38,borderRadius:9,background:'var(--canvas)',border:'1.5px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',flexShrink:0,transition:'all 0.12s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-tertiary)';}}
          title="Keyboard shortcuts (?)"
        ><Keyboard size={14}/></button>
      </div>

      {/* ─────────────────────────────────────────────────────────
          CATEGORY STRIP — horizontal pills, not a separate rail
      ───────────────────────────────────────────────────────── */}
      <div style={{flexShrink:0,padding:'6px 14px',display:'flex',gap:5,overflowX:'auto',scrollbarWidth:'none',background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
        {cats.map(c=>{
          const active = activeCat===c.id;
          return (
            <button key={c.id} onClick={()=>setActiveCat(c.id)}
              style={{display:'inline-flex',alignItems:'center',padding:'4px 12px',borderRadius:20,fontSize:12.5,fontWeight:active?700:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',transition:'all 0.12s',
                background:active?'var(--brand)':'transparent',
                color:active?'#fff':'var(--text-secondary)',
                border:active?'1.5px solid transparent':'1.5px solid var(--border)',
              }}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--brand-faint)';e.currentTarget.style.borderColor='var(--brand-light)';e.currentTarget.style.color='var(--brand)';}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}}
            >{c.name}</button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────
          WORKSPACE — product grid left / order panel right
      ───────────────────────────────────────────────────────── */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* ── PRODUCT GRID ── */}
        <div style={{flex:1,overflowY:'auto',padding:12,background:'var(--canvas)',minWidth:0}}>
          {displayed.length===0?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,paddingBottom:48}}>
              <div style={{width:48,height:48,borderRadius:12,background:'var(--surface)',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Package size={20} style={{color:'var(--text-tertiary)'}}/>
              </div>
              <p style={{fontSize:14,fontWeight:600,color:'var(--text-secondary)'}}>No products found</p>
              {search&&<button onClick={()=>setSearch('')} style={{padding:'5px 14px',borderRadius:7,background:'var(--brand-faint)',color:'var(--brand)',border:'none',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>Clear search</button>}
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
              {displayed.map((p,idx)=>{
                const inCart     = cart.find(i=>i.productId===p.id);
                const outOfStock = p.stock===0;
                const low        = !outOfStock&&isLowStock(p);
                const color      = PALETTE[idx%PALETTE.length];
                return (
                  <ProductTile key={p.id} product={p} inCart={inCart} outOfStock={outOfStock} low={low} color={color} sym={sym} onAdd={addToCart}/>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ORDER PANEL — desktop ── */}
        <div style={{width:380,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden'}} className="hidden lg:flex">
          {OrderPanel()}
        </div>
      </div>

      {/* ── MOBILE: floating cart FAB + side drawer ── */}
      <div className="lg:hidden">
        <button onClick={()=>setMobileCart(true)}
          style={{position:'fixed',bottom:70,right:16,zIndex:100,width:52,height:52,borderRadius:'50%',background:'var(--brand)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 18px rgba(79,70,229,0.5)'}}>
          <ShoppingCart size={20} color="#fff"/>
          {cartUnits>0&&<span style={{position:'absolute',top:-3,right:-3,minWidth:18,height:18,borderRadius:9,background:'#EF4444',color:'#fff',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{cartUnits}</span>}
        </button>
        {mobileCartOpen&&(
          <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)'}} onClick={()=>setMobileCart(false)}>
            <div style={{position:'absolute',top:0,right:0,bottom:0,width:'min(380px,100%)'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setMobileCart(false)} style={{position:'absolute',top:12,left:-40,zIndex:10,width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}><X size={14}/></button>
              {OrderPanel()}
            </div>
          </div>
        )}
      </div>

      {/* Shortcuts overlay */}
      {showShortcuts&&<ShortcutsOverlay onClose={()=>setShortcuts(false)}/>}
    </div>
  );
}

/* ─── ProductTile — dense 120px-tall card ───────────────────────────── */
function ProductTile({product:p, inCart, outOfStock, low, color, sym, onAdd}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={()=>!outOfStock&&onAdd(p)}
      style={{
        position:'relative',background:'var(--surface)',borderRadius:12,overflow:'hidden',
        border:inCart?'2px solid var(--brand)':'1.5px solid var(--border)',
        boxShadow:inCart?'0 0 0 3px rgba(79,70,229,0.12)':hov?'var(--shadow-md)':'var(--shadow-xs)',
        opacity:outOfStock?0.45:1,
        transition:'all 0.14s var(--ease)',
        transform:hov&&!outOfStock?'translateY(-1px)':'none',
        cursor:outOfStock?'not-allowed':'pointer',
        userSelect:'none',
      }}
    >
      {/* In-cart qty badge */}
      {inCart&&<div style={{position:'absolute',top:7,right:7,zIndex:3,minWidth:20,height:20,borderRadius:10,background:'var(--brand)',color:'#fff',fontSize:10.5,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',boxShadow:'0 2px 6px rgba(79,70,229,0.5)'}}>{inCart.quantity}</div>}
      {/* Low stock badge */}
      {low&&!inCart&&<div style={{position:'absolute',top:7,left:7,zIndex:3,fontSize:9,padding:'2px 5px',borderRadius:4,background:'var(--warning-bg)',color:'var(--warning)',border:'1px solid var(--warning-border)',fontWeight:700}}>Low</div>}
      {/* Out of stock overlay */}
      {outOfStock&&<div style={{position:'absolute',inset:0,zIndex:2,background:'rgba(255,255,255,0.75)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:9.5,fontWeight:800,color:'#fff',background:'#EF4444',padding:'2px 8px',borderRadius:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Out of stock</span></div>}

      {/* Avatar */}
      <div style={{height:64,display:'flex',alignItems:'center',justifyContent:'center',background:`${color}12`}}>
        <div style={{width:40,height:40,borderRadius:11,background:color,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 3px 12px ${color}35`,transition:'transform 0.14s',transform:hov&&!outOfStock?'scale(1.08)':'scale(1)'}}>
          <span style={{fontSize:20,fontWeight:900,color:'rgba(255,255,255,0.92)',lineHeight:1}}>{p.name.charAt(0).toUpperCase()}</span>
        </div>
      </div>

      {/* Info */}
      <div style={{padding:'8px 10px 10px'}}>
        <p style={{fontSize:12,fontWeight:700,lineHeight:1.35,color:'var(--text-primary)',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:32}}>
          {p.name}
        </p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:6,gap:4}}>
          <span style={{fontSize:14,fontWeight:800,color:'var(--brand)',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em'}}>
            {formatCurrency(p.sellingPrice,sym)}
          </span>
          {!outOfStock&&(
            <span style={{fontSize:10,color:low?'var(--warning)':'var(--text-tertiary)',fontWeight:low?700:400,background:low?'var(--warning-bg)':'var(--canvas)',border:`1px solid ${low?'var(--warning-border)':'var(--border)'}`,padding:'1px 5px',borderRadius:20,flexShrink:0}}>
              {p.stock}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ShortcutsOverlay ───────────────────────────────────────────────── */
function ShortcutsOverlay({onClose}) {
  const groups = [
    {label:'Navigation', items:[{key:'/',desc:'Focus product search'},{key:'F2',desc:'Open customer picker'},{key:'Esc',desc:'Close / clear'},{key:'?',desc:'Toggle shortcuts'}]},
    {label:'Order',      items:[{key:'Ctrl+↵',desc:'Charge & save'},{key:'Ctrl+⌫',desc:'Clear order'}]},
    {label:'Payment',    items:[{key:'Alt+1',desc:'Cash'},{key:'Alt+2',desc:'UPI'},{key:'Alt+3',desc:'Card'},{key:'Alt+4',desc:'Credit'}]},
    {label:'Scanner',    items:[{key:'Alt+S',desc:'Toggle barcode scanner'},{key:'Enter',desc:'Confirm scan'}]},
  ];
  return (
    <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{background:'var(--zinc-900)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:440,maxWidth:'100%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 40px 80px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <Keyboard size={15} style={{color:'#818CF8'}}/>
            <p style={{fontSize:14,fontWeight:700,color:'#fff'}}>Keyboard Shortcuts</p>
          </div>
          <button onClick={onClose} style={{width:26,height:26,borderRadius:7,background:'rgba(255,255,255,0.07)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.4)'}}><X size={12}/></button>
        </div>
        <div style={{padding:'14px 18px 20px',display:'flex',flexDirection:'column',gap:16}}>
          {groups.map(({label,items})=>(
            <div key={label}>
              <p style={{fontSize:9.5,fontWeight:800,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:7}}>{label}</p>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {items.map(({key,desc})=>(
                  <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',background:'rgba(255,255,255,0.03)',borderRadius:7}}>
                    <span style={{fontSize:12.5,color:'rgba(255,255,255,0.45)'}}>{desc}</span>
                    <kbd style={{fontSize:10.5,fontFamily:'monospace',background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:5,padding:'2px 8px',color:'#C7D2FE',whiteSpace:'nowrap',flexShrink:0}}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
