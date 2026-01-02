'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  companyName: z.string().min(2, 'Company name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function SignupContent() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadLeadData = async (leadId: string) => {
    setLoadingLead(true);
    try {
      const { data: leadData, error } = await supabase
        .from('leads')
        .select('business_name, contact_name, email, phone')
        .eq('id', leadId)
        .single();

      if (error) {
        console.error('Error loading lead:', error);
        setLoadingLead(false);
        return;
      }

      if (leadData) {
        // Pre-fill form with lead data
        if (leadData.business_name) {
          setValue('companyName', leadData.business_name);
        }
        if (leadData.email) {
          setValue('email', leadData.email);
        }
        if (leadData.phone) {
          setValue('phone', leadData.phone);
        }
        
        // Split contact_name into first and last name
        if (leadData.contact_name) {
          const nameParts = leadData.contact_name.trim().split(/\s+/);
          if (nameParts.length > 0) {
            setValue('firstName', nameParts[0]);
          }
          if (nameParts.length > 1) {
            setValue('lastName', nameParts.slice(1).join(' '));
          }
        }
      }
    } catch (err) {
      console.error('Error loading lead data:', err);
    } finally {
      setLoadingLead(false);
    }
  };

  // Read ?ref=... and ?lead_id=... from URL once on load
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerId(ref);
    }

    const leadIdParam = searchParams.get('lead_id');
    if (leadIdParam) {
      setLeadId(leadIdParam);
      loadLeadData(leadIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { email, password, companyName } = values;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    // Store company name locally for onboarding
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('initialCompanyName', companyName);
    }

    const newUser = data.user;
    if (!newUser) {
      setFormError('Failed to create user account');
      return;
    }

    // If we have a referrerId, attach the referral
    if (referrerId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ referred_by: referrerId })
        .eq('id', newUser.id);

      if (profileError) {
        console.error('Error attaching referral', profileError);
        // not fatal for signup, so we don't block the user
      }
    }

    // If we have a leadId, update the lead record to mark it as converted
    if (leadId) {
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          user_id: newUser.id,
          converted_at: new Date().toISOString(),
          status: 'converted',
        })
        .eq('id', leadId);

      if (leadError) {
        console.error('Error updating lead record', leadError);
        // not fatal for signup, so we don't block the user
      }
    }

    // For now we still send them to login
    router.push('/auth/login');
  };

  return (
    <main className="max-w-md mx-auto space-y-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create your account</h1>

      {loadingLead && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Loading your information...
        </p>
      )}

      {referrerId && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          You were referred by a partner. We&apos;ll attach your account to them
          automatically.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input 
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="Email" 
            {...register('email')} 
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            placeholder="Password"
            type="password"
            {...register('password')}
          />
          {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            placeholder="Company name"
            {...register('companyName')}
          />
          {errors.companyName && <p className="text-red-600 text-sm mt-1">{errors.companyName.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <input
              className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              placeholder="First name"
              {...register('firstName')}
            />
          </div>
          <div>
            <input
              className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              placeholder="Last name"
              {...register('lastName')}
            />
          </div>
        </div>

        <div>
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            placeholder="Phone (optional)"
            {...register('phone')}
          />
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{formError}</p>
          </div>
        )}

        <button
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg disabled:opacity-50"
          disabled={isSubmitting || loadingLead}
        >
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}
