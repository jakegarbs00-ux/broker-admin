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
  accepted_lender_id: string | null;
  created_at: string;
  company_id: string | null;
  owner_id: string | null;
  prospective_client_email: string | null;
  created_by: string | null;
  offer_amount: number | null;
  offer_loan_term: string | null;
  offer_cost_of_funding: string | null;
  offer_repayments: string | null;
  monthly_revenue: number | null;
  trading_months: number | null;
  workflow_status: string | null;
  eligibility_result: Record<string, unknown> | null;
  companies_house_data: Record<string, unknown> | null;
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
  submission_method?: string | null;
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

type PartnerCompany = {
  id: string;
  name: string;
};

type LenderSubmission = {
  id: string;
  lender_id: string;
  submission_method: 'api' | 'email';
  status: 'pending' | 'sent' | 'acknowledged' | 'failed' | 'retry';
  sent_at: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  lender?: {
    id: string;
    name: string;
  };
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

const DOCUMENT_CATEGORIES = [
  { value: 'bank_statements', label: '6 months bank statements' },
  { value: 'management_accounts', label: 'Management accounts' },
  { value: 'cashflow_forecast', label: 'Cashflow forecasts' },
  { value: 'other', label: 'Other' },
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
  const [lenderSubmissions, setLenderSubmissions] = useState<LenderSubmission[]>([]);
  const [selectedLenderIds, setSelectedLenderIds] = useState<string[]>([]);
  const [sendingToLenders, setSendingToLenders] = useState(false);
  const [referralPartner, setReferralPartner] = useState<Partner | null>(null);
  const [partnerCompanies, setPartnerCompanies] = useState<PartnerCompany[]>([]);
  const [partnerUsers, setPartnerUsers] = useState<Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    partner_company_id: string;
    partner_company?: { id: string; name: string } | null;
  }>>([]);
  const [selectedPartnerUserId, setSelectedPartnerUserId] = useState<string | null>(null);
  const [assigningPartner, setAssigningPartner] = useState(false);
  const [lenderSearchQuery, setLenderSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingStage, setUpdatingStage] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  // New info request form
  const [requestMessage, setRequestMessage] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);

  // Document upload
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('bank_statements');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          lender:accepted_lender_id(id, name)
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
        .select('id, name, submission_method')
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

      // Load lender submissions
      const { data: submissionsData } = await supabase
        .from('lender_submissions')
        .select('*, lender:lender_id(id, name)')
        .eq('application_id', id)
        .order('created_at', { ascending: false });
      setLenderSubmissions((submissionsData || []) as LenderSubmission[]);

      // Load partner users grouped by company for assignment
      const { data: partnerUsersData } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          partner_company_id,
          partner_company:partner_company_id(id, name)
        `)
        .eq('role', 'PARTNER')
        .order('partner_company_id')
        .order('first_name');
      
      setPartnerUsers((partnerUsersData || []) as any);

      // Check if company has assigned partner user
      if (appData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('referred_by, partner_company_id')
          .eq('id', appData.company_id)
          .maybeSingle();
        if (companyData?.referred_by) {
          setSelectedPartnerUserId(companyData.referred_by);
        }
      }

      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const availableLenders = lenders.filter(
    (l) => !lenderSubmissions.some((sub) => sub.lender_id === l.id)
  );

  // Filter lenders by search query
  const filteredLenders = availableLenders.filter((lender) =>
    lender.name.toLowerCase().includes(lenderSearchQuery.toLowerCase())
  );

  const handleAssignPartner = async (partnerUserId: string | null) => {
    if (!application?.company_id || !partnerUserId) return;
    setAssigningPartner(true);

    try {
      // Get the partner user's partner_company_id
      const { data: partnerUser } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', partnerUserId)
        .maybeSingle();
      
      if (!partnerUser?.partner_company_id) {
        alert('Partner user not found or has no company');
        setAssigningPartner(false);
        return;
      }

      // Update the company with both referred_by and partner_company_id
      const { error } = await supabase
        .from('companies')
        .update({
          referred_by: partnerUserId,
          partner_company_id: partnerUser.partner_company_id,
        })
        .eq('id', application.company_id);

      if (error) {
        alert('Error assigning partner: ' + error.message);
      } else {
        setSelectedPartnerUserId(partnerUserId);
      }
    } catch (err) {
      console.error('Error assigning partner:', err);
      alert('Error assigning partner');
    } finally {
      setAssigningPartner(false);
    }
  };

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

  const handleSendToLenders = async () => {
    if (selectedLenderIds.length === 0 || !application) return;
    setSendingToLenders(true);

    try {
      // Create pending submission records for each selected lender
      const submissions = selectedLenderIds.map((lenderId) => ({
        application_id: id,
        lender_id: lenderId,
        submission_method: lenders.find((l) => l.id === lenderId)?.submission_method || 'email',
        status: 'pending',
      }));

      const { data: newSubmissions, error: insertError } = await supabase
        .from('lender_submissions')
        .insert(submissions)
        .select('*, lender:lender_id(id, name)');

      if (insertError) throw insertError;

      // Trigger n8n webhook
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: id,
            lender_ids: selectedLenderIds,
          }),
        });
      }

      // Update local state
      setLenderSubmissions((prev) => [...(newSubmissions || []), ...prev]);
      setSelectedLenderIds([]);
      
      // Update workflow status
      await supabase
        .from('applications')
        .update({ workflow_status: 'submitted_to_lenders' })
        .eq('id', id);

      // Reload application to get updated workflow_status
      const { data: updatedApp } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .single();
      if (updatedApp) {
        setApplication(updatedApp as Application);
      }

    } catch (error) {
      console.error('Error sending to lenders:', error);
      alert('Failed to send to lenders. Please try again.');
    } finally {
      setSendingToLenders(false);
    }
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
        setDocuments((prev) => [data as Document, ...prev]);
        setUploadFile(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!application) return;
    setDeleting(true);

    try {
      // Delete related documents from storage first
      if (documents.length > 0) {
        const paths = documents.map(d => d.storage_path);
        await supabase.storage.from('application-documents').remove(paths);
      }

      // Delete related records (order matters for foreign keys)
      await supabase.from('documents').delete().eq('application_id', id);
      await supabase.from('information_requests').delete().eq('application_id', id);
      await supabase.from('lender_submissions').delete().eq('application_id', id);
      await supabase.from('offers').delete().eq('application_id', id);
      
      // Delete the application
      const { error } = await supabase.from('applications').delete().eq('id', id);

      if (error) {
        alert('Error deleting application: ' + error.message);
        setDeleting(false);
        return;
      }

      router.push('/admin/applications');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting application');
      setDeleting(false);
    }
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
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Application
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send to Lenders */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Send to Lenders</h2>
              {filteredLenders.length > 0 && (
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {selectedLenderIds.length} of {filteredLenders.length} selected
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {availableLenders.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {lenders.length === 0 ? 'No lenders configured' : 'Already sent to all lenders'}
                </p>
              ) : (
                <>
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Search lenders..."
                    value={lenderSearchQuery}
                    onChange={(e) => setLenderSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
                  />
                  
                  {/* Lender list with scroll */}
                  <div className="max-h-64 overflow-y-auto space-y-2 border border-[var(--color-border)] rounded-lg p-2">
                    {filteredLenders.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                        No lenders match your search
                      </p>
                    ) : (
                      filteredLenders.map((lender) => (
                        <label key={lender.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-bg-tertiary)] p-2 rounded">
                          <input
                            type="checkbox"
                            className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                            checked={selectedLenderIds.includes(lender.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLenderIds([...selectedLenderIds, lender.id]);
                              } else {
                                setSelectedLenderIds(selectedLenderIds.filter((id) => id !== lender.id));
                              }
                            }}
                          />
                          <span className="text-sm text-[var(--color-text-primary)] flex-1">{lender.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLenderIds(filteredLenders.map((l) => l.id))}
                      disabled={filteredLenders.length === 0}
                    >
                      Select All Matching
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLenderIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={selectedLenderIds.length === 0 || sendingToLenders}
                    onClick={handleSendToLenders}
                  >
                    {sendingToLenders ? 'Sending...' : `Send to ${selectedLenderIds.length} Lender${selectedLenderIds.length !== 1 ? 's' : ''}`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Partner Assignment */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Partner Assignment</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                  Assign to Partner User
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] disabled:opacity-50"
                  value={selectedPartnerUserId || ''}
                  disabled={assigningPartner || !application?.company_id}
                  onChange={(e) => handleAssignPartner(e.target.value || null)}
                >
                  <option value="">No partner assigned</option>
                  {(() => {
                    // Group partner users by company
                    const partnersByCompany = partnerUsers.reduce((acc, user) => {
                      const companyName = user.partner_company?.name || 'Unknown';
                      if (!acc[companyName]) acc[companyName] = [];
                      acc[companyName].push(user);
                      return acc;
                    }, {} as Record<string, typeof partnerUsers>);

                    return Object.entries(partnersByCompany).map(([companyName, users]) => (
                      <optgroup key={companyName} label={companyName}>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.first_name} {user.last_name} ({user.email})
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
                {assigningPartner && (
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Assigning...</p>
                )}
              </div>
              
              {/* Show current referral info if exists */}
              {application?.company?.referrer && (
                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-tertiary)] uppercase font-medium mb-2">Original Referrer</p>
                  {application.company.referrer.partner_company?.name && (
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {application.company.referrer.partner_company.name}
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {application.company.referrer.first_name} {application.company.referrer.last_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{application.company.referrer.email}</p>
                </div>
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
                  {application.purpose && (
                    <p>
                      <span className="font-medium">Purpose:</span> {application.purpose}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No company information available</p>
              )}
            </CardContent>
          </Card>

          {/* Lender Submissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Lender Submissions</h2>
                <Badge variant="default">{lenderSubmissions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {lenderSubmissions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">Not yet submitted to lenders</p>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {lenderSubmissions.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{sub.lender?.name || 'Unknown Lender'}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {sub.submission_method.toUpperCase()} • {sub.sent_at ? new Date(sub.sent_at).toLocaleDateString('en-GB') : 'Not sent'}
                        </p>
                        {sub.last_error && (
                          <p className="text-xs text-[var(--color-error)] mt-1">{sub.last_error}</p>
                        )}
                      </div>
                      <Badge variant={
                        sub.status === 'sent' || sub.status === 'acknowledged' ? 'success' :
                        sub.status === 'failed' ? 'error' :
                        sub.status === 'retry' ? 'warning' : 'default'
                      }>
                        {sub.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
            <CardContent className="space-y-4">
              {/* Upload form */}
              <div className="space-y-3 pb-4 border-b border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Upload Document</p>
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
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </Button>
              </div>

              {/* Documents list */}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Delete Application?</h3>
            <p className="text-[var(--color-text-secondary)] mb-4">
              This will permanently delete this application and all associated documents, information requests, lender submissions, and offers. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteApplication}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Application'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}