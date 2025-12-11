'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, EmptyState } from '@/components/ui';

type Partner = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  referred_count: number;
  applications_count: number;
};

export default function AdminPartnersPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadPartners = async () => {
      setError(null);

      // Get all partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_name, created_at')
        .eq('role', 'PARTNER')
        .order('created_at', { ascending: false });

      if (partnersError) {
        console.error('Error loading partners', partnersError);
        setError('Error loading partners: ' + partnersError.message);
        setLoadingData(false);
        return;
      }

      if (!partnersData || partnersData.length === 0) {
        setPartners([]);
        setLoadingData(false);
        return;
      }

      // For each partner, count their referrals and applications
      const partnerIds = partnersData.map((p) => p.id);
      
      // Get referred clients count
      const { data: referralsData } = await supabase
        .from('profiles')
        .select('referred_by')
        .in('referred_by', partnerIds);

      const referralCounts: Record<string, number> = {};
      (referralsData || []).forEach((r: any) => {
        referralCounts[r.referred_by] = (referralCounts[r.referred_by] || 0) + 1;
      });

      // Get applications created by partners
      const { data: appsData } = await supabase
        .from('applications')
        .select('created_by')
        .in('created_by', partnerIds);

      const appsCounts: Record<string, number> = {};
      (appsData || []).forEach((a: any) => {
        appsCounts[a.created_by] = (appsCounts[a.created_by] || 0) + 1;
      });

      const processedPartners: Partner[] = partnersData.map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        company_name: p.company_name,
        created_at: p.created_at,
        referred_count: referralCounts[p.id] || 0,
        applications_count: appsCounts[p.id] || 0,
      }));

      setPartners(processedPartners);
      setLoadingData(false);
    };

    loadPartners();
  }, [loading, profile?.role, supabase]);

  const handlePromoteToPartner = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    setError(null);

    // Find the user by email and update their role
    const { data: userData, error: findError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', newEmail.trim())
      .maybeSingle();

    if (findError) {
      setError('Error finding user: ' + findError.message);
      setCreating(false);
      return;
    }

    if (!userData) {
      setError('No user found with that email address.');
      setCreating(false);
      return;
    }

    if (userData.role === 'PARTNER') {
      setError('This user is already a partner.');
      setCreating(false);
      return;
    }

    if (userData.role === 'ADMIN') {
      setError('Cannot change role of an admin user.');
      setCreating(false);
      return;
    }

    // Update role to PARTNER
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'PARTNER' })
      .eq('id', userData.id);

    if (updateError) {
      setError('Error promoting user: ' + updateError.message);
      setCreating(false);
      return;
    }

    // Add to the list
    setPartners((prev) => [
      {
        id: userData.id,
        email: userData.email,
        full_name: null,
        company_name: null,
        created_at: new Date().toISOString(),
        referred_count: 0,
        applications_count: 0,
      },
      ...prev,
    ]);
    setNewEmail('');
    setCreating(false);
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading partners...</p>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
        <p className="text-gray-600">{partners.length} registered partners</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - partners list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">All Partners</h2>
                <Badge variant="default">{partners.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {partners.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                    title="No partners yet"
                    description="Promote a user to partner using the form."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Partner
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Company
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Referrals
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Applications
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Joined
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {partners.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{p.full_name || p.email}</p>
                              {p.full_name && (
                                <p className="text-xs text-gray-500">{p.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{p.company_name || '—'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {p.referred_count > 0 ? (
                              <Badge variant="success">{p.referred_count}</Badge>
                            ) : (
                              <span className="text-sm text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {p.applications_count > 0 ? (
                              <Badge variant="info">{p.applications_count}</Badge>
                            ) : (
                              <span className="text-sm text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(p.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link
                              href={`/admin/partners/${p.id}`}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
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
        </div>

        {/* Sidebar - Promote user form */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Promote to Partner</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter the email address of an existing user to promote them to partner status.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={creating || !newEmail.trim()}
                onClick={handlePromoteToPartner}
              >
                {creating ? 'Promoting...' : 'Promote to Partner'}
              </Button>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <Card className="mt-6">
            <CardHeader>
              <h2 className="font-medium text-gray-900">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Partners</span>
                <span className="font-medium text-gray-900">{partners.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Referrals</span>
                <span className="font-medium text-gray-900">
                  {partners.reduce((sum, p) => sum + p.referred_count, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Applications</span>
                <span className="font-medium text-gray-900">
                  {partners.reduce((sum, p) => sum + p.applications_count, 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}