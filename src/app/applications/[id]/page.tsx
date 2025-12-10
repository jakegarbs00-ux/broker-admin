'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type AppDetail = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  purpose: string | null;
  created_at: string;
  company?: {
    name: string;
  } | null;
};

type Document = {
  id: string;
  category: string;
  url: string;
  created_at: string;
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

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();

  const [app, setApp] = useState<AppDetail | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

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
          purpose,
          created_at,
          company:companies(name)
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

      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, category, url, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error loading documents', docsError);
      } else if (docsData) {
        setDocs(docsData as any);
      }

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
      } else if (reqs) {
        setInfoRequests(reqs as any);
      }

      setLoadingData(false);
    };

    load();
  }, [id, supabase]);

  const handleUpload = async () => {
    if (!user || !id || !uploadFile) return;
    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const path = `${user.id}/${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, uploadFile);

      if (uploadError) {
        alert('Error uploading file: ' + uploadError.message);
        setUploading(false);
        return;
      }

      const publicUrl = supabase.storage
        .from('documents')
        .getPublicUrl(path).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          application_id: id,
          category: uploadCategory,
          url: publicUrl,
          uploaded_by: user.id,
        })
        .select('id, category, url, created_at')
        .single();

      if (insertError) {
        alert('Error saving document record: ' + insertError.message);
      } else if (data) {
        setDocs((prev) => [data as any, ...prev]);
        setUploadFile(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRespond = async (requestId: string) => {
    if (!responses[requestId]?.trim()) return;
    setRespondingId(requestId);

    const text = responses[requestId].trim();

    const { error } = await supabase
      .from('information_requests')
      .update({
        client_response_text: text,
        client_responded_at: new Date().toISOString(),
        status: 'client_responded',
      })
      .eq('id', requestId);

    if (error) {
      alert('Error submitting response: ' + error.message);
      setRespondingId(null);
      return;
    }

    setInfoRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              client_response_text: text,
              client_responded_at: new Date().toISOString(),
              status: 'client_responded',
            }
          : r,
      ),
    );
    setRespondingId(null);
  };

  if (loading || loadingData) {
    return <p className="p-4">Loading…</p>;
  }

  if (!user || !app) {
    return (
      <main className="max-w-3xl mx-auto p-4">
        <p className="text-sm text-red-600">Application not found.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto space-y-6 p-4">
      <section className="rounded-md border bg-white px-4 py-3 space-y-1">
        <p className="text-sm text-gray-500">
          {app.company?.name ?? 'No company'}
        </p>
        <p className="text-lg font-semibold">
          £{app.requested_amount.toLocaleString()} – {app.loan_type}
        </p>
        <p className="text-xs text-gray-500">
          Stage: {app.stage} • Created{' '}
          {new Date(app.created_at).toLocaleString()}
        </p>
        {app.purpose && (
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
            Purpose: {app.purpose}
          </p>
        )}
      </section>

      {/* Documents */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-3">
        <p className="font-medium text-sm">Documents</p>

        <div className="space-y-2 text-sm">
          {docs.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs mr-2">
                      {d.category}
                    </span>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View document
                    </a>
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-600">Upload additional documents</p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <select
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
            >
              <option value="bank_statements">6 months bank statements</option>
              <option value="management_accounts">Management accounts</option>
              <option value="cashflow_forecast">Cashflow forecasts</option>
              <option value="other">Other</option>
            </select>
            <input
              type="file"
              className="text-xs"
              onChange={(e) =>
                setUploadFile(e.target.files?.[0] ?? null)
              }
            />
            <button
              type="button"
              disabled={!uploadFile || uploading}
              onClick={handleUpload}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </section>

      {/* Information requests */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-3">
        <p className="font-medium text-sm">Information requests</p>

        {infoRequests.length === 0 ? (
          <p className="text-sm text-gray-600">
            There are currently no information requests for this application.
          </p>
        ) : (
          infoRequests.map((r) => {
            const canRespond =
              r.status !== 'resolved' && !r.client_response_text;

            return (
              <div
                key={r.id}
                className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 space-y-2"
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
                      Created{' '}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
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
                </div>

                {r.client_response_text && (
                  <div className="rounded-md bg-white px-3 py-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      Your response
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {r.client_response_text}
                    </p>
                    {r.client_responded_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted{' '}
                        {new Date(r.client_responded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {canRespond && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">
                      You can respond to this request below. You can also
                      upload supporting documents above.
                    </p>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      value={responses[r.id] ?? ''}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          [r.id]: e.target.value,
                        }))
                      }
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={
                          !responses[r.id]?.trim() ||
                          respondingId === r.id
                        }
                        onClick={() => handleRespond(r.id)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {respondingId === r.id
                          ? 'Submitting…'
                          : 'Submit response'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
