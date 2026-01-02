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
  company: { id: string; name: string } | null;
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
  message: string;
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
  const [offers, setOffers] = useState<any[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [submittingResponse, setSubmittingResponse] = useState(false);

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
          company:company_id(id, name)
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
      setApp(appData as unknown as AppDetail);

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
        .select('*')
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

  // Fetch offers when stage allows
  useEffect(() => {
    const fetchOffers = async () => {
      if (!id || !app) return;
      
      if (['approved', 'onboarding', 'funded', 'withdrawn', 'declined'].includes(app.stage)) {
        const { data } = await supabase
          .from('offers')
          .select('*, lender:lender_id(id, name)')
          .eq('application_id', id)
          .order('created_at', { ascending: false });
        
        setOffers(data || []);
        
        // Trigger celebration if there are pending offers
        if (data && data.some((o: any) => o.status === 'pending')) {
          setCelebrating(true);
          setTimeout(() => setCelebrating(false), 5000);
        }
      }
    };
    
    if (app) fetchOffers();
  }, [app, id, supabase]);

  const handleUpload = async () => {
    if (!user || !id || !uploadFile) return;
    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const path = `${user.id}/${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('application-documents')
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

  const handleAcceptOffer = async (offerId: string) => {
    if (!id) return;
    
    const { error } = await supabase
      .from('offers')
      .update({ 
        status: 'accepted', 
        accepted_at: new Date().toISOString() 
      })
      .eq('id', offerId);

    if (!error) {
      // Move application to onboarding
      await supabase
        .from('applications')
        .update({ stage: 'onboarding' })
        .eq('id', id);
      
      // Refresh data
      window.location.reload();
    } else {
      alert('Error accepting offer: ' + error.message);
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'declined' })
      .eq('id', offerId);

    if (!error) {
      setOffers(offers.map((o: any) => 
        o.id === offerId ? { ...o, status: 'declined' } : o
      ));
    } else {
      alert('Error declining offer: ' + error.message);
    }
  };

  const handleSubmitResponse = async (requestId: string) => {
    if (!responseText[requestId]?.trim()) return;
    setSubmittingResponse(true);

    const { error } = await supabase
      .from('information_requests')
      .update({
        status: 'completed',
        client_response_text: responseText[requestId].trim(),
        client_responded_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (!error) {
      // Optionally move application back to submitted
      await supabase
        .from('applications')
        .update({ stage: 'submitted' })
        .eq('id', id);
      
      // Refresh the page data
      window.location.reload();
    } else {
      alert('Error submitting response: ' + error.message);
    }
    
    setSubmittingResponse(false);
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
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading application...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user || !app) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Application not found.</p>
          <Link href="/applications" className="text-[var(--color-accent)] hover:underline text-sm mt-2 inline-block">
            ← Back to applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const openRequests = infoRequests.filter(r => r.status === 'open' || r.status === 'pending');

  return (
    <DashboardShell>
      <PageHeader
        title={`£${app.requested_amount?.toLocaleString()} – ${app.loan_type}`}
        description={app.company?.name ?? 'No company'}
        actions={
          <Link href="/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {/* Celebration Banner - show when there are new offers */}
      {offers.some((o: any) => o.status === 'pending') && (
        <div className="mb-6 relative overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-xl p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎉</div>
              <div>
                <h2 className="text-2xl font-bold">Great News!</h2>
                <p className="text-green-100">You have {offers.filter((o: any) => o.status === 'pending').length} funding offer{offers.filter((o: any) => o.status === 'pending').length > 1 ? 's' : ''} waiting for you!</p>
              </div>
              <div className="text-4xl ml-auto">🎊</div>
            </div>
          </div>
          
          {/* Animated sparkles */}
          {celebrating && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-10 text-2xl animate-bounce" style={{ animationDelay: '100ms' }}>✨</div>
              <div className="absolute top-4 right-20 text-xl animate-bounce" style={{ animationDelay: '200ms' }}>⭐</div>
              <div className="absolute bottom-2 left-1/3 text-2xl animate-bounce" style={{ animationDelay: '300ms' }}>🌟</div>
              <div className="absolute top-1 right-1/4 text-xl animate-bounce" style={{ animationDelay: '400ms' }}>✨</div>
            </div>
          )}
        </div>
      )}

      {/* Offers Cards */}
      {offers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">Your Offers</h2>
          <div className="grid gap-4">
            {offers.map((offer: any) => (
              <div 
                key={offer.id} 
                className={`bg-[var(--color-surface)] rounded-xl border p-6 transition-all ${
                  offer.status === 'pending' 
                    ? 'border-[var(--color-success)] shadow-lg' 
                    : offer.status === 'accepted'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                    : 'border-[var(--color-border)] opacity-60'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {offer.lender?.name || 'Lender'}
                      </span>
                      {offer.status === 'accepted' && (
                        <span className="px-2 py-1 bg-[var(--color-success-light)] text-[var(--color-success)] text-xs rounded-full font-medium">
                          ✓ Accepted
                        </span>
                      )}
                      {offer.status === 'declined' && (
                        <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-xs rounded-full font-medium">
                          Declined
                        </span>
                      )}
                    </div>
                    
                    <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">
                      £{Number(offer.amount).toLocaleString()}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 text-sm">
                      <div>
                        <p className="text-[var(--color-text-tertiary)]">Term</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{offer.loan_term || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-tertiary)]">Cost of Funding</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{offer.cost_of_funding || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-tertiary)]">Repayments</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{offer.repayments || '—'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {offer.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleAcceptOffer(offer.id)}
                        className="px-6 py-2 bg-[var(--color-success)] text-white rounded-lg hover:bg-[var(--color-success)] hover:opacity-90 font-medium transition-colors"
                      >
                        Accept Offer
                      </button>
                      <button
                        onClick={() => handleDeclineOffer(offer.id)}
                        className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-tertiary)] font-medium transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  
                  {offer.status === 'accepted' && (
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-text-tertiary)]">Accepted on</p>
                      <p className="font-medium text-[var(--color-text-primary)]">{offer.accepted_at ? new Date(offer.accepted_at).toLocaleDateString('en-GB') : '—'}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* If approved but no offers yet */}
      {app?.stage === 'approved' && offers.length === 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⏳</div>
            <div>
              <h3 className="font-semibold text-yellow-800">Application Approved!</h3>
              <p className="text-yellow-700">We're working on getting you the best offers. Check back soon!</p>
            </div>
          </div>
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
              <h2 className="font-medium text-[var(--color-text-primary)]">Application Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Amount</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">£{app.requested_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Loan Type</p>
                  <p className="text-[var(--color-text-primary)]">{app.loan_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Urgency</p>
                  <p className="text-[var(--color-text-primary)]">{app.urgency ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Stage</p>
                  <Badge variant={getStageBadgeVariant(app.stage)}>{formatStage(app.stage)}</Badge>
                </div>
              </div>
              {app.purpose && (
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-1">Purpose</p>
                  <p className="text-[var(--color-text-primary)] whitespace-pre-line">{app.purpose}</p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Created {new Date(app.created_at).toLocaleDateString('en-GB')} at {new Date(app.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Information Requests */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Information Requests</h2>
            </CardHeader>
            <CardContent>
              {infoRequests.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                  No information requests for this application.
                </p>
              ) : (
                <div className="space-y-3">
                  {infoRequests.map((request) => (
                    <div key={request.id} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-[var(--color-text-primary)]">{request.message}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'completed' 
                            ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                            : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                        }`}>
                          {request.status === 'completed' ? 'Completed' : 'Open'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
                        Requested {new Date(request.created_at).toLocaleDateString('en-GB')}
                      </p>
                      
                      {/* Show response if completed */}
                      {request.status === 'completed' && request.client_response_text && (
                        <div className="mt-3 p-3 bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
                          <p className="text-sm text-[var(--color-text-secondary)] mb-1">Your response:</p>
                          <p className="text-[var(--color-text-primary)]">{request.client_response_text}</p>
                          </div>
                        )}

                      {/* Show response form if open/pending */}
                      {(request.status === 'pending' || request.status === 'open') && (
                        <div className="mt-3 space-y-3">
                            <textarea
                            value={responseText[request.id] || ''}
                            onChange={(e) => setResponseText({ ...responseText, [request.id]: e.target.value })}
                            placeholder="Type your response here..."
                              rows={3}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                          />
                          <button
                            onClick={() => handleSubmitResponse(request.id)}
                            disabled={!responseText[request.id]?.trim() || submittingResponse}
                            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
                          >
                            {submittingResponse ? 'Submitting...' : 'Submit Response'}
                          </button>
                          </div>
                        )}
                      </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Documents */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Documents</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {docs.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-2">
                  No documents uploaded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-sm p-2 bg-[var(--color-bg-tertiary)] rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="default" size="sm">{d.category}</Badge>
                        <a
                          href={getDocumentUrl(d.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] truncate mt-1"
                        >
                          {d.original_filename ?? 'View document'}
                        </a>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                          {new Date(d.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Upload form */}
              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Upload Document</p>
                <div className="space-y-2">
                  <select
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
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
                    className="w-full text-sm text-[var(--color-text-tertiary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--color-accent-light)] file:text-[var(--color-accent)] hover:file:bg-[var(--color-accent-light)]"
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