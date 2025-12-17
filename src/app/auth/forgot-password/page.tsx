'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="text-sm text-gray-600">
        Enter your email address and we&apos;ll send you a password reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && (
          <p className="text-green-700 text-sm">
            Check your email for a password reset link.
          </p>
        )}

        <button
          className="bg-blue-600 text-white p-2 rounded w-full disabled:opacity-60"
          disabled={submitting || !email.trim()}
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="text-sm">
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}


