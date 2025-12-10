'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type AdminAppDetail = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  company?: {
    name: string;
  } | null;
  owner?: {
    email: string | null;
  } | null;
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

const STATUS_OPTIONS = ['open', 'client_responded', 'resolved'];

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

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Admin – application</h1>
        <p className="text-sm text-red-600">
          You do not have permission to view this page.
        </p>
      </main>
    );
  }

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

      setApp(appData as any);

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
        setRequests(reqs as any);
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
      setRequests((prev) => [data as any, ...prev]);
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
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r)),
    );
  };

  if (loading || loadingData) {
    return <p className="p-4">Loading…</p>;
  }

  if (!user || !app) {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <p className="text-sm text-red-600">Application not found.</p>
        <button
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => router.push('/admin/applications')}
        >
          Back to applications
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-red-600">Admin</p>
          <h1 className="text-2xl font-semibold">Application information requests</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/applications"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Back to applications
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Application summary */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-1">
        <p className="text-sm text-gray-500">
          {app.company?.name ?? 'No company'} •{' '}
          {app.owner?.email ?? 'Unknown client'}
        </p>
        <p className="text-lg font-semibold">
          £{app.requested_amount.toLocaleString()} – {app.loan_type}
        </p>
        <p className="text-xs text-gray-500">
          Stage: {app.stage} • Created{' '}
          {new Date(app.created_at).toLocaleString()}
        </p>
        {app.is_hidden && (
          <p className="text-xs text-yellow-700">
            This application is currently hidden from the client.
          </p>
        )}
      </section>

      {/* Create new information request */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-3">
        <p className="font-medium text-sm">New information request</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Short title (e.g. Bank statements, ID documentation)"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            rows={3}
            placeholder="Describe what you need from the client…"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={creating || !newTitle.trim()}
              onClick={handleCreate}
              className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create request'}
            </button>
          </div>
        </div>
      </section>

      {/* Existing requests */}
      <section className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-gray-600">
            No information requests for this application yet.
          </p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              className="rounded-md border bg-white px-4 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.description && (
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {r.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Created {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'resolved'
                        ? 'bg-green-100 text-green-800'
                        : r.status === 'client_responded'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {r.status}
                  </span>
                  <select
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    value={r.status}
                    onChange={(e) =>
                      handleStatusChange(r.id, e.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {r.client_response_text && (
                <div className="mt-2 rounded-md bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Client response
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    {r.client_response_text}
                  </p>
                  {r.client_responded_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Responded{' '}
                      {new Date(r.client_responded_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
