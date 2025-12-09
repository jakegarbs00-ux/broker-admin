// src/app/onboarding/company/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

const schema = z.object({
  name: z.string().min(2, 'Company name is required'),
  company_number: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  director_full_name: z.string().optional(),
  director_address: z.string().optional(),
  director_dob: z.string().optional(),
  property_status: z.enum(['owner', 'renter']).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CompanyOnboardingPage() {
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!user) return;

    const fetchCompany = async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading company', error);
        return;
      }

      if (data) {
        setCompanyId(data.id);
        reset({
          name: data.name ?? '',
          company_number: data.company_number ?? '',
          industry: data.industry ?? '',
          website: data.website ?? '',
          director_full_name: data.director_full_name ?? '',
          director_address: data.director_address ?? '',
          director_dob: data.director_dob ?? undefined,
          property_status: data.property_status ?? undefined,
        });
      } else {
        if (typeof window !== 'undefined') {
          const storedName =
            window.localStorage.getItem('initialCompanyName') ?? '';
          reset({ name: storedName });
        }
      }
    };

    fetchCompany();
  }, [user, supabase, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    const payload: any = {
      owner_id: user.id,
      name: values.name,
      company_number: values.company_number || null,
      industry: values.industry || null,
      website: values.website || null,
      director_full_name: values.director_full_name || null,
      director_address: values.director_address || null,
      director_dob: values.director_dob || null,
      property_status: values.property_status || null,
    };

    let error;

    if (companyId) {
      const res = await supabase
        .from('companies')
        .update(payload)
        .eq('id', companyId);
      error = res.error;
    } else {
      const res = await supabase
        .from('companies')
        .insert(payload)
        .select('id')
        .single();
      error = res.error;
      if (!error && res.data) setCompanyId(res.data.id);
    }

    if (error) {
      alert('Error saving company: ' + error.message);
      return;
    }

    router.push('/dashboard');
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <main className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Company information</h1>
      <p className="text-gray-600">
        Tell us about your business so we can match you with the right lenders.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Company name *
          </label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company number
            </label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              {...register('company_number')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Industry
            </label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              {...register('industry')}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('website')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Director full name
          </label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('director_full_name')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Director address
          </label>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            rows={3}
            {...register('director_address')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Director date of birth
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              {...register('director_dob')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Property status
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              {...register('property_status')}
            >
              <option value="">Select...</option>
              <option value="owner">Owner</option>
              <option value="renter">Renter</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save and continue'}
        </button>
      </form>
    </main>
  );
}
