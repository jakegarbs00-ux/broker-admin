'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof schema>;

export default function UpdatePasswordPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/auth/login');
    }, 2000);
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
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Password updated</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Your password has been updated successfully. Redirecting to login...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto space-y-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Set new password</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            New password
          </label>
          <input 
            type="password"
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="••••••••" 
            {...register('password')} 
          />
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Confirm new password
          </label>
          <input 
            type="password"
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="••••••••" 
            {...register('confirmPassword')} 
          />
          {errors.confirmPassword && (
            <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
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
          {isSubmitting ? 'Updating...' : 'Update password'}
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

