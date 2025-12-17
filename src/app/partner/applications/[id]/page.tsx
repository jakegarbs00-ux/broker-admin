'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

type AppDetail = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  purpose: string | null;
  created_at: string;
  company_id: string | null;
  company: {
    id: string;
    name: string;
    company_number: string | null;
    industry: string | null;
    website: string | null;
    referred_by: string | null;
    referrer?: { id: string; full_name: string | null; email: string | null }[] | null;
    primary_director?: {
      id: string;
      email: string;
      full_name: string | null;
      address: string | null;
      dob: string | null;
      property_status: string | null;
      is_primary_director: boolean;
    }[] | null;
  }[] | null;
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

type Offer = {
  id: string;
  lender_id: string;
  amount: number | null;
  loan_term: string | null;
  cost_of_funding: string | null;
  repayments: string | null;
  status: 'pending' | 'accepted' | 'declined' | string;
  created_at: string;
  accepted_at: string | null;
  lender?: { id: string; name: string }[] | null;
};

export default function PartnerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [app, setApp] = useState<AppDetail | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const company = app?.company?.[0] ?? null;
  const primaryDirector = useMemo(() => {
    const directors = company?.primary_director ?? [];
    return directors.find((d) => d.is_primary_director) ?? directors[0] ?? null;
  }, [company]);

  const showOffers = new Set(['approved', 'onboarding', 'funded', 'withdrawn', 'declined']).has(app?.stage ?? '');

  useEffect(() => {
    const load = async () => {
      if (!id || !user) return;
      if (profile?.role !== 'PARTNER') {
        setLoadingData(false);
        return;
      }

      setError(null);

      // Partner access check context (partner_company -> partner users)
      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', user.id)
        .single();

      if (myProfileError || !myProfile?.partner_company_id) {
        setError('Partner company not found for your account.');
        setLoadingData(false);
        return;
      }

      const { data: partnerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('partner_company_id', myProfile.partner_company_id)
        .eq('role', 'PARTNER');

      const partnerUserIds = (partnerUsers || []).map((u) => u.id) as string[];

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
          company_id,
          company:companies!applications_company_id_fkey(
            id,
            name,
            company_number,
            industry,
            website,
            referred_by,
            referrer:referred_by(id, full_name, email),
            primary_director:profiles!profiles_company_id_fkey(id, email, full_name, address, dob, property_status, is_primary_director)
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (appError || !appData) {
        setError('Application not found');
        setLoadingData(false);
        return;
      }

      const embeddedCompany = (appData as any).company?.[0] ?? (appData as any).company ?? null;
      if (!embeddedCompany?.referred_by || !partnerUserIds.includes(embeddedCompany.referred_by)) {
        setError('Access denied');
        setLoadingData(false);
        return;
      }

      setApp(appData as any);

      // Load documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('id, category, original_filename, storage_path, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setDocs((docsData || []) as Document[]);

      // Load info requests
      const { data: reqsData } = await supabase
        .from('information_requests')
        .select('id, title, description, status, created_at, client_response_text, client_responded_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setInfoRequests((reqsData || []) as InfoRequest[]);

      // Load offers (only if stage allows, but safe to query regardless)
      const { data: offersData } = await supabase
        .from('offers')
        .select(
          `
          id,
          lender_id,
          amount,
          loan_term,
          cost_of_funding,
          repayments,
          status,
          created_at,
          accepted_at,
          lender:lender_id(id, name)
        `
        )
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setOffers((offersData || []) as Offer[]);

      setLoadingData(false);
    };

    if (!loading) load();
  }, [id, user, profile?.role, loading, supabase]);

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('application-documents').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading application...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Authentication Required</p>
          <p className="text-sm text-gray-500 mt-1">You need to be logged in to view this page.</p>
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
          <div className="mt-4">
            <Link href="/partner/applications" className="text-sm text-purple-700 hover:underline">
              Back to applications
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!app) return null;

  const referrer = company?.referrer?.[0];

  return (
    <DashboardShell>
      <div className="mb-4">
        <Link href="/partner/applications" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Applications
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">£{app.requested_amount?.toLocaleString()}</h1>
            <Badge variant={getStageBadgeVariant(app.stage)}>{formatStage(app.stage)}</Badge>
          </div>
          <p className="text-gray-600">{app.loan_type}</p>
          <p className="text-sm text-gray-500">
            Created {new Date(app.created_at).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Application info */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {app.purpose && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Purpose</p>
                  <p className="text-sm text-gray-900 whitespace-pre-line">{app.purpose}</p>
                </div>
              )}
              {app.urgency && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Urgency</p>
                  <p className="text-sm text-gray-900">{formatStage(app.urgency)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Information requests (read-only) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Information Requests</h2>
                <Badge variant="default">{infoRequests.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {infoRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No information requests</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {infoRequests.map((req) => (
                    <div key={req.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{req.title}</p>
                          {req.description && <p className="text-sm text-gray-600 mt-1">{req.description}</p>}
                          <p className="text-xs text-gray-500 mt-1">{new Date(req.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <Badge variant={req.status === 'replied' || req.status === 'client_responded' || req.status === 'resolved' ? 'success' : 'warning'}>
                          {req.status}
                        </Badge>
                      </div>
                      {req.client_response_text && (
                        <div className="mt-2 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-gray-700">{req.client_response_text}</p>
                          {req.client_responded_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Responded: {new Date(req.client_responded_at).toLocaleDateString('en-GB')}
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

          {/* Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Documents</h2>
                <Badge variant="default">{docs.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No documents uploaded</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{doc.original_filename || 'Document'}</p>
                        <p className="text-xs text-gray-500">
                          {doc.category} • {new Date(doc.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <a
                        href={getDocumentUrl(doc.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-700 hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offers (read-only) */}
          {showOffers && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900">Offers</h2>
                  <Badge variant="default">{offers.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {offers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No offers yet</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {offers.map((o) => (
                      <div key={o.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{o.lender?.[0]?.name ?? 'Lender'}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Amount: {o.amount != null ? `£${Number(o.amount).toLocaleString()}` : '—'}
                            </p>
                            <p className="text-sm text-gray-600">Term: {o.loan_term ?? '—'}</p>
                            <p className="text-sm text-gray-600">Cost: {o.cost_of_funding ?? '—'}</p>
                            <p className="text-sm text-gray-600">Repayments: {o.repayments ?? '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={o.status === 'accepted' ? 'success' : o.status === 'declined' ? 'error' : 'warning'}>
                              {o.status}
                            </Badge>
                            {o.accepted_at && (
                              <p className="text-xs text-gray-500">
                                Accepted: {new Date(o.accepted_at).toLocaleDateString('en-GB')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Company */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium text-gray-900">{company?.name ?? '—'}</p>
              {company?.company_number && <p className="text-sm text-gray-600">#{company.company_number}</p>}
              {company?.industry && <p className="text-sm text-gray-600">{company.industry}</p>}
              {company?.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 hover:underline">
                  {company.website}
                </a>
              )}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 uppercase mb-1">Referred By</p>
                <p className="text-sm text-gray-900">{referrer?.full_name ?? '—'}</p>
                <p className="text-sm text-gray-600">{referrer?.email ?? '—'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Director */}
          {primaryDirector && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Director</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-gray-900">{primaryDirector.full_name ?? '—'}</p>
                <p className="text-sm text-gray-600">{primaryDirector.email ?? '—'}</p>
                {primaryDirector.dob && (
                  <p className="text-sm text-gray-600">
                    DOB: {new Date(primaryDirector.dob).toLocaleDateString('en-GB')}
                  </p>
                )}
                {primaryDirector.property_status && (
                  <p className="text-sm text-gray-600">
                    Property: {primaryDirector.property_status.replace(/_/g, ' ')}
                  </p>
                )}
                {primaryDirector.address && (
                  <p className="text-sm text-gray-600 whitespace-pre-line">{primaryDirector.address}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}


