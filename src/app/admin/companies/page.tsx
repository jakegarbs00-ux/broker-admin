'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button, EmptyState } from '@/components/ui';

type Partner = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  created_at: string;
  director_full_name: string | null;
  director_address: string | null;
  director_dob: string | null;
  owner: { id: string; email: string; referred_by: string | null }[] | null;
  applications: { id: string; stage: string }[];
  partner?: Partner | null;
};

export default function AdminCompaniesPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadCompanies = async () => {
      setError(null);

      const { data, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          industry,
          website,
          created_at,
          director_full_name,
          director_address,
          director_dob,
          owner:profiles!companies_owner_id_fkey(id, email, referred_by),
          applications(id, stage)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading companies', error);
        setError('Error loading companies: ' + error.message);
        setLoadingData(false);
        return;
      }

      if (!data || data.length === 0) {
        setCompanies([]);
        setLoadingData(false);
        return;
      }

      // Get all unique partner IDs from referred_by fields
      const partnerIds = Array.from(
        new Set(
          data
            .map((c: any) => c.owner?.[0]?.referred_by)
            .filter((id: string | null) => id !== null && id !== undefined)
        )
      ) as string[];

      // Fetch partner information
      let partnerMap: Record<string, Partner> = {};
      if (partnerIds.length > 0) {
        const { data: partnersData } = await supabase
          .from('profiles')
          .select('id, email, full_name, company_name')
          .in('id', partnerIds)
          .eq('role', 'PARTNER');

        if (partnersData) {
          partnersData.forEach((p: any) => {
            partnerMap[p.id] = {
              id: p.id,
              email: p.email,
              full_name: p.full_name,
              company_name: p.company_name,
            };
          });
        }
      }

      // Enrich companies with partner information
      const enrichedCompanies: Company[] = data.map((c: any) => {
        const ownerReferredBy = c.owner?.[0]?.referred_by;
        const partner = ownerReferredBy ? partnerMap[ownerReferredBy] || null : null;

        return {
          ...c,
          partner,
        };
      });

      setCompanies(enrichedCompanies);
      setLoadingData(false);
    };

    if (!loading && profile?.role === 'ADMIN') {
      loadCompanies();
    }
  }, [loading, profile?.role, supabase]);

  if (!loading && profile?.role !== 'ADMIN') {
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
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading companies...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  const filteredCompanies = companies.filter((c) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      c.owner?.[0]?.email?.toLowerCase().includes(search) ||
      c.director_full_name?.toLowerCase().includes(search) ||
      c.company_number?.toLowerCase().includes(search)
    );
  });

  const getOpenApplicationsCount = (apps: { id: string; stage: string }[]) => {
    const closedStages = ['funded', 'declined', 'withdrawn'];
    return apps.filter((a) => !closedStages.includes(a.stage)).length;
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Companies"
        description={`${companies.length} companies registered`}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Search */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by company name, email, or number..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{filteredCompanies.length}</span> of{' '}
              <span className="font-medium">{companies.length}</span> companies
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Companies table */}
      <Card>
        <CardContent className="p-0">
          {filteredCompanies.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="No companies found"
              description={searchTerm ? 'Try adjusting your search.' : 'No companies have been registered yet.'}
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
                      Director / Client
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Referred By
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
                  {filteredCompanies.map((c) => {
                    const openApps = getOpenApplicationsCount(c.applications);
                    // Company is referred if the owner (client) was referred by a partner
                    const ownerReferredBy = c.owner?.[0]?.referred_by;
                    const isReferred = ownerReferredBy !== null && ownerReferredBy !== undefined;
                    const directorName = c.director_full_name;
                    const clientEmail = c.owner?.[0]?.email;
                    const hasOwner = c.owner && c.owner.length > 0 && c.owner[0]?.id;
                    
                    return (
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
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {directorName ? (
                              <p className="text-sm font-medium text-gray-900">{directorName}</p>
                            ) : (
                              <p className="text-sm text-gray-400">Director name unknown</p>
                            )}
                            {clientEmail ? (
                              <p className="text-xs text-gray-500">Client: {clientEmail}</p>
                            ) : (
                              <p className="text-xs text-gray-400">No client email</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isReferred ? (
                            <Badge variant="success">Referred</Badge>
                          ) : hasOwner ? (
                            <Badge variant="default">Direct</Badge>
                          ) : (
                            <Badge variant="warning">No Client</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {c.partner ? (
                            <div>
                              <Link
                                href={`/admin/partners/${c.partner.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700"
                              >
                                {c.partner.full_name || c.partner.company_name || c.partner.email}
                              </Link>
                              {c.partner.company_name && c.partner.full_name && (
                                <p className="text-xs text-gray-500">{c.partner.email}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
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
                          {openApps > 0 ? (
                            <Badge variant="info">{openApps}</Badge>
                          ) : (
                            <span className="text-sm text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(c.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/admin/companies/${c.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
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
        </CardContent>
      </Card>
    </DashboardShell>
  );
}