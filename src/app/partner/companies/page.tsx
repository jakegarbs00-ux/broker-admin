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

      // Get clients referred by this partner
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

    loadCompanies();
  }, [loading, profile?.role, user, supabase]);

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

  if (profile?.role !== 'PARTNER') {
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Companies</h1>
          <p className="text-gray-600">{companies.length} referred companies</p>
        </div>
        <Link href="/partner/companies/new">
          <Button variant="primary">+ Add Company</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
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
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left side - main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.company_number && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500">#{c.company_number}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {c.industry && <span>{c.industry}</span>}
                      {c.owner_email && <span>{c.owner_email}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Added {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>

                  {/* Right side - stats and badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{c.applications_count} applications</p>
                      {c.open_applications_count > 0 && (
                        <p className="text-xs text-purple-600">{c.open_applications_count} open</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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