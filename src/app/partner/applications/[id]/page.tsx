'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button } from '@/components/ui';

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  urgency: string | null;
  purpose: string | null;
  created_at: string;
  company_id: string | null;
  company?: {
    id: string;
    name: string;
    company_number: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    postcode: string | null;
    website: string | null;
    referred_by: string | null;
  } | null;
  lender?: {
    id: string;
    name: string;
  } | null;
};

type Director = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

type Offer = {
  id: string;
  amount: number;
  loan_term: string;
  cost_of_funding: string;
  repayments: string;
  status: string;
  created_at: string;
  lender?: {
    id: string;
    name: string;
  } | null;
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
  description: string;
  status: string;
  created_at: string;
  client_response_text: string | null;
  client_responded_at: string | null;
};

export default function PartnerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [application, setApplication] = useState<Application | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || loading || !user || profile?.role !== 'PARTNER') return;

    const loadData = async () => {
      setError(null);

      // Get user's partner_company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.partner_company_id) {
        setError('You are not associated with a partner company');
        setLoadingData(false);
        return;
      }

      // Get all partner user IDs in this partner company
      const { data: partnerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('partner_company_id', userProfile.partner_company_id)
        .eq('role', 'PARTNER');

      const partnerUserIds = (partnerUsers || []).map((u) => u.id);

      // Fetch application with company
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select(`
          *,
          company:company_id(
            id,
            name,
            company_number,
            address_line_1,
            address_line_2,
            city,
            postcode,
            website,
            referred_by
          ),
          lender:lender_id(id, name)
        `)
        .eq('id', id)
        .single();

      if (appError || !appData) {
        setError('Application not found');
        setLoadingData(false);
        return;
      }

      // Verify this application belongs to a company referred by this partner company
      if (appData.company?.referred_by && !partnerUserIds.includes(appData.company.referred_by)) {
        setError('You do not have permission to view this application');
        setLoadingData(false);
        return;
      }

      setApplication(appData as Application);

      // Fetch offers separately when stage allows
      const showOffers = ['approved', 'onboarding', 'funded', 'withdrawn', 'declined'].includes(appData.stage);
      if (showOffers) {
        const { data: offersData } = await supabase
          .from('offers')
          .select('*, lender:lender_id(id, name)')
          .eq('application_id', id)
          .order('created_at', { ascending: false });
        setOffers(offersData || []);
      }

      // Fetch directors
      if (appData.company_id) {
        const { data: directorsData } = await supabase
          .from('profiles')
          .select('*')
          .eq('company_id', appData.company_id)
          .eq('role', 'CLIENT');
        setDirectors(directorsData || []);
      }

      // Fetch documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setDocuments(docsData || []);

      // Fetch information requests
      const { data: infoReqsData } = await supabase
        .from('information_requests')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setInfoRequests(infoReqsData || []);

      setLoadingData(false);
    };

    loadData();
  }, [id, loading, user, profile?.role, supabase]);

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('application-documents').getPublicUrl(storagePath);
    return data.publicUrl;
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

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (error || !application) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">{error || 'Application not found'}</p>
          <Link href="/partner/applications" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to Applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-6">
        <Link href="/partner/applications" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Applications
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Application Details</h1>
        <p className="text-gray-600 mt-1">
          £{application.requested_amount?.toLocaleString()} • {application.loan_type}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application Information</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Amount Requested</p>
                  <p className="text-gray-900">£{application.requested_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Loan Type</p>
                  <p className="text-gray-900">{application.loan_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Stage</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm ${
                      application.stage === 'funded'
                        ? 'bg-green-100 text-green-800'
                        : application.stage === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : application.stage === 'onboarding'
                            ? 'bg-blue-100 text-blue-800'
                            : application.stage === 'declined'
                              ? 'bg-red-100 text-red-800'
                              : application.stage === 'withdrawn'
                                ? 'bg-red-100 text-red-800'
                                : application.stage === 'in_credit'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : application.stage === 'information_requested'
                                    ? 'bg-orange-100 text-orange-800'
                                    : application.stage === 'submitted'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {application.stage?.replace('_', ' ')}
                  </span>
                </div>
                {application.urgency && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Urgency</p>
                    <p className="text-gray-900 capitalize">{application.urgency}</p>
                  </div>
                )}
                {application.purpose && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">Purpose</p>
                    <p className="text-gray-900">{application.purpose}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
                  <p className="text-gray-900">{new Date(application.created_at).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          {application.company && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Company Information</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Company Name</p>
                    <p className="text-gray-900">{application.company.name}</p>
                  </div>
                  {application.company.company_number && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Company Number</p>
                      <p className="text-gray-900">{application.company.company_number}</p>
                    </div>
                  )}
                  {application.company.address_line_1 && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                      <p className="text-gray-900">
                        {[
                          application.company.address_line_1,
                          application.company.address_line_2,
                          application.company.city,
                          application.company.postcode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  )}
                  {application.company.website && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Website</p>
                      <a
                        href={application.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {application.company.website}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Directors */}
          {directors.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Directors</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {directors.map((director) => (
                    <div key={director.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                          <p className="text-gray-900">
                            {director.first_name} {director.last_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                          <p className="text-gray-900">{director.email || '—'}</p>
                        </div>
                        {director.phone && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                            <p className="text-gray-900">{director.phone}</p>
                          </div>
                        )}
                        {director.date_of_birth && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Date of Birth</p>
                            <p className="text-gray-900">
                              {new Date(director.date_of_birth).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                        )}
                        {director.address_line_1 && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                            <p className="text-gray-900">
                              {[
                                director.address_line_1,
                                director.address_line_2,
                                director.city,
                                director.postcode,
                                director.country,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Documents</h2>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={getDocumentUrl(doc.storage_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="info" size="sm">{doc.category}</Badge>
                          <p className="text-sm text-gray-900 mt-1">
                            {doc.original_filename || 'View document'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Information Requests */}
          {infoRequests.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Information Requests</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {infoRequests.map((req) => (
                    <div key={req.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{req.title}</h3>
                        <Badge variant={req.status === 'replied' ? 'success' : 'warning'}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{req.description}</p>
                      {req.client_response_text && (
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Client Response</p>
                          <p className="text-sm text-gray-900">{req.client_response_text}</p>
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
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {application.lender && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Assigned Lender</h2>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900">{application.lender.name}</p>
              </CardContent>
            </Card>
          )}

          {/* Offers */}
          {offers.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Offers</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <div key={offer.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900 text-sm">{offer.lender?.name || 'Unknown Lender'}</h3>
                        <Badge
                          variant={
                            offer.status === 'accepted'
                              ? 'success'
                              : offer.status === 'declined'
                                ? 'error'
                                : 'default'
                          }
                        >
                          {offer.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Amount</p>
                          <p className="font-medium text-gray-900">£{offer.amount?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Loan Term</p>
                          <p className="font-medium text-gray-900">{offer.loan_term}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Cost of Funding</p>
                          <p className="font-medium text-gray-900">{offer.cost_of_funding}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Repayments</p>
                          <p className="font-medium text-gray-900">{offer.repayments}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

