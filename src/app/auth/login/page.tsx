'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);

    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(error.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <main className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Log in</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input className="w-full border p-2" placeholder="Email" {...register('email')} />
        <p className="text-red-600 text-sm">{errors.email?.message}</p>

        <input
          className="w-full border p-2"
          type="password"
          placeholder="Password"
          {...register('password')}
        />
        <p className="text-red-600 text-sm">{errors.password?.message}</p>

        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button className="bg-blue-600 text-white p-2 rounded w-full">
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
