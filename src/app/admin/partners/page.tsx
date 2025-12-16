'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, EmptyState, PageHeader } from '@/components/ui';

type PartnerCompany = {
  id: string;
  name: string;
  website: string | null;
  created_at: string;
  users_count: number;
  referred_companies_count: number;
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

      // Get all partner companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('partner_companies')
        .select('id, name, website, created_at')
        .order('name');

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

      // For each partner company, count users and referred companies
      const companyIds = companiesData.map((c) => c.id);

      // Get all partner users with their company IDs
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, partner_company_id')
        .in('partner_company_id', companyIds)
        .eq('role', 'PARTNER');

      const usersCount: Record<string, number> = {};
      const userToCompany: Record<string, string> = {};
      (usersData || []).forEach((u: any) => {
        if (u.partner_company_id) {
          usersCount[u.partner_company_id] = (usersCount[u.partner_company_id] || 0) + 1;
          userToCompany[u.id] = u.partner_company_id;
        }
      });

      // Get referred companies count
      const partnerUserIds = Object.keys(userToCompany);
      const referredCount: Record<string, number> = {};

      if (partnerUserIds.length > 0) {
        const { data: referredData } = await supabase
          .from('companies')
          .select('referred_by')
          .in('referred_by', partnerUserIds);

        (referredData || []).forEach((c: any) => {
          if (c.referred_by && userToCompany[c.referred_by]) {
            const companyId = userToCompany[c.referred_by];
            referredCount[companyId] = (referredCount[companyId] || 0) + 1;
          }
        });
      }

      const processedCompanies: PartnerCompany[] = companiesData.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        created_at: c.created_at,
        users_count: usersCount[c.id] || 0,
        referred_companies_count: referredCount[c.id] || 0,
      }));

      setPartnerCompanies(processedCompanies);
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
            <p className="text-sm text-gray-500">Loading partner companies...</p>
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
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Partner Companies"
        description={`${partnerCompanies.length} registered partner companies`}
        actions={
          <Link href="/admin/partners/create">
            <Button variant="primary">Create Partner Company</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">All Partner Companies</h2>
            <Badge variant="default">{partnerCompanies.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {partnerCompanies.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                title="No partner companies yet"
                description="Create your first partner company to get started."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Company Name
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Website
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Users
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Referred Companies
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Created
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {partnerCompanies.map((pc) => (
                    <tr key={pc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{pc.name}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{pc.website || '—'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pc.users_count > 0 ? (
                          <Badge variant="info">{pc.users_count}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pc.referred_companies_count > 0 ? (
                          <Badge variant="success">{pc.referred_companies_count}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(pc.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/admin/partners/${pc.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
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
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
