'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, getStageBadgeVariant, formatStage, Button } from '@/components/ui';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  created_at: string;
  referred_by: string | null;
  referrer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
};

type CompanyUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  property_status: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  is_primary_director: boolean | null;
  created_at: string;
};

export default function PartnerCompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !id) return;

    const loadData = async () => {
      setError(null);

      // Fetch company - RLS will handle permission check
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          referrer:referred_by(id, first_name, last_name, email)
        `)
        .eq('id', id)
        .single();

      if (companyError || !companyData) {
        console.error('Error fetching company:', companyError);
        setError('Company not found');
        setLoadingData(false);
        return;
      }

      setCompany(companyData as Company);

      // Fetch applications for this company
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      setApplications((appsData || []) as Application[]);

      // Fetch ALL users associated with this company
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: true });

      if (usersError) {
        console.error('Error fetching company users:', usersError);
      } else {
        console.log('Company users fetched:', usersData?.length || 0, usersData);
      }

      // Sort users: primary directors first, then by creation date
      const sortedUsers = (usersData || []).sort((a, b) => {
        if (a.is_primary_director && !b.is_primary_director) return -1;
        if (!a.is_primary_director && b.is_primary_director) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setCompanyUsers(sortedUsers as CompanyUser[]);

      setLoadingData(false);
    };

    loadData();
  }, [loading, id, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading company...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !company) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">{error || 'Company not found'}</p>
          <Link href="/partner/companies" className="text-[var(--color-accent)] hover:text-purple-700 text-sm mt-4 inline-block">
            ← Back to Companies
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const closedStages = ['funded', 'declined', 'withdrawn'];
  const openApplications = applications.filter((a) => !closedStages.includes(a.stage));
  const totalRequested = applications.reduce((sum, a) => sum + (a.requested_amount || 0), 0);
  
  // Check if company is eligible for a new application
  // Eligible if: no applications OR no open applications
  const canCreateApplication = applications.length === 0 || openApplications.length === 0;

  return (
    <DashboardShell>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/partner/companies" className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{company.name}</h1>
        {company.industry && (
          <p className="text-[var(--color-text-secondary)]">{company.industry}</p>
        )}
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          Added {new Date(company.created_at).toLocaleDateString('en-GB')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Company Information</h2>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Company Name</dt>
                  <dd className="text-sm font-medium text-[var(--color-text-primary)]">{company.name}</dd>
                </div>
                {company.company_number && (
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Company Number</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{company.company_number}</dd>
                  </div>
                )}
                {company.industry && (
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Industry</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{company.industry}</dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Website</dt>
                    <dd className="text-sm font-medium">
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {(company.address_line_1 || company.city || company.postcode) && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Company Address</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {[
                        company.address_line_1,
                        company.address_line_2,
                        company.city,
                        company.postcode,
                        company.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                  </div>
                )}
                {company.referrer && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Referred By</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {company.referrer.first_name} {company.referrer.last_name}
                      {company.referrer.email && (
                        <span className="text-[var(--color-text-secondary)] ml-2">({company.referrer.email})</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Company Users */}
          {companyUsers.length > 0 && companyUsers.map((user, index) => (
            <Card key={user.id}>
              <CardHeader>
                <h2 className="font-medium text-[var(--color-text-primary)]">
                  {user.is_primary_director ? 'Director Information' : `User Information${companyUsers.length > 1 ? ` (${index + 1})` : ''}`}
                </h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Full Name</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Phone</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{user.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Email</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{user.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Date of Birth</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-GB') : '—'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Address</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {user.address_line_1 || user.address_line_2 || user.city || user.postcode || user.country ? (
                        <div className="space-y-0.5">
                          {user.address_line_1 && <div>{user.address_line_1}</div>}
                          {user.address_line_2 && <div>{user.address_line_2}</div>}
                          {user.city && <div>{user.city}</div>}
                          {user.postcode && <div>{user.postcode}</div>}
                          {user.country && <div>{user.country}</div>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}

          {/* Applications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Applications</h2>
                <div className="flex items-center gap-3">
                  <Badge variant="default">{applications.length}</Badge>
                  {canCreateApplication && (
                    <Link href={`/partner/applications/new?company_id=${id}`}>
                      <Button variant="primary" size="sm">
                        + New Application
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-[var(--color-text-tertiary)] mb-4">No applications yet</p>
                  {canCreateApplication && (
                    <Link href={`/partner/applications/new?company_id=${id}`}>
                      <Button variant="primary">Create First Application</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/partner/applications/${app.id}`}
                      className="block p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            £{app.requested_amount?.toLocaleString()}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{app.loan_type}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                            {new Date(app.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <Badge variant={getStageBadgeVariant(app.stage)}>
                          {formatStage(app.stage)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Total Applications</span>
                <span className="font-medium text-[var(--color-text-primary)]">{applications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Open Applications</span>
                <span className="font-medium text-[var(--color-accent)]">{openApplications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Total Requested</span>
                <span className="font-medium text-[var(--color-text-primary)]">£{totalRequested.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status breakdown */}
          {applications.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-[var(--color-text-primary)]">By Status</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from(new Set(applications.map((a) => a.stage))).map((stage) => {
                  const count = applications.filter((a) => a.stage === stage).length;
                  return (
                    <div key={stage} className="flex items-center justify-between py-1">
                      <Badge variant={getStageBadgeVariant(stage)}>
                        {formatStage(stage)}
                      </Badge>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}