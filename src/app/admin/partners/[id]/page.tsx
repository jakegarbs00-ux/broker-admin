'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, getStageBadgeVariant, formatStage } from '@/components/ui';

type PartnerCompany = {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  registration_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  created_at: string;
};

type PartnerUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_primary_contact: boolean;
  created_at: string;
};

type ReferredCompany = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  created_at: string;
  owner_email: string | null;
  referrer_name: string | null;
  applications_count: number;
  open_applications_count: number;
};

export default function AdminPartnerCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null);
  const [partnerUsers, setPartnerUsers] = useState<PartnerUser[]>([]);
  const [referredCompanies, setReferredCompanies] = useState<ReferredCompany[]>([]);
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

      // Load partner company
      const { data: companyData, error: companyError } = await supabase
        .from('partner_companies')
        .select('*')
        .eq('id', id)
        .single();

      if (companyError || !companyData) {
        setError('Partner company not found');
        setLoadingData(false);
        return;
      }

      setPartnerCompany(companyData as PartnerCompany);

      // Load partner users for this company
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, is_primary_contact, created_at')
        .eq('partner_company_id', id)
        .eq('role', 'PARTNER')
        .order('is_primary_contact', { ascending: false })
        .order('created_at', { ascending: true });

      if (usersError) {
        console.error('Error loading partner users', usersError);
      } else {
        setPartnerUsers((usersData || []) as PartnerUser[]);
      }

      // Get all user IDs for this partner company
      const userIds = (usersData || []).map((u) => u.id);

      if (userIds.length > 0) {
        // Get companies referred by any user in this partner company
        const { data: companiesData } = await supabase
          .from('companies')
          .select(`
            id, name, company_number, industry, created_at,
            referrer:referred_by(id, full_name, email),
            primary_director:profiles!profiles_company_id_fkey(id, email, full_name, is_primary_director),
            applications(id, stage)
          `)
          .in('referred_by', userIds)
          .eq('primary_director.is_primary_director', true)
          .order('created_at', { ascending: false });

        if (companiesData) {
          const closedStages = ['funded', 'declined', 'withdrawn'];

          const processedCompanies: ReferredCompany[] = companiesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            company_number: c.company_number,
            industry: c.industry,
            created_at: c.created_at,
            owner_email: c.primary_director?.[0]?.email || null,
            referrer_name: c.referrer?.[0]?.full_name || c.referrer?.[0]?.email || null,
            applications_count: c.applications?.length || 0,
            open_applications_count: c.applications?.filter((a: any) => !closedStages.includes(a.stage)).length || 0,
          }));

          setReferredCompanies(processedCompanies);
        }
      } else {
        setReferredCompanies([]);
      }

      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading partner company...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN' || error) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">{error || 'You do not have permission to view this page.'}</p>
        </div>
      </DashboardShell>
    );
  }

  if (!partnerCompany) return null;

  const totalApplications = referredCompanies.reduce((sum, c) => sum + c.applications_count, 0);
  const openApplications = referredCompanies.reduce((sum, c) => sum + c.open_applications_count, 0);

  return (
    <DashboardShell>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/admin/partners" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Partner Companies
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{partnerCompany.name}</h1>
          {partnerCompany.website && (
            <a
              href={partnerCompany.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-blue-600 hover:text-blue-700"
            >
              {partnerCompany.website}
            </a>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(partnerCompany.created_at).toLocaleDateString('en-GB')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/partners/${id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => router.push(`/admin/partners/${id}/users/add`)}
          >
            Add Partner User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Company info */}
        <div className="space-y-6">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company Details</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Name</dt>
                  <dd className="text-sm font-medium text-gray-900">{partnerCompany.name}</dd>
                </div>
                {partnerCompany.address && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Address</dt>
                    <dd className="text-sm font-medium text-gray-900">{partnerCompany.address}</dd>
                  </div>
                )}
                {partnerCompany.website && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Website</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      <a
                        href={partnerCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {partnerCompany.website}
                      </a>
                    </dd>
                  </div>
                )}
                {partnerCompany.registration_number && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Registration Number</dt>
                    <dd className="text-sm font-medium text-gray-900">{partnerCompany.registration_number}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Bank Details */}
          {(partnerCompany.bank_name || partnerCompany.bank_account_name) && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Bank Details</h2>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {partnerCompany.bank_name && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Bank Name</dt>
                      <dd className="text-sm font-medium text-gray-900">{partnerCompany.bank_name}</dd>
                    </div>
                  )}
                  {partnerCompany.bank_account_name && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Account Name</dt>
                      <dd className="text-sm font-medium text-gray-900">{partnerCompany.bank_account_name}</dd>
                    </div>
                  )}
                  {partnerCompany.bank_account_number && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Account Number</dt>
                      <dd className="text-sm font-medium text-gray-900">{partnerCompany.bank_account_number}</dd>
                    </div>
                  )}
                  {partnerCompany.bank_sort_code && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Sort Code</dt>
                      <dd className="text-sm font-medium text-gray-900">{partnerCompany.bank_sort_code}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Statistics</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Partner Users</span>
                <span className="font-medium text-gray-900">{partnerUsers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Referred Companies</span>
                <span className="font-medium text-gray-900">{referredCompanies.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Applications</span>
                <span className="font-medium text-gray-900">{totalApplications}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Open Applications</span>
                <span className="font-medium text-gray-900">{openApplications}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Users and Companies */}
        <div className="lg:col-span-2 space-y-6">
          {/* Partner Users */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Partner Users</h2>
                <Badge variant="default">{partnerUsers.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {partnerUsers.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No partner users yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          User
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Contact
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Role
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {partnerUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{u.full_name || u.email}</p>
                              {u.full_name && (
                                <p className="text-xs text-gray-500">{u.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{u.phone || '—'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {u.is_primary_contact ? (
                              <Badge variant="purple">Primary Contact</Badge>
                            ) : (
                              <span className="text-sm text-gray-400">User</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(u.created_at).toLocaleDateString('en-GB')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referred Companies */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Referred Companies</h2>
                <Badge variant="default">{referredCompanies.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {referredCompanies.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No referred companies yet</p>
                </div>
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
                          Referred By
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Applications
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Open
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Created
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {referredCompanies.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{c.name}</p>
                              {c.industry && (
                                <p className="text-xs text-gray-500">{c.industry}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{c.owner_email || '—'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{c.referrer_name || '—'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{c.applications_count}</span>
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
                              href={`/admin/companies/${c.id}`}
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
        </div>
      </div>
    </DashboardShell>
  );
}
