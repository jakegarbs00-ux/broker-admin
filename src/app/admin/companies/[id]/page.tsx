'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  owner: { email: string }[] | null;
  referrer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    partner_company?: {
      id: string;
      name: string;
    } | null;
  } | null;
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
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [director, setDirector] = useState<any | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [directorData, setDirectorData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setError(null);

      // Load company with referrer
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          referrer:referred_by(
            id,
            first_name,
            last_name,
            email,
            partner_company:partner_company_id(id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (companyError) {
        console.error('Error loading company', companyError);
        setError('Error loading company: ' + companyError.message);
        setLoadingData(false);
        return;
      }

      if (!companyData) {
        setError('Company not found');
        setLoadingData(false);
        return;
      }

      // Get director/client profile for this company
      const { data: directorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', id)
        .eq('is_primary_director', true)
        .single();

      // If no primary director, get any profile linked to company
      let directorProfile = directorData;
      if (!directorProfile) {
        const { data: anyProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('company_id', id)
          .limit(1)
          .maybeSingle();
        directorProfile = anyProfile;
      }

      setDirector(directorProfile);

      // Get primary director for owner display
      const primaryDirector = directorProfile;

      const enrichedCompany = {
        ...companyData,
        owner: primaryDirector ? [{ id: primaryDirector.id, email: primaryDirector.email || '' }] : null,
      };

      setCompany(enrichedCompany as Company);

      // Load applications for this company
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error loading applications', appsError);
      } else {
        setApplications(appsData as Application[]);

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

  // Sync editable data when company/director loads
  useEffect(() => {
    if (company) {
      setCompanyData({ ...company });
    }
    if (director) {
      setDirectorData({ ...director });
    }
  }, [company, director]);

  const handleCompanyChange = (field: string, value: string) => {
    if (!companyData) return;
    setCompanyData({ ...companyData, [field]: value || null });
  };

  const handleDirectorChange = (field: string, value: string) => {
    if (!directorData) return;
    setDirectorData({ ...directorData, [field]: value || null });
  };

  const handleCancel = () => {
    if (company) setCompanyData({ ...company });
    if (director) setDirectorData({ ...director });
    setIsEditing(false);
    setMessage('');
  };

  const handleDeleteCompany = async () => {
    if (!company) return;
    setDeleting(true);

    try {
      // Get all applications for this company
      const { data: apps } = await supabase
        .from('applications')
        .select('id')
        .eq('company_id', company.id);

      if (apps && apps.length > 0) {
        const appIds = apps.map(a => a.id);
        
        // Get all documents for these applications
        const { data: docs } = await supabase
          .from('documents')
          .select('storage_path')
          .in('application_id', appIds);
        
        // Delete documents from storage
        if (docs && docs.length > 0) {
          const paths = docs.map(d => d.storage_path);
          await supabase.storage.from('application-documents').remove(paths);
        }

        // Delete related records for all applications
        await supabase.from('documents').delete().in('application_id', appIds);
        await supabase.from('information_requests').delete().in('application_id', appIds);
        await supabase.from('lender_submissions').delete().in('application_id', appIds);
        await supabase.from('offers').delete().in('application_id', appIds);
        
        // Delete applications
        await supabase.from('applications').delete().eq('company_id', company.id);
      }

      // Unlink profiles from this company (don't delete the profiles)
      await supabase
        .from('profiles')
        .update({ company_id: null, is_primary_director: false })
        .eq('company_id', company.id);

      // Delete the company
      const { error } = await supabase.from('companies').delete().eq('id', company.id);

      if (error) {
        alert('Error deleting company: ' + error.message);
        setDeleting(false);
        return;
      }

      router.push('/admin/companies');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting company');
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!companyData || !id) return;
    
    setSaving(true);
    setMessage('');

    // Update company
    const { error: companyError } = await supabase
      .from('companies')
      .update({
        name: companyData.name,
        company_number: companyData.company_number || null,
        industry: companyData.industry || null,
        website: companyData.website || null,
      })
      .eq('id', id);

    if (companyError) {
      setMessage('Error saving company: ' + companyError.message);
      setSaving(false);
      return;
    }

    // Update director profile
    if (directorData?.id) {
      const { error: directorError } = await supabase
        .from('profiles')
        .update({
          first_name: directorData.first_name || null,
          last_name: directorData.last_name || null,
          phone: directorData.phone || null,
          date_of_birth: directorData.date_of_birth || null,
          address_line_1: directorData.address_line_1 || null,
          address_line_2: directorData.address_line_2 || null,
          city: directorData.city || null,
          postcode: directorData.postcode || null,
          country: directorData.country || null,
        })
        .eq('id', directorData.id);

      if (directorError) {
        setMessage('Error saving director: ' + directorError.message);
        setSaving(false);
        return;
      }
    }

    setMessage('Saved successfully!');
    setIsEditing(false);
    
    // Reload data to reflect changes
    const load = async () => {
      const { data: companyData } = await supabase
        .from('companies')
        .select(`
          *,
          referrer:referred_by(
            id,
            first_name,
            last_name,
            email,
            partner_company:partner_company_id(id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (companyData) {
        const enrichedCompany = {
          ...companyData,
          owner: company?.owner || null,
        };
        setCompany(enrichedCompany as Company);
        setCompanyData(enrichedCompany);
      }

      if (directorData?.id) {
        const { data: directorDataNew } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', directorData.id)
          .single();
        
        if (directorDataNew) {
          setDirector(directorDataNew);
          setDirectorData(directorDataNew);
        }
      }
    };
    
    load();
    setSaving(false);
  };

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('application-documents').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

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

  if (!company) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Company not found.</p>
          <Link href="/admin/applications" className="text-[var(--color-accent)] hover:underline text-sm mt-2 inline-block">
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
        description={`Client: ${company.owner?.[0]?.email ?? 'Unknown'}`}
        actions={
          <div className="flex gap-2">
          <Link href="/admin/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Company
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.includes('Error') 
            ? 'bg-[var(--color-error-light)] border-[var(--color-error)] text-[var(--color-error)]' 
            : 'bg-[var(--color-success-light)] border-[var(--color-success)] text-[var(--color-success)]'
        }`}>
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <h2 className="font-medium text-[var(--color-text-primary)]">Company Information</h2>
                {!isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="text-sm"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Company Name</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyData?.name || ''}
                      onChange={(e) => handleCompanyChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    />
                  ) : (
                    <p className="text-[var(--color-text-primary)]">{companyData?.name || '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Company Number</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyData?.company_number || ''}
                      onChange={(e) => handleCompanyChange('company_number', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    />
                  ) : (
                    <p className="text-[var(--color-text-primary)]">{companyData?.company_number ?? '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Industry</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyData?.industry || ''}
                      onChange={(e) => handleCompanyChange('industry', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    />
                  ) : (
                    <p className="text-[var(--color-text-primary)]">{companyData?.industry ?? '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Website</p>
                  {isEditing ? (
                    <input
                      type="url"
                      value={companyData?.website || ''}
                      onChange={(e) => handleCompanyChange('website', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    />
                  ) : (
                    companyData?.website ? (
                      <a href={companyData.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                        {companyData.website}
                    </a>
                  ) : (
                    <p className="text-[var(--color-text-tertiary)]">—</p>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Director Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Director Information</h2>
            </CardHeader>
            <CardContent>
              {directorData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Full Name</p>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={directorData.first_name || ''}
                          onChange={(e) => handleDirectorChange('first_name', e.target.value)}
                          placeholder="First name"
                          className="flex-1 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={directorData.last_name || ''}
                          onChange={(e) => handleDirectorChange('last_name', e.target.value)}
                          placeholder="Last name"
                          className="flex-1 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                        />
                      </div>
                    ) : (
                      <p className="text-[var(--color-text-primary)]">
                        {directorData.first_name} {directorData.last_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Email</p>
                    <p className="text-[var(--color-text-primary)]">{directorData.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Phone</p>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={directorData.phone || ''}
                        onChange={(e) => handleDirectorChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                      />
                    ) : (
                      <p className="text-[var(--color-text-primary)]">{directorData.phone || '—'}</p>
                    )}
                </div>
                <div>
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Date of Birth</p>
                    {isEditing ? (
                      <input
                        type="date"
                        value={directorData.date_of_birth ? directorData.date_of_birth.split('T')[0] : ''}
                        onChange={(e) => handleDirectorChange('date_of_birth', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                      />
                    ) : (
                  <p className="text-[var(--color-text-primary)]">
                        {directorData.date_of_birth
                          ? new Date(directorData.date_of_birth).toLocaleDateString('en-GB')
                      : '—'}
                  </p>
                    )}
                </div>
                <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Address</p>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={directorData.address_line_1 || ''}
                          onChange={(e) => handleDirectorChange('address_line_1', e.target.value)}
                          placeholder="Address line 1"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={directorData.address_line_2 || ''}
                          onChange={(e) => handleDirectorChange('address_line_2', e.target.value)}
                          placeholder="Address line 2"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={directorData.city || ''}
                            onChange={(e) => handleDirectorChange('city', e.target.value)}
                            placeholder="City"
                            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          />
                          <input
                            type="text"
                            value={directorData.postcode || ''}
                            onChange={(e) => handleDirectorChange('postcode', e.target.value)}
                            placeholder="Postcode"
                            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          />
                        </div>
                        <input
                          type="text"
                          value={directorData.country || ''}
                          onChange={(e) => handleDirectorChange('country', e.target.value)}
                          placeholder="Country"
                          className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                        />
                      </div>
                    ) : (
                      <div className="text-[var(--color-text-primary)]">
                        {directorData.address_line_1 && <p>{directorData.address_line_1}</p>}
                        {directorData.address_line_2 && <p>{directorData.address_line_2}</p>}
                        {(directorData.city || directorData.postcode) && (
                          <p>{[directorData.city, directorData.postcode].filter(Boolean).join(' ')}</p>
                        )}
                        {directorData.country && <p>{directorData.country}</p>}
                        {!directorData.address_line_1 && !directorData.city && !directorData.postcode && !directorData.country && (
                          <p>—</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No director information available</p>
              )}
            </CardContent>
          </Card>

          {/* Save/Cancel buttons */}
          {isEditing && (
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                loading={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}

          {/* Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Uploaded Documents</h2>
                <Badge variant="default">{documents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="info" size="sm">{doc.category}</Badge>
                        </div>
                        <a
                          href={getDocumentUrl(doc.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] truncate block mt-1"
                        >
                          {doc.original_filename ?? 'View document'}
                        </a>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
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
              <h2 className="font-medium text-[var(--color-text-primary)]">Applications</h2>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-2">No applications yet.</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/admin/applications/${app.id}`}
                      className="block p-3 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <p className="font-medium text-[var(--color-text-primary)]">
                        £{app.requested_amount?.toLocaleString()}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{app.loan_type}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="default" size="sm">{app.stage}</Badge>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {new Date(app.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referral Partner */}
          {company?.referrer && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-[var(--color-text-primary)]">Referred By</h2>
              </CardHeader>
              <CardContent>
                {company.referrer.partner_company?.name && (
                  <p className="font-medium text-[var(--color-text-primary)] mb-2">
                    {company.referrer.partner_company.name}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-primary)]">
                  {company.referrer.first_name} {company.referrer.last_name}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">{company.referrer.email}</p>
              </CardContent>
            </Card>
          )}

          {/* Meta info */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Client Email</p>
                <p className="text-sm text-[var(--color-text-primary)]">{company.owner?.[0]?.email ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Created</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {new Date(company.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Total Documents</p>
                <p className="text-sm text-[var(--color-text-primary)]">{documents.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Delete Company?</h3>
            <p className="text-[var(--color-text-secondary)] mb-4">
              This will permanently delete this company along with all its applications, documents, and related data. User accounts will be preserved but unlinked from this company. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteCompany}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Company'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}