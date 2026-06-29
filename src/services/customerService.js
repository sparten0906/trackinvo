import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TABLE = 'customers';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const customerService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).select('*').order('name');
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async create(customer) {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).insert(mapToDb(customer)).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async update(id, customer) {
    requireSupabase();
    const { data, error } = await supabase
      .from(TABLE).update({ ...mapToDb(customer), updated_at: new Date().toISOString() })
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

function mapToDb(c) {
  return {
    name: c.name, email: c.email, phone: c.phone || null,
    address: c.address || null, city: c.city || null, country: c.country || null,
    gst_number: c.taxId || null, notes: c.notes || null, status: c.status || 'active',
  };
}
