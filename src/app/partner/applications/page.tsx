'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type PartnerApplication = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  prospective_client_email: string | null;
  company?: {
    name: string;
  } | null;
  owner?: {
    id: string;
    email: string | null;
  } | null;
};

export default function PartnerApplicationsPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const [apps, setApps] = useState<PartnerApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (profile?.role !== 'PARTNER') {
        setLoadingApps(false);
        return;
      }

      setError(null);

      // 1) Find IDs of clients referred by this partner
      const { data: clients, error: clientsError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'CLIENT')
        .eq('referred_by', user.id);

      if (clientsError) {
        console.error('Error loading referred clients', clientsError);
        setError('Error loading referred clients: ' + clientsError.message);
        setLoadingApps(false);
        return;
      }

      const clientIds = (clients ?? []).map((c) => c.id) as string[];

      // 2) Load applications:
      //    - owned by referred clients
      //    - OR draft apps created by this partner with no owner yet
      const orFilters = [
        clientIds.length > 0
          ? `owner_id.in.(${clientIds.join(',')})`
          : '',
        `and(owner_id.is.null,created_by.eq.${user.id})`,
      ]
        .filter(Boolean)
        .join(',');

      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(
          `
            id,
            requested_amount,
            stage,
            loan_type,
            urgency,
            created_at,
            is_hidden,
            prospective_client_email,
            company:companies(name),
            owner:profiles!applications_owner_id_fkey (id, email)
          `
        )
        .or(orFilters)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error loading partner applications', appsError);
        setError('Error loading applications: ' + appsError.message);
        setLoadingApps(false);
        return;
      }

      setApps((appsData ?? []) as any);
      setLoadingApps(false);
    };

    if (!loading) {
      load();
    }
  }, [user, profile?.role, loading, supabase]);

  if (loading || loadingApps) {
    return <p className="p-4">Loading…</p>;
  }

  if (!user) {
    return <p className="p-4">You need to be logged in.</p>;
  }

  if (profile?.role !== 'PARTNER') {
    return (
      <main className="max-w-3xl mx-auto space-y-4 p-4">
        <h1 className="text-2xl font-semibold">Partner applications</h1>
        <p className="text-sm text-red-600">
          You are not a partner. This page is only available to users with the PARTNER
          role.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600">
            Partner / broker
          </p>
          <h1 className="text-2xl font-semibold">Referred client applications</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Link
          href="/partner/applications/new"
          className="inline-block rounded-md bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
        >
          New client application
        </Link>
      </div>

      {apps.length === 0 ? (
        <p className="text-gray-600 text-sm">
          You don&apos;t have any applications for your clients yet.
        </p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const isDraft = a.is_hidden;
            const hasOwner = !!a.owner?.id;

            const clientLabel = hasOwner
              ? a.owner?.email ?? 'Known client'
              : a.prospective_client_email ?? 'Prospective client';

            return (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm text-gray-500">
                    {a.company?.name ?? 'Company pending'} • {clientLabel}
                  </p>
                  <p className="text-lg font-semibold">
                    £{a.requested_amount.toLocaleString()} – {a.loan_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      isDraft
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isDraft ? 'Draft (hidden)' : a.stage}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
