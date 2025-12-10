'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, getStageBadgeVariant, formatStage, Button } from '@/components/ui';

type AdminAppDetail = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  company: { name: string }[] | null;
  owner: { email: string | null }[] | null;
};

type InfoRequest = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  client_response_text: string | null;
  client_responded_at: string | null;
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', variant: 'warning' as const },
  { value: 'client_responded', label: 'Client Responded', variant: 'info' as const },
  { value: 'resolved', label: 'Resolved', variant: 'success' as const },
];

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [app, setApp] = useState<AdminAppDetail | null>(null);
  const [requests, setRequests] = useState<InfoRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setError(null);

      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select(
          `
          id,
          requested_amount,
          stage,
          loan_type,
          urgency,
          created_at,
          is_hidden,
          company:companies(name),
          owner:profiles!applications_owner_id_fkey (email)
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (appError) {
        console.error('Error loading application', appError);
        setError('Error loading application: ' + appError.message);
        setLoadingData(false);
        return;
      }

      setApp(appData as AdminAppDetail);

      const { data: reqs, error: reqError } = await supabase
        .from('information_requests')
        .select(
          `
          id,
          title,
          description,
          status,
          created_at,
          client_response_text,
          client_responded_at
        `
        )
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      if (reqError) {
        console.error('Error loading information requests', reqError);
        setError('Error loading information requests: ' + reqError.message);
      } else if (reqs) {
        setRequests(reqs as InfoRequest[]);
      }

      setLoadingData(false);
    };

    if (!loading && profile?.role === 'ADMIN') {
      load();
    }
  }, [id, loading, profile?.role, supabase]);

  const handleCreate = async () => {
    if (!user || !id || !newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('information_requests')
      .insert({
        application_id: id,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: 'open',
        created_by: user.id,
      })
      .select(
        `
        id,
        title,
        description,
        status,
        created_at,
        client_response_text,
        client_responded_at
      `
      )
      .single();

    if (error) {
      alert('Error creating information request: ' + error.message);
    } else if (data) {
      setRequests((prev) => [data as InfoRequest, ...prev]);
      setNewTitle('');
      setNewDescription('');
    }
    setCreating(false);
  };

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    const { error } = await supabase
      .from('information_requests')
      .update({ status: newStatus })
      .eq('id', requestId);

    if (error) {
      alert('Error updating status: ' + error.message);
      return;
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((s) => s.value === status);
    return <Badge variant={option?.variant ?? 'default'}>{option?.label ?? status}</Badge>;
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
            <p className="text-sm text-gray-500">Loading application...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user || !app) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Application not found.</p>
          <Link href="/admin/applications" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const openRequests = requests.filter((r) => r.status === 'open');
  const respondedRequests = requests.filter((r) => r.status === 'client_responded');

  return (
    <DashboardShell>
      <PageHeader
        title="Information Requests"
        description={`Managing requests for application #${app.id.slice(0, 8)}`}
        actions={
          <Link href="/admin/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create new information request */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">New Information Request</h2>
              <p className="text-sm text-gray-500">Request additional documents or information from the client.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank statements, ID documentation, Proof of address"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide details about what you need from the client..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={creating || !newTitle.trim()}
                  loading={creating}
                  onClick={handleCreate}
                >
                  {creating ? 'Creating...' : 'Create Request'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Information Requests ({requests.length})</h2>
                {respondedRequests.length > 0 && (
                  <Badge variant="info">{respondedRequests.length} need review</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No information requests for this application yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-4 space-y-3 ${
                        r.status === 'client_responded'
                          ? 'border-blue-200 bg-blue-50'
                          : r.status === 'resolved'
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{r.title}</p>
                          {r.description && (
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                              {r.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Created {new Date(r.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(r.status)}
                          <select
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={r.status}
                            onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {r.client_response_text && (
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Client Response</p>
                          <p className="text-sm text-gray-800 whitespace-pre-line">
                            {r.client_response_text}
                          </p>
                          {r.client_responded_at && (
                            <p className="text-xs text-gray-500 mt-2">
                              Responded {new Date(r.client_responded_at).toLocaleDateString('en-GB')} at{' '}
                              {new Date(r.client_responded_at).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Application summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application Summary</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Company</p>
                <p className="text-gray-900">{app.company?.[0]?.name ?? 'No company'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Client</p>
                <p className="text-gray-900">{app.owner?.[0]?.email ?? 'Unknown client'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Amount</p>
                <p className="text-lg font-semibold text-gray-900">£{app.requested_amount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Loan Type</p>
                <p className="text-gray-900">{app.loan_type}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Stage</p>
                <Badge variant={getStageBadgeVariant(app.stage)}>{formatStage(app.stage)}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
                <p className="text-sm text-gray-600">
                  {new Date(app.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>

              {app.is_hidden && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    This application is currently hidden from the client.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Request Status</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Open</span>
                <Badge variant="warning">{openRequests.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Awaiting Review</span>
                <Badge variant="info">{respondedRequests.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Resolved</span>
                <Badge variant="success">
                  {requests.filter((r) => r.status === 'resolved').length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}