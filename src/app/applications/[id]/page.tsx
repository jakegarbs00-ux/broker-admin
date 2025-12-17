'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, getStageBadgeVariant, formatStage, Button } from '@/components/ui';

type AppDetail = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  purpose: string | null;
  created_at: string;
  company: { name: string }[] | null;
};

type Document = {
  id: string;
  category: string;
  original_filename: string | null;
  storage_path: string;
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

const DOCUMENT_CATEGORIES = [
  { value: 'bank_statements', label: '6 months bank statements' },
  { value: 'management_accounts', label: 'Management accounts' },
  { value: 'cashflow_forecast', label: 'Cashflow forecasts' },
  { value: 'other', label: 'Other' },
];

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading } = useUserProfile();
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
    if (!id || !user) return;

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
      setApp(appData as AppDetail);

      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, category, original_filename, storage_path, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error loading documents', docsError);
      } else if (docsData) {
        setDocs(docsData as Document[]);
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
        setInfoRequests(reqs as InfoRequest[]);
      }

      setLoadingData(false);
    };

    load();
  }, [id, user, supabase]);

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

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          application_id: id,
          category: uploadCategory,
          original_filename: uploadFile.name,
          storage_path: path,
          uploaded_by: user.id,
        })
        .select('id, category, original_filename, storage_path, created_at')
        .single();

      if (insertError) {
        alert('Error saving document record: ' + insertError.message);
      } else if (data) {
        setDocs((prev) => [data as Document, ...prev]);
        setUploadFile(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('application-documents').getPublicUrl(storagePath);
    return data.publicUrl;
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
          : r
      )
    );
    setResponses((prev) => ({ ...prev, [requestId]: '' }));
    setRespondingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'client_responded':
        return <Badge variant="info">Responded</Badge>;
      default:
        return <Badge variant="warning">Open</Badge>;
    }
  };

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
          <Link href="/applications" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const openRequests = infoRequests.filter(r => r.status === 'open');

  return (
    <DashboardShell>
      <PageHeader
        title={`£${app.requested_amount?.toLocaleString()} – ${app.loan_type}`}
        description={app.company?.[0]?.name ?? 'No company'}
        actions={
          <Link href="/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Open info requests alert */}
      {openRequests.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="text-yellow-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-yellow-800">Action Required</p>
                <p className="text-sm text-yellow-700">
                  You have {openRequests.length} open information request{openRequests.length > 1 ? 's' : ''} that need{openRequests.length === 1 ? 's' : ''} your response.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Amount</p>
                  <p className="text-lg font-semibold text-gray-900">£{app.requested_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Loan Type</p>
                  <p className="text-gray-900">{app.loan_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Urgency</p>
                  <p className="text-gray-900">{app.urgency ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Stage</p>
                  <Badge variant={getStageBadgeVariant(app.stage)}>{formatStage(app.stage)}</Badge>
                </div>
              </div>
              {app.purpose && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Purpose</p>
                  <p className="text-gray-700 whitespace-pre-line">{app.purpose}</p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Created {new Date(app.created_at).toLocaleDateString('en-GB')} at {new Date(app.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Information Requests */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Information Requests</h2>
            </CardHeader>
            <CardContent>
              {infoRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No information requests for this application.
                </p>
              ) : (
                <div className="space-y-4">
                  {infoRequests.map((r) => {
                    const canRespond = r.status === 'open' && !r.client_response_text;

                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
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
                              Requested {new Date(r.created_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          {getStatusBadge(r.status)}
                        </div>

                        {r.client_response_text && (
                          <div className="rounded-lg bg-white border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">Your Response</p>
                            <p className="text-sm text-gray-800 whitespace-pre-line">
                              {r.client_response_text}
                            </p>
                            {r.client_responded_at && (
                              <p className="text-xs text-gray-500 mt-2">
                                Submitted {new Date(r.client_responded_at).toLocaleDateString('en-GB')}
                              </p>
                            )}
                          </div>
                        )}

                        {canRespond && (
                          <div className="space-y-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-600">
                              Respond to this request below. You can also upload supporting documents.
                            </p>
                            <textarea
                              rows={3}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Type your response here..."
                              value={responses[r.id] ?? ''}
                              onChange={(e) =>
                                setResponses((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={!responses[r.id]?.trim() || respondingId === r.id}
                                onClick={() => handleRespond(r.id)}
                              >
                                {respondingId === r.id ? 'Submitting…' : 'Submit Response'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Documents */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Documents</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {docs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  No documents uploaded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="default" size="sm">{d.category}</Badge>
                        <a
                          href={getDocumentUrl(d.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-blue-600 hover:text-blue-700 truncate mt-1"
                        >
                          {d.original_filename ?? 'View document'}
                        </a>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(d.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Upload form */}
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Upload Document</p>
                <div className="space-y-2">
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={!uploadFile || uploading}
                    onClick={handleUpload}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}