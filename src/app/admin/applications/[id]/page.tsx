'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, getStageBadgeVariant, formatStage } from '@/components/ui';

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  urgency: string | null;
  purpose: string | null;
  is_hidden: boolean;
  admin_notes: string | null;
  lender_id: string | null;
  created_at: string;
  company_id: string | null;
  prospective_client_email: string | null;
  created_by: string | null;
  offer_amount: number | null;
  offer_loan_term: string | null;
  offer_cost_of_funding: string | null;
  offer_repayments: string | null;
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  referred_by: string | null;
  primary_director: { 
    id: string; 
    email: string; 
    full_name: string | null; 
    address: string | null; 
    dob: string | null; 
    property_status: string | null;
  }[] | null;
  partner: { 
    id: string; 
    email: string; 
    full_name: string | null; 
    company_name: string | null;
  }[] | null;
};

type Lender = {
  id: string;
  name: string;
};

type InfoRequest = {
  id: string;
  question: string;
  status: string;
  created_at: string;
  response_text: string | null;
};

type Document = {
  id: string;
  category: string;
  original_filename: string;
  storage_path: string;
  created_at: string;
};

type Partner = {
  id: string;
  email: string;
};

const STAGES = [
  'created',
  'submitted',
  'in_credit',
  'info_required',
  'approved',
  'onboarding',
  'funded',
  'declined',
  'withdrawn',
];

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const [offerAmount, setOfferAmount] = useState('');
  const [offerLoanTerm, setOfferLoanTerm] = useState('');
  const [offerCostOfFunding, setOfferCostOfFunding] = useState('');
  const [offerRepayments, setOfferRepayments] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerDirty, setOfferDirty] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [referralPartner, setReferralPartner] = useState<Partner | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingStage, setUpdatingStage] = useState(false);
  const [updatingLender, setUpdatingLender] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  // New info request form
  const [newQuestion, setNewQuestion] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Load application
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .single();

      if (appError) {
        setError('Application not found');
        setLoadingData(false);
        return;
      }

      setApplication(appData as Application);
      setAdminNotes(appData.admin_notes || '');
      setOfferAmount(appData.offer_amount?.toString() || '');
      setOfferLoanTerm(appData.offer_loan_term || '');
      setOfferCostOfFunding(appData.offer_cost_of_funding || '');
      setOfferRepayments(appData.offer_repayments || '');

      // Load company if exists
      if (appData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select(`
            id, name, company_number, industry, website,
            referred_by,
            primary_director:profiles!profiles_company_id_fkey(id, email, full_name, address, dob, property_status, is_primary_director),
            partner:profiles!companies_referred_by_fkey(id, email, full_name, company_name)
          `)
          .eq('id', appData.company_id)
          .eq('primary_director.is_primary_director', true)
          .single();

        if (companyData) {
          setCompany(companyData as any);
        }
      }

      // Check for referral partner - get from company.referred_by
      let foundPartner: Partner | null = null;

      if (appData.company_id && company?.referred_by) {
        const { data: partnerData } = await supabase
          .from('profiles')
          .select('id, email, full_name, company_name')
          .eq('id', company.referred_by)
          .single();

        if (partnerData) {
          foundPartner = partnerData as Partner;
        }
      }

      // 2. Check if application was created by a partner (created_by field)
      if (appData.created_by && !foundPartner) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', appData.created_by)
          .single();

        if (creatorProfile?.role === 'PARTNER') {
          foundPartner = { id: creatorProfile.id, email: creatorProfile.email };
        }
      }

      if (foundPartner) {
        setReferralPartner(foundPartner);
      }

      // Load lenders
      const { data: lendersData } = await supabase
        .from('lenders')
        .select('id, name')
        .order('name', { ascending: true });
      setLenders((lendersData || []) as Lender[]);

      // Load info requests
      const { data: requestsData } = await supabase
        .from('information_requests')
        .select('id, question, status, created_at, response_text')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setInfoRequests((requestsData || []) as InfoRequest[]);

      // Load documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('id, category, original_filename, storage_path, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setDocuments((docsData || []) as Document[]);

      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const handleStageChange = async (newStage: string) => {
    if (!application) return;
    setUpdatingStage(true);

    const { error } = await supabase
      .from('applications')
      .update({ stage: newStage })
      .eq('id', id);

    if (error) {
      alert('Error updating stage: ' + error.message);
    } else {
      setApplication((prev) => prev ? { ...prev, stage: newStage } : null);
    }
    setUpdatingStage(false);
  };

  const handleLenderChange = async (lenderId: string) => {
    if (!application) return;
    setUpdatingLender(true);

    const lender_id = lenderId === 'none' ? null : lenderId;
    const { error } = await supabase
      .from('applications')
      .update({ lender_id })
      .eq('id', id);

    if (error) {
      alert('Error updating lender: ' + error.message);
    } else {
      setApplication((prev) => prev ? { ...prev, lender_id } : null);
    }
    setUpdatingLender(false);
  };

  const handleSaveNotes = async () => {
    if (!application) return;
    setSavingNotes(true);

    const { error } = await supabase
      .from('applications')
      .update({ admin_notes: adminNotes })
      .eq('id', id);

    if (error) {
      alert('Error saving notes: ' + error.message);
    } else {
      setApplication((prev) => prev ? { ...prev, admin_notes: adminNotes } : null);
      setNotesDirty(false);
    }
    setSavingNotes(false);
  };
const handleSaveOffer = async () => {
    if (!application) return;
    setSavingOffer(true);

    const { error } = await supabase
      .from('applications')
      .update({
        offer_amount: offerAmount ? parseFloat(offerAmount) : null,
        offer_loan_term: offerLoanTerm || null,
        offer_cost_of_funding: offerCostOfFunding || null,
        offer_repayments: offerRepayments || null,
      })
      .eq('id', id);

    if (error) {
      alert('Error saving offer: ' + error.message);
    } else {
      setApplication((prev) => prev ? {
        ...prev,
        offer_amount: offerAmount ? parseFloat(offerAmount) : null,
        offer_loan_term: offerLoanTerm || null,
        offer_cost_of_funding: offerCostOfFunding || null,
        offer_repayments: offerRepayments || null,
      } : null);
      setOfferDirty(false);
    }
    setSavingOffer(false);
  };

  const handleCreateInfoRequest = async () => {
    if (!newQuestion.trim()) return;
    setCreatingRequest(true);

    const { data, error } = await supabase
      .from('information_requests')
      .insert({
        application_id: id,
        question: newQuestion.trim(),
        status: 'pending',
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      alert('Error creating request: ' + error.message);
    } else if (data) {
      setInfoRequests((prev) => [data as InfoRequest, ...prev]);
      setNewQuestion('');
    }
    setCreatingRequest(false);
  };

  const getDocumentUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
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

  if (!application) return null;

  const currentLender = lenders.find((l) => l.id === application.lender_id);
  const directorEmail = company?.primary_director?.[0]?.email ?? application.prospective_client_email ?? 'Unknown';

  return (
    <DashboardShell>
      {/* Back link and Edit button */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/applications" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Applications
        </Link>
        <Link href={`/admin/applications/${id}/edit`}>
          <Button variant="outline">Edit</Button>
        </Link>
      </div>

      {/* Header with status */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              £{application.requested_amount?.toLocaleString()}
            </h1>
            <Badge variant={getStageBadgeVariant(application.stage)}>
              {formatStage(application.stage)}
            </Badge>
            {application.is_hidden && <Badge variant="warning">Draft</Badge>}
          </div>
          <p className="text-gray-600">{application.loan_type}</p>
          <p className="text-sm text-gray-500">
            Created {new Date(application.created_at).toLocaleDateString('en-GB')} at{' '}
            {new Date(application.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar - Actions */}
        <div className="space-y-4">
          {/* Stage & Lender Controls */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  value={application.stage}
                  disabled={updatingStage}
                  onChange={(e) => handleStageChange(e.target.value)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {formatStage(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Lender</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  value={application.lender_id ?? 'none'}
                  disabled={updatingLender}
                  onChange={(e) => handleLenderChange(e.target.value)}
                >
                  <option value="none">Unassigned</option>
                  {lenders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-500 uppercase font-medium">Quick Actions</p>
                {application.stage === 'created' && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => handleStageChange('submitted')}
                  >
                    Submit Application
                  </Button>
                )}
                {!['funded', 'declined', 'withdrawn'].includes(application.stage) && (
                  <>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleStageChange('declined')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleStageChange('withdrawn')}
                    >
                      Withdraw
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Referral Partner */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Referral Partner</h2>
            </CardHeader>
            <CardContent>
              {referralPartner ? (
                <div>
                  <p className="font-medium text-gray-900">{referralPartner.email}</p>
                  <p className="text-xs text-gray-500 mt-1">Partner ID: {referralPartner.id.slice(0, 8)}...</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No referral partner</p>
              )}
            </CardContent>
          </Card>

             {/* Offer Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Offer Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Offer Amount (£)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 50000"
                  value={offerAmount}
                  onChange={(e) => {
                    setOfferAmount(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Loan Term
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 12 months"
                  value={offerLoanTerm}
                  onChange={(e) => {
                    setOfferLoanTerm(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cost of Funding
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 8% APR"
                  value={offerCostOfFunding}
                  onChange={(e) => {
                    setOfferCostOfFunding(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Repayments
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., £4,500/month"
                  value={offerRepayments}
                  onChange={(e) => {
                    setOfferRepayments(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={!offerDirty || savingOffer}
                  onClick={handleSaveOffer}
                >
                  {savingOffer ? 'Saving...' : 'Save Offer Details'}
                </Button>
              </div>

              {/* Show current values as reference */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-500 uppercase font-medium">Application Details</p>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Requested</span>
                  <span className="text-sm font-medium">£{application.requested_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Type</span>
                  <span className="text-sm font-medium">{application.loan_type}</span>
                </div>
                {currentLender && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Lender</span>
                    <Link href={`/admin/lenders/${currentLender.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {currentLender.name}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
            </div> 


        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Company Information</h2>
                {company && (
                  <Link href={`/admin/companies/${company.id}`} className="text-sm text-blue-600 hover:underline">
                    View Company →
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {company ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Company Name</p>
                    <p className="font-medium text-gray-900">{company.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Company Number</p>
                    <p className="font-medium text-gray-900">{company.company_number || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Industry</p>
                    <p className="font-medium text-gray-900">{company.industry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Website</p>
                    {company.website ? (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <p className="font-medium text-gray-900">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Client Email</p>
                    <p className="font-medium text-gray-900">{directorEmail}</p>
                  </div>
                  {company.primary_director?.[0]?.full_name && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Director</p>
                      <p className="font-medium text-gray-900">{company.primary_director[0].full_name}</p>
                    </div>
                  )}
                  {company.primary_director?.[0]?.property_status && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Property Status</p>
                      <p className="font-medium text-gray-900 capitalize">{company.primary_director[0].property_status.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No company information available</p>
              )}
            </CardContent>
          </Card>

          {/* Purpose */}
          {application.purpose && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-gray-900">Purpose of Funding</h2>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-line">{application.purpose}</p>
              </CardContent>
            </Card>
          )}

          {/* Information Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Information Requests</h2>
                <Badge variant="default">{infoRequests.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Create new request */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask the client for information..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateInfoRequest();
                  }}
                />
                <Button
                  variant="primary"
                  disabled={creatingRequest || !newQuestion.trim()}
                  onClick={handleCreateInfoRequest}
                >
                  {creatingRequest ? 'Sending...' : 'Send'}
                </Button>
              </div>

              {/* Requests list */}
              {infoRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No information requests yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {infoRequests.map((req) => (
                    <div key={req.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{req.question}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(req.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <Badge variant={req.status === 'answered' ? 'success' : 'warning'}>
                          {req.status}
                        </Badge>
                      </div>
                      {req.response_text && (
                        <div className="mt-2 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-gray-700">{req.response_text}</p>
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
                <Badge variant="default">{documents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No documents uploaded</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{doc.original_filename}</p>
                        <p className="text-xs text-gray-500">
                          {doc.category} • {new Date(doc.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <a
                        href={getDocumentUrl(doc.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Admin Notes</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Internal notes visible only to admins..."
                value={adminNotes}
                onChange={(e) => {
                  setAdminNotes(e.target.value);
                  setNotesDirty(true);
                }}
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!notesDirty || savingNotes}
                  onClick={handleSaveNotes}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}