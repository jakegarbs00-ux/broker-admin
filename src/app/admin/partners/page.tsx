'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, EmptyState } from '@/components/ui';

type PartnerCompany = {
  id: string;
  name: string;
  registration_number: string | null;
  created_at: string;
  userCount: number;
  referralCount: number;
  applicationCount: number;
  lastReferralDate: string | null;
};

export default function AdminPartnersPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partnerCompanies, setPartnerCompanies] = useState<PartnerCompany[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadPartnerCompanies = async () => {
      setError(null);

      // Fetch partner companies, not profiles
      const { data: companiesData, error: companiesError } = await supabase
        .from('partner_companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Error loading partner companies', companiesError);
        setError('Error loading partner companies: ' + companiesError.message);
        setLoadingData(false);
        return;
      }

      if (!companiesData || companiesData.length === 0) {
        setPartnerCompanies([]);
        setLoadingData(false);
        return;
      }

      // For each partner company, get stats
      const companiesWithStats = await Promise.all(
        companiesData.map(async (pc) => {
          // Get users in this partner company
          const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .eq('partner_company_id', pc.id);

          const userIds = users?.map((u) => u.id) || [];

          // Get referred companies
          const { count: referralCount } = await supabase
            .from('companies')
            .select('id', { count: 'exact', head: true })
            .in('referred_by', userIds.length > 0 ? userIds : ['none']);

          // Get applications from referred companies
          const { data: referredCompanies } = await supabase
            .from('companies')
            .select('id')
            .in('referred_by', userIds.length > 0 ? userIds : ['none']);

          const companyIds = referredCompanies?.map((c) => c.id) || [];

          const { count: appCount } = await supabase
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .in('company_id', companyIds.length > 0 ? companyIds : ['none']);

          // Get most recent referral date
          const { data: lastReferral } = await supabase
            .from('companies')
            .select('created_at')
            .in('referred_by', userIds.length > 0 ? userIds : ['none'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...pc,
            userCount: users?.length || 0,
            referralCount: referralCount || 0,
            applicationCount: appCount || 0,
            lastReferralDate: lastReferral?.created_at || null,
          };
        })
      );

      setPartnerCompanies(companiesWithStats as PartnerCompany[]);
      setLoadingData(false);
    };

    loadPartnerCompanies();
  }, [loading, profile?.role, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading partner companies...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  const totalReferrals = partnerCompanies.reduce((sum, pc) => sum + pc.referralCount, 0);
  const totalApplications = partnerCompanies.reduce((sum, pc) => sum + pc.applicationCount, 0);

  return (
    <DashboardShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Partner Companies</h1>
            <p className="text-[var(--color-text-secondary)]">{partnerCompanies.length} registered partner companies</p>
          </div>
          <Link href="/admin/partners/create">
            <Button variant="primary">Create Partner Company</Button>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main table - takes 3 columns */}
          <div className="lg:col-span-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">All Partner Companies</h2>
              <span className="text-[var(--color-text-tertiary)]">{partnerCompanies.length}</span>
            </div>

            {partnerCompanies.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  title="No partner companies yet"
                  description="Create a new partner company to get started."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-sm text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                      <th className="pb-3 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">COMPANY NAME</th>
                      <th className="pb-3 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">USERS</th>
                      <th className="pb-3 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">REFERRALS</th>
                      <th className="pb-3 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">APPLICATIONS</th>
                      <th className="pb-3 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">LAST REFERRAL</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerCompanies.map((pc) => (
                      <tr key={pc.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                        <td className="py-4 font-medium text-[var(--color-text-primary)]">{pc.name}</td>
                        <td className="py-4 text-[var(--color-text-secondary)]">{pc.userCount}</td>
                        <td className="py-4 text-[var(--color-text-secondary)]">{pc.referralCount}</td>
                        <td className="py-4 text-[var(--color-text-secondary)]">{pc.applicationCount}</td>
                        <td className="py-4 text-[var(--color-text-secondary)]">
                          {pc.lastReferralDate
                            ? new Date(pc.lastReferralDate).toLocaleDateString('en-GB')
                            : '—'}
                        </td>
                        <td className="py-4">
                          <Link
                            href={`/admin/partners/${pc.id}`}
                            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar - takes 1 column */}
          <div className="space-y-6">
            {/* Summary card */}
            <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6">
              <h3 className="font-semibold mb-4 text-[var(--color-text-primary)]">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Companies</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{partnerCompanies.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Referrals</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{totalReferrals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Applications</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{totalApplications}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
