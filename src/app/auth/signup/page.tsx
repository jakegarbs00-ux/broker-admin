'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  companyName: z.string().min(2, 'Company name is required'),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const [referrerId, setReferrerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Read ?ref=... from URL once on load
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerId(ref);
    }
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

    // If we have a referrerId and a created user, attach the referral
    const newUser = data.user;
    if (referrerId && newUser) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ referred_by: referrerId })
        .eq('id', newUser.id);

      if (profileError) {
        console.error('Error attaching referral', profileError);
        // not fatal for signup, so we don't block the user
      }
    }

    // For now we still send them to login
    router.push('/auth/login');
  };

  return (
    <main className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Create your account</h1>

      {referrerId && (
        <p className="text-sm text-gray-600">
          You were referred by a partner. We&apos;ll attach your account to them
          automatically.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input className="w-full border p-2" placeholder="Email" {...register('email')} />
        <p className="text-red-600 text-sm">{errors.email?.message}</p>

        <input
          className="w-full border p-2"
          placeholder="Password"
          type="password"
          {...register('password')}
        />
        <p className="text-red-600 text-sm">{errors.password?.message}</p>

        <input
          className="w-full border p-2"
          placeholder="Company name"
          {...register('companyName')}
        />
        <p className="text-red-600 text-sm">{errors.companyName?.message}</p>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button
          className="w-full bg-blue-600 text-white p-2 rounded"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}
