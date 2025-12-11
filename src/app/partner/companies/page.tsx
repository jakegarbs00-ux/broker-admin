'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, PageHeader, Badge, Button, EmptyState } from '@/components/ui';

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
    const loadCompanies = async () => {
      if (!user) return;
      setError(null);

      // First, get all clients referred by this partner
      const { data: referredClients, error: clientsError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('referred_by', user.id);

      if (clientsError) {
        console.error('Error loading referred clients', clientsError);
        setError('Error loading referred clients: ' + clientsError.message);
        setLoadingData(false);
        return;
      }

      if (!referredClients || referredClients.length === 0) {
        setCompanies([]);
        setLoadingData(false);
        return;
      }

      const clientIds = referredClients.map((c) => c.id);
      const clientEmailMap: Record<string, string> = {};
      referredClients.forEach((c) => {
        clientEmailMap[c.id] = c.email;
      });

      // Get companies owned by these clients
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          industry,
          website,
          created_at,
          owner_id,
          applications(id, stage)
        `)
        .in('owner_id', clientIds)
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Error loading companies', companiesError);
        setError('Error loading companies: ' + companiesError.message);
        setLoadingData(false);
        return;
      }

      const closedStages = ['funded', 'declined', 'withdrawn'];
      
      const processedCompanies: Company[] = (companiesData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        company_number: c.company_number,
        industry: c.industry,
        website: c.website,
        created_at: c.created_at,
        owner_email: clientEmailMap[c.owner_id] || null,
        applications_count: c.applications?.length || 0,
        open_applications_count: c.applications?.filter((a: any) => !closedStages.includes(a.stage)).length || 0,
      }));

      setCompanies(processedCompanies);
      setLoadingData(false);
    };

    if (!loading && profile?.role === 'PARTNER') {
      loadCompanies();
    }
  }, [loading, profile?.role, user, supabase]);

  if (!loading && profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading companies...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Your Companies"
        description={`${companies.length} referred companies`}
        actions={
          <Link href="/partner/companies/new">
            <Button variant="primary">+ Add Company</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="No companies yet"
              description="Companies you refer will appear here. Use your referral link or add a company directly."
              action={
                <Link href="/partner/companies/new">
                  <Button variant="primary">Add Company</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Company
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Client Email
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Website
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Open Apps
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Created
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.company_number && (
                            <p className="text-xs text-gray-500">#{c.company_number}</p>
                          )}
                          {c.industry && (
                            <p className="text-xs text-gray-500">{c.industry}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {c.owner_email ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            {c.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.open_applications_count > 0 ? (
                          <Badge variant="info">{c.open_applications_count}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(c.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/partner/companies/${c.id}`}
                          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
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