'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const schema = z.object({
  requested_amount: z.coerce
    .number()
    .min(1000, 'Minimum amount is 1,000'),
  loan_type: z.string().min(1, 'Select a loan type'),
  urgency: z.string().min(1, 'Select urgency'),
  purpose: z.string().min(10, 'Please describe the purpose'),
});

type FormValues = z.infer<typeof schema>;

const LOAN_TYPES = [
  { value: 'term_loan', label: 'Term loan' },
  { value: 'revolving', label: 'Revolving facility' },
  { value: 'asset_finance', label: 'Asset finance' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'asap', label: 'ASAP' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'three_plus_months', label: '3+ months' },
];

export default function NewApplicationPage() {
  const { user, loading } = useRequireAuth();
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
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading company', error);
      }

      if (!data) {
        router.replace('/onboarding/company');
        return;
      }

      setCompanyId(data.id);
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
        owner_id: user.id,
        requested_amount: values.requested_amount,
        loan_type: values.loan_type,
        urgency: values.urgency,
        purpose: values.purpose,
        stage: 'created',
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
    return <p>Loading...</p>;
  }

  return (
    <main className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <p className="text-gray-600">
        Tell us what you&apos;re looking for. You can upload documents and submit after this step.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Requested amount (£)
          </label>
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('requested_amount')}
          />
          <p className="text-sm text-red-600">{errors.requested_amount?.message}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Loan type</label>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('loan_type')}
          >
            <option value="">Select...</option>
            {LOAN_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value}>
                {lt.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-red-600">{errors.loan_type?.message}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Urgency</label>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('urgency')}
          >
            <option value="">Select...</option>
            {URGENCY_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-red-600">{errors.urgency?.message}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Purpose of funding
          </label>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('purpose')}
          />
          <p className="text-sm text-red-600">{errors.purpose?.message}</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create application'}
        </button>
      </form>
    </main>
  );
}
