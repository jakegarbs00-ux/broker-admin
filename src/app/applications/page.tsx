'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type Application = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  company?: {
    name: string;
  } | null;
};

export default function ApplicationsListPage() {
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(
          `
          id,
          requested_amount,
          stage,
          loan_type,
          urgency,
          created_at,
          company:companies(name)
        `
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading applications', error);
      } else if (data) {
        setApplications(data as any);
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
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          New application
        </Link>
      </div>

      {applications.length === 0 ? (
        <p className="text-gray-600">
          You have no applications yet.{' '}
          <Link href="/applications/new" className="text-blue-600 underline">
            Create your first application.
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <Link
              key={a.id}
              href={`/applications/${a.id}`}
              className="block rounded-md border bg-white px-4 py-3 hover:border-blue-400"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {a.company?.name ?? 'Company'}
                  </p>
                  <p className="text-lg font-semibold">
                    £{a.requested_amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {a.loan_type} •{' '}
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {a.stage}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
