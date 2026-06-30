/**
 * purchaseService — handles purchase creation with stock increase and movement tracking.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const purchaseService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*), suppliers(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  /**
   * Create purchase, insert items, increase stock, record movements.
   */
  async create(purchase) {
    requireSupabase();

    // 1. Insert purchase header
    const { data: pur, error: purErr } = await supabase
      .from('purchases')
      .insert({
        purchase_number: purchase.purchaseNumber,
        supplier_id:     purchase.supplierId || null,
        subtotal:        Number(purchase.subtotal),
        tax_total:       Number(purchase.taxAmount || 0),
        grand_total:     Number(purchase.grandTotal),
        payment_status:  purchase.paymentStatus,
        status:          purchase.status,
        purchase_date:   purchase.date,
        notes:           purchase.notes || null,
      })
      .select().single();
    if (purErr) throw new Error(purErr.message);

    // 2. Insert items
    const itemRows = purchase.items.map((item) => ({
      purchase_id:    pur.id,
      product_id:     item.productId,
      product_name:   item.productName,
      sku:            item.sku,
      quantity:       Number(item.quantity),
      purchase_price: Number(item.unitCost),
      tax_percentage: 0,
      tax_amount:     0,
      total:          Number(item.unitCost) * Number(item.quantity),
    }));
    const { error: itemsErr } = await supabase.from('purchase_items').insert(itemRows);
    if (itemsErr) throw new Error(itemsErr.message);

    // Stock increase is handled by AppContext reducer (local state).

    return mapFromDb(pur);
  },

  async delete(id) {
    requireSupabase();
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

function mapFromDb(row) {
  if (!row) return null;
  return {
    id:             row.id,
    purchaseNumber: row.purchase_number,
    supplierId:     row.supplier_id,
    supplierName:   row.suppliers?.name || row.supplier_name || '',
    date:           row.purchase_date?.slice(0, 10) || '',
    subtotal:       Number(row.subtotal),
    taxAmount:      Number(row.tax_total || 0),
    grandTotal:     Number(row.grand_total),
    paymentStatus:  row.payment_status,
    status:         row.status || 'received',
    notes:          row.notes || '',
    createdAt:      row.created_at?.slice(0, 10) || '',
    items: (row.purchase_items || []).map((item) => ({
      productId:   item.product_id,
      productName: item.product_name,
      sku:         item.sku,
      quantity:    Number(item.quantity),
      unitCost:    Number(item.purchase_price),
    })),
  };
}
