'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';

type PartnerApplication = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  prospective_client_email: string | null;
  company?: {
    name: string;
  } | null;
  owner?: {
    id: string;
    email: string | null;
  } | null;
};

export default function PartnerApplicationsPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const [apps, setApps] = useState<PartnerApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (profile?.role !== 'PARTNER') {
        setLoadingApps(false);
        return;
      }

      setError(null);

      // Get user's partner_company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.partner_company_id) {
        setApps([]);
        setLoadingApps(false);
        return;
      }

      // Get all partner user IDs in this partner company
      const { data: partnerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('partner_company_id', userProfile.partner_company_id)
        .eq('role', 'PARTNER');

      const partnerUserIds = (partnerUsers || []).map((u) => u.id);

      if (partnerUserIds.length === 0) {
        setApps([]);
        setLoadingApps(false);
        return;
      }

      // Get companies under this partner company (via partner_company_id - matches dashboard)
      const { data: referredCompanies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('partner_company_id', userProfile.partner_company_id);

      if (companiesError) {
        console.error('Error loading referred companies', companiesError);
        setError('Error loading referred companies: ' + companiesError.message);
        setLoadingApps(false);
        return;
      }

      const companyIds = (referredCompanies ?? []).map((c) => c.id) as string[];

      if (companyIds.length === 0) {
        setApps([]);
        setLoadingApps(false);
        return;
      }

      // Load applications for these companies
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(
          `
            id,
            requested_amount,
            stage,
            loan_type,
            urgency,
            created_at,
            is_hidden,
            prospective_client_email,
            company_id,
            company:companies(name)
          `
        )
        .in('company_id', companyIds)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error loading partner applications', appsError);
        setError('Error loading applications: ' + appsError.message);
        setLoadingApps(false);
        return;
      }

      // Get primary directors for companies to show client email
      const { data: directorsData } = await supabase
        .from('profiles')
        .select('id, email, company_id')
        .in('company_id', companyIds)
        .eq('is_primary_director', true);

      const directorMap: Record<string, { id: string; email: string | null }> = {};
      (directorsData || []).forEach((d: any) => {
        if (d.company_id) {
          directorMap[d.company_id] = { id: d.id, email: d.email };
        }
      });

      // Enrich applications with owner data
      const enrichedApps = (appsData || []).map((app: any) => ({
        ...app,
        owner: app.company_id && directorMap[app.company_id]
          ? [directorMap[app.company_id]]
          : null,
      }));

      setApps(enrichedApps as PartnerApplication[]);
      setLoadingApps(false);
    };

    if (!loading) {
      load();
    }
  }, [user, profile?.role, loading, supabase]);

  if (loading || loadingApps) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading applications...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">You need to be logged in.</p>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            You are not a partner. This page is only available to users with the PARTNER role.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Referred Client Applications</h1>
            <p className="text-[var(--color-text-secondary)]">{apps.length} applications</p>
          </div>
          <Link href="/partner/applications/new">
            <button className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)]">
              New Application
            </button>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}

        {apps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-secondary)] text-sm">
              You don&apos;t have any applications for your clients yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => {
              const isDraft = a.is_hidden;
              const hasOwner = !!a.owner?.id;

              const clientLabel = hasOwner
                ? a.owner?.email ?? 'Known client'
                : a.prospective_client_email ?? 'Prospective client';

              return (
                <Link
                  key={a.id}
                  href={`/partner/applications/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <div>
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {a.company?.name ?? 'Company pending'} • {clientLabel}
                    </p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                      £{a.requested_amount.toLocaleString()} – {a.loan_type}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        isDraft
                          ? 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      {isDraft ? 'Draft (hidden)' : a.stage}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
