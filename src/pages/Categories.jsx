import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Tag, Layers, Box, Zap, Coffee, Shirt, Monitor, ShoppingBag, Wrench, Leaf, Music, BookOpen, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import { FormField, Input, Textarea } from '../components/forms/FormField';
import { searchFilter, formatDate, formatDateTime } from '../utils/helpers';

const empty = { name: '', description: '' };

// Palette of distinct hues for category icon chips — cycling, never repeating adjacent
const CHIP_PALETTE = [
  { bg: '#EEF2FF', icon: '#4F46E5', border: '#C7D2FE' }, // indigo
  { bg: '#F0FDF4', icon: '#16A34A', border: '#BBF7D0' }, // green
  { bg: '#FFF7ED', icon: '#EA580C', border: '#FED7AA' }, // orange
  { bg: '#FDF4FF', icon: '#9333EA', border: '#E9D5FF' }, // purple
  { bg: '#FEFCE8', icon: '#CA8A04', border: '#FEF08A' }, // amber
  { bg: '#F0F9FF', icon: '#0284C7', border: '#BAE6FD' }, // sky
  { bg: '#FFF1F2', icon: '#E11D48', border: '#FECDD3' }, // rose
  { bg: '#F0FDFA', icon: '#0D9488', border: '#99F6E4' }, // teal
];

// Icon set to cycle through for visual variety
const ICON_SET = [Tag, Box, Layers, Zap, Coffee, Shirt, Monitor, ShoppingBag, Wrench, Leaf, Music, BookOpen, Globe];

function CategoryCard({ cat, index, productCount, onEdit, onDelete }) {
  const chip = CHIP_PALETTE[index % CHIP_PALETTE.length];
  const IconComponent = ICON_SET[index % ICON_SET.length];
  const count = productCount(cat.id);

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.18s, transform 0.18s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: 3, background: chip.icon, flexShrink: 0 }} />

      {/* Card body */}
      <div style={{ padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

        {/* Icon chip + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: chip.bg,
              border: `1px solid ${chip.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconComponent size={18} style={{ color: chip.icon }} />
          </div>

          {/* Actions — appear on hover of the card, always visible for accessibility */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => onEdit(cat)}
              title="Edit category"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = chip.bg; e.currentTarget.style.color = chip.icon; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(cat.id)}
              title="Delete category"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--error-bg)'; e.currentTarget.style.color = 'var(--error)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Name + description */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {cat.name}
          </p>
          {cat.description ? (
            <p style={{
              fontSize: 12.5,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {cat.description}
            </p>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
              No description
            </p>
          )}
        </div>

        {/* Footer: product count + date */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
        }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              color: chip.icon,
              background: chip.bg,
              border: `1px solid ${chip.border}`,
              borderRadius: 'var(--radius-full)',
              padding: '2px 9px',
            }}
          >
            {count} {count === 1 ? 'product' : 'products'}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-disabled)' }}>
            {formatDateTime(cat.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const { state, addCategory, updateCategory, deleteCategory } = useApp();
  const { categories, products } = state;

  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(empty);
  const [errors, setErrors]     = useState({});
  const [deleteId, setDeleteId] = useState(null);

  const filtered = useMemo(() => searchFilter(categories, search, ['name', 'description']), [categories, search]);

  const productCount = (catId) => products.filter((p) => p.categoryId === catId).length;

  const openAdd  = () => { setForm(empty); setErrors({}); setEditing(null); setModal(true); };
  const openEdit = (cat) => {
    setForm({ name: cat.name, description: cat.description || '' });
    setErrors({});
    setEditing(cat.id);
    setModal(true);
  };

  const handleSave = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (editing) updateCategory({ id: editing, ...form });
    else addCategory(form);
    setModal(false);
  };

  return (
    <div className="animate-fadeIn" style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--canvas)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={20} color="var(--brand)" /> Categories</h1>
          <p className="page-subtitle">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} · organise your product catalog
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* ── Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search categories…"
        className="max-w-sm"
      />

      {/* ── Category grid or empty state */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <Layers size={24} />
            </div>
            <p className="empty-title">
              {search ? 'No categories match your search' : 'No categories yet'}
            </p>
            <p className="empty-desc">
              {search
                ? 'Try a different search term.'
                : 'Create your first category to start organising products by type.'}
            </p>
            {!search && (
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={15} /> Add Category
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map((cat, index) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              index={index}
              productCount={productCount}
              onEdit={openEdit}
              onDelete={setDeleteId}
            />
          ))}

          {/* "Add another" ghost card — only shown when there's already at least one */}
          {!search && (
            <button
              onClick={openAdd}
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--border-strong)',
                borderRadius: 'var(--radius-xl)',
                minHeight: 160,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                padding: 16,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand)';
                e.currentTarget.style.color = 'var(--brand)';
                e.currentTarget.style.background = 'var(--brand-faint)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                border: '1.5px dashed currentColor',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Plus size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>New category</span>
            </button>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {editing ? 'Save Changes' : 'Add Category'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label="Category Name" error={errors.name} required>
            <Input
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((e2) => ({ ...e2, name: '' })); }}
              placeholder="e.g. Electronics"
              error={errors.name}
              autoFocus
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What kinds of products belong here?"
            />
          </FormField>
        </div>
      </Modal>

      {/* ── Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteCategory(deleteId)}
        message="Delete this category? Products in this category won't be deleted, but they'll become uncategorised."
      />
    </div>
  );
}
