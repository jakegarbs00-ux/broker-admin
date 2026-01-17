'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, getStageBadgeVariant, formatStage, Button, EmptyState } from '@/components/ui';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { ApplicationsChart } from '@/components/dashboard/ApplicationsChart';
import { ApplicationsOverTimeChart } from '@/components/dashboard/ApplicationsOverTimeChart';
import { QuickActionsPanel } from '@/components/dashboard/QuickActionsPanel';
import { FileText, TrendingUp, PoundSterling, Calendar, CheckCircle2, Circle, AlertTriangle, Upload, Building2, ExternalLink, MessageSquare } from 'lucide-react';

type Company = { id: string; name: string };

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
  submitted_at?: string | null;
  company_id?: string;
  company_name?: string;
  purpose?: string | null;
  referrer?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
};

type InfoRequest = {
  id: string;
  title?: string | null;
  message: string;
  status: string;
  created_at: string;
};

type Offer = {
  id: string;
  amount: number;
  loan_term: string;
  cost_of_funding: string;
  repayments: string;
  status: string;
  lender?: {
    id: string;
    name: string;
  } | null;
};

type Document = {
  id: string;
  category: string;
  original_filename: string;
  created_at: string;
};

type ReferredClient = {
  id: string;
  email: string | null;
  companies: { id: string; name: string }[] | null;
};

function ClientDashboardContent({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  // Removed useUserProfile dependency - query profile directly in useEffect
  const [application, setApplication] = useState<Application | null>(null);
  const [company, setCompany] = useState<{ id: string; name: string; company_number?: string | null; industry?: string | null } | null>(null);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgressApp, setInProgressApp] = useState<Application | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // CRITICAL: Verify authenticated user ID matches userId prop
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== userId) {
        console.error('[ClientDashboard] SECURITY: User ID mismatch');
        setLoading(false);
        return;
      }

      // Query profile directly - don't depend on hook state
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .maybeSingle();

      // First, check if user has a company
      if (profileData?.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
          .select('id, name, company_number, industry')
          .eq('id', profileData.company_id)
        .maybeSingle();

        if (companyData) {
          setCompany(companyData);
        }
      }

      // Load the most recent application (prioritize submitted, then created)
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, requested_amount, loan_type, stage, created_at, submitted_at, company_id, purpose')
        .eq('created_by', currentUser.id) // Use created_by instead of owner_id
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appsData) {
        setApplication(appsData as Application);

        // Load company info if not already loaded
        if (appsData.company_id && !company) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('id, name, company_number, industry')
            .eq('id', appsData.company_id)
            .maybeSingle();
          
          if (companyData) {
            setCompany(companyData);
          }
        }

        // Load information requests
        const { data: requestsData } = await supabase
          .from('information_requests')
          .select('id, title, message, status, created_at')
          .eq('application_id', appsData.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (requestsData) {
          setInfoRequests(requestsData as InfoRequest[]);
        }

        // Load offers (if stage allows)
        if (['approved', 'onboarding', 'funded', 'withdrawn', 'declined'].includes(appsData.stage)) {
          const { data: offersData } = await supabase
            .from('offers')
            .select('*, lender:lender_id(id, name)')
            .eq('application_id', appsData.id)
            .order('created_at', { ascending: false });

          if (offersData) {
            setOffers(offersData as Offer[]);
          }
        }

        // Load documents
        const { data: docsData } = await supabase
          .from('documents')
          .select('id, category, original_filename, created_at')
          .eq('application_id', appsData.id)
          .order('created_at', { ascending: false });

        if (docsData) {
          setDocuments(docsData as Document[]);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase, userId]); // Removed profile dependency - query it directly

  // Load open application if no submitted application exists
  // Open = any application not in closed stages (funded, declined, withdrawn)
  useEffect(() => {
    const loadOpenApp = async () => {
      if (application) return; // Don't load if we already have a submitted app
      
      // CRITICAL: Verify authenticated user ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== userId) {
        return;
      }

      // Check for any open application (not closed)
      const closedStages = ['funded', 'declined', 'withdrawn'];
      
      const { data: openApp } = await supabase
        .from('applications')
        .select('id, requested_amount, purpose, stage, created_at')
        .eq('created_by', currentUser.id)
        .not('stage', 'in', `(${closedStages.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (openApp) {
        setInProgressApp(openApp as Application);
      }
    };
    
    if (!loading) {
      loadOpenApp();
    }
  }, [application, userId, supabase, loading]);

  const getStageStatus = (stage: string) => {
    const stages = ['created', 'submitted', 'in_credit', 'approved', 'funded'];
    const currentIndex = stages.indexOf(stage);
    return {
      currentIndex,
      stages: stages.map((s, i) => ({
        name: s,
        label: formatStage(s),
        completed: i < currentIndex,
        current: i === currentIndex,
      })),
    };
  };

  const getStatusMessage = (stage: string) => {
    const messages: Record<string, string> = {
      created: 'Your application has been created and is ready to submit.',
      submitted: 'Your application is being reviewed by our team.',
      in_credit: 'Your application is in credit review.',
      info_required: 'We need some additional information from you.',
      approved: 'Your application has been approved! Check your offers below.',
      onboarding: 'Your application is in the onboarding process.',
      funded: 'Congratulations! Your funding has been completed.',
      declined: 'Unfortunately, your application was declined.',
      withdrawn: 'Your application has been withdrawn.',
    };
    return messages[stage] || 'Your application is being processed.';
  };

  const getNextSteps = (stage: string) => {
    const steps: Record<string, string> = {
      created: 'Submit your application to begin the review process.',
      submitted: 'Our team will review your application and may request additional information.',
      in_credit: 'Our credit team is reviewing your application. This typically takes 2-3 business days.',
      info_required: 'Please respond to the information requests below to continue.',
      approved: 'Review your offers below and accept the one that works best for you.',
      onboarding: 'Complete the onboarding process to receive your funding.',
      funded: 'Your funding is complete. Check your account for details.',
    };
    return steps[stage] || 'We will keep you updated on your application status.';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const formatFundingPurpose = (purpose: string | null | undefined): string => {
    if (!purpose) return 'Funding';
    
    const labels: Record<string, string> = {
      'working-capital': 'Working Capital',
      'working_capital': 'Working Capital',
      'stock-inventory': 'Stock/Inventory',
      'stock_inventory': 'Stock/Inventory',
      'equipment': 'Equipment',
      'expansion': 'Expansion',
      'cash-flow': 'Cash Flow',
      'cash_flow': 'Cash Flow',
      'other': 'Other',
    };
    
    return labels[purpose] || purpose;
  };

  const formatLoanType = (type: string) => {
    const types: Record<string, string> = {
      term_loan: 'Term Loan',
      revolving_credit: 'Revolving Credit',
      invoice_finance: 'Invoice Finance',
      asset_finance: 'Asset Finance',
    };
    return types[type] || type;
  };

  const groupDocumentsByCategory = () => {
    const grouped: Record<string, Document[]> = {};
    documents.forEach((doc) => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = [];
      }
      grouped[doc.category].push(doc);
    });
    return grouped;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bank_statements: 'Bank Statements',
      filed_accounts: 'Filed Accounts',
      management_accounts: 'Management Accounts',
      cashflow_forecast: 'Cashflow Forecast',
      other: 'Other Documents',
    };
    return labels[category] || category;
  };

  const handleRespondToRequest = (requestId: string) => {
    if (application) {
      router.push(`/applications/${application.id}?request=${requestId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!application && !inProgressApp) {
  return (
    <>
      <PageHeader
        title="Dashboard"
          description="Get matched with lenders in minutes."
        />
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
              Ready to apply for funding?
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Get matched with lenders in minutes.
            </p>
            <Link href="/apply">
              <Button variant="primary" size="lg" className="px-8">
                Start Application
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  if (!application && inProgressApp) {
    // Check if it's a draft (created) or in-progress (submitted, etc.)
    const isDraft = inProgressApp.stage === 'created';
    
    return (
      <>
        <PageHeader
          title="Dashboard"
          description={isDraft ? "Continue your application or start a new one." : "View your application status."}
        />
        <Card className="max-w-2xl mx-auto border-l-4 border-l-[var(--color-accent)]">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {isDraft ? 'Continue your application' : 'Your application is in progress'}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {isDraft 
                ? 'You have an application in progress. Continue where you left off.'
                : 'Your application is being reviewed. Click below to view details and status.'
              }
            </p>
            <Link href={isDraft ? '/apply' : `/applications/${inProgressApp.id}`}>
              <Button variant="primary">
                {isDraft ? 'Continue Application' : 'View Application'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  // At this point, application must be non-null (guarded by early returns above)
  if (!application) {
    return null;
  }

  const stageStatus = getStageStatus(application.stage);
  const groupedDocuments = groupDocumentsByCategory();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Track your funding application status and manage your account."
      />

      {/* Application Status Hero Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  Your Application
                </h2>
                <Badge variant={getStageBadgeVariant(application.stage)}>
                  {formatStage(application.stage)} {application.stage === 'submitted' && '✓'}
                </Badge>
              </div>

              <div className="space-y-3 mb-6">
                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {formatCurrency(application.requested_amount)} for {formatFundingPurpose(application.purpose)}
                </div>
                {application.submitted_at && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[var(--color-text-secondary)]">Submitted:</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {new Date(application.submitted_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Stage Pipeline */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {['created', 'submitted', 'in_credit', 'approved', 'funded'].map((stageName, index) => {
                    const isCompleted = stageStatus.currentIndex > index;
                    const isCurrent = stageStatus.currentIndex === index;
                    const labels: Record<string, string> = {
                      created: 'Created',
                      submitted: 'Submitted',
                      in_credit: 'Reviewing',
                      approved: 'Approved',
                      funded: 'Funded',
                    };
                    
                    return (
                      <div key={stageName} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                              isCompleted
                                ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                                : isCurrent
                                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                                : 'bg-white border-[var(--color-border)] text-[var(--color-text-tertiary)]'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </div>
                          <span className="text-xs text-[var(--color-text-secondary)] mt-2 text-center">
                            {labels[stageName]}
                          </span>
                        </div>
                        {index < 4 && (
                          <div
                            className={`h-0.5 flex-1 mx-2 ${
                              isCompleted ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {application.stage === 'submitted' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    We'll review and be in touch within 24-48 hours.
                  </p>
                </div>
              )}
              {application.stage !== 'submitted' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {getStatusMessage(application.stage)}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {getNextSteps(application.stage)}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:w-64">
              <Link href={`/applications/${application.id}`}>
                <Button variant="primary" className="w-full">
                  View Full Details
                </Button>
              </Link>
            </div>
          </div>
            </CardContent>
          </Card>

      {/* Action Required Section */}
      {infoRequests.length > 0 && (
        <Card className="mb-6 border-l-4 border-l-[var(--color-warning)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Action Required
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {infoRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-bg-tertiary)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {request.title && (
                        <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                          {request.title}
                        </h3>
                      )}
                      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                        {request.message}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Requested: {new Date(request.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleRespondToRequest(request.id)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Respond
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offers Section */}
      {offers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Your Offers</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {offers.map((offer, index) => (
                <div
                  key={offer.id}
                  className={`border rounded-lg p-5 transition-all ${
                    offer.status === 'pending'
                      ? 'border-[var(--color-success)] bg-green-50 shadow-sm'
                      : offer.status === 'accepted'
                      ? 'border-[var(--color-accent)] bg-blue-50'
                      : 'border-[var(--color-border)] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {offer.lender?.name || `Offer ${index + 1}`}
                        </span>
                        {offer.status === 'accepted' && (
                          <Badge variant="success">Accepted</Badge>
                        )}
                        {offer.status === 'declined' && (
                          <Badge variant="error">Declined</Badge>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                        {formatCurrency(offer.amount)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-[var(--color-text-secondary)]">Term:</span>
                      <span className="font-medium text-[var(--color-text-primary)] ml-2">
                        {offer.loan_term}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">Monthly Repayment:</span>
                      <span className="font-medium text-[var(--color-text-primary)] ml-2">
                        {offer.repayments}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-secondary)]">Total Cost:</span>
                      <span className="font-medium text-[var(--color-text-primary)] ml-2">
                        {offer.cost_of_funding}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/applications/${application.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full">
                        View Details
                </Button>
              </Link>
                    {offer.status === 'pending' && (
                      <Link href={`/applications/${application.id}`} className="flex-1">
                <Button variant="primary" className="w-full">
                          Accept Offer
              </Button>
              </Link>
            )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents Section */}
        <div className="lg:col-span-2">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Documents</h2>
                <Link href={`/applications/${application.id}`}>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload More
                  </Button>
            </Link>
          </div>
        </CardHeader>
            <CardContent>
              {Object.keys(groupedDocuments).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    No documents uploaded yet
                  </p>
                  <Link href={`/applications/${application.id}`}>
                    <Button variant="primary" size="sm">
                      Upload Documents
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedDocuments).map(([category, docs]) => (
                    <div key={category} className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
                      <h3 className="font-medium text-[var(--color-text-primary)] mb-2 text-sm">
                        {getCategoryLabel(category)}
                      </h3>
                      <ul className="space-y-1">
                        {docs.map((doc) => (
                          <li
                            key={doc.id}
                            className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                            <span>{doc.original_filename}</span>
                            <span className="text-xs text-[var(--color-text-tertiary)]">
                              ({new Date(doc.created_at).toLocaleDateString('en-GB')})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Company Info Card */}
                  <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Company</h2>
              </div>
            </CardHeader>
            <CardContent>
              {company ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {company.name}
                    </p>
                    {company.company_number && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        Company No: {company.company_number}
                      </p>
                    )}
                    {company.industry && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {company.industry}
                      </p>
                    )}
                  </div>
                  <Link href="/company">
                    <Button variant="secondary" className="w-full" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    No company information
                  </p>
                  <Link href="/apply">
                    <Button variant="primary" size="sm">
                      Complete Profile
                    </Button>
                </Link>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </>
  );
}

function PartnerDashboardContent({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [referralLink, setReferralLink] = useState('');
  const [clients, setClients] = useState<ReferredClient[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalApplications: 0,
    openApplications: 0,
    fundedAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReferralLink(`${window.location.origin}/auth/signup?ref=${userId}`);
    }
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      // CRITICAL: Verify authenticated user ID matches userId prop
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== userId) {
        console.error('[PartnerDashboard] SECURITY: User ID mismatch');
        setLoading(false);
        return;
      }

      // Get user's partner_company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', currentUser.id) // Use authenticated user ID
        .maybeSingle(); // Use maybeSingle to avoid errors

      if (!userProfile?.partner_company_id) {
        console.warn('[PartnerDashboard] No partner_company_id found for user');
        // Initialize with empty stats for users without a partner company
        setStats({
          totalCompanies: 0,
          totalApplications: 0,
          openApplications: 0,
          fundedAmount: 0,
        });
        setLoading(false);
        return;
      }

      // Get all partner user IDs in this partner company
      const { data: partnerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('partner_company_id', userProfile.partner_company_id)
        .eq('role', 'PARTNER');

      const partnerUserIds = (partnerUsers || []).map((u) => u.id);

      if (partnerUserIds.length === 0) {
        console.warn('[PartnerDashboard] No partner users found in company');
        // Initialize with empty stats
        setStats({
          totalCompanies: 0,
          totalApplications: 0,
          openApplications: 0,
          fundedAmount: 0,
        });
        setLoading(false);
        return;
      }

      // Get ALL companies under this partner company (via partner_company_id) with referrer info
      const { data: referredCompanies, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          industry,
          created_at,
          referred_by,
          referrer:referred_by(id, first_name, last_name, email)
        `)
        .eq('partner_company_id', userProfile.partner_company_id)
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Error loading referred companies', companiesError);
        setLoading(false);
        return;
      }

      const companyIds = (referredCompanies ?? []).map((c) => c.id) as string[];
      const companyMap: Record<string, { name: string; referrer?: { first_name: string | null; last_name: string | null; email: string } | null }> = {};
      (referredCompanies || []).forEach((c: any) => {
        companyMap[c.id] = {
          name: c.name,
          referrer: c.referrer || null,
        };
      });

      // Load referred clients (profiles linked to these companies)
      if (companyIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('profiles')
          .select('id, email, company_id')
          .in('company_id', companyIds)
          .eq('role', 'CLIENT');

        if (clientsData) {
          const enrichedClients = clientsData.map((c: any) => ({
            id: c.id,
            email: c.email,
            companies: c.company_id ? [{ id: c.company_id, name: companyMap[c.company_id]?.name || 'Unknown' }] : null,
          }));
          setClients(enrichedClients as ReferredClient[]);
        }
      }

      // Load all applications for these companies
      if (companyIds.length > 0) {
        const { data: appsData } = await supabase
          .from('applications')
          .select('id, requested_amount, loan_type, stage, created_at, company_id')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false });

        const enrichedApps = (appsData || []).map((a: any) => ({
          ...a,
          company_name: companyMap[a.company_id]?.name || 'Unknown',
          referrer: companyMap[a.company_id]?.referrer || null,
        }));

        setApplications(enrichedApps);

        // Calculate stats
        const closedStages = ['funded', 'declined', 'withdrawn'];
        const openApps = enrichedApps.filter((a: Application) => !closedStages.includes(a.stage));
        const fundedApps = enrichedApps.filter((a: Application) => a.stage === 'funded');
        const fundedTotal = fundedApps.reduce((sum: number, a: Application) => sum + (a.requested_amount || 0), 0);

        setStats({
          totalCompanies: (referredCompanies || []).length,
          totalApplications: enrichedApps.length,
          openApplications: openApps.length,
          fundedAmount: fundedTotal,
        });
      } else {
        // No companies - initialize stats with empty data
        setStats({
          totalCompanies: (referredCompanies || []).length,
          totalApplications: 0,
          openApplications: 0,
          fundedAmount: 0,
        });
      }

      setLoading(false);
    };

    loadData();
  }, [supabase, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading partner dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Partner Dashboard"
        description="Manage your referred clients and track their applications."
        actions={
          <Link href="/partner/companies/new">
            <Button variant="primary">
              + Add Company
            </Button>
          </Link>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Referred Companies</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Applications</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Open Applications</p>
            <p className="text-2xl font-bold text-purple-600">{stats.openApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Funded</p>
            <p className="text-2xl font-bold text-green-600">£{stats.fundedAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">All Applications</h2>
                <Badge variant="default">{applications.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Applications from your referred companies will appear here."
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.slice(0, 10).map((app) => (
                    <Link
                      key={app.id}
                      href={`/partner/applications/${app.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {app.company_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          £{app.requested_amount?.toLocaleString()} – {app.loan_type}
                        </p>
                        {app.referrer && (
                          <p className="text-xs text-gray-500 mt-1">
                            Referred by: {app.referrer.first_name} {app.referrer.last_name}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(app.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <Badge variant={getStageBadgeVariant(app.stage)}>
                        {formatStage(app.stage)}
                      </Badge>
                    </Link>
                  ))}
                  {applications.length > 10 && (
                    <div className="px-6 py-4 text-center">
                      <Link
                        href="/partner/applications"
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        View all {applications.length} applications →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Referral Link */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Your Referral Link</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">
                Share this link with clients to automatically link them to you.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (navigator.clipboard && referralLink) {
                      navigator.clipboard.writeText(referralLink);
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Quick Actions</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/partner/companies/new" className="block">
                <Button variant="primary" className="w-full">
                  + Add New Company
                </Button>
              </Link>
              <Link href="/partner/companies" className="block">
                <Button variant="secondary" className="w-full">
                  View All Companies
                </Button>
              </Link>
              <Link href="/partner/company" className="block">
                <Button variant="secondary" className="w-full">
                  Your Company Info
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Companies summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Your Companies</h2>
                <Link href="/partner/companies" className="text-sm text-purple-600 hover:text-purple-700">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {clients.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm text-gray-500">No companies referred yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {clients.slice(0, 5).map((client) => (
                    <div key={client.id} className="px-4 py-3">
                      {client.companies && client.companies[0] ? (
                        <Link
                          href={`/partner/companies/${client.companies[0].id}`}
                          className="font-medium text-gray-900 hover:text-purple-600"
                        >
                          {client.companies[0].name}
                        </Link>
                      ) : (
                        <p className="text-gray-500">No company</p>
                      )}
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useUserProfile();
  const router = useRouter();
  const [checkingClient, setCheckingClient] = useState(true);

  useEffect(() => {
    const checkClientRequirements = async () => {
      if (loading || !user || !profile) {
        return;
      }

      const role = profile.role as 'CLIENT' | 'PARTNER' | 'ADMIN';

      // Only check for CLIENT users
      if (role !== 'CLIENT') {
        setCheckingClient(false);
        return;
      }

      const supabase = getSupabaseClient();

      // CRITICAL: Verify authenticated user ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[Dashboard] SECURITY: User ID mismatch');
        setCheckingClient(false);
        return;
      }

      // Check if CLIENT user has any applications (submitted or in progress)
      const { data: applications, error } = await supabase
        .from('applications')
        .select('id, stage')
        .eq('created_by', currentUser.id) // Use created_by instead of owner_id
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking applications:', error);
        setCheckingClient(false);
        return;
      }

      // Only redirect to /apply if:
      // 1. User has no company_id AND no applications, OR
      // 2. User has company_id but no applications at all
      if (!profile.company_id && (!applications || applications.length === 0)) {
        router.push('/apply');
        return;
      }

      if (profile.company_id && (!applications || applications.length === 0)) {
        // User has company but no application - let them see dashboard with "Start Application" prompt
        // Don't redirect, just show the prompt
        setCheckingClient(false);
        return;
      }

      setCheckingClient(false);
    };

    checkClientRequirements();
  }, [user, profile, loading, router]);

  if (loading || checkingClient) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }
  
  if (!user || !profile) return null;

  const role = profile.role as 'CLIENT' | 'PARTNER' | 'ADMIN';

  // Admins get redirected to admin dashboard
  if (role === 'ADMIN') {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/applications';
    }
    return null;
  }

  // CLIENT users should use the client dashboard (handled by route group)
  // This page is for PARTNER users only

  return (
    <DashboardShell>
      {role === 'CLIENT' && <ClientDashboardContent userId={user.id} />}
      {role === 'PARTNER' && <PartnerDashboardContent userId={user.id} />}
    </DashboardShell>
  );
}
