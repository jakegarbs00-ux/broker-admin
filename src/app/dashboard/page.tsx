'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, getStageBadgeVariant, formatStage, Button, EmptyState } from '@/components/ui';

type Company = { id: string; name: string };

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
  company_id?: string;
  company_name?: string;
};

type ReferredClient = {
  id: string;
  email: string | null;
  companies: { id: string; name: string }[] | null;
};

function ClientDashboardContent({ userId }: { userId: string }) {
  const supabase = getSupabaseClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Get user's company_id from profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (userProfile?.company_id) {
        // Load company
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', userProfile.company_id)
          .maybeSingle();

        if (companyData) setCompany(companyData);

        // Load recent applications for this company
        const { data: appsData } = await supabase
          .from('applications')
          .select('id, requested_amount, loan_type, stage, created_at')
          .eq('company_id', userProfile.company_id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (appsData) setApplications(appsData);
      }
      setLoading(false);
    };

    loadData();
  }, [supabase, userId]);

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your funding applications."
      />

      {/* Company profile alert */}
      {!company && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium text-yellow-800">Complete your company profile</p>
              <p className="text-sm text-yellow-700">
                We need your company details before you can submit a funding application.
              </p>
            </div>
            <Link href="/onboarding/company">
              <Button variant="primary" size="sm">
                Complete Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Info Card */}
        {company && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-gray-500">Company</h2>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-gray-900">{company.name}</p>
              <Link
                href="/onboarding/company"
                className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
              >
                Edit details →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Applications Summary */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Applications</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{applications.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total applications</p>
          </CardContent>
        </Card>

        {/* Quick Action */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Quick Action</h2>
          </CardHeader>
          <CardContent>
            {company ? (
              <Link href="/applications/new">
                <Button variant="primary" className="w-full">
                  Start New Application
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" disabled className="w-full">
                Complete profile first
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Recent Applications</h2>
            <Link href="/applications" className="text-sm text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Create your first funding application to get started."
              action={
                company && (
                  <Link href="/applications/new">
                    <Button variant="primary" size="sm">
                      Create Application
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="divide-y divide-gray-200">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  href={`/applications/${app.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      £{app.requested_amount?.toLocaleString() ?? '—'}
                    </p>
                    <p className="text-sm text-gray-500">{app.loan_type}</p>
                  </div>
                  <Badge variant={getStageBadgeVariant(app.stage)}>
                    {formatStage(app.stage)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PartnerDashboardContent({ userId }: { userId: string }) {
  const supabase = getSupabaseClient();
  const [referralLink, setReferralLink] = useState('');
  const [clients, setClients] = useState<ReferredClient[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalApplications: 0,
    openApplications: 0,
    fundedAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReferralLink(`${window.location.origin}/auth/signup?ref=${userId}`);
    }
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      // Get user's partner_company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', userId)
        .single();

      if (!userProfile?.partner_company_id) {
        setLoading(false);
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
        setLoading(false);
        return;
      }

      // Load companies referred by any user in this partner company
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, primary_director:profiles!profiles_company_id_fkey(id, email, is_primary_director)')
        .in('referred_by', partnerUserIds)
        .eq('primary_director.is_primary_director', true);

      if (!companiesData || companiesData.length === 0) {
        setLoading(false);
        return;
      }

      // Build company map and client list
      const companyMap: Record<string, string> = {};
      const clientsList: ReferredClient[] = [];
      companiesData.forEach((c: any) => {
        companyMap[c.id] = c.name;
        const director = c.primary_director?.[0];
        if (director) {
          clientsList.push({
            id: director.id,
            email: director.email,
            companies: [{ id: c.id, name: c.name }],
          });
        }
      });

      if (clientsList.length > 0) {
        setClients(clientsList);
      }

      const companyIds = Object.keys(companyMap);

      // Load all applications for these companies
      if (companyIds.length > 0) {
        const { data: appsData } = await supabase
          .from('applications')
          .select('id, requested_amount, loan_type, stage, created_at, company_id')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false });

        const enrichedApps = (appsData || []).map((a: any) => ({
          ...a,
          company_name: companyMap[a.company_id] || 'Unknown',
        }));

        setApplications(enrichedApps);

        // Calculate stats
        const closedStages = ['funded', 'declined', 'withdrawn'];
        const openApps = enrichedApps.filter((a: Application) => !closedStages.includes(a.stage));
        const fundedApps = enrichedApps.filter((a: Application) => a.stage === 'funded');
        const fundedTotal = fundedApps.reduce((sum: number, a: Application) => sum + (a.requested_amount || 0), 0);

        setStats({
          totalCompanies: companyIds.length,
          totalApplications: enrichedApps.length,
          openApplications: openApps.length,
          fundedAmount: fundedTotal,
        });
      }

      setLoading(false);
    };

    loadData();
  }, [supabase, userId]);

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <>
      <PageHeader
        title="Partner Dashboard"
        description="Manage your referred clients and track their applications."
        actions={
          <Link href="/partner/companies/new">
            <Button variant="primary">
              + Add Company
            </Button>
          </Link>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Referred Companies</p>
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
            <p className="text-2xl font-bold text-purple-600">{stats.openApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Funded</p>
            <p className="text-2xl font-bold text-green-600">£{stats.fundedAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">All Applications</h2>
                <Badge variant="default">{applications.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Applications from your referred companies will appear here."
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.slice(0, 10).map((app) => (
                    <Link
                      key={app.id}
                      href={`/partner/applications/${app.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {app.company_name}
                        </p>
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
                  ))}
                  {applications.length > 10 && (
                    <div className="px-6 py-4 text-center">
                      <Link
                        href="/partner/applications"
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        View all {applications.length} applications →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Referral Link */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Your Referral Link</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">
                Share this link with clients to automatically link them to you.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (navigator.clipboard && referralLink) {
                      navigator.clipboard.writeText(referralLink);
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Quick Actions</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/partner/companies/new" className="block">
                <Button variant="primary" className="w-full">
                  + Add New Company
                </Button>
              </Link>
              <Link href="/partner/companies" className="block">
                <Button variant="secondary" className="w-full">
                  View All Companies
                </Button>
              </Link>
              <Link href="/partner/company" className="block">
                <Button variant="secondary" className="w-full">
                  Your Company Info
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Companies summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Your Companies</h2>
                <Link href="/partner/companies" className="text-sm text-purple-600 hover:text-purple-700">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {clients.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm text-gray-500">No companies referred yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {clients.slice(0, 5).map((client) => (
                    <div key={client.id} className="px-4 py-3">
                      {client.companies && client.companies[0] ? (
                        <Link
                          href={`/partner/companies/${client.companies[0].id}`}
                          className="font-medium text-gray-900 hover:text-purple-600"
                        >
                          {client.companies[0].name}
                        </Link>
                      ) : (
                        <p className="text-gray-500">No company</p>
                      )}
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useUserProfile();

  if (loading) return null;
  if (!user || !profile) return null;

  const role = profile.role as 'CLIENT' | 'PARTNER' | 'ADMIN';

  // Admins get redirected to admin dashboard
  if (role === 'ADMIN') {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/applications';
    }
    return null;
  }

  return (
    <DashboardShell>
      {role === 'CLIENT' && <ClientDashboardContent userId={user.id} />}
      {role === 'PARTNER' && <PartnerDashboardContent userId={user.id} />}
    </DashboardShell>
  );
}