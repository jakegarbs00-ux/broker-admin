'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button, EmptyState, getStageBadgeVariant, formatStage } from '@/components/ui';

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
  company_id: string | null;
  prospective_client_email: string | null;
  company: { id: string; name: string; director_full_name: string | null }[] | null;
  owner: { email: string | null }[] | null;
};

const STAGES = [
  'created',
  'submitted',
  'in_credit',
  'info_required',
  'approved',
  'onboarding',
  'funded',
  'declined',
  'withdrawn',
];

export default function AdminDashboardPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [stats, setStats] = useState({
    totalPartners: 0,
    totalCompanies: 0,
    totalApplications: 0,
    totalFunded: 0,
    openApplications: 0,
  });
  const [applications, setApplications] = useState<Application[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      try {
        // Load partners count
        const { data: partnersData, error: partnersError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'PARTNER');

        if (partnersError) {
          console.error('Error loading partners', partnersError);
        }

        // Load companies count
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('id');

        if (companiesError) {
          console.error('Error loading companies', companiesError);
        }

        // Load all applications (for counts and recent list)
        const { data: allAppsData, error: appsError } = await supabase
          .from('applications')
          .select(`
            id,
            requested_amount,
            loan_type,
            stage,
            created_at,
            company_id,
            prospective_client_email,
            company:companies!applications_company_id_fkey(id, name, director_full_name),
            owner:profiles!applications_owner_id_fkey(id, email)
          `)
          .order('created_at', { ascending: false });

        if (appsError) {
          console.error('Error loading applications', appsError);
          setError('Error loading data: ' + appsError.message);
        } else if (allAppsData) {
          const apps = allAppsData as Application[];
          // Set recent applications (first 10)
          setApplications(apps.slice(0, 10));
          // Store all applications for Kanban view
          setAllApplications(apps);

          // Calculate stage counts from all applications
          const allCounts: Record<string, number> = {};
          STAGES.forEach((stage) => {
            allCounts[stage] = apps.filter((a) => a.stage === stage).length;
          });
          setStageCounts(allCounts);

          // Calculate stats
          const closedStages = ['funded', 'declined', 'withdrawn'];
          const openApps = allAppsData.filter((a) => !closedStages.includes(a.stage));
          const fundedApps = allAppsData.filter((a) => a.stage === 'funded');
          const fundedTotal = fundedApps.reduce((sum, a) => sum + (a.requested_amount || 0), 0);

          setStats({
            totalPartners: partnersData?.length || 0,
            totalCompanies: companiesData?.length || 0,
            totalApplications: allAppsData.length,
            totalFunded: fundedTotal,
            openApplications: openApps.length,
          });
        }
      } catch (err: any) {
        console.error('Error loading dashboard data', err);
        setError('Error loading dashboard data: ' + err.message);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [loading, profile?.role, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading dashboard...</p>
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
        title="Admin Dashboard"
        description="Platform overview and key metrics at a glance."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Partners</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPartners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Companies</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Applications</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Open Applications</p>
            <p className="text-2xl font-bold text-blue-600">{stats.openApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Funded</p>
            <p className="text-2xl font-bold text-green-600">£{stats.totalFunded.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Recent Applications</h2>
                <Link href="/admin/applications" className="text-sm text-blue-600 hover:text-blue-700">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Applications will appear here once they are created."
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.map((app) => {
                    const companyName = app.company?.[0]?.name;
                    const directorName = app.company?.[0]?.director_full_name;
                    const ownerEmail = app.owner?.[0]?.email;
                    const prospectiveEmail = app.prospective_client_email;
                    // Prefer director name, then company name, then owner email, then prospective email
                    const displayName = directorName || companyName || ownerEmail || prospectiveEmail || `Application ${app.id.slice(0, 8)}`;
                    const secondaryInfo = companyName && directorName ? companyName : 
                                         ownerEmail && ownerEmail !== displayName ? ownerEmail : null;

                    return (
                      <Link
                        key={app.id}
                        href={`/admin/applications/${app.id}`}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{displayName}</p>
                          {secondaryInfo && (
                            <p className="text-xs text-gray-500 truncate">{secondaryInfo}</p>
                          )}
                          <p className="text-sm text-gray-600">
                            £{app.requested_amount?.toLocaleString()} – {app.loan_type}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(app.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <Badge variant={getStageBadgeVariant(app.stage)}>
                          {formatStage(app.stage)}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Quick Actions</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/applications" className="block">
                <Button variant="primary" className="w-full">
                  View All Applications
                </Button>
              </Link>
              <Link href="/admin/partners" className="block">
                <Button variant="secondary" className="w-full">
                  Manage Partners
                </Button>
              </Link>
              <Link href="/admin/companies" className="block">
                <Button variant="secondary" className="w-full">
                  Manage Companies
                </Button>
              </Link>
              <Link href="/admin/lenders" className="block">
                <Button variant="secondary" className="w-full">
                  Manage Lenders
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deals by Stage - Grid View */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Deals by Stage</h2>
            <Link href="/admin/applications" className="text-sm text-blue-600 hover:text-blue-700">
              View all applications →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {stats.totalApplications === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No applications yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {STAGES.filter((stage) => stage !== 'funded').map((stage) => {
                const stageApps = allApplications.filter((app) => app.stage === stage);
                const count = stageApps.length;
                const percentage = stats.totalApplications > 0 
                  ? Math.round((count / stats.totalApplications) * 100) 
                  : 0;
                
                return (
                  <Link
                    key={stage}
                    href={`/admin/applications?stage=${stage}`}
                    className="block"
                  >
                    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={getStageBadgeVariant(stage)}>
                          {formatStage(stage)}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-3xl font-bold text-gray-900">{count}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {percentage}% of total
                          </p>
                        </div>
                        {count > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

