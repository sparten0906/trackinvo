import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when both env vars are present and non-placeholder values.
 * The app uses mock/localStorage data when this is false.
 */
export const isSupabaseConfigured =
  !!(supabaseUrl && supabaseAnonKey &&
     supabaseUrl !== 'https://your-project-id.supabase.co' &&
     supabaseAnonKey !== 'your-anon-public-key-here');

if (!isSupabaseConfigured) {
  console.info(
    '[TrackInvo] Supabase not configured — running in mock-data mode.\n' +
    'Copy .env.example → .env and add your project URL + anon key to enable database sync.'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
