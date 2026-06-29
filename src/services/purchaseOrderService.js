import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

function mapFromDb(row) {
  return {
    id:              row.id,
    poNumber:        row.po_number,
    supplierId:      row.supplier_id,
    supplierName:    row.supplier_name,
    status:          row.status,
    orderDate:       row.order_date,
    expectedDate:    row.expected_date,
    supplierRef:     row.supplier_ref,
    paymentTerms:    row.payment_terms,
    notes:           row.notes,
    subtotal:        Number(row.subtotal  || 0),
    grandTotal:      Number(row.grand_total || 0),
    timeline:        row.timeline || [],
    items:           (row.purchase_order_items || []).map(mapItemFromDb),
    createdAt:       row.created_at,
  };
}

function mapItemFromDb(row) {
  return {
    id:            row.id,
    productId:     row.product_id,
    productName:   row.product_name,
    sku:           row.sku,
    description:   row.description,
    unit:          row.unit,
    quantity:      Number(row.quantity   || 0),
    receivedQty:   Number(row.received_qty || 0),
    unitCost:      Number(row.unit_cost  || 0),
    sellingPrice:  Number(row.selling_price || 0),
    taxPercent:    Number(row.tax_percent || 0),
    hsnSac:        row.hsn_sac,
    categoryId:    row.category_id,
    brand:         row.brand,
    isNewProduct:  row.is_new_product || false,
    productLinked: row.product_linked || false,
  };
}

function mapReceiptFromDb(row) {
  return {
    id:            row.id,
    receiptNumber: row.receipt_number,
    poId:          row.po_id,
    poNumber:      row.po_number,
    supplierId:    row.supplier_id,
    supplierName:  row.supplier_name,
    receiptDate:   row.receipt_date,
    notes:         row.notes,
    items:         (row.purchase_receipt_items || []).map(ri => ({
      poItemId:    ri.po_item_id,
      productId:   ri.product_id,
      productName: ri.product_name,
      sku:         ri.sku,
      orderedQty:  Number(ri.ordered_qty  || 0),
      receivedQty: Number(ri.received_qty || 0),
      condition:   ri.condition,
      notes:       ri.notes,
    })),
    createdAt: row.created_at,
  };
}

export const purchaseOrderService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async getById(id) {
    requireSupabase();
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async create(po) {
    requireSupabase();
    const { data: header, error: hErr } = await supabase
      .from('purchase_orders')
      .insert({
        po_number:     po.poNumber,
        supplier_id:   po.supplierId,
        supplier_name: po.supplierName,
        status:        po.status || 'created',
        order_date:    po.orderDate,
        expected_date: po.expectedDate,
        supplier_ref:  po.supplierRef,
        payment_terms: po.paymentTerms,
        notes:         po.notes,
        subtotal:      po.subtotal,
        grand_total:   po.grandTotal,
        timeline:      JSON.stringify(po.timeline || []),
      })
      .select()
      .single();
    if (hErr) throw new Error(hErr.message);

    if (po.items?.length) {
      const rows = po.items.map(it => ({
        po_id:          header.id,
        product_id:     it.productId || null,
        product_name:   it.productName,
        sku:            it.sku,
        description:    it.description,
        unit:           it.unit,
        quantity:       it.quantity,
        received_qty:   0,
        unit_cost:      it.unitCost,
        selling_price:  it.sellingPrice,
        tax_percent:    it.taxPercent,
        hsn_sac:        it.hsnSac,
        category_id:    it.categoryId || null,
        brand:          it.brand,
        is_new_product: it.isNewProduct || false,
        product_linked: it.productLinked || false,
      }));
      const { error: iErr } = await supabase.from('purchase_order_items').insert(rows);
      if (iErr) throw new Error(iErr.message);
    }
    return mapFromDb({ ...header, purchase_order_items: po.items || [] });
  },

  async updateStatus(id, status, timelineEntry) {
    requireSupabase();
    const { data: existing } = await supabase.from('purchase_orders').select('timeline').eq('id', id).single();
    const timeline = [...(JSON.parse(existing?.timeline || '[]')), timelineEntry].filter(Boolean);
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status, timeline: JSON.stringify(timeline) })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async receiveItems(poId, receiptData) {
    requireSupabase();
    const { data: receipt, error: rErr } = await supabase
      .from('purchase_receipts')
      .insert({
        receipt_number: receiptData.receiptNumber,
        po_id:          poId,
        po_number:      receiptData.poNumber,
        supplier_id:    receiptData.supplierId,
        supplier_name:  receiptData.supplierName,
        receipt_date:   receiptData.receiptDate,
        notes:          receiptData.notes,
      })
      .select()
      .single();
    if (rErr) throw new Error(rErr.message);

    const rows = receiptData.items.map(it => ({
      receipt_id:   receipt.id,
      po_item_id:   it.poItemId,
      product_id:   it.productId,
      product_name: it.productName,
      sku:          it.sku,
      ordered_qty:  it.orderedQty,
      received_qty: it.receivedQty,
      condition:    it.condition,
      notes:        it.notes,
    }));
    const { error: riErr } = await supabase.from('purchase_receipt_items').insert(rows);
    if (riErr) throw new Error(riErr.message);

    // Update received_qty on each PO item
    for (const it of receiptData.items) {
      await supabase
        .from('purchase_order_items')
        .update({ received_qty: supabase.rpc('increment', { x: it.receivedQty }) })
        .eq('id', it.poItemId);
    }
    return mapReceiptFromDb({ ...receipt, purchase_receipt_items: rows });
  },

  async linkItemToProduct(poItemId, productId) {
    requireSupabase();
    const { error } = await supabase
      .from('purchase_order_items')
      .update({ product_id: productId, product_linked: true, is_new_product: true })
      .eq('id', poItemId);
    if (error) throw new Error(error.message);
  },

  async getAllReceipts() {
    requireSupabase();
    const { data, error } = await supabase
      .from('purchase_receipts')
      .select('*, purchase_receipt_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(mapReceiptFromDb);
  },
};
