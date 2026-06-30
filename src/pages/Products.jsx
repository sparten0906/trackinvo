import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Package, Search, LayoutGrid, LayoutList, SlidersHorizontal, AlertTriangle, Star, DollarSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '../components/forms/FormField';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeSplit, searchFilter, paginate, validateProduct, isLowStock } from '../utils/helpers';

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'pair', 'set', 'ream', 'bottle', 'bag'];
const PAGE_SIZE = 15;

const emptyProduct = {
  name: '', sku: '', barcode: '', categoryId: '', brand: '', unit: 'pcs',
  purchasePrice: '', sellingPrice: '', taxPercent: 0, stock: 0,
  minStock: 10, supplierId: '', status: 'active', description: '',
};

// Hashed card background palettes — 6 subtle tones cycling by index
const CARD_PALETTES = [
  { bg: '#eef2ff', color: '#4f46e5' },
  { bg: '#fef3c7', color: '#d97706' },
  { bg: '#dcfce7', color: '#16a34a' },
  { bg: '#fce7f3', color: '#db2777' },
  { bg: '#e0f2fe', color: '#0284c7' },
  { bg: '#f3e8ff', color: '#9333ea' },
];

function StockBadge({ product }) {
  if (product.stock === 0) return <span className="badge badge-error">Out of Stock</span>;
  if (isLowStock(product)) return <span className="badge badge-warning">Low Stock</span>;
  return <span className="badge badge-success">In Stock</span>;
}

function RadioOption({ checked, onChange, label, count, dot }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 0', cursor: 'pointer',
      }}
    >
      {/* Custom radio circle */}
      <span
        onClick={onChange}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: checked ? '4px solid var(--brand)' : '1.5px solid var(--border)',
          background: checked ? 'var(--brand)' : 'var(--surface)',
          flexShrink: 0,
          boxSizing: 'border-box',
          cursor: 'pointer',
          transition: 'border 0.12s, background 0.12s',
          display: 'inline-block',
        }}
      />
      {dot && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: dot, flexShrink: 0,
        }} />
      )}
      <span
        onClick={onChange}
        style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}
      >
        {label}
      </span>
      {count != null && (
        <span style={{
          background: 'var(--zinc-100)', fontSize: 10,
          padding: '1px 6px', borderRadius: 10,
          color: 'var(--text-secondary)', fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </label>
  );
}

export default function Products() {
  const { state, addProduct, updateProduct, deleteProduct, adjustStock, markDamagedStock, setPreferredSupplier } = useApp();
  const { products, categories, suppliers, settings, productSupplierPrices = [] } = state;
  const sym = settings.currencySymbol;

  // ── Search & filter state
  const [search, setSearch]               = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter]     = useState('');
  const [sortBy, setSortBy]               = useState('');
  const [page, setPage]                   = useState(1);
  const [viewMode, setViewMode]           = useState('grid'); // 'grid' | 'list'

  // ── Modal / form state
  const [modal, setModal]       = useState(null); // null | 'add' | 'edit' | 'adjust'
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyProduct);
  const [errors, setErrors]     = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [adjustData, setAdjustData] = useState({ productId: '', delta: 0, reason: '' });
  const [markDmgModal, setMarkDmgModal] = useState(false);
  const [markDmgProduct, setMarkDmgProduct] = useState(null);
  const [markDmgForm, setMarkDmgForm] = useState({ quantity: 1, damageType: 'warehouse_damage', reason: '', notes: '' });
  const [markDmgErrors, setMarkDmgErrors] = useState({});
  const [pricingProductId, setPricingProductId] = useState(null);

  // ── Derived data
  const filtered = useMemo(() => {
    let list = searchFilter(products, search, ['name', 'sku', 'brand', 'barcode']);
    if (categoryFilter) list = list.filter((p) => p.categoryId === categoryFilter);
    if (stockFilter === 'low') list = list.filter(isLowStock);
    if (stockFilter === 'out') list = list.filter((p) => p.stock === 0);
    if (stockFilter === 'in')  list = list.filter((p) => p.stock > 0 && !isLowStock(p));
    if (sortBy === 'price-asc')  list = [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
    if (sortBy === 'price-desc') list = [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
    if (sortBy === 'stock-low')  list = [...list].sort((a, b) => a.stock - b.stock);
    if (sortBy === 'name-az')    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, search, categoryFilter, stockFilter, sortBy]);

  const paginated = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);

  // Counts per category (for badges in sidebar)
  const categoryCounts = useMemo(() => {
    const base = searchFilter(products, search, ['name', 'sku', 'brand', 'barcode']);
    const map = {};
    base.forEach((p) => {
      map[p.categoryId] = (map[p.categoryId] || 0) + 1;
    });
    return map;
  }, [products, search]);

  // Counts per stock status (based on current category + search)
  const stockCounts = useMemo(() => {
    let base = searchFilter(products, search, ['name', 'sku', 'brand', 'barcode']);
    if (categoryFilter) base = base.filter((p) => p.categoryId === categoryFilter);
    return {
      '':    base.length,
      in:    base.filter((p) => p.stock > 0 && !isLowStock(p)).length,
      low:   base.filter(isLowStock).length,
      out:   base.filter((p) => p.stock === 0).length,
    };
  }, [products, search, categoryFilter]);

  // ── Handlers
  const openAdd    = () => { setForm(emptyProduct); setErrors({}); setEditing(null); setModal('add'); };
  const openEdit   = (p) => { setForm({ ...p }); setErrors({}); setEditing(p.id); setModal('edit'); };
  const openAdjust = (p) => { setAdjustData({ productId: p.id, delta: 0, reason: '' }); setModal('adjust'); };

  const handleChange = (field, val) => {
    setForm((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleSave = () => {
    const errs = validateProduct(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (editing) {
      updateProduct({ ...form, id: editing });
    } else {
      addProduct(form);
    }
    setModal(null);
  };

  const handleAdjust = () => {
    if (!adjustData.delta) return;
    adjustStock(adjustData.productId, Number(adjustData.delta));
    setModal(null);
  };

  const openMarkDamaged = (product) => {
    setMarkDmgProduct(product);
    setMarkDmgForm({ quantity: 1, damageType: 'warehouse_damage', reason: '', notes: '' });
    setMarkDmgErrors({});
    setMarkDmgModal(true);
  };

  const handleMarkDamaged = async () => {
    const errs = {};
    if (!(Number(markDmgForm.quantity) > 0)) errs.quantity = 'Quantity must be > 0';
    if (Number(markDmgForm.quantity) > (markDmgProduct?.stock || 0)) errs.quantity = 'Exceeds sellable stock';
    if (!markDmgForm.reason.trim()) errs.reason = 'Reason required';
    if (Object.keys(errs).length) { setMarkDmgErrors(errs); return; }
    await markDamagedStock({
      productId: markDmgProduct.id,
      quantity: Number(markDmgForm.quantity),
      damageType: markDmgForm.damageType,
      reason: markDmgForm.reason,
      notes: markDmgForm.notes,
      date: new Date().toISOString().slice(0, 10),
    });
    setMarkDmgModal(false);
  };

  const resetFilters = () => {
    setCategoryFilter('');
    setStockFilter('');
    setSortBy('');
    setPage(1);
  };

  const getCatName = (id) => categories.find((c) => c.id === id)?.name || '—';

  // ── Product form (Add / Edit)
  const productForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Identity
        </p>
        <div className="form-row form-row-2">
          <FormField label="Product Name" error={errors.name} required>
            <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} error={errors.name} placeholder="e.g. Wireless Headphones" />
          </FormField>
          <FormField label="SKU" error={errors.sku} required>
            <Input value={form.sku} onChange={(e) => handleChange('sku', e.target.value)} error={errors.sku} placeholder="e.g. WBH-001" />
          </FormField>
          <FormField label="Barcode">
            <Input value={form.barcode} onChange={(e) => handleChange('barcode', e.target.value)} placeholder="Optional" />
          </FormField>
          <FormField label="Brand">
            <Input value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} placeholder="Optional" />
          </FormField>
          <FormField label="Category" error={errors.categoryId} required>
            <Select value={form.categoryId} onChange={(e) => handleChange('categoryId', e.target.value)} error={errors.categoryId}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Unit" error={errors.unit} required>
            <Select value={form.unit} onChange={(e) => handleChange('unit', e.target.value)} error={errors.unit}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </FormField>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Pricing
        </p>
        <div className="form-row form-row-2">
          <FormField label={`Purchase Price (${sym})`} error={errors.purchasePrice} required>
            <Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => handleChange('purchasePrice', e.target.value)} error={errors.purchasePrice} />
          </FormField>
          <FormField label={`Selling Price (${sym})`} error={errors.sellingPrice} required>
            <Input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => handleChange('sellingPrice', e.target.value)} error={errors.sellingPrice} />
          </FormField>
          <FormField label="Tax (%)">
            <Input type="number" min="0" max="100" value={form.taxPercent} onChange={(e) => handleChange('taxPercent', e.target.value)} />
          </FormField>
          <FormField label="Supplier">
            <Select value={form.supplierId} onChange={(e) => handleChange('supplierId', e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Inventory
        </p>
        <div className="form-row form-row-2">
          <FormField label="Current Stock" error={errors.stock}>
            <Input type="number" min="0" value={form.stock} onChange={(e) => handleChange('stock', e.target.value)} error={errors.stock} />
          </FormField>
          <FormField label="Min Stock Alert">
            <Input type="number" min="0" value={form.minStock} onChange={(e) => handleChange('minStock', e.target.value)} />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      <FormField label="Description">
        <Textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Optional notes about this product..." />
      </FormField>

      {editing && (form.createdAt || form.updatedAt) && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Audit</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {form.createdAt && (
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Created On</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{formatDateTime(form.createdAt)}</div>
              </div>
            )}
            {form.updatedAt && (
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Updated On</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{formatDateTime(form.updatedAt)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── [A] Filter Sidebar sections
  const sidebarSectionStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  };
  const sectionLabelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <div
      className="animate-fadeIn"
      style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--canvas)' }}
    >
      {/* ══════════════════════════════════════════
          [A] FILTER SIDEBAR
      ══════════════════════════════════════════ */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '0 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 16,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-tertiary)',
          }}>
            Filters
          </span>
          <button
            onClick={resetFilters}
            style={{
              fontSize: 11, color: 'var(--brand)', cursor: 'pointer',
              border: 'none', background: 'none', padding: 0,
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        </div>

        {/* Category section */}
        <div style={sidebarSectionStyle}>
          <p style={sectionLabelStyle}>Category</p>
          <RadioOption
            checked={categoryFilter === ''}
            onChange={() => { setCategoryFilter(''); setPage(1); }}
            label="All Categories"
            count={searchFilter(products, search, ['name', 'sku', 'brand', 'barcode']).length}
          />
          {categories.map((c) => (
            <RadioOption
              key={c.id}
              checked={categoryFilter === c.id}
              onChange={() => { setCategoryFilter(c.id); setPage(1); }}
              label={c.name}
              count={categoryCounts[c.id] || 0}
            />
          ))}
        </div>

        {/* Stock Status section */}
        <div style={sidebarSectionStyle}>
          <p style={sectionLabelStyle}>Stock Status</p>
          <RadioOption
            checked={stockFilter === ''}
            onChange={() => { setStockFilter(''); setPage(1); }}
            label="All"
            count={stockCounts['']}
            dot="var(--zinc-400)"
          />
          <RadioOption
            checked={stockFilter === 'in'}
            onChange={() => { setStockFilter('in'); setPage(1); }}
            label="In Stock"
            count={stockCounts.in}
            dot="#16a34a"
          />
          <RadioOption
            checked={stockFilter === 'low'}
            onChange={() => { setStockFilter('low'); setPage(1); }}
            label="Low Stock"
            count={stockCounts.low}
            dot="#d97706"
          />
          <RadioOption
            checked={stockFilter === 'out'}
            onChange={() => { setStockFilter('out'); setPage(1); }}
            label="Out of Stock"
            count={stockCounts.out}
            dot="#dc2626"
          />
        </div>

        {/* Sort By section */}
        <div style={{ padding: '12px 16px' }}>
          <p style={sectionLabelStyle}>Sort By</p>
          {[
            { value: '', label: 'Default' },
            { value: 'price-asc', label: 'Price: Low to High' },
            { value: 'price-desc', label: 'Price: High to Low' },
            { value: 'stock-low', label: 'Stock: Low First' },
            { value: 'name-az', label: 'Name A–Z' },
          ].map((opt) => (
            <RadioOption
              key={opt.value}
              checked={sortBy === opt.value}
              onChange={() => { setSortBy(opt.value); setPage(1); }}
              label={opt.label}
            />
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          [B] CATALOG AREA
      ══════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── [B1] Toolbar */}
        <div style={{
          flexShrink: 0,
          height: 52,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search
              size={14}
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)', pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              style={{ paddingLeft: 32, height: 34, fontSize: 13 }}
              placeholder="Search products…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Result count */}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => setViewMode('grid')}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ color: viewMode === 'grid' ? 'var(--brand)' : 'var(--text-tertiary)' }}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ color: viewMode === 'list' ? 'var(--brand)' : 'var(--text-tertiary)' }}
              title="List view"
            >
              <LayoutList size={15} />
            </button>
          </div>

          {/* Add Product */}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={14} /> Add Product
          </button>
        </div>

        {/* ── [B2] Product Grid / List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {paginated.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description={
                search || categoryFilter || stockFilter
                  ? 'Try adjusting your search or filters.'
                  : 'Add your first product to start tracking inventory.'
              }
              action={
                !search && !categoryFilter && !stockFilter
                  ? <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Product</button>
                  : null
              }
            />
          ) : (
            <>
              {/* GRID VIEW */}
              {viewMode === 'grid' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12,
                }}>
                  {paginated.map((p, i) => {
                    const palette = CARD_PALETTES[i % CARD_PALETTES.length];
                    const initial = p.name.charAt(0).toUpperCase();
                    return (
                      <div
                        key={p.id}
                        onClick={() => openEdit(p)}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'box-shadow 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        {/* Image placeholder */}
                        <div style={{
                          height: 120,
                          background: palette.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative',
                        }}>
                          <span style={{
                            fontSize: 36, fontWeight: 800,
                            color: palette.color, opacity: 0.35,
                            userSelect: 'none',
                          }}>
                            {initial}
                          </span>
                          {/* Stock badge — absolute top-right */}
                          <div style={{ position: 'absolute', top: 8, right: 8 }}>
                            <StockBadge product={p} />
                          </div>
                        </div>

                        {/* Card body */}
                        <div style={{ padding: '10px 12px', flex: 1 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                            lineHeight: 1.3, marginBottom: 4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {p.name}
                          </p>
                          <p style={{
                            fontSize: 11, color: 'var(--text-tertiary)',
                            marginBottom: 8, fontFamily: 'monospace',
                          }}>
                            {p.sku}
                          </p>
                          <p style={{
                            fontSize: 16, fontWeight: 800, color: 'var(--brand)',
                            fontVariantNumeric: 'tabular-nums', marginBottom: 2,
                          }}>
                            {formatCurrency(p.sellingPrice, sym)}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Sellable: {p.stock} / Damaged: {p.damagedQty || 0}
                          </p>
                          <div style={{ fontSize: 11, color: '#DC2626' }}>{p.damagedQty > 0 ? `${p.damagedQty} damaged` : ''}</div>
                        </div>

                        {/* Card footer */}
                        <div style={{
                          padding: '8px 12px',
                          borderTop: '1px solid var(--border-subtle)',
                          display: 'flex', gap: 6, justifyContent: 'flex-end',
                        }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setPricingProductId(p.id)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#16A34A'; e.currentTarget.style.background = '#F0FDF4'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Supplier Pricing"
                          >
                            <DollarSign size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-faint)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Edit product"
                          >
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openMarkDamaged(p)} title="Mark as Damaged"
                            style={{ width: 28, height: 28, border: '1px solid #FDE68A', borderRadius: 6, background: '#FFFBEB', color: '#D97706', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Delete product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LIST VIEW */}
              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {paginated.map((p, i) => {
                    const palette = CARD_PALETTES[i % CARD_PALETTES.length];
                    const initial = p.name.charAt(0).toUpperCase();
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: 'var(--surface)',
                          borderBottom: '1px solid var(--border-subtle)',
                          padding: '12px 16px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        {/* Color chip */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                          background: palette.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{
                            fontSize: 16, fontWeight: 800,
                            color: palette.color, opacity: 0.5,
                            userSelect: 'none',
                          }}>
                            {initial}
                          </span>
                        </div>

                        {/* Name + SKU */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            marginBottom: 2,
                          }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                            {p.sku}
                          </p>
                        </div>

                        {/* Category badge */}
                        <span style={{
                          fontSize: 11, color: 'var(--text-secondary)',
                          background: 'var(--zinc-100)', padding: '2px 8px',
                          borderRadius: 6, whiteSpace: 'nowrap',
                        }}>
                          {getCatName(p.categoryId)}
                        </span>

                        {/* Price */}
                        <span style={{
                          fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 72, textAlign: 'right',
                        }}>
                          {formatCurrency(p.sellingPrice, sym)}
                        </span>

                        {/* Stock badge */}
                        <div style={{ minWidth: 90, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <StockBadge product={p} />
                          {p.damagedQty > 0 && (
                            <div style={{ fontSize: 11, color: '#DC2626' }}>{p.damagedQty} damaged</div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={() => setPricingProductId(p.id)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#16A34A'; e.currentTarget.style.background = '#F0FDF4'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Supplier Pricing"
                          >
                            <DollarSign size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-faint)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Edit product"
                          >
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openMarkDamaged(p)} title="Mark as Damaged"
                            style={{ width: 28, height: 28, border: '1px solid #FDE68A', borderRadius: 6, background: '#FFFBEB', color: '#D97706', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Delete product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Pagination */}
              <div style={{ padding: '16px 0 4px', borderTop: '1px solid var(--border-subtle)', marginTop: 16 }}>
                <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}

      {/* Add / Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {editing ? 'Save Changes' : 'Add Product'}
            </button>
          </>
        }
      >
        {productForm}
      </Modal>

      {/* Stock Adjust Modal */}
      <Modal
        open={modal === 'adjust'}
        onClose={() => setModal(null)}
        title="Adjust Stock"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdjust}>Apply Adjustment</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Enter a positive number to add stock, or a negative number to remove it.
          </p>
          <FormField label="Quantity Change">
            <Input
              type="number"
              value={adjustData.delta}
              onChange={(e) => setAdjustData((d) => ({ ...d, delta: e.target.value }))}
              placeholder="e.g. 10 or −5"
            />
          </FormField>
          <FormField label="Reason (optional)">
            <Input
              value={adjustData.reason}
              onChange={(e) => setAdjustData((d) => ({ ...d, reason: e.target.value }))}
              placeholder="e.g. Returned goods, damaged items…"
            />
          </FormField>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteProduct(deleteId)}
        message="Delete this product? This cannot be undone."
      />

      {/* Mark Damaged Modal */}
      <Modal
        open={markDmgModal}
        onClose={() => setMarkDmgModal(false)}
        title={`Mark as Damaged — ${markDmgProduct?.name || ''}`}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setMarkDmgModal(false)} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--canvas)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
            <button onClick={handleMarkDamaged} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: '#D97706', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Mark Damaged</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
            Sellable stock: <strong>{markDmgProduct?.stock || 0}</strong> units · Damaged stock: <strong>{markDmgProduct?.damagedQty || 0}</strong> units
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Quantity to Mark Damaged *</label>
            <input type="number" min="1" max={markDmgProduct?.stock || 0} value={markDmgForm.quantity}
              onChange={e => setMarkDmgForm(f => ({ ...f, quantity: e.target.value }))}
              style={{ width: '100%', height: 34, padding: '0 10px', border: `1px solid ${markDmgErrors.quantity ? '#DC2626' : 'var(--border)'}`, borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
            {markDmgErrors.quantity && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{markDmgErrors.quantity}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Damage Type</label>
            <select value={markDmgForm.damageType} onChange={e => setMarkDmgForm(f => ({ ...f, damageType: e.target.value }))}
              style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
              <option value="warehouse_damage">Warehouse Damage</option>
              <option value="broken">Broken</option>
              <option value="defective">Defective</option>
              <option value="expired">Expired</option>
              <option value="missing_parts">Missing Parts</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Reason *</label>
            <input type="text" value={markDmgForm.reason} onChange={e => setMarkDmgForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Dropped during handling"
              style={{ width: '100%', height: 34, padding: '0 10px', border: `1px solid ${markDmgErrors.reason ? '#DC2626' : 'var(--border)'}`, borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
            {markDmgErrors.reason && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{markDmgErrors.reason}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes</label>
            <textarea value={markDmgForm.notes} onChange={e => setMarkDmgForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Supplier Pricing Modal */}
      {pricingProductId && (() => {
        const prod  = products.find(p => p.id === pricingProductId);
        const psps  = productSupplierPrices.filter(r => r.productId === pricingProductId);
        const sorted = [...psps].sort((a, b) => a.lastPurchasePrice - b.lastPurchasePrice);
        if (!prod) return null;
        return (
          <Modal open onClose={() => setPricingProductId(null)} title={`Supplier Pricing — ${prod.name}`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {psps.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No supplier pricing data yet. Prices are recorded automatically when purchase orders are received.
                </div>
              ) : (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 60px', background: 'var(--canvas)', padding: '6px 12px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', gap: 8 }}>
                      <div>Supplier</div>
                      <div style={{ textAlign: 'right' }}>Last Price</div>
                      <div style={{ textAlign: 'right' }}>Avg Price</div>
                      <div style={{ textAlign: 'right' }}>Min</div>
                      <div style={{ textAlign: 'right' }}>Max</div>
                      <div style={{ textAlign: 'right' }}>Total Qty</div>
                      <div style={{ textAlign: 'center' }}>Preferred</div>
                    </div>
                    {sorted.map((r, i) => {
                      const supp = suppliers.find(s => s.id === r.supplierId);
                      const isCheapest = r.supplierId === sorted[0].supplierId;
                      return (
                        <div key={r.id || i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 60px', padding: '9px 12px', gap: 8, borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, alignItems: 'center', background: r.isPreferred ? 'var(--brand-faint)' : 'transparent' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {supp?.name || 'Unknown'}
                              {r.isPreferred && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--brand)', color: '#fff' }}>Preferred</span>}
                            </div>
                            {r.lastPurchaseDate && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Last: {formatDate(r.lastPurchaseDate)}</div>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: isCheapest ? '#16A34A' : 'var(--text-primary)' }}>{formatCurrency(r.lastPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{formatCurrency(r.averagePurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#16A34A' }}>{formatCurrency(r.lowestPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#DC2626' }}>{formatCurrency(r.highestPurchasePrice, sym)}</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{r.totalPurchasedQuantity} {prod.unit || ''}</div>
                          <div style={{ textAlign: 'center' }}>
                            <button onClick={() => setPreferredSupplier(pricingProductId, r.isPreferred ? null : r.supplierId)}
                              style={{ width: 28, height: 28, border: `1.5px solid ${r.isPreferred ? '#F59E0B' : 'var(--border)'}`, borderRadius: 7, background: r.isPreferred ? '#FFFBEB' : 'var(--canvas)', color: r.isPreferred ? '#F59E0B' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={r.isPreferred ? 'Remove preferred' : 'Mark as preferred'}>
                              <Star size={13} fill={r.isPreferred ? '#F59E0B' : 'none'} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '0 2px' }}>
                    Prices update automatically when purchase orders are received. Green = lowest price. Star = preferred supplier.
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
