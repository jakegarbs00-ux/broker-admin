'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, PageHeader, Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

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

  // Only admins allowed
  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (loading || loadingApps || loadingLenders) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading applications...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Applications Overview"
        description={`Managing ${apps.length} applications`}
        actions={
          <Link
            href="/admin/lenders"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Manage Lenders
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="all">All stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {formatStage(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lender</label>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={lenderFilter}
                onChange={(e) => setLenderFilter(e.target.value)}
              >
                <option value="all">All lenders</option>
                <option value="none">Unassigned</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium">{filteredApps.length}</span> of{' '}
                <span className="font-medium">{apps.length}</span> applications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications list */}
      <div className="space-y-4">
        {filteredApps.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No applications match your filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredApps.map((a) => {
            const lender = a.lender_id ? lenderMap[a.lender_id] : undefined;

            return (
              <Card key={a.id}>
                <CardContent className="space-y-4">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        {a.company?.name ?? 'No company'} •{' '}
                        {a.owner?.email ?? a.prospective_client_email ?? 'Unknown client'}
                      </p>
                      <p className="text-xl font-semibold text-gray-900">
                        £{a.requested_amount?.toLocaleString()} – {a.loan_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(a.created_at).toLocaleDateString('en-GB')} at{' '}
                        {new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.is_hidden && (
                        <Badge variant="warning">Draft (hidden)</Badge>
                      )}
                      <Badge variant={getStageBadgeVariant(a.stage)}>
                        {formatStage(a.stage)}
                      </Badge>
                      {lender && (
                        <Badge variant="info">{lender.name}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Controls: stage & lender */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                      <select
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        value={a.stage}
                        disabled={updatingStageId === a.id}
                        onChange={(e) => handleStageChange(a.id, e.target.value)}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {formatStage(s)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Lender</label>
                      <select
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        value={a.lender_id ?? 'none'}
                        disabled={updatingLenderId === a.id}
                        onChange={(e) =>
                          handleLenderChange(a.id, e.target.value as string | 'none')
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
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Admin Notes</label>
                    <AdminNotesEditor
                      appId={a.id}
                      initialValue={a.admin_notes ?? ''}
                      onSave={handleNotesSave}
                      saving={savingAppId === a.id}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <Link
                      href={`/admin/applications/${a.id}`}
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Manage information requests →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardShell>
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
    <div className="space-y-2">
      <textarea
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  );
}