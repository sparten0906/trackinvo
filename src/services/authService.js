/**
 * authService — wraps Supabase Auth (or demo stub)
 * The AuthContext is the primary consumer; pages should use useAuth(), not this directly.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const authService = {
  /**
   * Sign in with email + password via Supabase Auth.
   * Falls back to demo mode if Supabase is not configured (handled in AuthContext).
   */
  async signIn(email, password) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('SUPABASE_NOT_CONFIGURED');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getSession() {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getUser() {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  onAuthStateChange(callback) {
    if (!isSupabaseConfigured || !supabase) return { unsubscribe: () => {} };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  },
};
