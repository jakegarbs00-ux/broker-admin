'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Get authenticated user directly
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          // Not authenticated - redirect to login
          router.replace('/auth/login');
          return;
        }

        // Query profile directly - don't use hooks
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[AdminLayout] Error loading profile:', profileError);
          router.replace('/auth/login');
          return;
        }

        if (!profileData || profileData.role !== 'ADMIN') {
          // Not an admin - redirect to dashboard
          router.replace('/dashboard');
          return;
        }

        // User is authenticated and is an admin
        setIsAuthorized(true);
        setIsLoading(false);
      } catch (err) {
        console.error('[AdminLayout] Error checking admin auth:', err);
        router.replace('/auth/login');
      }
    };

    checkAdminAuth();
  }, [router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authorized, return null (redirect will happen via router.replace)
  if (!isAuthorized) {
    return null;
  }

  // User is authorized as admin - render children
  return <>{children}</>;
}

