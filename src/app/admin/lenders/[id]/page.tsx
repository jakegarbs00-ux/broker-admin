'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button, getStageBadgeVariant, formatStage } from '@/components/ui';

type Lender = {
  id: string;
  name: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  submission_method: 'api' | 'email' | null;
  api_endpoint: string | null;
  api_auth_type: string | null;
  submission_email: string | null;
  created_at: string;
};

type LenderSubmission = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  application_id: string;
  application: {
    id: string;
    requested_amount: number;
    loan_type: string;
    stage: string;
    created_at: string;
    company: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export default function AdminLenderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [lender, setLender] = useState<Lender | null>(null);
  const [submissions, setSubmissions] = useState<LenderSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    submission_method: 'email' as 'api' | 'email' | null,
    api_endpoint: '',
    api_auth_type: '',
    submission_email: '',
  });

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Load lender
      const { data: lenderData, error: lenderError } = await supabase
        .from('lenders')
        .select('*')
        .eq('id', id)
        .single();

      if (lenderError) {
        setError('Lender not found');
        setLoadingData(false);
        return;
      }

      setLender(lenderData as Lender);
      setFormData({
        name: lenderData.name || '',
        contact_email: lenderData.contact_email || '',
        contact_phone: lenderData.contact_phone || '',
        notes: lenderData.notes || '',
        submission_method: lenderData.submission_method || 'email',
        api_endpoint: lenderData.api_endpoint || '',
        api_auth_type: lenderData.api_auth_type || '',
        submission_email: lenderData.submission_email || '',
      });

      // Load lender submissions
      const { data: submissionsData } = await supabase
        .from('lender_submissions')
        .select('*')
        .eq('lender_id', id)
        .order('created_at', { ascending: false });

      // Get unique application IDs
      const applicationIds = Array.from(new Set(submissionsData?.map(s => s.application_id).filter(Boolean) || []));

      // Fetch applications with their companies
      let applicationsMap: Record<string, any> = {};
      if (applicationIds.length > 0) {
        const { data: applicationsData } = await supabase
          .from('applications')
          .select(`
            id,
            requested_amount,
            loan_type,
            stage,
            created_at,
            company:company_id(id, name)
          `)
          .in('id', applicationIds);
        
        applicationsData?.forEach(app => {
          // Transform company from array to single object
          const company = Array.isArray(app.company) ? (app.company[0] || null) : app.company;
          applicationsMap[app.id] = {
            ...app,
            company: company,
          };
        });
      }

      // Combine the data
      const enrichedSubmissions = submissionsData?.map(sub => ({
        ...sub,
        application: applicationsMap[sub.application_id] || null
      })) || [];

      setSubmissions(enrichedSubmissions as LenderSubmission[]);
      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('lenders')
      .update({
        name: formData.name.trim(),
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        notes: formData.notes.trim() || null,
        submission_method: formData.submission_method || null,
        api_endpoint: formData.api_endpoint.trim() || null,
        api_auth_type: formData.api_auth_type.trim() || null,
        submission_email: formData.submission_email.trim() || null,
      })
      .eq('id', id);

    if (error) {
      alert('Error saving: ' + error.message);
    } else {
      setLender((prev) => prev ? {
        ...prev,
        name: formData.name.trim(),
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        notes: formData.notes.trim() || null,
        submission_method: formData.submission_method || null,
        api_endpoint: formData.api_endpoint.trim() || null,
        api_auth_type: formData.api_auth_type.trim() || null,
        submission_email: formData.submission_email.trim() || null,
      } : null);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lender? Applications will be unassigned.')) return;

    // Unassign applications first
    await supabase
      .from('applications')
      .update({ accepted_lender_id: null })
      .eq('accepted_lender_id', id);

    const { error } = await supabase
      .from('lenders')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting: ' + error.message);
    } else {
      router.push('/admin/lenders');
    }
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-secondary)]">Loading lender...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN' || error) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{error || 'You do not have permission to view this page.'}</p>
        </div>
      </DashboardShell>
    );
  }

  if (!lender) return null;

  // Group submissions by stage
  const stageGroups: Record<string, LenderSubmission[]> = {};
  submissions.forEach((sub) => {
    const stage = sub.application?.stage || 'created';
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(sub);
  });

  return (
    <DashboardShell>
      <PageHeader
        title={lender.name}
        description={`${submissions.length} submitted applications`}
        actions={
          <div className="flex gap-2">
            {!editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="secondary" onClick={handleDelete} className="text-[var(--color-error)] hover:bg-[var(--color-error-light)]">
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lender Info */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Lender Information</h2>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_email: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_phone: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>

                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-tertiary)] uppercase font-medium mb-3">Workflow Integration</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Submission Method
                        </label>
                        <select
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          value={formData.submission_method || 'email'}
                          onChange={(e) => setFormData((p) => ({ ...p, submission_method: e.target.value as 'api' | 'email' }))}
                        >
                          <option value="email">Email</option>
                          <option value="api">API</option>
                        </select>
                      </div>

                      {formData.submission_method === 'email' || !formData.submission_method ? (
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Submission Email
                          </label>
                          <input
                            type="email"
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                            placeholder="submissions@lender.com"
                            value={formData.submission_email || ''}
                            onChange={(e) => setFormData((p) => ({ ...p, submission_email: e.target.value }))}
                          />
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Where n8n will email applications</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                              API Endpoint
                            </label>
                            <input
                              type="url"
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                              placeholder="https://api.lender.com/applications"
                              value={formData.api_endpoint || ''}
                              onChange={(e) => setFormData((p) => ({ ...p, api_endpoint: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                              API Auth Type
                            </label>
                            <select
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                              value={formData.api_auth_type || ''}
                              onChange={(e) => setFormData((p) => ({ ...p, api_auth_type: e.target.value }))}
                            >
                              <option value="">Select...</option>
                              <option value="api_key">API Key</option>
                              <option value="oauth2">OAuth 2.0</option>
                              <option value="basic">Basic Auth</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-[var(--color-text-secondary)] uppercase">Name</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{lender.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-secondary)] uppercase">Contact Email</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{lender.contact_email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-secondary)] uppercase">Contact Phone</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">{lender.contact_phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-text-secondary)] uppercase">Added</dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {new Date(lender.created_at).toLocaleDateString('en-GB')}
                    </dd>
                  </div>
                  {lender.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-[var(--color-text-secondary)] uppercase">Notes</dt>
                      <dd className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{lender.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Applications List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Submitted Applications</h2>
                <Badge variant="default">{submissions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">No applications submitted to this lender yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="py-3 flex items-center justify-between px-4">
                      <div>
                        <Link href={`/admin/applications/${submission.application?.id}`} className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]">
                          {submission.application?.company?.name || 'No company'}
                        </Link>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          £{submission.application?.requested_amount?.toLocaleString() || 0} – {submission.application?.loan_type || 'Unknown'}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {submission.application?.created_at 
                            ? new Date(submission.application.created_at).toLocaleDateString('en-GB')
                            : 'No date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStageBadgeVariant(submission.application?.stage || 'created')}>
                          {formatStage(submission.application?.stage || 'created')}
                        </Badge>
                        <Badge variant={submission.status === 'sent' ? 'success' : 'default'}>
                          {submission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Stats by stage */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">By Stage</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stageGroups).map(([stage, subs]) => (
                <div key={stage} className="flex items-center justify-between py-1">
                  <Badge variant={getStageBadgeVariant(stage)}>
                    {formatStage(stage)}
                  </Badge>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{subs.length}</span>
                </div>
              ))}
              {submissions.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-2">No applications</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}