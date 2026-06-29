import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TABLE = 'suppliers';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const supplierService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).select('*').order('name');
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async create(supplier) {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).insert(mapToDb(supplier)).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async update(id, supplier) {
    requireSupabase();
    const { data, error } = await supabase
      .from(TABLE).update({ ...mapToDb(supplier), updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async delete(id) {
    requireSupabase();
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

function mapFromDb(row) {
  return {
    id: row.id, name: row.name, email: row.email || '', phone: row.phone || '',
    address: row.address || '', city: row.city || '', country: row.country || '',
    taxId: row.gst_number || '', notes: row.notes || '',
    status: row.status || 'active', createdAt: row.created_at?.slice(0, 10) || '',
  };
}

function mapToDb(s) {
  return {
    name: s.name, email: s.email, phone: s.phone || null,
    address: s.address || null, city: s.city || null, country: s.country || null,
    gst_number: s.taxId || null, notes: s.notes || null, status: s.status || 'active',
  };
}
