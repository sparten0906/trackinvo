/**
 * productService — CRUD + stock operations
 * Returns Supabase data when configured, throws 'SUPABASE_NOT_CONFIGURED' otherwise
 * so AppContext can fall back to its in-memory state.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TABLE = 'products';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const productService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, categories(name), suppliers(name)')
      .order('name');
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async getById(id) {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async create(product) {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).insert(mapToDb(product)).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async update(id, product) {
    requireSupabase();
    const { data, error } = await supabase
      .from(TABLE).update({ ...mapToDb(product), updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async delete(id) {
    requireSupabase();
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Adjust stock by delta (positive = add, negative = remove). Prevents negative. */
  async adjustStock(id, delta, note = '') {
    requireSupabase();
    // Fetch current stock first
    const { data: current, error: fetchErr } = await supabase
      .from(TABLE).select('current_stock').eq('id', id).single();
    if (fetchErr) throw new Error(fetchErr.message);

    const newStock = Math.max(0, (current.current_stock || 0) + delta);
    const { data, error } = await supabase
      .from(TABLE).update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);

    // Log stock movement
    await supabase.from('stock_movements').insert({
      product_id: id,
      movement_type: delta >= 0 ? 'in' : 'out',
      reference_type: 'adjustment',
      quantity: Math.abs(delta),
      previous_stock: current.current_stock,
      new_stock: newStock,
      note,
    });

    return mapFromDb(data);
  },
};

// ─── Field mapping: DB (snake_case) ↔ App (camelCase) ────────────────────────
function mapFromDb(row) {
  if (!row) return null;
  return {
    id:            row.id,
    name:          row.name,
    sku:           row.sku,
    barcode:       row.barcode || '',
    categoryId:    row.category_id,
    brand:         row.brand || '',
    unit:          row.unit,
    purchasePrice: Number(row.purchase_price),
    sellingPrice:  Number(row.selling_price),
    taxPercent:    Number(row.tax_percentage || 0),
    stock:         Number(row.current_stock || 0),
    minStock:      Number(row.minimum_stock || 0),
    supplierId:    row.supplier_id || '',
    status:        row.status || 'active',
    description:   row.description || '',
    createdAt:     row.created_at?.slice(0, 10) || '',
  };
}

function mapToDb(product) {
  return {
    name:            product.name,
    sku:             product.sku,
    barcode:         product.barcode || null,
    category_id:     product.categoryId || null,
    brand:           product.brand || null,
    unit:            product.unit,
    purchase_price:  Number(product.purchasePrice),
    selling_price:   Number(product.sellingPrice),
    tax_percentage:  Number(product.taxPercent || 0),
    current_stock:   Number(product.stock || 0),
    minimum_stock:   Number(product.minStock || 0),
    supplier_id:     product.supplierId || null,
    status:          product.status || 'active',
    description:     product.description || null,
  };
}
