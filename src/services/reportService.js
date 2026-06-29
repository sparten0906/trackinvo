/**
 * reportService — aggregated data queries for the Reports page.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const reportService = {
  /** Sales summary for a date range */
  async getSalesSummary(from, to) {
    requireSupabase();
    let q = supabase.from('invoices').select('grand_total, tax_total, payment_status, invoice_date, discount_amount');
    if (from) q = q.gte('invoice_date', from);
    if (to)   q = q.lte('invoice_date', to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      totalRevenue:    data.reduce((s, r) => s + Number(r.grand_total), 0),
      paidRevenue:     data.filter((r) => r.payment_status === 'paid').reduce((s, r) => s + Number(r.grand_total), 0),
      totalTax:        data.reduce((s, r) => s + Number(r.tax_total || 0), 0),
      totalDiscount:   data.reduce((s, r) => s + Number(r.discount_amount || 0), 0),
      invoiceCount:    data.length,
    };
  },

  /** Stock movements for a product or all products */
  async getStockMovements(productId = null) {
    requireSupabase();
    let q = supabase.from('stock_movements').select('*, products(name, sku)').order('created_at', { ascending: false });
    if (productId) q = q.eq('product_id', productId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  },

  /** Low stock products */
  async getLowStock() {
    requireSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, current_stock, minimum_stock, unit')
      .filter('current_stock', 'lte', supabase.raw('minimum_stock'));
    if (error) throw new Error(error.message);
    return data;
  },
};
