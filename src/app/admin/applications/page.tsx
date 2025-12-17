'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, Badge, getStageBadgeVariant, formatStage, Button } from '@/components/ui';

type AdminApp = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  created_at: string;
  is_hidden: boolean;
  lender_id: string | null;
  company_id: string | null;
  created_by: string | null;
  prospective_client_email: string | null;
  company: { id: string; name: string }[] | null;
  creator: { email: string | null; full_name: string | null }[] | null;
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
  'information_requested',
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

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingApps(false);
      setLoadingLenders(false);
      return;
    }

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
      
      // Get all applications with company and creator info
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          id,
          requested_amount,
          stage,
          loan_type,
          urgency,
          created_at,
          is_hidden,
          lender_id,
          company_id,
          created_by,
          prospective_client_email,
          company:companies!applications_company_id_fkey(id, name),
          creator:profiles!applications_created_by_fkey(id, email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error loading applications', appsError);
        setError('Error loading applications: ' + appsError.message);
        setLoadingApps(false);
        return;
      }

      if (!appsData || appsData.length === 0) {
        setApps([]);
        setLoadingApps(false);
        return;
      }

      // Map to AdminApp type
      const enrichedApps: AdminApp[] = appsData.map((a: any) => ({
        id: a.id,
        requested_amount: a.requested_amount,
        stage: a.stage,
        loan_type: a.loan_type,
        urgency: a.urgency,
        created_at: a.created_at,
        is_hidden: a.is_hidden,
        lender_id: a.lender_id,
        company_id: a.company_id,
        created_by: a.created_by,
        prospective_client_email: a.prospective_client_email,
        company: a.company ? [a.company] : null,
        creator: a.creator ? [a.creator] : null,
      }));

      setApps(enrichedApps);
      setLoadingApps(false);
    };

    loadLenders();
    loadApps();
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

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-600">Managing {apps.length} applications</p>
        </div>
        <Link href="/admin/applications/create">
          <Button variant="primary">Create Application</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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
      </div>

      {/* Applications list - full width */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No applications match your filters.</p>
          </div>
        ) : (
          filteredApps.map((a) => {
            const lender = a.lender_id ? lenderMap[a.lender_id] : undefined;
            const companyName = a.company?.[0]?.name;
            const companyId = a.company?.[0]?.id;
            const creatorEmail = a.creator?.[0]?.email || a.prospective_client_email;
            const creatorName = a.creator?.[0]?.full_name;
            
            // Display logic: show what we have
            const primaryDisplay = companyName || creatorEmail || creatorName || `Application ${a.id.slice(0, 8)}`;
            const secondaryDisplay = companyName && creatorEmail ? creatorEmail : null;

            return (
              <Link key={a.id} href={`/admin/applications/${a.id}`} className="block">
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Left side - main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{primaryDisplay}</span>
                        {secondaryDisplay && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-500 truncate">{secondaryDisplay}</span>
                          </>
                        )}
                        {!companyName && !creatorEmail && (
                          <Badge variant="warning">No client linked</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        £{a.requested_amount?.toLocaleString()} – {a.loan_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(a.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>

                    {/* Right side - badges */}
                    <div className="flex items-center gap-2">
                      {a.is_hidden && (
                        <Badge variant="warning">Draft</Badge>
                      )}
                      {lender && (
                        <Badge variant="info">{lender.name}</Badge>
                      )}
                      <Badge variant={getStageBadgeVariant(a.stage)}>
                        {formatStage(a.stage)}
                      </Badge>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}