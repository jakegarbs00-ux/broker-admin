'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

type PartnerApplication = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  company_id: string | null;
  created_by: string | null;
  prospective_client_email: string | null;
  company?: {
    id: string;
    name: string;
    referrer?: {
      id: string;
      full_name: string | null;
      email: string | null;
    }[] | null;
  }[] | null;
  creator?: {
    id: string;
    email: string | null;
    full_name: string | null;
  }[] | null;
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

      // Get companies referred by any user in this partner company
      const { data: referredCompanies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .in('referred_by', partnerUserIds);

      if (companiesError) {
        console.error('Error loading referred companies', companiesError);
        setError('Error loading referred companies: ' + companiesError.message);
        setLoadingApps(false);
        return;
      }

      const companyIds = (referredCompanies ?? []).map((c) => c.id) as string[];

      // Load applications for referred companies OR draft apps created by this partner
      const orFilters = [
        companyIds.length > 0
          ? `company_id.in.(${companyIds.join(',')})`
          : '',
        `and(company_id.is.null,created_by.in.(${partnerUserIds.join(',')}))`,
      ]
        .filter(Boolean)
        .join(',');

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
            company_id,
            created_by,
            prospective_client_email,
            company:companies!applications_company_id_fkey(
              id,
              name,
              referrer:referred_by(id, full_name, email)
            ),
            creator:profiles!applications_created_by_fkey(id, email, full_name)
          `
        )
        .or(orFilters)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error loading partner applications', appsError);
        setError('Error loading applications: ' + appsError.message);
        setLoadingApps(false);
        return;
      }

      setApps((appsData ?? []) as any);
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
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading applications...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Authentication Required</p>
          <p className="text-sm text-gray-500 mt-1">You need to be logged in to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">
            You are not a partner. This page is only available to users with the PARTNER role.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600">
            Partner / broker
          </p>
          <h1 className="text-2xl font-semibold">Referred client applications</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Link
          href="/partner/applications/new"
          className="inline-block rounded-md bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
        >
          New client application
        </Link>
      </div>

      {apps.length === 0 ? (
        <p className="text-gray-600 text-sm">
          You don&apos;t have any applications for your clients yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => {
                const companyName = a.company?.[0]?.name ?? 'Company pending';
                const referrer = a.company?.[0]?.referrer?.[0];
                const referredBy =
                  referrer?.full_name
                    ? `${referrer.full_name}${referrer.email ? ` (${referrer.email})` : ''}`
                    : (referrer?.email ?? '—');

                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/partner/applications/${a.id}`} className="font-medium text-purple-700 hover:underline">
                        {companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      £{a.requested_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{a.loan_type}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStageBadgeVariant(a.stage)}>{formatStage(a.stage)}</Badge>
                        {a.is_hidden && <Badge variant="warning">Draft</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{referredBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(a.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/partner/applications/${a.id}`} className="text-sm text-purple-700 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </DashboardShell>
  );
}
