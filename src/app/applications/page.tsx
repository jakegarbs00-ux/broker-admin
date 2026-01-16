'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import {
  Card,
  CardContent,
  PageHeader,
  Badge,
  getStageBadgeVariant,
  formatStage,
  Button,
  EmptyState,
} from '@/components/ui';

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  purpose: string;
  urgency: string | null;
  stage: string;
  created_at: string;
  submitted_at: string | null;
  company: { id: string; name: string } | null;
  lender: { id: string; name: string } | null;
};

export default function ApplicationsListPage() {
  const { user, profile, loading: authLoading } = useUserProfile();
  const supabase = getSupabaseClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadApplications = async () => {
      console.log('Loading applications for user:', user.id);

      // CRITICAL: Verify authenticated user ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[ApplicationsPage] SECURITY: User ID mismatch');
        setLoading(false);
        return;
      }

      // Get user's profile to find their company_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id) // Use authenticated user ID
        .maybeSingle(); // Use maybeSingle to avoid errors

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setLoading(false);
        return;
      }

      if (!profile?.company_id) {
        console.log('No company_id found for user');
        setApplications([]);
        setLoading(false);
        return;
      }

      console.log('Fetching applications for company:', profile.company_id);

      // Fetch applications for this company
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          requested_amount,
          loan_type,
          purpose,
          urgency,
          stage,
          created_at,
          submitted_at,
          company:company_id(id, name),
          lender:accepted_lender_id(id, name)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching applications:', error);
      } else {
        console.log('Found applications:', data);
        setApplications((data || []) as unknown as Application[]);
      }
      setLoading(false);
    };

    loadApplications();
  }, [user, supabase]);

  if (authLoading || loading) {
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

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Your Applications"
        description="View and manage all your funding applications."
        actions={
          <Link href="/apply">
            <Button variant="primary">Start Application</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="No applications yet"
              description="Start your funding journey by creating your first application."
              action={
                <Link href="/apply">
                  <Button variant="primary">Start Application</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Company
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Amount
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Type
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Urgency
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Stage
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-6 py-3">
                      Created
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-[var(--color-bg-tertiary)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {app.company?.name ?? 'No company'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          £{app.requested_amount?.toLocaleString() ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {app.loan_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {app.urgency ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStageBadgeVariant(app.stage)}>
                          {formatStage(app.stage)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-tertiary)]">
                        {new Date(app.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/applications/${app.id}`}
                          className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}