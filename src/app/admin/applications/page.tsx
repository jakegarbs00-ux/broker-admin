'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type AdminApp = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  admin_notes: string | null;
  lender_id: string | null;
  prospective_client_email: string | null;
  company?: {
    name: string;
  } | null;
  owner?: {
    email: string | null;
  } | null;
};

type Lender = {
  id: string;
  name: string;
  status: string;
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
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [apps, setApps] = useState<AdminApp[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingLenders, setLoadingLenders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [lenderFilter, setLenderFilter] = useState<string>('all');

  const [savingAppId, setSavingAppId] = useState<string | null>(null);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [updatingLenderId, setUpdatingLenderId] = useState<string | null>(null);

  // Only admins allowed
  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Admin – applications</h1>
        <p className="text-sm text-red-600">
          You do not have permission to view this page.
        </p>
      </main>
    );
  }

  useEffect(() => {
    const loadLenders = async () => {
      const { data, error } = await supabase
        .from('lenders')
        .select('id, name, status')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading lenders', error);
      } else if (data) {
        setLenders(data as Lender[]);
      }
      setLoadingLenders(false);
    };

    const loadApps = async () => {
      setError(null);
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
          is_hidden,
          admin_notes,
          lender_id,
          prospective_client_email,
          company:companies(name),
          owner:profiles!applications_owner_id_fkey (email)
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading applications', error);
        setError('Error loading applications: ' + error.message);
      } else if (data) {
        setApps(data as any);
      }
      setLoadingApps(false);
    };

    if (!loading && profile?.role === 'ADMIN') {
      loadLenders();
      loadApps();
    }
  }, [loading, profile?.role, supabase]);

  const lenderMap = useMemo(() => {
    const map: Record<string, Lender> = {};
    lenders.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lenders]);

  const filteredApps = apps.filter((a) => {
    if (stageFilter !== 'all' && a.stage !== stageFilter) return false;
    if (lenderFilter === 'none' && a.lender_id) return false;
    if (lenderFilter !== 'all' && lenderFilter !== 'none' && a.lender_id !== lenderFilter)
      return false;
    return true;
  });

  const handleStageChange = async (appId: string, newStage: string) => {
    setUpdatingStageId(appId);
    const { error } = await supabase
      .from('applications')
      .update({ stage: newStage })
      .eq('id', appId);

    if (error) {
      alert('Error updating stage: ' + error.message);
    } else {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, stage: newStage } : a)),
      );
    }
    setUpdatingStageId(null);
  };

  const handleLenderChange = async (appId: string, lenderId: string | 'none') => {
    setUpdatingLenderId(appId);
    const lender_id = lenderId === 'none' ? null : lenderId;

    const { error } = await supabase
      .from('applications')
      .update({ lender_id })
      .eq('id', appId);

    if (error) {
      alert('Error updating lender: ' + error.message);
    } else {
      setApps((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, lender_id } : a,
        ),
      );
    }

    setUpdatingLenderId(null);
  };

  const handleNotesSave = async (appId: string, notes: string) => {
    setSavingAppId(appId);
    const { error } = await supabase
      .from('applications')
      .update({ admin_notes: notes })
      .eq('id', appId);

    if (error) {
      alert('Error saving notes: ' + error.message);
    } else {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, admin_notes: notes } : a)),
      );
    }
    setSavingAppId(null);
  };

  if (loading || loadingApps || loadingLenders) {
    return <p className="p-4">Loading…</p>;
  }

  if (!user) return null;

  return (
    <main className="max-w-6xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-red-600">Admin</p>
          <h1 className="text-2xl font-semibold">Applications overview</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/lenders"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Manage lenders
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Filters */}
      <section className="rounded-md border bg-white px-4 py-3 flex flex-wrap gap-4 items-center">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Stage</p>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="all">All</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Lender</p>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={lenderFilter}
            onChange={(e) => setLenderFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="none">Unassigned</option>
            {lenders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-500">
          Showing {filteredApps.length} of {apps.length} applications
        </p>
      </section>

      {/* Applications list */}
      <section className="space-y-3">
        {filteredApps.length === 0 ? (
          <p className="text-sm text-gray-600">
            No applications match your filters.
          </p>
        ) : (
          filteredApps.map((a) => {
            const lender = a.lender_id ? lenderMap[a.lender_id] : undefined;

            return (
              <div
                key={a.id}
                className="rounded-md border bg-white px-4 py-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-500">
                      {a.company?.name ?? 'No company'} •{' '}
                      {a.owner?.email ??
                        a.prospective_client_email ??
                        'Unknown client'}
                    </p>
                    <p className="text-lg font-semibold">
                      £{a.requested_amount.toLocaleString()} – {a.loan_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap gap-2">
                      {a.is_hidden && (
                        <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          Draft (hidden from client)
                        </span>
                      )}
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                        {a.stage}
                      </span>
                      {lender && (
                        <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {lender.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls: stage & lender */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Stage</p>
                    <select
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      value={a.stage}
                      disabled={updatingStageId === a.id}
                      onChange={(e) => handleStageChange(a.id, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 mb-1">Lender</p>
                    <select
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      value={a.lender_id ?? 'none'}
                      disabled={updatingLenderId === a.id}
                      onChange={(e) =>
                        handleLenderChange(
                          a.id,
                          e.target.value as string | 'none',
                        )
                      }
                    >
                      <option value="none">Unassigned</option>
                      {lenders.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Admin notes */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">Admin notes</p>
                  <AdminNotesEditor
                    appId={a.id}
                    initialValue={a.admin_notes ?? ''}
                    onSave={handleNotesSave}
                    saving={savingAppId === a.id}
                  />
                </div>

                {/* Info requests link */}
                <div className="flex justify-end pt-2">
                  <Link
                    href={`/admin/applications/${a.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Manage information requests
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function AdminNotesEditor({
  appId,
  initialValue,
  onSave,
  saving,
}: {
  appId: string;
  initialValue: string;
  onSave: (appId: string, notes: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(initialValue);
    setDirty(false);
  }, [initialValue]);

  return (
    <div className="space-y-1">
      <textarea
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        rows={2}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="Internal notes visible only to admins (e.g. lender feedback, risk comments)…"
      />
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            onSave(appId, value);
            setDirty(false);
          }}
          className="rounded-md bg-gray-800 px-3 py-1 text-xs text-white hover:bg-black disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  );
}
