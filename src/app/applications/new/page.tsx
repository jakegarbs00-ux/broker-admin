'use client';

import { useEffect, useState } from 'react';
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
  requested_amount: z.coerce
    .number()
    .min(1000, 'Minimum amount is £1,000'),
  loan_type: z.string().min(1, 'Select a loan type'),
  urgency: z.string().min(1, 'Select urgency'),
  purpose: z.string().min(10, 'Please describe the purpose (at least 10 characters)'),
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

export default function NewApplicationPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!user) return;
    const loadCompany = async () => {
      // Check if user has a company via their profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile', profileError);
      }

      if (!profileData?.company_id) {
        router.replace('/onboarding/company');
        return;
      }

      setCompanyId(profileData.company_id);
      setLoadingCompany(false);
    };

    loadCompany();
  }, [user, supabase, router]);

  const onSubmit = async (values: FormValues) => {
    if (!user || !companyId) return;

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company_id: companyId,
        created_by: user.id,
        requested_amount: values.requested_amount,
        loan_type: values.loan_type,
        urgency: values.urgency,
        purpose: values.purpose,
        stage: 'created',
        is_hidden: false,
        monthly_revenue: values.monthly_revenue ? parseFloat(values.monthly_revenue) : null,
        trading_months: values.trading_months ? parseInt(values.trading_months) : null,
      })
      .select('id')
      .single();

    if (error) {
      alert('Error creating application: ' + error.message);
      return;
    }

    router.push(`/applications/${data.id}`);
  };

  if (loading || loadingCompany) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="New Application"
        description="Tell us what funding you're looking for. You can upload documents after creating the application."
        actions={
          <Link href="/applications">
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Application Details</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Requested Amount */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Requested Amount (£) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('requested_amount')}
                />
                {errors.requested_amount && (
                  <p className="text-sm text-red-600 mt-1">{errors.requested_amount.message}</p>
                )}
              </div>

              {/* Loan Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Loan Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <p className="text-sm text-red-600 mt-1">{errors.loan_type.message}</p>
                )}
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Urgency <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('urgency')}
                >
                  <option value="">How soon do you need the funds?</option>
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {errors.urgency && (
                  <p className="text-sm text-red-600 mt-1">{errors.urgency.message}</p>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Purpose of Funding <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe what you'll use the funds for..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('purpose')}
                />
                {errors.purpose && (
                  <p className="text-sm text-red-600 mt-1">{errors.purpose.message}</p>
                )}
              </div>

              {/* Business Information */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Business Information</h3>
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
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Link href="/applications">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Application'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}