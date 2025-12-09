'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from './useRequireAuth';

type Profile = {
  id: string;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  email?: string | null;
  referred_by?: string | null;
};

export function useUserProfile() {
  const { user, loading: authLoading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (authLoading) return;

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const email = user.email;
      if (!email) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Simple, robust lookup: find profile row by email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, referred_by')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('[useUserProfile] Error loading profile by email:', error);
      }

      if (!data) {
        // No profile row found for this email
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    };

    loadProfile();
  }, [authLoading, user, supabase]);

  return { user, profile, loading };
}
