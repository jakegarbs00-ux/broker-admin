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
});

type FormValues = z.infer<typeof schema>;

function SignupContent() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Read ?ref=... and ?lead_id=... from URL once on load
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerId(ref);
    }

    const leadIdParam = searchParams.get('lead_id');
    if (leadIdParam) {
      setLeadId(leadIdParam);
    }
  }, [searchParams]);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setIsLoading(true);
    const { email, password } = values;

    try {
      console.log('[Signup] Starting signup process...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('[Signup] Signup error:', error);
        setFormError(error.message || 'Failed to create account. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        console.error('[Signup] No user returned from signup');
        setFormError('Failed to create user account. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('[Signup] User created successfully:', data.user.id);

      // Handle referrals and leads in background (non-blocking)
      if (referrerId || leadId) {
        Promise.resolve().then(async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Store referrer ID in localStorage - will be applied to company when created
          if (referrerId) {
            localStorage.setItem('referrer_id', referrerId);
            console.log('[Signup] Stored referrer ID in localStorage:', referrerId);
          }
          
          if (leadId) {
            const { error } = await supabase
              .from('leads')
              .update({
                user_id: data.user!.id,
                converted_at: new Date().toISOString(),
                status: 'converted',
              })
              .eq('id', leadId);
            if (error) console.error('Error updating lead:', error);
          }
        });
      }

      // Small delay to let trigger create profile
      console.log('[Signup] Waiting for profile creation...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force navigation
      console.log('[Signup] Redirecting to /apply');
      window.location.href = '/apply';
    } catch (err) {
      console.error('Error during signup:', err);
      setFormError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto space-y-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create your account</h1>

      {referrerId && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          You were referred by a partner. We&apos;ll attach your account to them
          automatically.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Email <span className="text-red-600">*</span>
          </label>
          <input 
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="john@example.com" 
            type="email"
            {...register('email')} 
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Password <span className="text-red-600">*</span>
          </label>
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            placeholder="At least 6 characters"
            type="password"
            {...register('password')}
          />
          {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{formError}</p>
          </div>
        )}

        <button
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg disabled:opacity-50"
          disabled={isLoading || isSubmitting}
          type="submit"
        >
          {isLoading || isSubmitting ? 'Creating account…' : 'Sign up'}
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
