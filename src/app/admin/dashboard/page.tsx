'use client';

import { useEffect, useState, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader } from '@/components/ui';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { ApplicationsChart } from '@/components/dashboard/ApplicationsChart';
import { ApplicationsOverTimeChart } from '@/components/dashboard/ApplicationsOverTimeChart';
import { FileText, TrendingUp, PoundSterling, Users } from 'lucide-react';
import Link from 'next/link';

type DashboardStats = {
  totalApplications: number;
  openApplications: number;
  totalPartners: number;
  fundedThisMonth: number;
};

type StageData = {
  stage: string;
  count: number;
  color: string;
};

type MonthlyData = {
  month: string;
  count: number;
};

type RecentActivity = {
  id: string;
  company_name: string;
  stage: string;
  requested_amount: number;
  updated_at: string;
};

export default function AdminDashboardPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    openApplications: 0,
    totalPartners: 0,
    fundedThisMonth: 0,
  });
  const [stageData, setStageData] = useState<StageData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load total applications
        const { count: totalApps } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true });

        // Load open applications (not closed)
        const closedStages = ['funded', 'declined', 'withdrawn'];
        const { count: openApps } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .not('stage', 'in', `(${closedStages.join(',')})`);

        // Load total partners
        const { count: partnerCount } = await supabase
          .from('partner_companies')
          .select('*', { count: 'exact', head: true });

        // Load funded this month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const { data: fundedApps } = await supabase
          .from('applications')
          .select('requested_amount')
          .eq('stage', 'funded')
          .gte('updated_at', firstDayOfMonth.toISOString());

        const fundedAmount = fundedApps?.reduce((sum, app) => sum + (app.requested_amount || 0), 0) || 0;

        setStats({
          totalApplications: totalApps || 0,
          openApplications: openApps || 0,
          totalPartners: partnerCount || 0,
          fundedThisMonth: fundedAmount,
        });

        // Load applications by stage
        const { data: appsByStage } = await supabase
          .from('applications')
          .select('stage');

        if (appsByStage) {
          const stageCounts = appsByStage.reduce((acc, app) => {
            acc[app.stage] = (acc[app.stage] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const colors: Record<string, string> = {
            created: '#94a3b8',
            submitted: '#fef3c7',
            in_credit: '#dbeafe',
            approved: '#d1fae5',
            funded: '#10b981',
            declined: '#ef4444',
            withdrawn: '#6b7280',
          };

          const formattedStageData: StageData[] = Object.entries(stageCounts).map(([stage, count]) => ({
            stage,
            count,
            color: colors[stage] || '#f1f5f9',
          }));

          setStageData(formattedStageData);
        }

        // Load applications over last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data: monthlyApps } = await supabase
          .from('applications')
          .select('created_at')
          .gte('created_at', sixMonthsAgo.toISOString());

        if (monthlyApps) {
          const monthlyCounts: Record<string, number> = {};
          monthlyApps.forEach((app) => {
            const date = new Date(app.created_at);
            const monthKey = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
            monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
          });

          const formattedMonthlyData: MonthlyData[] = Object.entries(monthlyCounts)
            .sort((a, b) => {
              // Sort by date
              const dateA = new Date(a[0]);
              const dateB = new Date(b[0]);
              return dateA.getTime() - dateB.getTime();
            })
            .map(([month, count]) => ({
              month,
              count,
            }));

          setMonthlyData(formattedMonthlyData);
        }

        // Load recent activity (last 10 applications with status changes)
        const { data: recentApps } = await supabase
          .from('applications')
          .select(`
            id,
            stage,
            requested_amount,
            updated_at,
            company:company_id(name)
          `)
          .order('updated_at', { ascending: false })
          .limit(10);

        if (recentApps) {
          const activity: RecentActivity[] = recentApps.map((app) => ({
            id: app.id,
            company_name: (app.company as any)?.name || 'Unknown',
            stage: app.stage,
            requested_amount: app.requested_amount || 0,
            updated_at: app.updated_at,
          }));
          setRecentActivity(activity);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [supabase]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatStage = (stage: string) => {
    return stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading dashboard...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader title="Admin Dashboard" description="Overview of platform activity and metrics" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          title="Total Applications"
          value={stats.totalApplications}
          icon={FileText}
        />
        <SummaryCard
          title="Open Applications"
          value={stats.openApplications}
          icon={TrendingUp}
        />
        <SummaryCard
          title="Total Partners"
          value={stats.totalPartners}
          icon={Users}
        />
        <SummaryCard
          title="Funded This Month"
          value={formatCurrency(stats.fundedThisMonth)}
          icon={PoundSterling}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ApplicationsChart data={stageData} />
        <ApplicationsOverTimeChart data={monthlyData} />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Activity</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-8">
                No recent activity
              </p>
            ) : (
              recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/admin/applications/${activity.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {activity.company_name}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {formatStage(activity.stage)} • {formatCurrency(activity.requested_amount)}
                    </p>
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(activity.updated_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

