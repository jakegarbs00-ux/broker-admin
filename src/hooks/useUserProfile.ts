'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from './useRequireAuth';

type Profile = {
  id: string;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  email?: string | null;
  company_id?: string | null;
  partner_company_id?: string | null;
  is_primary_contact?: boolean | null;
  onboarding_completed?: boolean | null;
  onboarding_step?: number | null;
};

export function useUserProfile() {
  const { user, loading: authLoading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadProfile = async () => {
      if (authLoading) return;

      // CRITICAL: Always get fresh user ID from Supabase, don't rely on cached user
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      // CRITICAL: Clear profile immediately if no user (logout or auth error)
      if (authError || !currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // CRITICAL: Verify the user from hook matches fresh user (security check)
      if (user && currentUser.id !== user.id) {
        console.warn('[useUserProfile] User ID changed - clearing stale profile', {
          oldUserId: user.id,
          newUserId: currentUser.id,
        });
        setProfile(null);
        setLoading(false);
        return;
      }

      // Try to find profile by user ID (ONLY method - no email fallback for security)
      // Try with onboarding fields first, fallback to without them if columns don't exist
      let { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, company_id, partner_company_id, is_primary_contact, onboarding_completed, onboarding_step')
        .eq('id', currentUser.id) // CRITICAL: Always filter by authenticated user ID
        .maybeSingle();

      // If error is about missing column, try without onboarding fields
      if (error && error.code === '42703' && (error.message?.includes('onboarding_completed') || error.message?.includes('onboarding_step'))) {
        const fallbackResult = await supabase
          .from('profiles')
          .select('id, role, email, company_id, partner_company_id, is_primary_contact')
          .eq('id', currentUser.id) // CRITICAL: Always filter by authenticated user ID
          .maybeSingle();
        
        if (fallbackResult.data) {
          data = { ...fallbackResult.data, onboarding_completed: false, onboarding_step: null };
          error = null;
        } else {
          error = fallbackResult.error;
        }
      }

      // SECURITY: Removed email fallback - it's a security risk
      // If profile not found by ID, it doesn't exist yet (will be created by trigger)

      if (error) {
        console.error('[useUserProfile] Error loading profile:', error);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!data) {
        // Profile doesn't exist - might be created by trigger soon
        // Return null and let the component handle waiting/creating
        setProfile(null);
        setLoading(false);
        return;
      }

      // Verify the profile ID matches the current user (double-check security)
      if (data.id !== currentUser.id) {
        console.error('[useUserProfile] SECURITY: Profile ID mismatch!', {
          profileId: data.id,
          userId: currentUser.id,
        });
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, refreshKey]); // Removed user?.id dependency - always get fresh user

  // Failsafe: if still loading after 5 seconds, stop loading (prevents infinite loading)
  useEffect(() => {
    if (!loading) return;
    
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[useUserProfile] Loading timeout - forcing completion');
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading]);

  // Expose refresh function
  const refresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  return { user, profile, loading, refresh };
}
