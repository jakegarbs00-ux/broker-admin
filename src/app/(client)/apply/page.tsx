'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { ApplicationWizard } from '@/components/application/ApplicationWizard';

export default function ApplyPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          // Not authenticated - redirect to login
          router.push('/auth/login');
          return;
        }

        setIsAuthChecked(true);
      } catch (err) {
        console.error('Error checking auth:', err);
        router.push('/auth/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  // Show loading until auth is checked
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Show wizard - it will handle its own loading/auth checks
  // Don't use DashboardShell if profile doesn't exist yet
  return <ApplicationWizard />;
}

