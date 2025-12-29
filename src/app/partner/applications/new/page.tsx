'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

const schema = z.object({
  company_id: z.string().min(1, 'Please select a company'),
  requested_amount: z.coerce
    .number()
    .min(1000, 'Minimum amount is £1,000'),
  loan_type: z.string().min(1, 'Select a loan type'),
  urgency: z.string().min(1, 'Select urgency'),
  purpose: z.string().min(10, 'Please describe the purpose (at least 10 characters)'),
  is_hidden: z.boolean(),
  monthly_revenue: z.string().optional(),
  trading_months: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const LOAN_TYPES = [
  { value: 'term_loan', label: 'Term loan' },
  { value: 'revolving', label: 'Revolving facility' },
  { value: 'asset_finance', label: 'Asset finance' },
  { value: 'invoice_finance', label: 'Invoice finance' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'asap', label: 'ASAP' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'three_plus_months', label: '3+ months' },
];

export default function PartnerNewApplicationPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_hidden: true, // Draft by default
      company_id: '',
    },
  });

  useEffect(() => {
    if (!user || profile?.role !== 'PARTNER') return;

    const loadCompanies = async () => {
      // Get user's partner_company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('partner_company_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.partner_company_id) {
        setLoadingCompanies(false);
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
        setLoadingCompanies(false);
        return;
      }

      // Get companies referred by this partner company
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .in('referred_by', partnerUserIds)
        .order('name', { ascending: true });

      setCompanies(companiesData || []);
      setLoadingCompanies(false);
    };

    loadCompanies();
  }, [user, profile?.role, supabase]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setSubmitError(null);

    if (!values.company_id) {
      setSubmitError('Please select a company.');
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company_id: values.company_id,
        requested_amount: values.requested_amount,
        loan_type: values.loan_type,
        purpose: values.purpose || null,
        urgency: values.urgency || null,
        monthly_revenue: values.monthly_revenue ? parseFloat(values.monthly_revenue) : null,
        trading_months: values.trading_months ? parseInt(values.trading_months) : null,
        stage: 'created',
        workflow_status: 'pending',
        is_hidden: values.is_hidden,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating application:', error);
      setSubmitError('Error creating application: ' + error.message);
      return;
    }

    router.push('/partner/applications');
  };

  if (loading) {
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

  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)]">You need to be logged in.</p>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">This page is only available to partners.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="New Client Application"
        description="Create a funding application on behalf of a client. You can keep it as a draft until ready to share."
        actions={
          <Link href="/partner/applications">
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />

      {submitError && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{submitError}</p>
        </div>
      )}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Selection */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Company</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Select Company <span className="text-[var(--color-error)]">*</span>
                </label>
                {loadingCompanies ? (
                  <p className="text-sm text-[var(--color-text-tertiary)]">Loading companies...</p>
                ) : companies.length === 0 ? (
                  <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                    <p className="text-sm text-[var(--color-text-secondary)]">No companies found.</p>
                    <Link href="/partner/companies/new" className="text-sm text-[var(--color-accent)] hover:underline mt-1 inline-block">
                      Create a company first →
                    </Link>
                  </div>
                ) : (
                  <select
                    {...register('company_id')}
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  >
                    <option value="">Select a company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {errors.company_id && (
                  <p className="text-sm text-[var(--color-error)] mt-1">{errors.company_id.message}</p>
                )}
              </div>

              {/* Draft toggle */}
              <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('is_hidden')}
                    className="mt-0.5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">Keep as draft (hidden from client)</p>
                    <p className="text-sm text-[var(--color-text-tertiary)]">This application will only be visible to you and admins until you uncheck this option.</p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Application Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requested Amount */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Requested Amount (£) <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  {...register('requested_amount')}
                />
                {errors.requested_amount && (
                  <p className="text-sm text-[var(--color-error)] mt-1">{errors.requested_amount.message}</p>
                )}
              </div>

              {/* Loan Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Loan Type <span className="text-[var(--color-error)]">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  {...register('loan_type')}
                >
                  <option value="">Select a loan type...</option>
                  {LOAN_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>
                      {lt.label}
                    </option>
                  ))}
                </select>
                {errors.loan_type && (
                  <p className="text-sm text-[var(--color-error)] mt-1">{errors.loan_type.message}</p>
                )}
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Urgency <span className="text-[var(--color-error)]">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  {...register('urgency')}
                >
                  <option value="">How soon does the client need the funds?</option>
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {errors.urgency && (
                  <p className="text-sm text-[var(--color-error)] mt-1">{errors.urgency.message}</p>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Purpose of Funding <span className="text-[var(--color-error)]">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe what the client will use the funds for..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  {...register('purpose')}
                />
                {errors.purpose && (
                  <p className="text-sm text-[var(--color-error)] mt-1">{errors.purpose.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Business Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Monthly Revenue (£)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm"
                    placeholder="e.g., 50000"
                    {...register('monthly_revenue')}
                  />
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Average monthly revenue</p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Trading History (months)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm"
                    placeholder="e.g., 24"
                    {...register('trading_months')}
                  />
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">How long the business has been trading</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/partner/applications">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || companies.length === 0}
              loading={isSubmitting}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] focus:ring-[var(--color-accent)]"
            >
              {isSubmitting ? 'Creating...' : 'Create Application'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}