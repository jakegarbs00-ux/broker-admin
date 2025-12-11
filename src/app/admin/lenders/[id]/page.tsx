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
  created_at: string;
};

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
  company: { id: string; name: string }[] | null;
};

export default function AdminLenderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [lender, setLender] = useState<Lender | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
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
      });

      // Load applications assigned to this lender
      const { data: appsData } = await supabase
        .from('applications')
        .select(`
          id, requested_amount, loan_type, stage, created_at,
          company:companies(id, name)
        `)
        .eq('lender_id', id)
        .order('created_at', { ascending: false });

      setApplications((appsData || []) as Application[]);
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
      .update({ lender_id: null })
      .eq('lender_id', id);

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
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading lender...</p>
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

  if (!lender) return null;

  // Group applications by stage
  const stageGroups: Record<string, Application[]> = {};
  applications.forEach((app) => {
    if (!stageGroups[app.stage]) stageGroups[app.stage] = [];
    stageGroups[app.stage].push(app);
  });

  return (
    <DashboardShell>
      <PageHeader
        title={lender.name}
        description={`${applications.length} applications assigned`}
        actions={
          <div className="flex gap-2">
            {!editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="secondary" onClick={handleDelete} className="text-red-600 hover:bg-red-50">
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
              <h2 className="font-medium text-gray-900">Lender Information</h2>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_phone: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
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
                    <dt className="text-xs text-gray-500 uppercase">Name</dt>
                    <dd className="text-sm font-medium text-gray-900">{lender.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Contact Email</dt>
                    <dd className="text-sm font-medium text-gray-900">{lender.contact_email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Contact Phone</dt>
                    <dd className="text-sm font-medium text-gray-900">{lender.contact_phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Added</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {new Date(lender.created_at).toLocaleDateString('en-GB')}
                    </dd>
                  </div>
                  {lender.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500 uppercase">Notes</dt>
                      <dd className="text-sm text-gray-900 whitespace-pre-line">{lender.notes}</dd>
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
                <h2 className="font-medium text-gray-900">Assigned Applications</h2>
                <Badge variant="default">{applications.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No applications assigned to this lender yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/admin/applications/${app.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          £{app.requested_amount.toLocaleString()} – {app.loan_type}
                        </span>
                        <Badge variant={getStageBadgeVariant(app.stage)}>
                          {formatStage(app.stage)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{app.company?.[0]?.name || 'No company'}</p>
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

        {/* Sidebar - Stats by stage */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">By Stage</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stageGroups).map(([stage, apps]) => (
                <div key={stage} className="flex items-center justify-between py-1">
                  <Badge variant={getStageBadgeVariant(stage)}>
                    {formatStage(stage)}
                  </Badge>
                  <span className="text-sm font-medium text-gray-900">{apps.length}</span>
                </div>
              ))}
              {applications.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No applications</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}