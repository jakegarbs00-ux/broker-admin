'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type ReferredClient = {
  id: string;
  email: string | null;
};

const schema = z.object({
  clientType: z.enum(['existing', 'new']),
  existingClientId: z.string().optional(),
  newClientEmail: z.string().email('Enter a valid email').optional(),
  requested_amount: z.coerce.number().min(1000, 'Minimum amount is 1,000'),
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

export default function PartnerNewApplicationPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [clients, setClients] = useState<ReferredClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientType: 'existing',
    },
  });

  const clientType = watch('clientType');

  useEffect(() => {
    if (!user) return;
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'CLIENT')
        .eq('referred_by', user.id);

      if (error) {
        console.error('Error loading referred clients', error);
      } else if (data) {
        setClients(data as any);
      }

      setLoadingClients(false);
    };

    loadClients();
  }, [user, supabase]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  if (profile?.role !== 'PARTNER') {
    return (
      <main className="max-w-xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">New client application</h1>
        <p className="text-sm text-red-600">
          Only partners can create applications on behalf of clients.
        </p>
      </main>
    );
  }

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    const {
      clientType,
      existingClientId,
      newClientEmail,
      requested_amount,
      loan_type,
      urgency,
      purpose,
    } = values;

    let ownerId: string | null = null;
    let companyId: string | null = null;
    let prospectiveEmail: string | null = null;

    if (clientType === 'existing') {
      if (!existingClientId) {
        alert('Select a client');
        return;
      }
      ownerId = existingClientId;

      // Try to find their company; it's ok if they haven't completed onboarding yet
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', existingClientId)
        .maybeSingle();

      if (companyError) {
        console.error('Error loading company for client', companyError);
      }

      companyId = company?.id ?? null;
    } else {
      // New client by email
      if (!newClientEmail) {
        alert('Enter a client email');
        return;
      }
      prospectiveEmail = newClientEmail;
      ownerId = null;
      companyId = null;
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company_id: companyId,
        owner_id: ownerId,
        created_by: user.id,
        requested_amount,
        loan_type,
        urgency,
        purpose,
        stage: 'created',
        is_hidden: true, // hidden draft
        prospective_client_email: prospectiveEmail,
      })
      .select('id')
      .single();

    if (error) {
      alert('Error creating draft application: ' + error.message);
      return;
    }

    // For now just go back to partner applications list
    router.push('/partner/applications');
  };

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">New client application (partner)</h1>
      <p className="text-gray-600 text-sm">
        Start an application on behalf of one of your clients. You can attach it to an
        existing referred client or a new email address.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Client selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Who is this for?</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="existing"
                {...register('clientType')}
              />
              Existing referred client
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="new"
                {...register('clientType')}
              />
              New client (by email)
            </label>
          </div>
        </div>

        {clientType === 'existing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select client
            </label>
            {loadingClients ? (
              <p className="text-xs text-gray-500">Loading clients…</p>
            ) : clients.length === 0 ? (
              <p className="text-xs text-gray-500">
                You don&apos;t have any referred clients yet.
              </p>
            ) : (
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                {...register('existingClientId')}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email ?? c.id}
                  </option>
                ))}
              </select>
            )}
            <p className="text-sm text-red-600">{errors.existingClientId?.message}</p>
          </div>
        )}

        {clientType === 'new' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Client email
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              {...register('newClientEmail')}
            />
            <p className="text-sm text-red-600">{errors.newClientEmail?.message}</p>
          </div>
        )}

        {/* Application details */}
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
            <option value="">Select…</option>
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
            <option value="">Select…</option>
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
          className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating draft…' : 'Create draft application'}
        </button>
      </form>
    </main>
  );
}
