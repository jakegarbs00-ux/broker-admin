'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { ApplicationWizard } from '@/components/application/ApplicationWizard';
import { Card, CardContent } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function ApplyPage() {
  const router = useRouter();
  const { user, profile, loading, refresh } = useUserProfile();
  const supabase = getSupabaseClient();
  const [resuming, setResuming] = useState(false);
  const [initialStep, setInitialStep] = useState<number | undefined>(undefined);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== 'CLIENT') {
      router.push('/dashboard');
    }
  }, [profile, loading, router]);

  // Load existing application in progress
  useEffect(() => {
    const loadApplication = async () => {
      if (!user || !profile) return;

      // CRITICAL: Verify authenticated user ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[ApplyPage] SECURITY: User ID mismatch');
        return;
      }

      // Check for existing application in 'created' stage
      const { data: apps } = await supabase
        .from('applications')
        .select('id, stage')
        .eq('created_by', currentUser.id) // Use created_by instead of owner_id
        .eq('stage', 'created')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (apps) {
        setApplicationId(apps.id);
        setResuming(true);
        // Determine step based on what's filled
        // For now, default to step 1, but could be smarter
        setInitialStep(1);
      }
    };

    if (!loading && user && profile) {
      loadApplication();
    }
  }, [user, profile, loading, supabase]);

  // Show loading state
  if (loading || !user || !profile) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Only show for CLIENT role
  if (profile.role !== 'CLIENT') {
    return null;
  }

  return (
    <DashboardShell>
      <ApplicationWizard 
        initialStep={initialStep} 
        applicationId={applicationId || undefined}
      />
    </DashboardShell>
  );
}

