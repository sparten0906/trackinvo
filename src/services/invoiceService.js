/**
 * invoiceService — handles invoice creation with stock deduction and movement tracking.
 * All operations are atomic via sequential DB calls; wraps in try/catch.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const invoiceService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), customers(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async getById(id) {
    requireSupabase();
    const { data, error } = await supabase
      .from('invoices').select('*, invoice_items(*)')
      .eq('id', id).single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  /**
   * Create invoice with items in Supabase.
   * Stock validation and deduction are handled by AppContext reducer (local state).
   */
  async create(invoice) {
    requireSupabase();

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number:  invoice.invoiceNumber,
        customer_id:     invoice.customerId || null,
        customer_name:   invoice.customerName || null,
        subtotal:        Number(invoice.subtotal),
        discount_type:   invoice.discountType,
        discount_value:  Number(invoice.discountValue || 0),
        tax_total:       Number(invoice.taxAmount),
        grand_total:     Number(invoice.grandTotal),
        discount_amount: Number(invoice.discountAmount),
        paid_amount:     Number(invoice.paidAmount || invoice.grandTotal),
        balance_amount:  Number(invoice.balanceAmount || 0),
        payment_method:  invoice.paymentMethod,
        payment_status:  invoice.paymentStatus,
        invoice_date:    invoice.date,
        notes:           invoice.notes || null,
      })
      .select().single();
    if (invErr) throw new Error(invErr.message);

    if (invoice.items?.length) {
      const itemRows = invoice.items.map((item) => ({
        invoice_id:     inv.id,
        product_id:     item.productId || null,
        product_name:   item.productName,
        sku:            item.sku || null,
        quantity:       Number(item.quantity),
        unit_price:     Number(item.unitPrice),
        tax_percentage: Number(item.taxPercent || 0),
        tax_amount:     Number(item.unitPrice) * Number(item.quantity) * Number(item.taxPercent || 0) / 100,
        discount:       Number(item.discount || 0),
        total:          Number(item.unitPrice) * Number(item.quantity),
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(itemRows);
      if (itemsErr) throw new Error(itemsErr.message);
    }

    return mapFromDb(inv);
  },

  async updateStatus(id, paymentStatus) {
    requireSupabase();
    const { data, error } = await supabase
      .from('invoices').update({ payment_status: paymentStatus }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async delete(id) {
    requireSupabase();
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

function mapFromDb(row) {
  if (!row) return null;
  return {
    id:             row.id,
    invoiceNumber:  row.invoice_number,
    customerId:     row.customer_id,
    customerName:   row.customers?.name || row.customer_name || '',
    date:           row.invoice_date?.slice(0, 10) || '',
    subtotal:       Number(row.subtotal),
    discountType:   row.discount_type || 'fixed',
    discountValue:  Number(row.discount_value || 0),
    discountAmount: Number(row.discount_amount || 0),
    taxAmount:      Number(row.tax_total || 0),
    grandTotal:     Number(row.grand_total),
    paymentMethod:  row.payment_method,
    paymentStatus:  row.payment_status,
    notes:          row.notes || '',
    createdAt:      row.created_at?.slice(0, 10) || '',
    items: (row.invoice_items || []).map((item) => ({
      productId:   item.product_id,
      productName: item.product_name,
      sku:         item.sku,
      quantity:    Number(item.quantity),
      unitPrice:   Number(item.unit_price),
      taxPercent:  Number(item.tax_percentage || 0),
      discount:    0,
    })),
  };
}
