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
};

type ReferredClient = {
  id: string;
  email: string | null;
  companies: { name: string }[] | null;
};

function ClientDashboardContent({ userId }: { userId: string }) {
  const supabase = getSupabaseClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Load company
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('owner_id', userId)
        .maybeSingle();

      if (companyData) setCompany(companyData);

      // Load recent applications
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('owner_id', userId)
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
  const [applicationCount, setApplicationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReferralLink(`${window.location.origin}/auth/signup?ref=${userId}`);
    }
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      // Load referred clients with their companies
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('id, email, companies(name)')
        .eq('role', 'CLIENT')
        .eq('referred_by', userId);

      if (clientsData) setClients(clientsData as ReferredClient[]);

      // Count applications from referred clients
      if (clientsData && clientsData.length > 0) {
        const clientIds = clientsData.map((c) => c.id);
        const { count } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .in('owner_id', clientIds);

        setApplicationCount(count ?? 0);
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
          <Link href="/partner/applications/new">
            <Button variant="primary">
              New Client Application
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clients count */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Referred Clients</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{clients.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active clients</p>
          </CardContent>
        </Card>

        {/* Applications count */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Applications</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{applicationCount}</p>
            <p className="text-sm text-gray-500 mt-1">Total applications</p>
          </CardContent>
        </Card>

        {/* Quick link */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Quick Action</h2>
          </CardHeader>
          <CardContent>
            <Link href="/partner/applications">
              <Button variant="outline" className="w-full">
                View All Applications
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-medium text-gray-900">Your Referral Link</h2>
          <p className="text-sm text-gray-500">
            Share this link with clients. Their accounts will be automatically linked to you.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
            />
            <Button
              variant="secondary"
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

      {/* Referred Clients List */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-medium text-gray-900">Referred Clients</h2>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              description="Share your referral link to start building your client base."
            />
          ) : (
            <div className="divide-y divide-gray-200">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{client.email ?? 'Unknown'}</p>
                    {client.companies && client.companies[0] && (
                      <p className="text-sm text-gray-500">{client.companies[0].name}</p>
                    )}
                  </div>
                  <Badge variant="info">Client</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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