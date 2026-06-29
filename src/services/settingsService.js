/**
 * settingsService — read/write the settings table (single row per org).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TABLE = 'settings';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const settingsService = {
  async get() {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).select('*').limit(1).single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async save(settings) {
    requireSupabase();
    // Upsert — settings table has a single row per organisation
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({ ...mapToDb(settings), updated_at: new Date().toISOString() })
      .select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
};

function mapFromDb(row) {
  if (!row) return {};
  return {
    businessName:    row.business_name || '',
    businessEmail:   row.business_email || '',
    businessPhone:   row.business_phone || '',
    businessAddress: row.business_address || '',
    businessCity:    row.business_city || '',
    businessCountry: row.business_country || '',
    taxNumber:       row.tax_number || '',
    currency:        row.currency || 'USD',
    currencySymbol:  row.currency_symbol || '$',
    invoicePrefix:   row.invoice_prefix || 'INV',
    purchasePrefix:  row.purchase_prefix || 'PUR',
    taxRate:         Number(row.tax_rate || 0),
    lowStockThreshold: Number(row.low_stock_threshold || 10),
    invoiceFooter:   row.invoice_footer || '',
  };
}

function mapToDb(s) {
  return {
    business_name:      s.businessName,
    business_email:     s.businessEmail,
    business_phone:     s.businessPhone,
    business_address:   s.businessAddress,
    business_city:      s.businessCity,
    business_country:   s.businessCountry,
    tax_number:         s.taxNumber,
    currency:           s.currency,
    currency_symbol:    s.currencySymbol,
    invoice_prefix:     s.invoicePrefix,
    purchase_prefix:    s.purchasePrefix,
    tax_rate:           Number(s.taxRate),
    low_stock_threshold: Number(s.lowStockThreshold),
    invoice_footer:     s.invoiceFooter,
  };
}
