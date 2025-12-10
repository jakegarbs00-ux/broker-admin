'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type AppListItem = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  created_at: string;
};

export default function ApplicationsIndexPage() {
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('id, requested_amount, stage, loan_type, created_at')
        .eq('owner_id', user.id)
        .eq('is_hidden', false) // 🔒 only show visible apps
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading applications', error);
      } else if (data) {
        setApps(data as any);
      }

      setLoadingApps(false);
    };

    load();
  }, [user, supabase]);

  if (loading || loadingApps) return <p>Loading...</p>;
  if (!user) return null;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your applications</h1>
        <Link
          href="/applications/new"
          className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          New application
        </Link>
      </div>

      {apps.length === 0 ? (
        <p className="text-gray-600 text-sm">
          You don&apos;t have any applications yet.
        </p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link
              key={a.id}
              href={`/applications/${a.id}`}
              className="flex items-center justify-between rounded-md border bg-white px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p className="text-lg font-semibold">
                  £{a.requested_amount.toLocaleString()} – {a.loan_type}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                {a.stage}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
