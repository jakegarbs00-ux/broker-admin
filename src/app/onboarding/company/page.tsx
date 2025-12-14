'use client';

import { useEffect, useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

const schema = z.object({
  name: z.string().min(2, 'Company name is required'),
  company_number: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  director_full_name: z.string().optional(),
  director_address: z.string().optional(),
  director_dob: z.string().optional(),
  property_status: z.enum(['owner', 'renter', '']).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CompanyOnboardingPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

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
      // Get user's profile to find their company_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('company_id, full_name, address, dob, property_status')
        .eq('id', user.id)
        .single();

      if (userProfile?.company_id) {
        // User already has a company - load it
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userProfile.company_id)
          .single();

        if (companyError) {
          console.error('Error loading company', companyError);
          setLoadingCompany(false);
          return;
        }

        if (companyData) {
          setCompanyId(companyData.id);
          reset({
            name: companyData.name ?? '',
            company_number: companyData.company_number ?? '',
            industry: companyData.industry ?? '',
            website: companyData.website ?? '',
            director_full_name: userProfile.full_name ?? '',
            director_address: userProfile.address ?? '',
            director_dob: userProfile.dob ?? undefined,
            property_status: userProfile.property_status ?? undefined,
          });
        }
      } else {
        // No company yet - check for stored company name
        if (typeof window !== 'undefined') {
          const storedName = window.localStorage.getItem('initialCompanyName') ?? '';
          reset({ name: storedName });
        }
      }
      setLoadingCompany(false);
    };

    fetchCompany();
  }, [user, supabase, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user || !profile) return;

    // Map property_status to match database constraint
    let finalPropertyStatus: string | null = null;
    if (values.property_status && values.property_status.trim()) {
      const status = values.property_status.trim().toLowerCase();
      const statusMap: Record<string, string | null> = {
        'homeowner': 'owner',
        'owner': 'owner',
        'tenant': 'renter',
        'renter': 'renter',
        'living_with_family': 'renter',
        'other': null,
      };
      finalPropertyStatus = statusMap[status] ?? null;
    }

    // Company payload - NO owner_id, NO director fields
    const companyPayload: any = {
      name: values.name,
      company_number: values.company_number || null,
      industry: values.industry || null,
      website: values.website || null,
      // Get referred_by from profile if user was referred (but profiles.referred_by doesn't exist anymore)
      // Actually, we need to check if there's a way to get this - maybe from signup flow stored it?
      // For now, set to null if creating new, keep existing if updating
      referred_by: companyId ? undefined : null, // Don't update referred_by if company exists
    };

    let newCompanyId: string | null = companyId;
    let error;

    if (companyId) {
      // Update existing company
      const res = await supabase
        .from('companies')
        .update(companyPayload)
        .eq('id', companyId);
      error = res.error;
    } else {
      // Create new company
      const res = await supabase
        .from('companies')
        .insert(companyPayload)
        .select('id')
        .single();
      error = res.error;
      if (!error && res.data) {
        newCompanyId = res.data.id;
        setCompanyId(res.data.id);
      }
    }

    if (error) {
      alert('Error saving company: ' + error.message);
      return;
    }

    // Update profile: link to company, set as primary director, add director details
    if (newCompanyId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: newCompanyId,
          is_primary_director: true,
          full_name: values.director_full_name || null,
          address: values.director_address || null,
          dob: values.director_dob || null,
          property_status: finalPropertyStatus,
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        alert('Company saved but failed to update director profile: ' + profileError.message);
        return;
      }
    }

    router.push('/dashboard');
  };

  if (loading || loadingCompany) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title={companyId ? 'Edit Company Information' : 'Company Information'}
        description="Tell us about your business so we can match you with the right lenders."
        actions={
          <Link href="/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        }
      />

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Acme Ltd"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Number
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. 12345678"
                    {...register('company_number')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Technology"
                    {...register('industry')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. https://acme.com"
                  {...register('website')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Director Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Director Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Director Full Name
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. John Smith"
                  {...register('director_full_name')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Director Address
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Full residential address"
                  {...register('director_address')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Director Date of Birth
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    {...register('director_dob')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property Status
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    {...register('property_status')}
                  >
                    <option value="">Select...</option>
                    <option value="owner">Homeowner</option>
                    <option value="renter">Renter</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/dashboard">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save and Continue'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}