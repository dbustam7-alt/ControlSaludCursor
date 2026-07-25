'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  signInWithEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_DEMO_USER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'demo.familiar@controlsalud.com',
  displayName: 'Usuario Demo Familiar',
  photoUrl: null,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Check if user is already in demo mode in localStorage
    const savedDemo = localStorage.getItem('demo_mode_active');
    if (savedDemo === 'true') {
      setIsDemoMode(true);
      setUser(MOCK_DEMO_USER);
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          mapAndSetUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error checking authentication session:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          mapAndSetUser(session.user);
        } else if (!isDemoMode && localStorage.getItem('demo_mode_active') !== 'true') {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  const mapAndSetUser = (supabaseUser: User) => {
    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      displayName: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Usuario',
      photoUrl: supabaseUser.user_metadata?.avatar_url || null,
    });
    setIsDemoMode(false);
    localStorage.removeItem('demo_mode_active');
  };

  const signInWithEmail = async (email: string) => {
    try {
      // If we are in local development and placeholder config is used, automatically fall back to Demo Mode
      if (process.env.NEXT_PUBLIC_SUPABASE_URL === undefined || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        enableDemoMode();
        return { success: true };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Email sign in error:', error);
      return { success: false, error: error.message || 'Error al enviar el enlace de acceso.' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL === undefined || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        enableDemoMode();
        return { success: true };
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Google sign in error:', error);
      return { success: false, error: error.message || 'Error al conectar con Google.' };
    }
  };

  const signOut = async () => {
    try {
      if (!isDemoMode) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setIsDemoMode(false);
      localStorage.removeItem('demo_mode_active');
    }
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    setUser(MOCK_DEMO_USER);
    localStorage.setItem('demo_mode_active', 'true');
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        enableDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
