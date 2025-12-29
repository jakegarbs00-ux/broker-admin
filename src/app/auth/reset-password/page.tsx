'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const supabase = getSupabaseClient();
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <main className="max-w-md mx-auto space-y-6 py-12">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Check your email</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            We&apos;ve sent a password reset link to your email address.
          </p>
          <Link 
            href="/auth/login" 
            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] mt-4 inline-block"
          >
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto space-y-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Reset password</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Email address
          </label>
          <input 
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="you@example.com" 
            {...register('email')} 
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{formError}</p>
          </div>
        )}

        <button 
          type="submit"
          disabled={isSubmitting}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg w-full disabled:opacity-50"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="text-center">
        <Link 
          href="/auth/login" 
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back to login
        </Link>
      </div>
    </main>
  );
}

