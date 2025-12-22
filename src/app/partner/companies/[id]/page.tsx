'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

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

type Director = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

export default function PartnerCompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
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

      // Fetch client/director
      const { data: directorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', id)
        .eq('is_primary_director', true)
        .maybeSingle();

      if (directorData) {
        setDirector(directorData as Director);
      }

      setLoadingData(false);
    };

    loadData();
  }, [loading, id, supabase]);

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading company...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !company) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">{error || 'Company not found'}</p>
          <Link href="/partner/companies" className="text-purple-600 hover:text-purple-700 text-sm mt-4 inline-block">
            ← Back to Companies
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const closedStages = ['funded', 'declined', 'withdrawn'];
  const openApplications = applications.filter((a) => !closedStages.includes(a.stage));
  const totalRequested = applications.reduce((sum, a) => sum + (a.requested_amount || 0), 0);

  return (
    <DashboardShell>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/partner/companies" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
        {company.industry && (
          <p className="text-gray-600">{company.industry}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Added {new Date(company.created_at).toLocaleDateString('en-GB')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company Information</h2>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Company Name</dt>
                  <dd className="text-sm font-medium text-gray-900">{company.name}</dd>
                </div>
                {company.company_number && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Company Number</dt>
                    <dd className="text-sm font-medium text-gray-900">{company.company_number}</dd>
                  </div>
                )}
                {company.industry && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Industry</dt>
                    <dd className="text-sm font-medium text-gray-900">{company.industry}</dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Website</dt>
                    <dd className="text-sm font-medium">
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {director && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Client Email</dt>
                    <dd className="text-sm font-medium text-gray-900">{director.email || '—'}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Director Information */}
          {director && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Director Information</h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Name</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {director.first_name} {director.last_name}
                    </dd>
                  </div>
                  {director.email && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Email</dt>
                      <dd className="text-sm font-medium text-gray-900">{director.email}</dd>
                    </div>
                  )}
                  {director.phone && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Phone</dt>
                      <dd className="text-sm font-medium text-gray-900">{director.phone}</dd>
                    </div>
                  )}
                  {director.date_of_birth && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Date of Birth</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {new Date(director.date_of_birth).toLocaleDateString('en-GB')}
                      </dd>
                    </div>
                  )}
                  {director.address_line_1 && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500 uppercase">Address</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {[
                          director.address_line_1,
                          director.address_line_2,
                          director.city,
                          director.postcode,
                          director.country,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Applications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Applications</h2>
                <Badge variant="default">{applications.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No applications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/partner/applications/${app.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            £{app.requested_amount?.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">{app.loan_type}</p>
                          <p className="text-xs text-gray-400 mt-1">
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
              <h2 className="font-medium text-gray-900">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Applications</span>
                <span className="font-medium text-gray-900">{applications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Open Applications</span>
                <span className="font-medium text-purple-600">{openApplications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Requested</span>
                <span className="font-medium text-gray-900">£{totalRequested.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status breakdown */}
          {applications.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">By Status</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from(new Set(applications.map((a) => a.stage))).map((stage) => {
                  const count = applications.filter((a) => a.stage === stage).length;
                  return (
                    <div key={stage} className="flex items-center justify-between py-1">
                      <Badge variant={getStageBadgeVariant(stage)}>
                        {formatStage(stage)}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
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