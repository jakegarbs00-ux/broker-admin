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
  director_first_name: z.string().optional(),
  director_last_name: z.string().optional(),
  director_address_line_1: z.string().optional(),
  director_address_line_2: z.string().optional(),
  director_city: z.string().optional(),
  director_postcode: z.string().optional(),
  director_country: z.string().optional(),
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
      // Get profile with company_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, company:company_id(*)')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile', profileError);
        setLoadingCompany(false);
        return;
      }

      if (profileData?.company) {
        // Company exists - load both company and director (profile) data
        const company = profileData.company;
        setCompanyId(company.id);
        
        reset({
          name: company.name ?? '',
          company_number: company.company_number ?? '',
          industry: company.industry ?? '',
          website: company.website ?? '',
          director_first_name: profileData.first_name ?? '',
          director_last_name: profileData.last_name ?? '',
          director_address_line_1: profileData.address_line_1 ?? '',
          director_address_line_2: profileData.address_line_2 ?? '',
          director_city: profileData.city ?? '',
          director_postcode: profileData.postcode ?? '',
          director_country: profileData.country ?? 'United Kingdom',
          director_dob: profileData.date_of_birth ? profileData.date_of_birth.split('T')[0] : undefined,
          property_status: profileData.property_status ?? undefined,
        });
      } else {
        // No company yet - check for stored name
        if (typeof window !== 'undefined') {
          const storedName = window.localStorage.getItem('initialCompanyName') ?? '';
          reset({ 
            name: storedName,
            director_country: 'United Kingdom',
          });
        } else {
          reset({
            director_country: 'United Kingdom',
          });
        }
      }
      setLoadingCompany(false);
    };

    fetchCompany();
  }, [user, supabase, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    // Update company
    const companyPayload: any = {
      name: values.name,
      company_number: values.company_number || null,
      industry: values.industry || null,
      website: values.website || null,
    };

    let error;
    let finalCompanyId = companyId;

    if (companyId) {
      const res = await supabase
        .from('companies')
        .update(companyPayload)
        .eq('id', companyId);
      error = res.error;
    } else {
      const res = await supabase
        .from('companies')
        .insert(companyPayload)
        .select('id')
        .single();
      error = res.error;
      if (!error && res.data) {
        finalCompanyId = res.data.id;
        setCompanyId(res.data.id);
      }
    }

    if (error) {
      alert('Error saving company: ' + error.message);
      return;
    }

    // Update profile with director info
    if (finalCompanyId) {
      const profilePayload: any = {
        company_id: finalCompanyId,
        is_primary_director: true,
        first_name: values.director_first_name || null,
        last_name: values.director_last_name || null,
        address_line_1: values.director_address_line_1 || null,
        address_line_2: values.director_address_line_2 || null,
        city: values.director_city || null,
        postcode: values.director_postcode || null,
        country: values.director_country || 'United Kingdom',
        date_of_birth: values.director_dob || null,
        property_status: values.property_status || null,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', user.id);

      if (profileError) {
        alert('Error saving director information: ' + profileError.message);
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John"
                    {...register('director_first_name')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Smith"
                    {...register('director_last_name')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main Street"
                  {...register('director_address_line_1')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Apartment, Suite, etc. (optional)"
                  {...register('director_address_line_2')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="London"
                    {...register('director_city')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postcode
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="SW1A 1AA"
                    {...register('director_postcode')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="United Kingdom"
                  defaultValue="United Kingdom"
                  {...register('director_country')}
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