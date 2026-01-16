'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export function useRequireAuth() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      // CRITICAL: Always use getUser() for fresh user data, not getSession()
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      
      if (!mounted) return;

      if (error || !currentUser) {
        // Clear all cached data on auth error
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }
        router.replace('/auth/login');
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(false);
    };

    getInitialUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT' || !session?.user) {
          // CRITICAL: Clear ALL cached data on logout
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          router.replace('/auth/login');
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // CRITICAL: Always get fresh user on sign in or token refresh
          const { data: { user: currentUser }, error } = await supabase.auth.getUser();
          if (!mounted) return;
          
          if (error || !currentUser) {
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            router.replace('/auth/login');
            setLoading(false);
            return;
          }

          setUser(currentUser);
          setLoading(false);
        } else if (session?.user) {
          // For other events, use session user but verify it's fresh
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!mounted) return;
          
          if (currentUser) {
            setUser(currentUser);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return { user, loading };
}