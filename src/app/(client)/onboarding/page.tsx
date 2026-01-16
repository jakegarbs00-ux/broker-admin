'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function ClientOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refresh } = useUserProfile();
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role !== 'CLIENT') {
      router.push('/dashboard');
    }
  }, [profile, loading, router]);

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

  // Only show onboarding for CLIENT role
  if (profile.role !== 'CLIENT') {
    return null;
  }

  // Check if user has completed onboarding (onboarding_step = 5 or onboarding_completed = true)
  const profileWithStep = profile as typeof profile & { onboarding_step?: number | null; onboarding_completed?: boolean };
  const isCompleted = profileWithStep.onboarding_step === 5 || profileWithStep.onboarding_completed === true;

  if (isCompleted) {
    router.push('/dashboard');
    return null;
  }

  const savedStep = profileWithStep.onboarding_step;

  return (
    <DashboardShell>
      <OnboardingWizard initialStep={savedStep || undefined} />
    </DashboardShell>
  );
}

