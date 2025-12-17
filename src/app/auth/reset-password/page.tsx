'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [checkingLink, setCheckingLink] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      // Supabase will automatically parse the token from the URL hash on load
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(!!data.session);
      setCheckingLink(false);
    };

    check();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) setHasSession(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }

      // Optional: end the recovery session
      await supabase.auth.signOut();

      router.push('/auth/login?message=Password updated successfully');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>

      {checkingLink ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Checking reset link…
        </div>
      ) : !hasSession ? (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
              Request new link
            </Link>
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full border p-2"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />
          <input
            className="w-full border p-2"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            required
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            className="bg-blue-600 text-white p-2 rounded w-full disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </main>
  );
}


