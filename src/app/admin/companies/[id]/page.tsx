'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button } from '@/components/ui';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  created_at: string;
  referred_by: string | null;
  primary_director: { 
    id: string; 
    email: string; 
    full_name: string | null; 
    address: string | null; 
    dob: string | null; 
    property_status: string | null;
  }[] | null;
  partner: { 
    id: string; 
    email: string; 
    full_name: string | null; 
    company_name: string | null;
  }[] | null;
};

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
};

type Document = {
  id: string;
  category: string;
  original_filename: string | null;
  storage_path: string;
  created_at: string;
  application_id: string;
};

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setError(null);

      // Load company with primary director and partner info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          industry,
          website,
          created_at,
          referred_by,
          primary_director:profiles!profiles_company_id_fkey(id, email, full_name, address, dob, property_status, is_primary_director),
          partner:profiles!companies_referred_by_fkey(id, email, full_name, company_name)
        `)
        .eq('id', id)
        .eq('primary_director.is_primary_director', true)
        .maybeSingle();

      if (companyError) {
        console.error('Error loading company', companyError);
        setError('Error loading company: ' + companyError.message);
        setLoadingData(false);
        return;
      }

      setCompany(companyData as Company);

      // Load applications for this company
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      // Load all directors for this company
      const { data: directorsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', id)
        .eq('role', 'CLIENT')
        .order('is_primary_director', { ascending: false })
        .order('full_name', { ascending: true });

      if (appsError) {
        console.error('Error loading applications', appsError);
      } else {
        setApplications((appsData || []) as Application[]);
      }

      if (directorsData) {
        setDirectors(directorsData);

        // Load documents for all applications
        if (appsData && appsData.length > 0) {
          const appIds = appsData.map((a: any) => a.id);
          const { data: docsData, error: docsError } = await supabase
            .from('documents')
            .select('id, category, original_filename, storage_path, created_at, application_id')
            .in('application_id', appIds)
            .order('created_at', { ascending: false });

          if (docsError) {
            console.error('Error loading documents', docsError);
          } else {
            setDocuments(docsData as Document[]);
          }
        }
      }

      setLoadingData(false);
    };

    if (!loading && profile?.role === 'ADMIN') {
      load();
    }
  }, [id, loading, profile?.role, supabase]);

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
    return data.publicUrl;
  };

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
            <p className="text-sm text-gray-500">Loading company...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!company) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Company not found.</p>
          <Link href="/admin/applications" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title={company.name}
        description={`Director: ${company.primary_director?.[0]?.email ?? 'Unknown'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/admin/applications/create?company_id=${id}`}>
              <Button variant="primary">Create Application</Button>
            </Link>
            <Link href={`/admin/companies/${id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
            <Link href="/admin/companies">
              <Button variant="outline">← Back</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company Information</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Company Name</p>
                  <p className="text-gray-900">{company.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Company Number</p>
                  <p className="text-gray-900">{company.company_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Industry</p>
                  <p className="text-gray-900">{company.industry ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Website</p>
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {company.website}
                    </a>
                  ) : (
                    <p className="text-gray-500">—</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Director Information */}
          {company.primary_director?.[0] && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Director Information</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                    <p className="text-gray-900">{company.primary_director[0].email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Full Name</p>
                    <p className="text-gray-900">{company.primary_director[0].full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Date of Birth</p>
                    <p className="text-gray-900">
                      {company.primary_director[0].dob 
                        ? new Date(company.primary_director[0].dob).toLocaleDateString('en-GB') 
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Property Status</p>
                    <p className="text-gray-900 capitalize">{company.primary_director[0].property_status ?? '—'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                    <p className="text-gray-900 whitespace-pre-line">{company.primary_director[0].address ?? '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Directors */}
          {directors.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900">Directors</h2>
                  <Link href={`/admin/companies/${id}/directors/add`}>
                    <Button variant="primary" size="sm">Add Director</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {directors.map((director) => (
                    <div key={director.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium text-gray-900">
                              {director.full_name || 'Unnamed Director'}
                            </p>
                            {director.is_primary_director && (
                              <Badge variant="info">Primary</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{director.email}</p>
                          {director.phone && (
                            <p className="text-sm text-gray-600">{director.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Referred By Partner */}
          {company.partner?.[0] && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Referred By</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-gray-900">
                      {company.partner[0].full_name || company.partner[0].company_name || 'Partner'}
                    </span>
                    {company.partner[0].email && (
                      <>
                        {' '}
                        <span className="text-gray-500">({company.partner[0].email})</span>
                      </>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Uploaded Documents</h2>
                <Badge variant="default">{documents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="info" size="sm">{doc.category}</Badge>
                        </div>
                        <a
                          href={getDocumentUrl(doc.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 truncate block mt-1"
                        >
                          {doc.original_filename ?? 'View document'}
                        </a>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded {new Date(doc.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applications summary */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Applications</h2>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">No applications yet.</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/admin/applications/${app.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <p className="font-medium text-gray-900">
                        £{app.requested_amount?.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">{app.loan_type}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="default" size="sm">{app.stage}</Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(app.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meta info */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Client Email</p>
                <p className="text-sm text-gray-900">{company.primary_director?.[0]?.email ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
                <p className="text-sm text-gray-900">
                  {new Date(company.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Total Documents</p>
                <p className="text-sm text-gray-900">{documents.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}