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
      // Get user's profile to find company_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (!profileData?.company_id) {
        setLoading(false);
        return;
      }

      // Load company
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', profileData.company_id)
        .maybeSingle();

      if (companyData) setCompany(companyData);

      // Load recent applications for this company
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('company_id', profileData.company_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (appsData) setApplications(appsData);
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

      // Get companies referred by any user in this partner company
      const { data: referredCompanies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, referred_by')
        .in('referred_by', partnerUserIds)
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Error loading referred companies', companiesError);
        setLoading(false);
        return;
      }

      if (!referredCompanies || referredCompanies.length === 0) {
        setLoading(false);
        return;
      }

      // Build company map and get client emails
      const companyMap: Record<string, string> = {};
      const companyToClientMap: Record<string, string> = {};

      for (const company of referredCompanies) {
        companyMap[company.id] = company.name;
        if (company.referred_by) {
          companyToClientMap[company.id] = company.referred_by;
        }
      }

      // Get client emails for display
      const clientIds = Array.from(new Set(Object.values(companyToClientMap)));
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('id, email, company_id')
        .in('id', clientIds);

      const clientEmailMap: Record<string, string> = {};
      (clientsData || []).forEach((c: any) => {
        clientEmailMap[c.id] = c.email || '';
      });

      // Build clients list for sidebar
      const clientsList: ReferredClient[] = referredCompanies.map((c) => ({
        id: companyToClientMap[c.id] || '',
        email: clientEmailMap[companyToClientMap[c.id] || ''] || null,
        companies: [{ id: c.id, name: c.name }],
      }));

      setClients(clientsList);

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
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useUserProfile();

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
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
          <p className="text-sm text-gray-500 mt-1">Please log in to access the dashboard.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Profile Not Found</p>
          <p className="text-sm text-gray-500 mt-1">Your user profile could not be loaded. Please contact support.</p>
        </div>
      </DashboardShell>
    );
  }

  const role = profile.role as 'CLIENT' | 'PARTNER' | 'ADMIN';

  // Admins get redirected to admin dashboard
  if (role === 'ADMIN') {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/applications';
    }
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Redirecting to admin dashboard...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {role === 'CLIENT' && <ClientDashboardContent userId={user.id} />}
      {role === 'PARTNER' && <PartnerDashboardContent userId={user.id} />}
    </DashboardShell>
  );
}