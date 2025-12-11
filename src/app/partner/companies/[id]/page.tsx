'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  director_full_name: string | null;
  director_address: string | null;
  director_dob: string | null;
  property_status: string | null;
  created_at: string;
  owner: { email: string }[] | null;
};

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
};

export default function PartnerCompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.role !== 'PARTNER') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // First verify this company belongs to a client referred by this partner
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          id, name, company_number, industry, website,
          director_full_name, director_address, director_dob, property_status,
          created_at, owner_id,
          owner:profiles!companies_owner_id_fkey(email)
        `)
        .eq('id', id)
        .single();

      if (companyError) {
        setError('Company not found');
        setLoadingData(false);
        return;
      }

      // Check if owner was referred by this partner
      if (companyData.owner_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('referred_by')
          .eq('id', companyData.owner_id)
          .single();

        if (ownerProfile?.referred_by !== user.id) {
          setError('You do not have access to this company');
          setLoadingData(false);
          return;
        }
      }

      setCompany(companyData as Company);

      // Load applications
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      setApplications((appsData || []) as Application[]);
      setLoadingData(false);
    };

    loadData();
  }, [loading, user, profile?.role, id, supabase]);

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

  if (profile?.role !== 'PARTNER' || error) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">{error || 'You do not have permission to view this page.'}</p>
        </div>
      </DashboardShell>
    );
  }

  if (!company) return null;

  return (
    <DashboardShell>
      <PageHeader
        title={company.name}
        description={company.industry || 'Company details'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Info */}
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
              </dl>
            </CardContent>
          </Card>

          {/* Director Info */}
          {(company.director_full_name || company.director_dob || company.property_status) && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Director Information</h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {company.director_full_name && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Director Name</dt>
                      <dd className="text-sm font-medium text-gray-900">{company.director_full_name}</dd>
                    </div>
                  )}
                  {company.director_dob && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Date of Birth</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {new Date(company.director_dob).toLocaleDateString('en-GB')}
                      </dd>
                    </div>
                  )}
                  {company.director_address && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500 uppercase">Address</dt>
                      <dd className="text-sm font-medium text-gray-900">{company.director_address}</dd>
                    </div>
                  )}
                  {company.property_status && (
                    <div>
                      <dt className="text-xs text-gray-500 uppercase">Property Status</dt>
                      <dd className="text-sm font-medium text-gray-900 capitalize">{company.property_status.replace(/_/g, ' ')}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
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
                <span className="text-sm text-gray-600">Client Email</span>
                <span className="text-sm font-medium text-gray-900">{company.owner?.[0]?.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Applications</span>
                <span className="text-sm font-medium text-gray-900">{applications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(company.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </CardContent>
          </Card>

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
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500">No applications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/partner/applications/${app.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          £{app.requested_amount.toLocaleString()}
                        </span>
                        <Badge variant={getStageBadgeVariant(app.stage)}>
                          {formatStage(app.stage)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{app.loan_type}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(app.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}