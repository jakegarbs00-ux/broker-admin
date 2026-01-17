'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, Badge, Button, EmptyState } from '@/components/ui';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  created_at: string;
  owner_email: string | null;
  applications_count: number;
  open_applications_count: number;
};

export default function PartnerCompaniesPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.role !== 'PARTNER') {
      setLoadingData(false);
      return;
    }

    const loadCompanies = async () => {
      setError(null);

      // First get the current user's partner_company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.partner_company_id) {
        setCompanies([]);
        setLoadingData(false);
        return;
      }

      // Get companies under this partner company (via partner_company_id - matches dashboard)
      const { data: referredCompanies, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          industry,
          website,
          created_at,
          referrer:referred_by(id, first_name, last_name, email),
          applications(id, stage)
        `)
        .eq('partner_company_id', profile.partner_company_id)
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Error loading companies', companiesError);
        setError('Error loading companies: ' + companiesError.message);
        setLoadingData(false);
        return;
      }

      if (!referredCompanies || referredCompanies.length === 0) {
        setCompanies([]);
        setLoadingData(false);
        return;
      }

      // Get primary directors for companies to show client email
      const companyIds = referredCompanies.map((c: any) => c.id);
      const { data: directorsData } = await supabase
        .from('profiles')
        .select('id, email, company_id')
        .in('company_id', companyIds)
        .eq('is_primary_director', true);

      const directorMap: Record<string, string> = {};
      (directorsData || []).forEach((d: any) => {
        if (d.company_id) {
          directorMap[d.company_id] = d.email;
        }
      });

      const closedStages = ['funded', 'declined', 'withdrawn'];
      
      const processedCompanies: Company[] = (referredCompanies || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        company_number: c.company_number,
        industry: c.industry,
        website: c.website,
        created_at: c.created_at,
        owner_email: directorMap[c.id] || null,
        applications_count: c.applications?.length || 0,
        open_applications_count: c.applications?.filter((a: any) => !closedStages.includes(a.stage)).length || 0,
      }));

      setCompanies(processedCompanies);
      setLoadingData(false);
    };

    loadCompanies();
  }, [loading, profile?.role, user, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading companies...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Your Companies</h1>
          <p className="text-[var(--color-text-secondary)]">{companies.length} referred companies</p>
        </div>
        <Link href="/partner/companies/new">
          <Button variant="primary">+ Add Company</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="No companies yet"
              description="Companies you refer will appear here. Add your first company to get started."
              action={
                <Link href="/partner/companies/new">
                  <Button variant="primary">Add Company</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => (
            <Link key={c.id} href={`/partner/companies/${c.id}`} className="block">
              <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 hover:shadow-md hover:border-[var(--color-border)] transition-all cursor-pointer">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left side - main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[var(--color-text-primary)]">{c.name}</span>
                      {c.company_number && (
                        <>
                          <span className="text-[var(--color-text-tertiary)]">•</span>
                          <span className="text-sm text-[var(--color-text-tertiary)]">#{c.company_number}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[var(--color-text-tertiary)]">
                      {c.industry && <span>{c.industry}</span>}
                      {c.owner_email && <span>{c.owner_email}</span>}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      Added {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>

                  {/* Right side - stats and badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{c.applications_count} applications</p>
                      {c.open_applications_count > 0 && (
                        <p className="text-xs text-[var(--color-accent)]">{c.open_applications_count} open</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}