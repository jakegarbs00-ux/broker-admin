'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('companies')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCompany(data));
  }, [user]);

  if (loading) return <p>Loading…</p>;
  if (!user) return null;

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Client Dashboard</h1>

      <button
        className="border px-3 py-1 rounded"
        onClick={async () => {
          await supabase.auth.signOut();
          router.push('/');
        }}
      >
        Log out
      </button>

      {!company ? (
        <div className="p-4 border rounded bg-yellow-50">
          <p>Please complete your company profile:</p>
          <Link className="text-blue-600 underline" href="/onboarding/company">
            Start company profile
          </Link>
        </div>
      ) : (
        <div className="p-4 border rounded bg-white">
          <h2 className="font-semibold">Company: {company.name}</h2>
          <p>You are ready to create your first application (next milestone).</p>
        </div>
      )}
    </main>
  );
}
