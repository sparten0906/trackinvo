import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, Receipt, Check, X,
  ShoppingCart, User, ScanLine, Keyboard, RotateCcw,
  Package, Printer, Eye, AlertCircle, CreditCard, FileText,
  Banknote, Smartphone, Building2, BookmarkPlus, CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  formatCurrency, calcInvoiceTotals, calcBalance,
  derivePaymentStatus, today, isLowStock, generateInvoiceNumber,
} from '../utils/helpers';
import toast from 'react-hot-toast';
import InvoiceViewer from '../components/invoice/InvoiceViewer';

/* ─── Constants ─────────────────────────────────────────────────────── */
const PAY_METHODS = [
  { value: 'cash',          label: 'Cash',   color: '#16A34A', Icon: Banknote },
  { value: 'upi',           label: 'UPI',    color: '#2563EB', Icon: Smartphone },
  { value: 'card',          label: 'Card',   color: '#7C3AED', Icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank',   color: '#0369A1', Icon: Building2 },
  { value: 'credit',        label: 'Credit', color: '#D97706', Icon: Receipt },
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

/* ─── Billing Workstation ────────────────────────────────────────────── */
export default function Billing() {
  const { state, addInvoice } = useApp();
  const { products, customers, categories, settings } = state;
  const sym = settings.currencySymbol || '₹';
  const navigate = useNavigate();

  /* ── state ── */
  const [cart, setCart]                 = useState([]);
  const [form, setForm]                 = useState(EMPTY);
  const [search, setSearch]             = useState('');
  const [activeCat, setActiveCat]       = useState('');
  const [custQuery, setCustQuery]       = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [saved, setSaved]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [mobileCartOpen, setMobileCart] = useState(false);
  const [scanQuery, setScanQuery]       = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [showShortcuts, setShortcuts]   = useState(false);
  const [holds, setHolds]               = useState([]);
  const [showHolds, setShowHolds]       = useState(false);
  const [previewOpen, setPreviewOpen]   = useState(false);

  const searchRef   = useRef(null);
  const scanRef     = useRef(null);
  const custDropRef = useRef(null);
  const holdsRef    = useRef(null);

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const h = e => {
      if (custDropRef.current && !custDropRef.current.contains(e.target)) setShowCustDrop(false);
      if (holdsRef.current && !holdsRef.current.contains(e.target)) setShowHolds(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const h = e => {
      const busy = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (!busy && e.key === '?')                              { setShortcuts(v => !v); return; }
      if (e.key === 'Escape') {
        if (showShortcuts)  { setShortcuts(false); return; }
        if (previewOpen)    { setPreviewOpen(false); return; }
        if (showCustDrop)   { setShowCustDrop(false); return; }
        if (showHolds)      { setShowHolds(false); return; }
        if (search)         { setSearch(''); return; }
        return;
      }
      if (!busy && e.key === '/')                              { e.preventDefault(); searchRef.current?.focus(); return; }
      if (!busy && e.key === 'F2')                             { e.preventDefault(); setShowCustDrop(true); return; }
      if ((e.ctrlKey||e.metaKey) && e.key === 'Enter')        { e.preventDefault(); cart.length > 0 ? handleSave() : toast.error('Add products first'); return; }
      if ((e.ctrlKey||e.metaKey) && e.key === 'Backspace')    { e.preventDefault(); if (cart.length) { setCart([]); toast.success('Bill cleared'); } return; }
      if (!busy && e.altKey && e.key.toLowerCase() === 's')   { e.preventDefault(); scanRef.current?.focus(); return; }
      if (e.altKey && ['1','2','3','4','5'].includes(e.key))  { setF('paymentMethod', PAY_METHODS[+e.key-1].value); return; }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showShortcuts, previewOpen, showCustDrop, showHolds, search, cart.length]);

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

  const totals       = useMemo(() => calcInvoiceTotals(cart, form.discountType, form.discountValue), [cart, form.discountType, form.discountValue]);
  const roundOff     = useMemo(() => cart.length ? (Math.round(totals.grandTotal) - totals.grandTotal) : 0, [totals.grandTotal, cart.length]);
  const effPaid      = form.paidAmount === '' ? totals.grandTotal : +form.paidAmount;
  const balAmt       = calcBalance(totals.grandTotal, effPaid);
  const payStatus    = derivePaymentStatus(totals.grandTotal, effPaid);
  const cartUnits    = cart.reduce((s, i) => s + i.quantity, 0);
  const change       = effPaid > totals.grandTotal ? effPaid - totals.grandTotal : 0;
  const nextInvNum   = useMemo(() => generateInvoiceNumber(settings.invoicePrefix, state.invoices), [settings.invoicePrefix, state.invoices]);

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
    setTimeout(() => setScanFeedback(null), 2200);
    scanRef.current?.focus();
  };

  const holdBill = () => {
    if (!cart.length) { toast.error('Nothing to hold'); return; }
    const newHolds = [...holds, { cart, form, custQuery }];
    setHolds(newHolds);
    setCart([]); setForm(EMPTY); setCustQuery('');
    toast.success(`Bill held (${newHolds.length} hold${newHolds.length !== 1 ? 's' : ''})`);
  };

  const retrieveHold = idx => {
    const h = holds[idx];
    setCart(h.cart); setForm(h.form); setCustQuery(h.custQuery || '');
    setHolds(prev => prev.filter((_, i) => i !== idx));
    setShowHolds(false);
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
     SAVED VIEW
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
          style={{display:'flex',alignItems:'center',gap:7,height:34,padding:'0 16px',borderRadius:8,background:'var(--brand)',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}
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
     CUSTOMER WIDGET (inside component to avoid remount)
  ══════════════════════════════════════════════════════════════ */
  const CustomerWidget = () => (
    <div ref={custDropRef} style={{position:'relative'}}>
      {form.customerId ? (
        <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',borderRadius:8,background:'rgba(79,70,229,0.07)',border:'1.5px solid rgba(79,70,229,0.2)'}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#fff',flexShrink:0}}>
            {(selectedCust?.name||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12.5,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedCust?.name}</p>
            {selectedCust?.phone && <p style={{fontSize:10,color:'var(--text-tertiary)'}}>{selectedCust.phone}</p>}
          </div>
          <button onClick={e=>{e.stopPropagation();clearCustomer();}}
            style={{width:16,height:16,borderRadius:3,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',padding:0,flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.color='var(--error)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}
          ><X size={10}/></button>
        </div>
      ) : form.isWalkIn ? (
        <div style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)'}}>
          <User size={11} style={{color:'var(--text-tertiary)',flexShrink:0}}/>
          <input value={form.customerName} onChange={e=>setF('customerName',e.target.value)}
            placeholder="Walk-in name…"
            style={{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--text-primary)',fontSize:12.5,minWidth:0}}/>
          <button onClick={clearCustomer}
            style={{width:16,height:16,borderRadius:3,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',padding:0,flexShrink:0}}>
            <X size={10}/>
          </button>
        </div>
      ) : (
        <div style={{display:'flex',gap:5}}>
          <button onClick={()=>setShowCustDrop(true)}
            style={{flex:1,display:'flex',alignItems:'center',gap:6,padding:'5px 9px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)',cursor:'pointer',textAlign:'left',transition:'border-color 0.12s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
          >
            <User size={11} style={{color:'var(--text-tertiary)',flexShrink:0}}/>
            <span style={{fontSize:12,color:'var(--text-tertiary)',flex:1}}>Select customer</span>
            <kbd style={{fontSize:9,fontFamily:'monospace',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 4px',color:'var(--text-tertiary)',flexShrink:0}}>F2</kbd>
          </button>
          <button onClick={()=>setF('isWalkIn',true)}
            style={{padding:'5px 9px',borderRadius:8,background:'var(--canvas)',border:'1.5px solid var(--border)',cursor:'pointer',fontSize:11.5,fontWeight:500,color:'var(--text-tertiary)',whiteSpace:'nowrap',transition:'color 0.12s'}}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}
          >Walk-in</button>
        </div>
      )}

      {showCustDrop && !form.customerId && !form.isWalkIn && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:600,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow-xl)',overflow:'hidden',minWidth:220}}>
          <div style={{padding:'7px 7px 3px'}}>
            <div style={{position:'relative'}}>
              <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
              <input autoFocus value={custQuery} onChange={e=>setCustQuery(e.target.value)}
                placeholder="Search customers…"
                style={{width:'100%',height:32,paddingLeft:26,paddingRight:8,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:7,outline:'none',color:'var(--text-primary)',fontSize:12.5,boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{maxHeight:180,overflowY:'auto',borderTop:'1px solid var(--border)'}}>
            {custResults.map((c,i) => (
              <button key={c.id} onClick={()=>pickCustomer(c)}
                style={{width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:8,padding:'7px 11px',background:'transparent',border:'none',cursor:'pointer',borderTop:i>0?'1px solid var(--border)':'none',transition:'background 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--canvas)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <div style={{width:26,height:26,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10.5,fontWeight:700,flexShrink:0}}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <p style={{fontSize:12.5,fontWeight:600,color:'var(--text-primary)'}}>{c.name}</p>
                  {(c.phone||c.email) && <p style={{fontSize:10.5,color:'var(--text-tertiary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{[c.phone,c.email].filter(Boolean).join(' · ')}</p>}
                </div>
              </button>
            ))}
            {custResults.length===0 && <p style={{padding:'11px',textAlign:'center',fontSize:12.5,color:'var(--text-tertiary)'}}>No customers found</p>}
          </div>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════════ */
  const cats = [{id:'',name:'All'}, ...categories];

  return (
    <div className="animate-fadeIn" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--canvas)'}}>

      {/* ══ TOP COMMAND BAR ═════════════════════════════════════ */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:6,padding:'0 12px',height:46,background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>

        {/* Brand + invoice# */}
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginRight:4}}>
          <div style={{width:28,height:28,borderRadius:7,background:'rgba(79,70,229,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <ShoppingCart size={14} color="var(--brand)"/>
          </div>
          <div style={{lineHeight:1.2}}>
            <div style={{fontSize:13,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-0.02em'}}>Billing / POS</div>
            <div style={{fontSize:9,color:'var(--text-tertiary)',fontFamily:'monospace',letterSpacing:'0.02em'}}>{nextInvNum}</div>
          </div>
        </div>

        <div style={{width:1,height:22,background:'var(--border)',flexShrink:0}}/>

        {/* Barcode / scan input */}
        <div style={{position:'relative',width:200,flexShrink:0}}>
          <ScanLine size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
          <input
            ref={scanRef}
            value={scanQuery}
            onChange={e=>setScanQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleScanSubmit(scanQuery);}}}
            placeholder="Barcode or SKU…"
            style={{width:'100%',height:30,paddingLeft:26,paddingRight:scanFeedback?76:8,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:7,fontSize:12,color:'var(--text-primary)',outline:'none',boxSizing:'border-box',transition:'border-color 0.15s'}}
            onFocus={e=>e.currentTarget.style.borderColor='var(--brand)'}
            onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}
          />
          {scanFeedback&&(
            <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:700,color:scanFeedback.ok?'#16A34A':'#DC2626',pointerEvents:'none',whiteSpace:'nowrap'}}>
              {scanFeedback.ok?'✓ Added':'✗ Not found'}
            </span>
          )}
        </div>

        <div style={{flex:1}}/>

        {/* Holds button */}
        <div ref={holdsRef} style={{position:'relative',flexShrink:0}}>
          <button onClick={()=>setShowHolds(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:4,height:30,padding:'0 9px',borderRadius:7,background:holds.length>0?'#FFFBEB':'var(--canvas)',border:`1px solid ${holds.length>0?'#FDE68A':'var(--border)'}`,color:holds.length>0?'#D97706':'var(--text-tertiary)',fontSize:11.5,fontWeight:holds.length>0?700:500,cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.12s'}}
          ><BookmarkPlus size={12}/> {holds.length>0?`${holds.length} Hold${holds.length!==1?'s':''}` : 'Hold'}</button>
          {showHolds&&holds.length>0&&(
            <div style={{position:'absolute',top:'calc(100% + 5px)',right:0,zIndex:700,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow-xl)',minWidth:180,overflow:'hidden'}}>
              <div style={{padding:'6px 10px 4px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:10,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Held Bills</span>
              </div>
              {holds.map((h,i)=>(
                <button key={i} onClick={()=>retrieveHold(i)}
                  style={{width:'100%',textAlign:'left',padding:'8px 12px',background:'transparent',border:'none',borderTop:i>0?'1px solid var(--border)':'none',cursor:'pointer',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--canvas)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--text-primary)'}}>Hold #{i+1}</div>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:1}}>{h.cart.length} item{h.cart.length!==1?'s':''}{h.form.customerName ? ` · ${h.form.customerName}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hold current bill */}
        {!showHolds&&holds.length===0&&(
          <button onClick={holdBill}
            style={{display:'flex',alignItems:'center',gap:4,height:30,padding:'0 9px',borderRadius:7,background:'var(--canvas)',border:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:11.5,fontWeight:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',transition:'all 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#D97706';e.currentTarget.style.color='#D97706';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
          ><BookmarkPlus size={12}/> Hold</button>
        )}

        {cart.length>0&&(
          <button onClick={()=>{setCart([]);setForm(EMPTY);setCustQuery('');toast.success('Bill cleared');}}
            style={{display:'flex',alignItems:'center',gap:4,height:30,padding:'0 9px',borderRadius:7,background:'var(--canvas)',border:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:11.5,fontWeight:500,cursor:'pointer',flexShrink:0,transition:'all 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#EF4444';e.currentTarget.style.color='#DC2626';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
          ><X size={12}/> Clear</button>
        )}

        <button onClick={()=>navigate('/invoices')}
          style={{display:'flex',alignItems:'center',gap:4,height:30,padding:'0 9px',borderRadius:7,background:'var(--canvas)',border:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:11.5,fontWeight:500,cursor:'pointer',flexShrink:0,transition:'all 0.12s',whiteSpace:'nowrap'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
        ><FileText size={12}/> Invoices</button>

        <button onClick={()=>setShortcuts(true)}
          style={{width:30,height:30,borderRadius:7,background:'var(--canvas)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',flexShrink:0,transition:'all 0.12s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-tertiary)';}}
          title="Keyboard shortcuts (?)"
        ><Keyboard size={13}/></button>
      </div>

      {/* ══ WORKSPACE ═══════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* ─── LEFT: PRODUCT BROWSER ─────────────────── */}
        <div className="hidden lg:flex" style={{width:260,flexShrink:0,flexDirection:'column',overflow:'hidden',borderRight:'1px solid var(--border)',background:'var(--canvas)'}}>

          {/* Search */}
          <div style={{flexShrink:0,padding:'9px 10px 5px'}}>
            <div style={{position:'relative'}}>
              <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search products…"
                style={{width:'100%',height:34,paddingLeft:28,paddingRight:search?26:8,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,fontSize:12.5,color:'var(--text-primary)',outline:'none',boxSizing:'border-box',transition:'border-color 0.15s'}}
                onFocus={e=>e.currentTarget.style.borderColor='var(--brand)'}
                onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}
              />
              {search&&(
                <button onClick={()=>{setSearch('');searchRef.current?.focus();}}
                  style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',background:'transparent',border:'none',cursor:'pointer',color:'var(--text-tertiary)',display:'flex',padding:2}}>
                  <X size={10}/>
                </button>
              )}
            </div>
          </div>

          {/* Category chips */}
          <div style={{flexShrink:0,padding:'0 10px 6px',display:'flex',gap:4,overflowX:'auto',scrollbarWidth:'none'}}>
            {cats.map(c => {
              const active = activeCat === c.id;
              return (
                <button key={c.id} onClick={()=>setActiveCat(c.id)}
                  style={{display:'inline-flex',alignItems:'center',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:active?700:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',transition:'all 0.12s',
                    background:active?'var(--brand)':'transparent',
                    color:active?'#fff':'var(--text-secondary)',
                    border:active?'1px solid transparent':'1px solid var(--border)',
                  }}
                >{c.name}</button>
              );
            })}
          </div>

          {/* Product list */}
          <div style={{flex:1,overflowY:'auto',padding:'0 10px 10px',display:'flex',flexDirection:'column',gap:4,minHeight:0}}>
            {displayed.length===0 ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:8,paddingBottom:32}}>
                <Package size={28} style={{color:'var(--text-tertiary)',opacity:0.25}}/>
                <p style={{fontSize:12.5,color:'var(--text-tertiary)'}}>No products</p>
                {search&&<button onClick={()=>setSearch('')} style={{padding:'3px 12px',borderRadius:6,background:'var(--brand-faint)',color:'var(--brand)',border:'none',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>Clear</button>}
              </div>
            ) : displayed.map((p,idx) => {
              const inCart     = cart.find(i => i.productId === p.id);
              const outOfStock = p.stock === 0;
              const low        = !outOfStock && isLowStock(p);
              const color      = PALETTE[idx % PALETTE.length];
              return <ProductCard key={p.id} product={p} inCart={inCart} outOfStock={outOfStock} low={low} color={color} sym={sym} onAdd={addToCart}/>;
            })}
          </div>
        </div>

        {/* ─── CENTER: CART WORKSPACE ────────────────── */}
        <div className="hidden lg:flex" style={{flex:1,flexDirection:'column',overflow:'hidden',background:'var(--surface)',minWidth:0}}>

          {/* Cart header */}
          <div style={{flexShrink:0,padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,background:'var(--surface)'}}>
            <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Order Items</span>
            {cart.length>0&&(
              <span style={{fontSize:10,fontWeight:800,padding:'1px 6px',borderRadius:9,background:'var(--brand)',color:'#fff',minWidth:18,textAlign:'center'}}>{cart.length}</span>
            )}
            <div style={{flex:1}}/>
            {cart.length>0&&(
              <span style={{fontSize:11,color:'var(--text-tertiary)'}}>{cartUnits} unit{cartUnits!==1?'s':''}</span>
            )}
          </div>

          {/* Cart body */}
          {cart.length===0 ? (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:'0 20px 60px'}}>
              <div style={{width:48,height:48,borderRadius:12,background:'var(--canvas)',border:'1.5px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <ShoppingCart size={20} style={{color:'var(--text-tertiary)',opacity:0.35}}/>
              </div>
              <div style={{textAlign:'center'}}>
                <p style={{fontSize:13.5,fontWeight:600,color:'var(--text-secondary)'}}>Cart is empty</p>
                <p style={{fontSize:11.5,color:'var(--text-tertiary)',marginTop:3,lineHeight:1.6}}>
                  Select a product from the left panel<br/>
                  <kbd style={{fontFamily:'monospace',fontSize:10,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 4px'}}>/</kbd> to search &nbsp;·&nbsp;
                  <kbd style={{fontFamily:'monospace',fontSize:10,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 4px'}}>Alt+S</kbd> to scan
                </p>
              </div>
            </div>
          ) : (
            <div style={{flex:1,overflowX:'auto',overflowY:'auto',minHeight:0,minWidth:0}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:540}}>
                <thead style={{position:'sticky',top:0,zIndex:5,background:'var(--canvas)'}}>
                  <tr>
                    {[
                      {label:'Product',    align:'left'},
                      {label:'Qty',        align:'center', w:96},
                      {label:'Unit Price', align:'right',  w:82},
                      {label:'Discount',   align:'right',  w:82},
                      {label:'GST',        align:'right',  w:52},
                      {label:'Line Total', align:'right',  w:90},
                      {label:'',           align:'center', w:32},
                    ].map((col,i)=>(
                      <th key={i} style={{
                        padding:'7px 10px',textAlign:col.align,
                        fontSize:9.5,fontWeight:700,color:'var(--text-tertiary)',
                        textTransform:'uppercase',letterSpacing:'0.05em',
                        borderBottom:'1.5px solid var(--border)',
                        width:col.w,whiteSpace:'nowrap',
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, rowIdx) => {
                    const lineNet   = Math.max(0, item.unitPrice * item.quantity - item.discount);
                    const lineTax   = lineNet * item.taxPercent / 100;
                    const lineTotal = lineNet + lineTax;
                    const atMax     = item.quantity >= item.availableStock;
                    const clr       = item._color || PALETTE[0];
                    return (
                      <tr key={item.productId}
                        style={{
                          borderBottom:'1px solid var(--border)',
                          borderLeft:`3px solid ${clr}`,
                          background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--canvas)',
                          transition:'background 0.1s',
                        }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--brand-faint)'}
                        onMouseLeave={e=>e.currentTarget.style.background=rowIdx%2===0?'var(--surface)':'var(--canvas)'}
                      >
                        {/* Product */}
                        <td style={{padding:'9px 10px'}}>
                          <div style={{fontSize:12.5,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>
                            {item.productName}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
                            <span style={{fontSize:9.5,color:'var(--text-tertiary)',fontFamily:'monospace'}}>{item.sku}</span>
                            {atMax&&<span style={{display:'flex',alignItems:'center',gap:2,fontSize:9.5,color:'#D97706'}}><AlertCircle size={9} color="#D97706"/> Max</span>}
                          </div>
                        </td>
                        {/* Qty stepper */}
                        <td style={{padding:'9px 6px',textAlign:'center'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                            <button
                              onClick={()=>item.quantity===1?removeItem(item.productId):updateQty(item.productId,item.quantity-1)}
                              style={{width:22,height:22,borderRadius:5,border:'1px solid var(--border)',background:'var(--canvas)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:item.quantity===1?'#DC2626':'var(--text-secondary)',flexShrink:0,transition:'background 0.1s'}}
                              onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
                              onMouseLeave={e=>e.currentTarget.style.background='var(--canvas)'}
                            >{item.quantity===1?<Trash2 size={9}/>:<Minus size={9}/>}</button>
                            <input
                              type="number" value={item.quantity} min={1} max={item.availableStock}
                              onChange={e=>updateQty(item.productId,e.target.value)}
                              style={{width:30,height:22,textAlign:'center',border:'1px solid var(--border)',borderRadius:5,fontSize:12,fontWeight:700,color:'var(--text-primary)',background:'var(--canvas)',outline:'none',padding:0,fontVariantNumeric:'tabular-nums'}}
                            />
                            <button
                              onClick={()=>updateQty(item.productId,item.quantity+1)}
                              disabled={atMax}
                              style={{width:22,height:22,borderRadius:5,border:'1px solid var(--border)',background:'var(--canvas)',cursor:atMax?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)',opacity:atMax?0.3:1,flexShrink:0,transition:'background 0.1s'}}
                              onMouseEnter={e=>{if(!atMax)e.currentTarget.style.background='var(--border)';}}
                              onMouseLeave={e=>e.currentTarget.style.background='var(--canvas)'}
                            ><Plus size={9}/></button>
                          </div>
                        </td>
                        {/* Unit price */}
                        <td style={{padding:'9px 10px',textAlign:'right',color:'var(--text-secondary)',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>
                          {formatCurrency(item.unitPrice,sym)}
                        </td>
                        {/* Discount */}
                        <td style={{padding:'9px 6px',textAlign:'right'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:2}}>
                            <span style={{fontSize:10,color:'var(--text-tertiary)'}}>{sym}</span>
                            <input
                              type="number" min="0" step="0.01" value={item.discount||''} onChange={e=>updateDisc(item.productId,e.target.value)} placeholder="0"
                              style={{width:46,textAlign:'right',border:'1px solid var(--border)',borderRadius:5,fontSize:12,padding:'2px 4px',color:item.discount>0?'#16A34A':'var(--text-primary)',background:'var(--canvas)',outline:'none',fontVariantNumeric:'tabular-nums'}}
                            />
                          </div>
                        </td>
                        {/* GST */}
                        <td style={{padding:'9px 10px',textAlign:'right',color:'var(--text-tertiary)',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>
                          {item.taxPercent>0?`${item.taxPercent}%`:'—'}
                        </td>
                        {/* Line total */}
                        <td style={{padding:'9px 10px',textAlign:'right',fontWeight:700,color:'var(--text-primary)',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',fontSize:13}}>
                          {formatCurrency(lineTotal,sym)}
                        </td>
                        {/* Remove */}
                        <td style={{padding:'9px 4px',textAlign:'center'}}>
                          <button onClick={()=>removeItem(item.productId)}
                            style={{width:24,height:24,borderRadius:5,border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-tertiary)',transition:'all 0.1s'}}
                            onMouseEnter={e=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#DC2626';}}
                            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-tertiary)';}}
                          ><X size={11}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── RIGHT: CHECKOUT PANEL ─────────────────── */}
        <div className="hidden lg:flex" style={{width:258,flexShrink:0,flexDirection:'column',overflow:'hidden',borderLeft:'1px solid var(--border)',background:'var(--surface)'}}>

          {/* Customer */}
          <div style={{flexShrink:0,padding:'9px 12px',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Customer</div>
            {CustomerWidget()}
          </div>

          {/* Scrollable body */}
          <div style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:0,minHeight:0}}>

            {/* Breakdown */}
            <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)'}}>
                <span>Subtotal</span>
                <span style={{fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totals.subtotal||0,sym)}</span>
              </div>
              {(totals.itemDiscounts||0)>0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#16A34A'}}>
                  <span>Discount</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>−{formatCurrency(Math.min(totals.itemDiscounts,totals.subtotal||0),sym)}</span>
                </div>
              )}
              {(totals.itemDiscounts||0)>(totals.subtotal||0)&&(
                <div style={{fontSize:9.5,color:'#D97706',background:'#FFFBEB',borderRadius:4,padding:'2px 6px',border:'1px solid #FDE68A'}}>Discount capped at subtotal</div>
              )}
              {(totals.taxAmount||0)>0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)'}}>
                  <span>Tax (GST)</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>+{formatCurrency(totals.taxAmount,sym)}</span>
                </div>
              )}
              {roundOff!==0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-tertiary)'}}>
                  <span>Round off</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>{roundOff>0?'+':''}{roundOff.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand total */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'9px 0',borderTop:'2px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:10}}>
              <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Grand Total</span>
              <span style={{fontSize:20,fontWeight:900,color:cart.length?'var(--text-primary)':'var(--text-tertiary)',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.03em'}}>{formatCurrency(totals.grandTotal,sym)}</span>
            </div>

            {/* Amount received */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>Amount Received</div>
              <div style={{position:'relative',borderRadius:7,border:'1.5px solid var(--border)',background:'var(--canvas)',transition:'border-color 0.15s'}}>
                <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:12,fontWeight:600,color:'var(--text-tertiary)',pointerEvents:'none'}}>{sym}</span>
                <input type="number" min="0" step="0.01" value={form.paidAmount}
                  onChange={e=>setF('paidAmount',e.target.value)}
                  placeholder={totals.grandTotal>0?totals.grandTotal.toFixed(2):'0.00'}
                  style={{width:'100%',height:36,paddingLeft:22,paddingRight:form.paidAmount&&cart.length?80:10,background:'transparent',border:'none',color:'var(--text-primary)',fontSize:15,fontWeight:800,outline:'none',fontVariantNumeric:'tabular-nums',boxSizing:'border-box'}}
                  onFocus={e=>e.currentTarget.parentElement.style.borderColor='var(--brand)'}
                  onBlur={e=>e.currentTarget.parentElement.style.borderColor='var(--border)'}
                />
                {form.paidAmount!==''&&cart.length>0&&(
                  <div style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                    {change>0
                      ? <span style={{fontSize:10,fontWeight:700,color:'#16A34A',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:4,padding:'1px 5px',whiteSpace:'nowrap'}}>Chg {formatCurrency(change,sym)}</span>
                      : balAmt>0
                        ? <span style={{fontSize:10,fontWeight:700,color:'#DC2626',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:4,padding:'1px 5px',whiteSpace:'nowrap'}}>Due {formatCurrency(balAmt,sym)}</span>
                        : <CheckCircle2 size={13} color="#16A34A"/>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Balance row */}
            {cart.length>0&&(
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:11.5,color:'var(--text-tertiary)'}}>Balance</span>
                  <span style={{
                    fontSize:9.5,fontWeight:700,padding:'1px 6px',borderRadius:9,
                    background: payStatus==='paid'?'#F0FDF4':payStatus==='partial'?'#FEFCE8':'#FEF2F2',
                    color: payStatus==='paid'?'#16A34A':payStatus==='partial'?'#CA8A04':'#DC2626',
                    border: `1px solid ${payStatus==='paid'?'#BBF7D0':payStatus==='partial'?'#FDE047':'#FECACA'}`,
                  }}>
                    {payStatus==='paid'?'Paid':payStatus==='partial'?'Partial':'Unpaid'}
                  </span>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:balAmt>0?'#DC2626':change>0?'#16A34A':'var(--text-tertiary)',fontVariantNumeric:'tabular-nums'}}>
                  {balAmt>0?formatCurrency(balAmt,sym):change>0?`+${formatCurrency(change,sym)}`:'—'}
                </span>
              </div>
            )}

            {/* Payment method grid */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Payment Method</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                {PAY_METHODS.map((m,i)=>{
                  const active = form.paymentMethod===m.value;
                  const Icon = m.Icon;
                  return (
                    <button key={m.value} onClick={()=>setF('paymentMethod',m.value)}
                      style={{
                        display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:7,cursor:'pointer',
                        background:active?`${m.color}12`:'var(--canvas)',
                        border:`1px solid ${active?m.color+'50':'var(--border)'}`,
                        color:active?m.color:'var(--text-tertiary)',
                        fontSize:11.5,fontWeight:active?700:500,transition:'all 0.13s',
                      }}
                      onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--brand-faint)';e.currentTarget.style.color='var(--brand)';e.currentTarget.style.borderColor='var(--brand-light)';}}}
                      onMouseLeave={e=>{if(!active){e.currentTarget.style.background='var(--canvas)';e.currentTarget.style.color='var(--text-tertiary)';e.currentTarget.style.borderColor='var(--border)';}}}
                      title={`Alt+${i+1}`}
                    >
                      <Icon size={11} strokeWidth={2}/> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{marginBottom:4}}>
              <div style={{fontSize:9.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>Notes</div>
              <textarea
                value={form.notes} onChange={e=>setF('notes',e.target.value)}
                placeholder="Order notes…" rows={2}
                style={{width:'100%',padding:'6px 8px',fontSize:11.5,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:7,color:'var(--text-secondary)',resize:'none',fontFamily:'inherit',outline:'none',boxSizing:'border-box',lineHeight:1.5,transition:'border-color 0.15s'}}
                onFocus={e=>e.currentTarget.style.borderColor='var(--brand)'}
                onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{flexShrink:0,padding:'10px 12px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:5,background:'var(--surface)'}}>
            {/* Complete Invoice */}
            <button
              onClick={()=>cart.length?handleSave():toast.error('Add products first')}
              disabled={!cart.length||saving}
              style={{
                width:'100%',height:40,borderRadius:8,border:'none',
                cursor:cart.length&&!saving?'pointer':'not-allowed',
                display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                fontSize:13,fontWeight:800,transition:'all 0.15s',
                background:cart.length?'var(--brand)':'var(--canvas)',
                color:cart.length?'#fff':'var(--text-tertiary)',
                boxShadow:cart.length&&!saving?'0 2px 10px rgba(79,70,229,0.28)':'none',
              }}
              onMouseEnter={e=>{if(cart.length&&!saving){e.currentTarget.style.background='var(--brand-hover)';e.currentTarget.style.boxShadow='0 4px 18px rgba(79,70,229,0.4)';}}}
              onMouseLeave={e=>{if(cart.length){e.currentTarget.style.background='var(--brand)';e.currentTarget.style.boxShadow='0 2px 10px rgba(79,70,229,0.28)';}}}
            >
              {saving
                ? <><span style={{width:13,height:13,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> Saving…</>
                : cart.length
                  ? <><CheckCircle2 size={13}/> Complete Invoice</>
                  : <><ShoppingCart size={13}/> Add products first</>
              }
            </button>

            {/* Secondary: Preview + Print */}
            {cart.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                <button onClick={()=>setPreviewOpen(true)}
                  style={{height:30,borderRadius:7,border:'1.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,transition:'all 0.12s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
                ><Eye size={11}/> Preview</button>
                <button onClick={()=>cart.length?handleSave():null}
                  style={{height:30,borderRadius:7,border:'1.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,transition:'all 0.12s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--brand)';e.currentTarget.style.color='var(--brand)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
                ><Printer size={11}/> Save &amp; Print</button>
              </div>
            )}

            {cart.length>0&&<p style={{textAlign:'center',fontSize:9,color:'var(--text-tertiary)',margin:0}}>Ctrl+Enter to complete</p>}
          </div>
        </div>

        {/* ─── MOBILE: full-width product browser ────── */}
        <div className="lg:hidden" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flexShrink:0,padding:'8px 12px 5px'}}>
            <div style={{position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}}/>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search products…"
                style={{width:'100%',height:38,paddingLeft:30,paddingRight:search?26:10,background:'var(--canvas)',border:'1.5px solid var(--border)',borderRadius:9,fontSize:13.5,color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}
              />
              {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'transparent',border:'none',cursor:'pointer',color:'var(--text-tertiary)',display:'flex',padding:2}}><X size={11}/></button>}
            </div>
          </div>
          <div style={{flexShrink:0,padding:'0 12px 6px',display:'flex',gap:4,overflowX:'auto',scrollbarWidth:'none'}}>
            {cats.map(c=>{
              const active=activeCat===c.id;
              return <button key={c.id} onClick={()=>setActiveCat(c.id)} style={{display:'inline-flex',alignItems:'center',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:active?700:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',background:active?'var(--brand)':'transparent',color:active?'#fff':'var(--text-secondary)',border:active?'1px solid transparent':'1px solid var(--border)'}}>{c.name}</button>;
            })}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 12px 80px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,alignContent:'start',minHeight:0}}>
            {displayed.map((p,idx)=>{
              const inCart=cart.find(i=>i.productId===p.id);
              const outOfStock=p.stock===0;
              const low=!outOfStock&&isLowStock(p);
              const color=PALETTE[idx%PALETTE.length];
              return <ProductCard key={p.id} product={p} inCart={inCart} outOfStock={outOfStock} low={low} color={color} sym={sym} onAdd={addToCart}/>;
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile FAB + drawer ── */}
      <div className="lg:hidden">
        <button onClick={()=>setMobileCart(true)}
          style={{position:'fixed',bottom:70,right:16,zIndex:100,width:52,height:52,borderRadius:'50%',background:'var(--brand)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 18px rgba(79,70,229,0.5)'}}>
          <ShoppingCart size={20} color="#fff"/>
          {cartUnits>0&&<span style={{position:'absolute',top:-3,right:-3,minWidth:18,height:18,borderRadius:9,background:'#EF4444',color:'#fff',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{cartUnits}</span>}
        </button>
        {mobileCartOpen&&(
          <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}} onClick={()=>setMobileCart(false)}>
            <div style={{position:'absolute',top:0,right:0,bottom:0,width:'min(380px,100%)',background:'var(--surface)',display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <div style={{flexShrink:0,padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>Order · {cart.length} item{cart.length!==1?'s':''}</span>
                <button onClick={()=>setMobileCart(false)} style={{width:28,height:28,borderRadius:'50%',background:'var(--canvas)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)'}}><X size={13}/></button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'0',minHeight:0}}>
                {cart.length===0?<div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-tertiary)',fontSize:13}}>Cart is empty</div>:cart.map(item=>{
                  const lineNet=Math.max(0,item.unitPrice*item.quantity-item.discount);
                  const lineTax=lineNet*item.taxPercent/100;
                  const total=lineNet+lineTax;
                  const clr=item._color||PALETTE[0];
                  return(
                    <div key={item.productId} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${clr}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.productName}</div>
                        <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3}}>
                          <button onClick={()=>item.quantity===1?removeItem(item.productId):updateQty(item.productId,item.quantity-1)} style={{width:22,height:20,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:item.quantity===1?'#DC2626':'var(--text-secondary)'}}>
                            {item.quantity===1?<Trash2 size={9}/>:<Minus size={9}/>}
                          </button>
                          <span style={{fontSize:12,fontWeight:700,minWidth:24,textAlign:'center'}}>{item.quantity}</span>
                          <button onClick={()=>updateQty(item.productId,item.quantity+1)} disabled={item.quantity>=item.availableStock} style={{width:22,height:20,background:'var(--canvas)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)',opacity:item.quantity>=item.availableStock?0.3:1}}>
                            <Plus size={9}/>
                          </button>
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{formatCurrency(total,sym)}</div>
                        <button onClick={()=>removeItem(item.productId)} style={{marginTop:2,fontSize:10,color:'var(--text-tertiary)',background:'none',border:'none',cursor:'pointer',padding:0}} onMouseEnter={e=>e.currentTarget.style.color='#DC2626'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{flexShrink:0,padding:'12px 14px',borderTop:'1px solid var(--border)',background:'var(--canvas)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-secondary)',marginBottom:4}}><span>Subtotal</span><span>{formatCurrency(totals.subtotal||0,sym)}</span></div>
                {(totals.taxAmount||0)>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-secondary)',marginBottom:4}}><span>GST</span><span>+{formatCurrency(totals.taxAmount,sym)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:900,color:'var(--text-primary)',marginBottom:10,paddingTop:6,borderTop:'1px solid var(--border)'}}><span>Total</span><span>{formatCurrency(totals.grandTotal,sym)}</span></div>
                <button onClick={()=>{setMobileCart(false);cart.length?handleSave():toast.error('Add products');}} disabled={!cart.length||saving}
                  style={{width:'100%',height:44,borderRadius:9,border:'none',background:cart.length?'var(--brand)':'var(--canvas)',color:cart.length?'#fff':'var(--text-tertiary)',fontSize:14,fontWeight:800,cursor:cart.length?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
                  {saving?'Saving…':<><CheckCircle2 size={14}/> Complete · {formatCurrency(totals.grandTotal,sym)}</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Invoice Preview Modal ── */}
      {previewOpen&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setPreviewOpen(false)}>
          <div style={{background:'var(--surface)',borderRadius:14,width:'100%',maxWidth:860,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{flexShrink:0,padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <span style={{fontSize:13.5,fontWeight:700,color:'var(--text-primary)'}}>Invoice Preview</span>
                <span style={{fontSize:11,color:'var(--text-tertiary)',marginLeft:8}}>Draft — not saved</span>
              </div>
              <button onClick={()=>setPreviewOpen(false)} style={{width:28,height:28,borderRadius:'50%',background:'var(--canvas)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)'}}><X size={13}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20}}>
              <InvoiceViewer
                invoice={{
                  invoiceNumber: nextInvNum,
                  customerId: form.isWalkIn?null:(form.customerId||null),
                  customerName: form.isWalkIn?(form.customerName.trim()||'Walk-in'):(selectedCust?.name||'Walk-in'),
                  date: form.date, dueDate: form.dueDate||null,
                  paymentMethod: form.paymentMethod, notes: form.notes,
                  items: cart, ...totals,
                  paidAmount: effPaid, balanceAmount: balAmt,
                  paymentStatus: payStatus,
                }}
                customer={selectedCust}
                settings={settings}
              />
            </div>
          </div>
        </div>
      )}

      {showShortcuts&&<ShortcutsOverlay onClose={()=>setShortcuts(false)}/>}
    </div>
  );
}

/* ─── ProductCard — sidebar list card ───────────────────────────────── */
function ProductCard({ product: p, inCart, outOfStock, low, color, sym, onAdd }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={()=>!outOfStock&&onAdd(p)}
      style={{
        position:'relative',
        background:'var(--surface)',
        borderRadius:8,
        border:`1px solid ${inCart?'var(--brand)':hov&&!outOfStock?'var(--brand-light)':'var(--border)'}`,
        borderLeft:`3px solid ${color}`,
        padding:'9px 10px 9px 11px',
        cursor:outOfStock?'not-allowed':'pointer',
        opacity:outOfStock?0.5:1,
        transition:'all 0.12s',
        boxShadow:hov&&!outOfStock?'var(--shadow-sm)':'none',
        userSelect:'none',
      }}
    >
      {/* In-cart badge */}
      {inCart&&(
        <div style={{position:'absolute',top:5,right:5,width:18,height:18,borderRadius:9,background:'var(--brand)',color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {inCart.quantity}
        </div>
      )}

      {/* Name */}
      <p style={{fontSize:12.5,fontWeight:700,color:'var(--text-primary)',lineHeight:1.3,marginBottom:2,paddingRight:inCart?22:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:30}}>
        {p.name}
      </p>

      {/* SKU */}
      <p style={{fontSize:9.5,color:'var(--text-tertiary)',fontFamily:'Menlo,Consolas,monospace',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {p.sku}
      </p>

      {/* Price row */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:4}}>
        <span style={{fontSize:13.5,fontWeight:800,color:'var(--brand)',fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em'}}>
          {formatCurrency(p.sellingPrice,sym)}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {/* Stock badge */}
          <span style={{
            fontSize:9.5,fontWeight:700,padding:'1px 5px',borderRadius:4,
            background: outOfStock?'#FEF2F2':low?'#FFFBEB':'var(--canvas)',
            color: outOfStock?'#DC2626':low?'#D97706':'var(--text-tertiary)',
            border:`1px solid ${outOfStock?'#FECACA':low?'#FDE68A':'var(--border)'}`,
          }}>
            {outOfStock?'Out':low?`⚠ ${p.stock}`:p.stock}
          </span>
          {/* Quick add button */}
          {!outOfStock&&(
            <button
              onClick={e=>{e.stopPropagation();onAdd(p);}}
              style={{
                width:22,height:22,borderRadius:5,flexShrink:0,
                background:inCart||hov?'var(--brand)':'var(--canvas)',
                border:`1px solid ${inCart||hov?'var(--brand)':'var(--border)'}`,
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                color:inCart||hov?'#fff':'var(--text-tertiary)',
                transition:'all 0.12s',
              }}
            ><Plus size={11} strokeWidth={2.5}/></button>
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
    {label:'Order',      items:[{key:'Ctrl+↵',desc:'Complete invoice'},{key:'Ctrl+⌫',desc:'Clear bill'}]},
    {label:'Payment',    items:[{key:'Alt+1',desc:'Cash'},{key:'Alt+2',desc:'UPI'},{key:'Alt+3',desc:'Card'},{key:'Alt+4',desc:'Bank'},{key:'Alt+5',desc:'Credit'}]},
    {label:'Scanner',    items:[{key:'Alt+S',desc:'Focus barcode input'},{key:'Enter',desc:'Confirm scan'}]},
  ];
  return (
    <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,width:420,maxWidth:'100%',maxHeight:'80vh',overflow:'auto',boxShadow:'var(--shadow-xl)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Keyboard size={14} style={{color:'var(--brand)'}}/>
            <p style={{fontSize:13.5,fontWeight:700,color:'var(--text-primary)'}}>Keyboard Shortcuts</p>
          </div>
          <button onClick={onClose} style={{width:26,height:26,borderRadius:7,background:'var(--canvas)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)'}}><X size={12}/></button>
        </div>
        <div style={{padding:'12px 16px 18px',display:'flex',flexDirection:'column',gap:14}}>
          {groups.map(({label,items})=>(
            <div key={label}>
              <p style={{fontSize:9.5,fontWeight:800,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>{label}</p>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {items.map(({key,desc})=>(
                  <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 9px',background:'var(--canvas)',borderRadius:6}}>
                    <span style={{fontSize:12.5,color:'var(--text-secondary)'}}>{desc}</span>
                    <kbd style={{fontSize:10.5,fontFamily:'monospace',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 7px',color:'var(--brand)',whiteSpace:'nowrap',flexShrink:0}}>{key}</kbd>
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
