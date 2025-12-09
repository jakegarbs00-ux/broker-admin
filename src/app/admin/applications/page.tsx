'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type AdminApp = {
  id: string;
  requested_amount: number;
  loan_type: string;
  urgency: string | null;
  stage: string;
  created_at: string;
  company?: {
    name: string;
  } | null;
  owner?: {
    email: string;
  } | null;
};

const STAGES = [
  'created',
  'submitted',
  'in_credit',
  'info_required',
  'approved',
  'onboarding',
  'funded',
  'declined',
  'withdrawn',
];

export default function AdminApplicationsPage() {
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();
  const [role, setRole] = useState<string | null>(null);
  const [apps, setApps] = useState<AdminApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profError) {
        console.error('Error loading profile', profError);
        return;
      }

      setRole(profile?.role ?? null);

      if (profile?.role !== 'ADMIN') {
        setLoadingApps(false);
        return;
      }

      const { data, error } = await supabase
        .from('applications')
        .select(
          `
          id,
          requested_amount,
          loan_type,
          urgency,
          stage,
          created_at,
          company:companies(name),
          owner:profiles(email)
        `
        )
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

  const handleStageChange = async (id: string, newStage: string) => {
    const { error } = await supabase
      .from('applications')
      .update({ stage: newStage })
      .eq('id', id);

    if (error) {
      alert('Error updating stage: ' + error.message);
      return;
    }

    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, stage: newStage } : a))
    );
  };

  if (loading || loadingApps) return <p>Loading...</p>;
  if (!user) return null;

  if (role !== 'ADMIN') {
    return (
      <main className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Admin – applications</h1>
        <p className="text-red-600">
          You are not an admin. Set your role to ADMIN in the <code>profiles</code> table
          in Supabase to access this page.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Admin – all applications</h1>

      {apps.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm text-gray-500">
                  {a.company?.name ?? 'Company'} • {a.owner?.email ?? 'Unknown owner'}
                </p>
                <p className="text-lg font-semibold">
                  £{a.requested_amount.toLocaleString()} – {a.loan_type}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <label className="text-xs text-gray-500">Stage</label>
                <select
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={a.stage}
                  onChange={(e) => handleStageChange(a.id, e.target.value)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
