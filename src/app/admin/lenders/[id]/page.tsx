'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button, getStageBadgeVariant, formatStage } from '@/components/ui';

type Lender = {
  id: string;
  name: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  submission_method: 'api' | 'email' | null;
  api_endpoint: string | null;
  api_auth_type: string | null;
  submission_email: string | null;
  created_at: string;
  // Eligibility criteria fields
  min_trading_months: number | null;
  min_monthly_revenue: number | null;
  max_monthly_revenue_multiple: number | null;
  max_annual_revenue_percentage: number | null;
  absolute_min_loan: number | null;
  absolute_max_loan: number | null;
  accepted_business_types: string[] | null;
  prohibited_industries: string[] | null;
  requires_filed_accounts: boolean | null;
  min_filed_accounts_years: number | null;
  accepts_ccjs: boolean | null;
  max_ccj_value: number | null;
  requires_homeowner: boolean | null;
  homeowner_min_loan: number | null;
  requires_card_payments: boolean | null;
  min_card_payment_percentage: number | null;
  requires_existing_lending: boolean | null;
  max_existing_lenders: number | null;
  min_term_months: number | null;
  max_term_months: number | null;
  funding_speed: string | null;
  repayment_type: string | null;
  product_type: string | null;
  is_eligible_panel: boolean | null;
  min_profit_margin_percentage: number | null;
  requires_profitable: boolean | null;
  min_net_assets_ratio: number | null;
  requires_positive_net_assets: boolean | null;
};

type LenderSubmission = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  application_id: string;
  application: {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
    company: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export default function AdminLenderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();


  const [lender, setLender] = useState<Lender | null>(null);
  const [submissions, setSubmissions] = useState<LenderSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    submission_method: 'email' as 'api' | 'email' | null,
    api_endpoint: '',
    api_auth_type: '',
    submission_email: '',
    // Eligibility criteria
    min_trading_months: null as number | null,
    min_monthly_revenue: null as number | null,
    max_monthly_revenue_multiple: null as number | null,
    max_annual_revenue_percentage: null as number | null,
    absolute_min_loan: null as number | null,
    absolute_max_loan: null as number | null,
    accepted_business_types: [] as string[],
    prohibited_industries: [] as string[],
    requires_filed_accounts: false,
    min_filed_accounts_years: null as number | null,
    accepts_ccjs: false,
    max_ccj_value: null as number | null,
    requires_homeowner: false,
    homeowner_min_loan: null as number | null,
    requires_card_payments: false,
    min_card_payment_percentage: null as number | null,
    requires_existing_lending: false,
    max_existing_lenders: null as number | null,
    min_term_months: null as number | null,
    max_term_months: null as number | null,
    funding_speed: '',
    repayment_type: '',
    product_type: '',
    is_eligible_panel: false,
    min_profit_margin_percentage: null as number | null,
    requires_profitable: false,
    min_net_assets_ratio: null as number | null,
    requires_positive_net_assets: false,
  });

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Load lender
      const { data: lenderData, error: lenderError } = await supabase
        .from('lenders')
        .select('*')
        .eq('id', id)
        .single();

      if (lenderError) {
        setError('Lender not found');
        setLoadingData(false);
        return;
      }

      setLender(lenderData as Lender);
      setFormData({
        name: lenderData.name || '',
        contact_email: lenderData.contact_email || '',
        contact_phone: lenderData.contact_phone || '',
        notes: lenderData.notes || '',
        submission_method: lenderData.submission_method || 'email',
        api_endpoint: lenderData.api_endpoint || '',
        api_auth_type: lenderData.api_auth_type || '',
        submission_email: lenderData.submission_email || '',
        // Eligibility criteria
        min_trading_months: lenderData.min_trading_months ?? null,
        min_monthly_revenue: lenderData.min_monthly_revenue ?? null,
        max_monthly_revenue_multiple: lenderData.max_monthly_revenue_multiple ?? null,
        max_annual_revenue_percentage: lenderData.max_annual_revenue_percentage ?? null,
        absolute_min_loan: lenderData.absolute_min_loan ?? null,
        absolute_max_loan: lenderData.absolute_max_loan ?? null,
        accepted_business_types: lenderData.accepted_business_types || [],
        prohibited_industries: lenderData.prohibited_industries || [],
        requires_filed_accounts: lenderData.requires_filed_accounts ?? false,
        min_filed_accounts_years: lenderData.min_filed_accounts_years ?? null,
        accepts_ccjs: lenderData.accepts_ccjs ?? false,
        max_ccj_value: lenderData.max_ccj_value ?? null,
        requires_homeowner: lenderData.requires_homeowner ?? false,
        homeowner_min_loan: lenderData.homeowner_min_loan ?? null,
        requires_card_payments: lenderData.requires_card_payments ?? false,
        min_card_payment_percentage: lenderData.min_card_payment_percentage ?? null,
        requires_existing_lending: lenderData.requires_existing_lending ?? false,
        max_existing_lenders: lenderData.max_existing_lenders ?? null,
        min_term_months: lenderData.min_term_months ?? null,
        max_term_months: lenderData.max_term_months ?? null,
        funding_speed: lenderData.funding_speed || '',
        repayment_type: lenderData.repayment_type || '',
        product_type: lenderData.product_type || '',
        is_eligible_panel: lenderData.is_eligible_panel ?? false,
        min_profit_margin_percentage: lenderData.min_profit_margin_percentage ?? null,
        requires_profitable: lenderData.requires_profitable ?? false,
        min_net_assets_ratio: lenderData.min_net_assets_ratio ?? null,
        requires_positive_net_assets: lenderData.requires_positive_net_assets ?? false,
      });

      // Load lender submissions
      const { data: submissionsData } = await supabase
        .from('lender_submissions')
        .select('*')
        .eq('lender_id', id)
        .order('created_at', { ascending: false });

      // Get unique application IDs
      const applicationIds = Array.from(new Set(submissionsData?.map(s => s.application_id).filter(Boolean) || []));

      // Fetch applications with their companies
      let applicationsMap: Record<string, any> = {};
      if (applicationIds.length > 0) {
        const { data: applicationsData } = await supabase
          .from('applications')
          .select(`
            id,
            requested_amount,
            loan_type,
            stage,
            created_at,
            company:company_id(id, name)
          `)
          .in('id', applicationIds);
        
        applicationsData?.forEach(app => {
          // Transform company from array to single object
          const company = Array.isArray(app.company) ? (app.company[0] || null) : app.company;
          applicationsMap[app.id] = {
            ...app,
            company: company,
          };
        });
      }

      // Combine the data
      const enrichedSubmissions = submissionsData?.map(sub => ({
        ...sub,
        application: applicationsMap[sub.application_id] || null
      })) || [];

      setSubmissions(enrichedSubmissions as LenderSubmission[]);
      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const handleSave = async () => {
    // Validation
    if (formData.absolute_min_loan !== null && formData.absolute_max_loan !== null) {
      if (formData.absolute_min_loan >= formData.absolute_max_loan) {
        alert('Minimum loan amount must be less than maximum loan amount');
        setSaving(false);
        return;
      }
    }
    if (formData.min_term_months !== null && formData.max_term_months !== null) {
      if (formData.min_term_months >= formData.max_term_months) {
        alert('Minimum term must be less than maximum term');
        setSaving(false);
        return;
      }
    }
    if (formData.requires_filed_accounts && (!formData.min_filed_accounts_years || formData.min_filed_accounts_years < 1)) {
      alert('If filed accounts are required, minimum years must be at least 1');
      setSaving(false);
      return;
    }
    if (formData.requires_card_payments && (!formData.min_card_payment_percentage || formData.min_card_payment_percentage <= 0)) {
      alert('If card payments are required, minimum percentage must be greater than 0');
      setSaving(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('lenders')
      .update({
        name: formData.name.trim(),
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        notes: formData.notes.trim() || null,
        submission_method: formData.submission_method || null,
        api_endpoint: formData.api_endpoint.trim() || null,
        api_auth_type: formData.api_auth_type.trim() || null,
        submission_email: formData.submission_email.trim() || null,
        // Eligibility criteria
        min_trading_months: formData.min_trading_months || null,
        min_monthly_revenue: formData.min_monthly_revenue || null,
        max_monthly_revenue_multiple: formData.max_monthly_revenue_multiple || null,
        max_annual_revenue_percentage: formData.max_annual_revenue_percentage || null,
        absolute_min_loan: formData.absolute_min_loan || null,
        absolute_max_loan: formData.absolute_max_loan || null,
        accepted_business_types: formData.accepted_business_types.length > 0 ? formData.accepted_business_types : null,
        prohibited_industries: formData.prohibited_industries.length > 0 ? formData.prohibited_industries : null,
        requires_filed_accounts: formData.requires_filed_accounts,
        min_filed_accounts_years: formData.requires_filed_accounts ? (formData.min_filed_accounts_years || null) : null,
        accepts_ccjs: formData.accepts_ccjs,
        max_ccj_value: formData.accepts_ccjs ? (formData.max_ccj_value || null) : null,
        requires_homeowner: formData.requires_homeowner,
        homeowner_min_loan: formData.requires_homeowner ? (formData.homeowner_min_loan || null) : null,
        requires_card_payments: formData.requires_card_payments,
        min_card_payment_percentage: formData.requires_card_payments ? (formData.min_card_payment_percentage || null) : null,
        requires_existing_lending: formData.requires_existing_lending,
        max_existing_lenders: formData.max_existing_lenders || null,
        min_term_months: formData.min_term_months || null,
        max_term_months: formData.max_term_months || null,
        funding_speed: formData.funding_speed.trim() || null,
        repayment_type: formData.repayment_type.trim() || null,
        product_type: formData.product_type.trim() || null,
        is_eligible_panel: formData.is_eligible_panel,
        min_profit_margin_percentage: formData.min_profit_margin_percentage || null,
        requires_profitable: formData.requires_profitable,
        min_net_assets_ratio: formData.min_net_assets_ratio || null,
        requires_positive_net_assets: formData.requires_positive_net_assets,
      })
      .eq('id', id);

    if (error) {
      alert('Error saving: ' + error.message);
    } else {
      setLender((prev) => prev ? {
        ...prev,
        name: formData.name.trim(),
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        notes: formData.notes.trim() || null,
        submission_method: formData.submission_method || null,
        api_endpoint: formData.api_endpoint.trim() || null,
        api_auth_type: formData.api_auth_type.trim() || null,
        submission_email: formData.submission_email.trim() || null,
        // Eligibility criteria
        min_trading_months: formData.min_trading_months,
        min_monthly_revenue: formData.min_monthly_revenue,
        max_monthly_revenue_multiple: formData.max_monthly_revenue_multiple,
        max_annual_revenue_percentage: formData.max_annual_revenue_percentage,
        absolute_min_loan: formData.absolute_min_loan,
        absolute_max_loan: formData.absolute_max_loan,
        accepted_business_types: formData.accepted_business_types.length > 0 ? formData.accepted_business_types : null,
        prohibited_industries: formData.prohibited_industries.length > 0 ? formData.prohibited_industries : null,
        requires_filed_accounts: formData.requires_filed_accounts,
        min_filed_accounts_years: formData.requires_filed_accounts ? formData.min_filed_accounts_years : null,
        accepts_ccjs: formData.accepts_ccjs,
        max_ccj_value: formData.accepts_ccjs ? formData.max_ccj_value : null,
        requires_homeowner: formData.requires_homeowner,
        homeowner_min_loan: formData.requires_homeowner ? formData.homeowner_min_loan : null,
        requires_card_payments: formData.requires_card_payments,
        min_card_payment_percentage: formData.requires_card_payments ? formData.min_card_payment_percentage : null,
        requires_existing_lending: formData.requires_existing_lending,
        max_existing_lenders: formData.max_existing_lenders,
        min_term_months: formData.min_term_months,
        max_term_months: formData.max_term_months,
        funding_speed: formData.funding_speed.trim() || null,
        repayment_type: formData.repayment_type.trim() || null,
        product_type: formData.product_type.trim() || null,
        is_eligible_panel: formData.is_eligible_panel,
        min_profit_margin_percentage: formData.min_profit_margin_percentage,
        requires_profitable: formData.requires_profitable,
        min_net_assets_ratio: formData.min_net_assets_ratio,
        requires_positive_net_assets: formData.requires_positive_net_assets,
      } : null);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lender? Applications will be unassigned.')) return;

    // Unassign applications first
    await supabase
      .from('applications')
      .update({ accepted_lender_id: null })
      .eq('accepted_lender_id', id);

    const { error } = await supabase
      .from('lenders')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting: ' + error.message);
    } else {
      router.push('/admin/lenders');
    }
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-secondary)]">Loading lender...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)]">You don't have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!lender) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)]">Lender not found.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title={lender.name}
        description="Lender details and eligibility criteria"
        actions={
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button variant="primary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            <Button variant="secondary" onClick={handleDelete} className="text-[var(--color-error)] hover:bg-[var(--color-error-light)]">
              Delete
            </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Eligibility & Applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Eligibility Criteria Card - this is now the primary focus */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Eligibility Criteria</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Configure criteria for the website eligibility checker</p>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-5">
                  {/* Panel Toggle - full width */}
                  <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text-primary)]">Show in Eligibility Checker</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">Enable to include in website results</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_eligible_panel}
                        onChange={(e) => setFormData((p) => ({ ...p, is_eligible_panel: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                    </label>
                  </div>

                  {formData.is_eligible_panel && (
                    <>
                      {/* Section: Product & Speed */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5">Product Type</label>
                          <select className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.product_type || ''} onChange={(e) => setFormData((p) => ({ ...p, product_type: e.target.value }))}>
                            <option value="">Select...</option>
                            <option value="revenue-based">Revenue-Based</option>
                            <option value="short-term">Short-Term</option>
                            <option value="term-loan">Term Loan</option>
                            <option value="mca">MCA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5">Funding Speed</label>
                          <input type="text" placeholder="e.g. 24-48 hours" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.funding_speed} onChange={(e) => setFormData((p) => ({ ...p, funding_speed: e.target.value }))} />
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Trading Requirements */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Trading Requirements</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Trading (months)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_trading_months || ''} onChange={(e) => setFormData((p) => ({ ...p, min_trading_months: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Monthly Revenue (£)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_monthly_revenue || ''} onChange={(e) => setFormData((p) => ({ ...p, min_monthly_revenue: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Loan Limits */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Loan Limits</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Loan (£)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.absolute_min_loan || ''} onChange={(e) => setFormData((p) => ({ ...p, absolute_min_loan: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Maximum Loan (£)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.absolute_max_loan || ''} onChange={(e) => setFormData((p) => ({ ...p, absolute_max_loan: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Max Monthly Revenue Multiple</label>
                            <input type="number" step="0.1" placeholder="e.g. 2.0" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.max_monthly_revenue_multiple || ''} onChange={(e) => setFormData((p) => ({ ...p, max_monthly_revenue_multiple: e.target.value ? parseFloat(e.target.value) : null }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Max Annual Revenue %</label>
                            <input type="number" placeholder="e.g. 25" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.max_annual_revenue_percentage || ''} onChange={(e) => setFormData((p) => ({ ...p, max_annual_revenue_percentage: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Terms */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Terms</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Term (months)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_term_months || ''} onChange={(e) => setFormData((p) => ({ ...p, min_term_months: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Maximum Term (months)</label>
                            <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.max_term_months || ''} onChange={(e) => setFormData((p) => ({ ...p, max_term_months: e.target.value ? parseInt(e.target.value) : null }))} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Repayment Type</label>
                            <select className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.repayment_type || ''} onChange={(e) => setFormData((p) => ({ ...p, repayment_type: e.target.value }))}>
                              <option value="">Select...</option>
                              <option value="Daily DD">Daily DD</option>
                              <option value="Weekly DD">Weekly DD</option>
                              <option value="Monthly DD">Monthly DD</option>
                              <option value="Revenue sweep">Revenue Sweep</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Financial Health */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Financial Health</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_profitable} onChange={(e) => setFormData(p => ({...p, requires_profitable: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires profitable business</span>
                            </label>
                            <div>
                              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Profit Margin %</label>
                              <input type="number" step="0.5" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_profit_margin_percentage || ''} onChange={(e) => setFormData((p) => ({ ...p, min_profit_margin_percentage: e.target.value ? parseFloat(e.target.value) : null }))} />
                            </div>
                          </div>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_positive_net_assets} onChange={(e) => setFormData(p => ({...p, requires_positive_net_assets: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires positive balance sheet</span>
                            </label>
                            <div>
                              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum Net Assets Ratio %</label>
                              <input type="number" step="0.5" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_net_assets_ratio || ''} onChange={(e) => setFormData((p) => ({ ...p, min_net_assets_ratio: e.target.value ? parseFloat(e.target.value) : null }))} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Business Types & Documentation */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Business Types</p>
                          <div className="space-y-2">
                            {[
                              { value: 'limited-company', label: 'Limited Company' },
                              { value: 'llp', label: 'LLP' },
                              { value: 'sole-trader', label: 'Sole Trader' },
                              { value: 'partnership', label: 'Partnership' }
                            ].map(type => (
                              <label key={type.value} className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  checked={formData.accepted_business_types?.includes(type.value)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData(p => ({...p, accepted_business_types: [...(p.accepted_business_types || []), type.value]}));
                                    } else {
                                      setFormData(p => ({...p, accepted_business_types: (p.accepted_business_types || []).filter(t => t !== type.value)}));
                                    }
                                  }}
                                  className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                                />
                                <span className="text-sm text-[var(--color-text-primary)]">{type.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Documentation</p>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_filed_accounts} onChange={(e) => setFormData(p => ({...p, requires_filed_accounts: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires filed accounts</span>
                            </label>
                            {formData.requires_filed_accounts && (
                              <div>
                                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum years of accounts</label>
                                <input type="number" min="1" max="5" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_filed_accounts_years || ''} onChange={(e) => setFormData(p => ({...p, min_filed_accounts_years: e.target.value ? parseInt(e.target.value) : null}))} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Credit & Security */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Credit & Security</p>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.accepts_ccjs} onChange={(e) => setFormData(p => ({...p, accepts_ccjs: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Accepts CCJs</span>
                            </label>
                            {formData.accepts_ccjs && (
                              <div>
                                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Maximum CCJ value (£)</label>
                                <input type="number" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.max_ccj_value || ''} onChange={(e) => setFormData(p => ({...p, max_ccj_value: e.target.value ? parseInt(e.target.value) : null}))} />
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_homeowner} onChange={(e) => setFormData(p => ({...p, requires_homeowner: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires homeowner</span>
                            </label>
                            {formData.requires_homeowner && (
                              <div>
                                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Only for loans above (£)</label>
                                <input type="number" placeholder="Always required" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.homeowner_min_loan || ''} onChange={(e) => setFormData(p => ({...p, homeowner_min_loan: e.target.value ? parseInt(e.target.value) : null}))} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-border)]" />

                      {/* Section: Card Payments & Stacking */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Card Payments</p>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_card_payments} onChange={(e) => setFormData(p => ({...p, requires_card_payments: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires card payments</span>
                            </label>
                            {formData.requires_card_payments && (
                              <div>
                                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Minimum card payment %</label>
                                <input type="number" min="0" max="100" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.min_card_payment_percentage || ''} onChange={(e) => setFormData(p => ({...p, min_card_payment_percentage: e.target.value ? parseInt(e.target.value) : null}))} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">Stacking</p>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={formData.requires_existing_lending} onChange={(e) => setFormData(p => ({...p, requires_existing_lending: e.target.checked}))} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Requires existing lending</span>
                            </label>
                            <div>
                              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5">Maximum existing lenders</label>
                              <input type="number" min="0" max="10" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" value={formData.max_existing_lenders || ''} onChange={(e) => setFormData(p => ({...p, max_existing_lenders: e.target.value ? parseInt(e.target.value) : null}))} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* View mode - badge summary */
                <div className="flex flex-wrap gap-2">
                  <Badge variant={lender?.is_eligible_panel ? 'success' : 'default'}>
                    {lender?.is_eligible_panel ? 'Enabled' : 'Disabled'}
                  </Badge>
                  {lender?.is_eligible_panel && (
                    <>
                      {lender.product_type && <Badge>{lender.product_type}</Badge>}
                      {lender.min_trading_months && <Badge>{lender.min_trading_months}+ months</Badge>}
                      {lender.min_monthly_revenue && <Badge>£{(lender.min_monthly_revenue/1000).toFixed(0)}k+ /mo</Badge>}
                      {lender.absolute_min_loan && lender.absolute_max_loan && <Badge>£{(lender.absolute_min_loan/1000).toFixed(0)}k - £{(lender.absolute_max_loan/1000).toFixed(0)}k</Badge>}
                      {lender.requires_profitable && <Badge>Profitable</Badge>}
                      {lender.requires_positive_net_assets && <Badge>Positive BS</Badge>}
                      {lender.accepted_business_types && lender.accepted_business_types.length > 0 && <Badge>{lender.accepted_business_types.map(t => t === 'limited-company' ? 'Ltd' : t === 'sole-trader' ? 'Sole Trader' : t.toUpperCase()).join(', ')}</Badge>}
                      {lender.requires_filed_accounts && <Badge>{lender.min_filed_accounts_years}yr accounts</Badge>}
                      {lender.accepts_ccjs && <Badge>CCJs OK</Badge>}
                      {lender.requires_homeowner && <Badge>Homeowner</Badge>}
                      {lender.requires_card_payments && <Badge>{lender.min_card_payment_percentage}% cards</Badge>}
                      {lender.funding_speed && <Badge>{lender.funding_speed}</Badge>}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submitted Applications Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-[var(--color-text-primary)]">Submitted Applications</h2>
                <Badge variant="default">{submissions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-[var(--color-text-tertiary)]">No applications submitted to this lender yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="p-4 hover:bg-[var(--color-bg-secondary)] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Link
                            href={`/admin/applications/${submission.application?.id}`}
                            className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                          >
                            {submission.application?.company?.name || 'No company'}
                          </Link>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            £{submission.application?.requested_amount?.toLocaleString() || 0} – {submission.application?.loan_type || 'Unknown'}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {submission.application?.created_at ? new Date(submission.application.created_at).toLocaleDateString('en-GB') : 'No date'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStageBadgeVariant(submission.application?.stage || 'created')}>
                            {formatStage(submission.application?.stage || 'created')}
                          </Badge>
                          <Badge variant={submission.status === 'sent' ? 'success' : 'default'}>
                            {submission.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Lender Info & Stats */}
        <div className="space-y-6">
          {/* Lender Information - now in sidebar, more compact */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Lender Information</h2>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_email: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData((p) => ({ ...p, contact_phone: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>

                  {/* Workflow Integration - collapsible */}
                  <details className="pt-2 border-t border-[var(--color-border)]">
                    <summary className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase cursor-pointer py-2">
                      Workflow Integration
                    </summary>
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Submission Method</label>
                        <select
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          value={formData.submission_method || 'email'}
                          onChange={(e) => setFormData((p) => ({ ...p, submission_method: e.target.value as 'api' | 'email' }))}
                        >
                          <option value="email">Email</option>
                          <option value="api">API</option>
                        </select>
                      </div>
                      {(formData.submission_method === 'email' || !formData.submission_method) ? (
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Submission Email</label>
                          <input
                            type="email"
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                            placeholder="submissions@lender.com"
                            value={formData.submission_email || ''}
                            onChange={(e) => setFormData((p) => ({ ...p, submission_email: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">API Endpoint</label>
                            <input
                              type="url"
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                              placeholder="https://api.lender.com/applications"
                              value={formData.api_endpoint || ''}
                              onChange={(e) => setFormData((p) => ({ ...p, api_endpoint: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Auth Type</label>
                            <select
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                              value={formData.api_auth_type || ''}
                              onChange={(e) => setFormData((p) => ({ ...p, api_auth_type: e.target.value }))}
                            >
                              <option value="">Select...</option>
                              <option value="api_key">API Key</option>
                              <option value="oauth2">OAuth 2.0</option>
                              <option value="basic">Basic Auth</option>
                            </select>
                          </div>
                        </>
                      )}
                  </div>
                  </details>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Contact</dt>
                    <dd className="text-sm text-[var(--color-text-primary)]">{lender.contact_email || '—'}</dd>
                    {lender.contact_phone && (
                      <dd className="text-sm text-[var(--color-text-secondary)]">{lender.contact_phone}</dd>
                    )}
                  </div>
                  {lender.notes && (
                  <div>
                      <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Notes</dt>
                      <dd className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{lender.notes}</dd>
                  </div>
                  )}
                  <div>
                    <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Added</dt>
                    <dd className="text-sm text-[var(--color-text-primary)]">
                      {new Date(lender.created_at).toLocaleDateString('en-GB')}
                    </dd>
                  </div>
                  {lender.submission_method && (
                    <div>
                      <dt className="text-xs text-[var(--color-text-tertiary)] uppercase">Submission</dt>
                      <dd className="text-sm text-[var(--color-text-primary)]">
                        {lender.submission_method === 'email' ? lender.submission_email : 'API'}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* By Stage stats card */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">By Stage</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const stageGroups: Record<string, number> = {};
                submissions.forEach((sub) => {
                  const stage = sub.application?.stage || 'unknown';
                  stageGroups[stage] = (stageGroups[stage] || 0) + 1;
                });

                const stages = ['created', 'submitted', 'under_review', 'approved', 'declined', 'withdrawn'];
                return stages.map((stage) => {
                  const count = stageGroups[stage] || 0;
                  if (count === 0 && stageGroups[stage] === undefined) return null;
                  return (
                <div key={stage} className="flex items-center justify-between py-1">
                      <span className="text-sm text-[var(--color-text-secondary)]">{formatStage(stage)}</span>
                      <Badge variant={getStageBadgeVariant(stage)}>{count}</Badge>
                </div>
                  );
                }).filter(Boolean);
              })()}
              {submissions.length === 0 && (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-2">No submissions yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
