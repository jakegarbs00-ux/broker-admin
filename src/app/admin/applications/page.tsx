'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, Badge, getStageBadgeVariant, formatStage } from '@/components/ui';

type AdminApp = {
  id: string;
  requested_amount: number;
  stage: string;
  loan_type: string;
  urgency: string | null;
  workflow_status: string | null;
  created_at: string;
  is_hidden: boolean;
  lender_id: string | null;
  company_id: string | null;
  prospective_client_email: string | null;
  company?: { id: string; name: string } | null;
  lender?: { id: string; name: string } | null;
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
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');

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
      
      // Get all applications with company and lender info
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          *,
          workflow_status,
          company:company_id(id, name),
          lender:lender_id(id, name)
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

      setApps(appsData as AdminApp[]);
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
    if (workflowFilter !== 'all' && a.workflow_status !== workflowFilter) return false;
    return true;
  });

  if (loading || loadingApps || loadingLenders) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading applications...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Applications</h1>
        <p className="text-[var(--color-text-secondary)]">Managing {apps.length} applications</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Stage</label>
            <select
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
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
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Lender</label>
            <select
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
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

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Workflow Status</label>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
            >
              <option value="all">All Workflow Status</option>
              <option value="pending">Pending</option>
              <option value="eligible">Eligible</option>
              <option value="submitted_to_lenders">Submitted to Lenders</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="ml-auto">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Showing <span className="font-medium">{filteredApps.length}</span> of{' '}
              <span className="font-medium">{apps.length}</span> applications
            </p>
          </div>
        </div>
      </div>

      {/* Applications list - full width */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-12 text-center">
            <p className="text-[var(--color-text-tertiary)]">No applications match your filters.</p>
          </div>
        ) : (
          filteredApps.map((a) => {
            const lender = a.lender_id ? (a.lender as { id: string; name: string } | undefined) : undefined;
            const companyName = a.company?.name;
            const companyId = a.company?.id;
            const clientEmail = a.prospective_client_email;
            
            // Display logic: show what we have
            const primaryDisplay = companyName || clientEmail || `Application ${a.id.slice(0, 8)}`;
            const secondaryDisplay = companyName && clientEmail ? clientEmail : null;

            return (
              <Link key={a.id} href={`/admin/applications/${a.id}`} className="block">
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 hover:shadow-md hover:border-[var(--color-border-strong)] transition-all cursor-pointer">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Left side - main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {companyName || 'No client linked'}
                        </span>
                        {clientEmail && companyName && (
                          <>
                            <span className="text-[var(--color-border-strong)]">•</span>
                            <span className="text-sm text-[var(--color-text-tertiary)] truncate">{clientEmail}</span>
                          </>
                        )}
                        {!companyName && !clientEmail && (
                          <Badge variant="warning">No client linked</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        £{a.requested_amount?.toLocaleString()} – {a.loan_type}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
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
                      {a.workflow_status && (
                        <Badge variant={
                          a.workflow_status === 'submitted_to_lenders' ? 'success' :
                          a.workflow_status === 'failed' ? 'error' :
                          'default'
                        }>
                          {a.workflow_status === 'submitted_to_lenders' ? 'Submitted' :
                           a.workflow_status === 'failed' ? 'Failed' :
                           a.workflow_status === 'eligible' ? 'Eligible' :
                           a.workflow_status === 'pending' ? 'Pending' :
                           a.workflow_status}
                        </Badge>
                      )}
                      <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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