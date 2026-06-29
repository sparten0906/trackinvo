import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TABLE = 'categories';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
}

export const categoryService = {
  async getAll() {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).select('*').order('name');
    if (error) throw new Error(error.message);
    return data.map(mapFromDb);
  },

  async create(category) {
    requireSupabase();
    const { data, error } = await supabase.from(TABLE).insert(mapToDb(category)).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  async update(id, category) {
    requireSupabase();
    const { data, error } = await supabase
      .from(TABLE).update({ ...mapToDb(category), updated_at: new Date().toISOString() })
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
  return { id: row.id, name: row.name, description: row.description || '', createdAt: row.created_at?.slice(0, 10) || '' };
}

function mapToDb(cat) {
  return { name: cat.name, description: cat.description || null };
}
