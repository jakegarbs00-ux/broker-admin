'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
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

type Company = {
  id: string;
  name: string;
};

export default function PartnerNewApplicationPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const preSelectedCompanyId = searchParams.get('company_id');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: preSelectedCompanyId || '',
      is_hidden: true, // Draft by default
    },
  });

  const isHidden = watch('is_hidden');
  const selectedCompanyId = watch('company_id');

  // Load companies referred by this partner
  useEffect(() => {
    if (loading || !user || profile?.role !== 'PARTNER') {
      setLoadingCompanies(false);
      return;
    }

    const loadCompanies = async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('referred_by', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading companies:', error);
        setLoadingCompanies(false);
        return;
      }

      setCompanies((data || []) as Company[]);
      setLoadingCompanies(false);

      // If company_id is in URL but not in the list, clear it
      if (preSelectedCompanyId && !data?.find((c) => c.id === preSelectedCompanyId)) {
        setValue('company_id', '');
      }
    };

    loadCompanies();
  }, [loading, user, profile?.role, supabase, preSelectedCompanyId, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setSubmitError(null);

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company_id: values.company_id,
        created_by: user.id,
        requested_amount: values.requested_amount,
        loan_type: values.loan_type,
        urgency: values.urgency,
        purpose: values.purpose,
        stage: 'created',
        is_hidden: values.is_hidden,
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
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600">You need to be logged in.</p>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">This page is only available to partners.</p>
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Selection */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Select Company</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCompanies ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  Loading companies...
                </div>
              ) : companies.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    You haven't referred any companies yet.{' '}
                    <Link href="/partner/companies/new" className="text-purple-600 hover:underline font-medium">
                      Create a company first
                    </Link>
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      {...register('company_id')}
                    >
                      <option value="">Select a company...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {errors.company_id && (
                      <p className="text-sm text-red-600 mt-1">{errors.company_id.message}</p>
                    )}
                  </div>

                  {/* Draft toggle */}
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="is_hidden"
                      className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      {...register('is_hidden')}
                    />
                    <div>
                      <label htmlFor="is_hidden" className="block text-sm font-medium text-gray-900">
                        Keep as draft (hidden from client)
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        {isHidden
                          ? 'This application will only be visible to you and admins until you uncheck this option.'
                          : 'The client will be able to see this application once linked.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requested Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requested Amount (£) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  {...register('requested_amount')}
                />
                {errors.requested_amount && (
                  <p className="text-sm text-red-600 mt-1">{errors.requested_amount.message}</p>
                )}
              </div>

              {/* Loan Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Urgency <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  <p className="text-sm text-red-600 mt-1">{errors.urgency.message}</p>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose of Funding <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe what the client will use the funds for..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  {...register('purpose')}
                />
                {errors.purpose && (
                  <p className="text-sm text-red-600 mt-1">{errors.purpose.message}</p>
                )}
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
              disabled={isSubmitting}
              loading={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
            >
              {isSubmitting ? 'Creating...' : 'Create Application'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}