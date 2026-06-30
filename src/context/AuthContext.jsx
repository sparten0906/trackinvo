/**
 * AuthContext — demo mode + Supabase-ready
 *
 * Demo credentials: demo@inventory.com / demo123
 *
 * To wire real Supabase Auth later:
 *   1. Uncomment the Supabase blocks below (marked SUPABASE_AUTH)
 *   2. Remove the DEMO_USER block
 *   3. The rest of the app needs no changes — it reads from this context only
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// ─── Demo credentials ────────────────────────────────────────────────────────
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@inventory.com',
  name: 'Admin User',
  role: 'Administrator',
  avatarInitial: 'A',
};
const DEMO_PASSWORD = 'demo123';
const SESSION_KEY = 'trackinvo_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while checking persisted session
  const [error, setError] = useState('');

  // ─── On mount: restore session ─────────────────────────────────────────────
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email,
            role: session.user.user_metadata?.role || 'Administrator',
            avatarInitial: (session.user.user_metadata?.name || session.user.email || 'A')[0].toUpperCase(),
          });
        }
        setIsLoading(false);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email,
            role: session.user.user_metadata?.role || 'Administrator',
            avatarInitial: (session.user.user_metadata?.name || session.user.email || 'A')[0].toUpperCase(),
          });
        } else {
          setUser(null);
        }
      });
      return () => subscription.unsubscribe();
    }

    // Demo mode: restore from localStorage (remember me) or sessionStorage (tab session)
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.id === DEMO_USER.id) setUser(session);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password, rememberMe = false) => {
    setError('');

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const u = data.user;
      const sessionUser = {
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email,
        role: u.user_metadata?.role || 'Administrator',
        avatarInitial: (u.user_metadata?.name || u.email || 'A')[0].toUpperCase(),
      };
      setUser(sessionUser);
      return sessionUser;
    }

    // Demo mode fallback (no Supabase configured)
    await new Promise((r) => setTimeout(r, 800));
    if (email.toLowerCase().trim() !== DEMO_USER.email) {
      throw new Error('No account found with that email address.');
    }
    if (password !== DEMO_PASSWORD) {
      throw new Error('Incorrect password. Try: demo123');
    }
    const sessionUser = { ...DEMO_USER, rememberMe };
    setUser(sessionUser);
    if (rememberMe) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    }
    return sessionUser;
  }, []);

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
