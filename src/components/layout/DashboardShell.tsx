'use client';

import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Get auth and profile directly (don't depend on useUserProfile)
  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      try {
        // Get authenticated user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (!mounted) return;

        if (authError || !authUser) {
          // Not authenticated - redirect to login
          router.replace('/auth/login');
          setLoading(false);
          return;
        }

        setUser(authUser);

        // Get profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, email, company_id, partner_company_id, is_primary_contact')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          console.error('[DashboardShell] Error loading profile:', profileError);
          // Continue anyway - might be a new user
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(profileData);
        setLoading(false);
      } catch (err) {
        console.error('[DashboardShell] Error loading auth:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Timeout fallback - if still loading after 5 seconds, stop loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[DashboardShell] Loading timeout - forcing completion');
        setLoadingTimeout(true);
        setLoading(false);
      }
    }, 5000);

    loadAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [supabase, router, loading]);

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user after timeout or error, redirect to login
  if (!user) {
    // Redirect will happen in useEffect, but show loading while redirecting
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Redirecting...</p>
        </div>
      </div>
    );
  }

  // If no profile, try to continue with default role (might be new user)
  const role = (profile?.role as 'CLIENT' | 'PARTNER' | 'ADMIN') || 'CLIENT';
  const email = user.email ?? 'Unknown';

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - fixed on all screen sizes, hidden on mobile unless open */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar role={role} userId={user.id} email={email} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen">
        <Header 
          email={email} 
          role={role} 
          onMenuClick={() => setSidebarOpen(true)} 
        />
        
        {/* Page content - full width, no max-width constraint */}
        <main className="flex-1 pt-16 bg-[var(--color-bg-primary)] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}