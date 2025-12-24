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
  owner_id: string | null;
  prospective_client_email: string | null;
  created_by: string | null;
  offer_amount: number | null;
  offer_loan_term: string | null;
  offer_cost_of_funding: string | null;
  offer_repayments: string | null;
  company?: {
    id: string;
    name: string;
    company_number: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
    website?: string | null;
    referred_by?: string | null;
    referrer?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      partner_company?: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
  lender?: {
    id: string;
    name: string;
  } | null;
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  owner: { email: string }[] | null;
};

type Lender = {
  id: string;
  name: string;
};

type InfoRequest = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  client_response_text: string | null;
  client_responded_at: string | null;
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
  const [requestMessage, setRequestMessage] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Load application with company data and referral chain
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
            country,
            website,
            referred_by,
            referrer:referred_by(
              id,
              first_name,
              last_name,
              email,
              partner_company:partner_company_id(id, name)
            )
          ),
          lender:lender_id(id, name)
        `)
        .eq('id', id)
        .single();

      if (appError) {
        console.error('Error fetching application:', appError);
        setError(appError.message || 'Application not found');
        setLoadingData(false);
        return;
      }

      if (!appData) {
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

      // Load company separately for additional fields if needed
      if (appData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select(`
            id, name, company_number, industry, website
          `)
          .eq('id', appData.company_id)
          .single();

        if (companyData) {
          // Load primary director
          const { data: directorData } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('company_id', appData.company_id)
            .eq('is_primary_director', true)
            .maybeSingle();

          const enrichedCompany = {
            ...companyData,
            owner: directorData ? [{ id: directorData.id, email: directorData.email || '' }] : null,
          };

          setCompany(enrichedCompany as Company);
        }
      }

      // Referral partner is now loaded via the query join
      if (appData.company?.referrer) {
        setReferralPartner({
          id: appData.company.referrer.id,
          email: appData.company.referrer.email || '',
        });
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
        .select('*')
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
    if (!requestMessage.trim()) return;
    setCreatingRequest(true);

    const { data, error } = await supabase
      .from('information_requests')
      .insert({
        message: requestMessage.trim(),
        application_id: id,
        status: 'pending',
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      alert('Error creating request: ' + error.message);
    } else if (data) {
      setInfoRequests((prev) => [data as InfoRequest, ...prev]);
      setRequestMessage('');
    }
    setCreatingRequest(false);
  };

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
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading application...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Check role first - separate from error handling
  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  // Show error if there is one (but user is admin, so it's a data issue, not permission)
  if (error) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{error}</p>
          <Link href="/admin/applications" className="text-[var(--color-accent)] hover:underline text-sm mt-4 inline-block">
            ← Back to Applications
          </Link>
        </div>
      </DashboardShell>
    );
  }

  // Show loading if no application yet
  if (!application) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading application...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const currentLender = application.lender || lenders.find((l) => l.id === application.lender_id);
  const ownerEmail = company?.owner?.[0]?.email ?? application.prospective_client_email ?? 'Unknown';

  return (
    <DashboardShell>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/admin/applications" className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Applications
        </Link>
      </div>

      {/* Header with status */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              £{application.requested_amount?.toLocaleString()}
            </h1>
            <Badge variant={getStageBadgeVariant(application.stage)}>
              {formatStage(application.stage)}
            </Badge>
            {application.is_hidden && <Badge variant="warning">Draft</Badge>}
          </div>
          <p className="text-[var(--color-text-secondary)]">{application.loan_type}</p>
          <p className="text-sm text-[var(--color-text-tertiary)]">
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
              <h2 className="font-medium text-[var(--color-text-primary)]">Application</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Stage</label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] disabled:opacity-50"
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
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Assigned Lender</label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] disabled:opacity-50"
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

              <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
                <p className="text-xs text-[var(--color-text-tertiary)] uppercase font-medium">Quick Actions</p>
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
              <h2 className="font-medium text-[var(--color-text-primary)]">Referral Partner</h2>
            </CardHeader>
            <CardContent>
              {application?.company?.referrer ? (
                <div>
                  {application.company.referrer.partner_company?.name && (
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {application.company.referrer.partner_company.name}
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {application.company.referrer.first_name} {application.company.referrer.last_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{application.company.referrer.email}</p>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">No referral partner</p>
              )}
            </CardContent>
          </Card>

             {/* Offer Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Offer Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Offer Amount (£)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
                  placeholder="e.g., 50000"
                  value={offerAmount}
                  onChange={(e) => {
                    setOfferAmount(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Loan Term
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
                  placeholder="e.g., 12 months"
                  value={offerLoanTerm}
                  onChange={(e) => {
                    setOfferLoanTerm(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Cost of Funding
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
                  placeholder="e.g., 8% APR"
                  value={offerCostOfFunding}
                  onChange={(e) => {
                    setOfferCostOfFunding(e.target.value);
                    setOfferDirty(true);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Repayments
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
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
              <div className="pt-3 border-t border-[var(--color-border)] space-y-2">
                <p className="text-xs text-[var(--color-text-tertiary)] uppercase font-medium">Application Details</p>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">Requested</span>
                  <span className="text-sm font-medium">£{application.requested_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">Type</span>
                  <span className="text-sm font-medium">{application.loan_type}</span>
                </div>
                {currentLender && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Lender</span>
                    <Link href={`/admin/lenders/${currentLender.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
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
                <h2 className="font-medium text-[var(--color-text-primary)]">Company Information</h2>
                {application?.company && (
                  <Link href={`/admin/companies/${application.company.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
                    View Company →
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {application?.company ? (
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Name:</span> {application.company.name}
                  </p>
                  <p>
                    <span className="font-medium">Company Number:</span> {application.company.company_number || '—'}
                  </p>
                  <p>
                    <span className="font-medium">Address:</span>{' '}
                    {[
                      application.company.address_line_1,
                      application.company.address_line_2,
                      application.company.city,
                      application.company.postcode,
                      application.company.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                  {application.company.website && (
                    <p>
                      <span className="font-medium">Website:</span>{' '}
                      <a
                        href={application.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        {application.company.website.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                  )}
                  {company && (
                    <>
                      {company.industry && (
                        <p>
                          <span className="font-medium">Industry:</span> {company.industry}
                        </p>
                      )}
                    </>
                  )}
                  {company?.owner?.[0]?.email && (
                    <p>
                      <span className="font-medium">Client Email:</span> {company.owner[0].email}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No company information available</p>
              )}
            </CardContent>
          </Card>

          {/* Purpose */}
          {application.purpose && (
            <Card>
              <CardHeader>
                <h2 className="font-medium text-[var(--color-text-primary)]">Purpose of Funding</h2>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--color-text-primary)] whitespace-pre-line">{application.purpose}</p>
              </CardContent>
            </Card>
          )}

          {/* Information Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Information Requests</h2>
                <Badge variant="default">{infoRequests.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Create new request */}
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--color-text-primary)]">Message to client</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Please upload your last 3 months bank statements"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateInfoRequest();
                    }}
                  />
                  <Button
                    variant="primary"
                    disabled={creatingRequest || !requestMessage.trim()}
                    onClick={handleCreateInfoRequest}
                  >
                    {creatingRequest ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>

              {/* Requests list */}
              {infoRequests.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">No information requests yet</p>
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
                      
                      <p className="text-sm text-[var(--color-text-tertiary)]">
                        Requested {new Date(request.created_at).toLocaleDateString('en-GB')}
                      </p>
                      
                      {/* Show client response if completed */}
                      {request.status === 'completed' && (
                        <div className="mt-3 p-3 bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
                          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Client Response:</p>
                          {request.client_response_text && (
                            <p className="text-[var(--color-text-primary)]">{request.client_response_text}</p>
                          )}
                          {request.client_responded_at && (
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                              Responded {new Date(request.client_responded_at).toLocaleDateString('en-GB')} at {new Date(request.client_responded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
                <h2 className="font-medium text-[var(--color-text-primary)]">Documents</h2>
                <Badge variant="default">{documents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">No documents uploaded</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{doc.original_filename}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {doc.category} • {new Date(doc.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <a
                        href={getDocumentUrl(doc.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-accent)] hover:underline"
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
              <h2 className="font-medium text-[var(--color-text-primary)]">Admin Notes</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
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