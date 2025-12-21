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
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  partner_company?: {
    id: string;
    name: string;
  } | null;
  referralCount: number;
  applicationCount: number;
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

      // Get all partners with their partner company
      const { data: partnersData, error: partnersError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          created_at,
          partner_company:partner_company_id(id, name)
        `)
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

      // Get referral counts for each partner
      const partnersWithCounts = await Promise.all(
        partnersData.map(async (partner) => {
          // Count companies referred by this partner
          const { count: referralCount } = await supabase
            .from('companies')
            .select('id', { count: 'exact', head: true })
            .eq('referred_by', partner.id);

          // Count applications from referred companies
          const { data: referredCompanies } = await supabase
            .from('companies')
            .select('id')
            .eq('referred_by', partner.id);

          const companyIds = referredCompanies?.map((c) => c.id) || [];

          let appCount = 0;
          if (companyIds.length > 0) {
            const { count } = await supabase
              .from('applications')
              .select('id', { count: 'exact', head: true })
              .in('company_id', companyIds);
            appCount = count || 0;
          }

          return {
            ...partner,
            referralCount: referralCount || 0,
            applicationCount: appCount || 0,
          };
        })
      );

      setPartners(partnersWithCounts as Partner[]);
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

    // Reload partners list
    const loadPartners = async () => {
      const { data: partnersData } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          created_at,
          partner_company:partner_company_id(id, name)
        `)
        .eq('role', 'PARTNER')
        .order('created_at', { ascending: false });

      if (partnersData && partnersData.length > 0) {
        const partnersWithCounts = await Promise.all(
          partnersData.map(async (partner) => {
            const { count: referralCount } = await supabase
              .from('companies')
              .select('id', { count: 'exact', head: true })
              .eq('referred_by', partner.id);

            const { data: referredCompanies } = await supabase
              .from('companies')
              .select('id')
              .eq('referred_by', partner.id);

            const companyIds = referredCompanies?.map((c) => c.id) || [];

            let appCount = 0;
            if (companyIds.length > 0) {
              const { count } = await supabase
                .from('applications')
                .select('id', { count: 'exact', head: true })
                .in('company_id', companyIds);
              appCount = count || 0;
            }

            return {
              ...partner,
              referralCount: referralCount || 0,
              applicationCount: appCount || 0,
            };
          })
        );

        setPartners(partnersWithCounts as Partner[]);
      }
    };

    loadPartners();
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

  const totalReferrals = partners.reduce((sum, p) => sum + p.referralCount, 0);
  const totalApplications = partners.reduce((sum, p) => sum + p.applicationCount, 0);

  return (
    <DashboardShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Partners</h1>
        <p className="text-gray-600 mb-6">{partners.length} registered partners</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main table - takes 3 columns */}
          <div className="lg:col-span-3 bg-white rounded-lg border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">All Partners</h2>
              <span className="text-gray-500">{partners.length}</span>
            </div>

            {partners.length === 0 ? (
              <div className="py-12">
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
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">NAME</th>
                      <th className="pb-3 font-medium">COMPANY</th>
                      <th className="pb-3 font-medium">REFERRALS</th>
                      <th className="pb-3 font-medium">APPS</th>
                      <th className="pb-3 font-medium">JOINED</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((partner) => (
                      <tr key={partner.id} className="border-b hover:bg-gray-50">
                        <td className="py-4">
                          <div>
                            <p className="font-medium">
                              {partner.first_name || partner.last_name
                                ? `${partner.first_name || ''} ${partner.last_name || ''}`.trim()
                                : partner.email}
                            </p>
                            <p className="text-sm text-gray-500">{partner.email}</p>
                          </div>
                        </td>
                        <td className="py-4">{partner.partner_company?.name || '—'}</td>
                        <td className="py-4">{partner.referralCount}</td>
                        <td className="py-4">{partner.applicationCount}</td>
                        <td className="py-4">
                          {new Date(partner.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4">
                          {partner.partner_company?.id ? (
                            <Link
                              href={`/admin/partners/${partner.partner_company.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              View →
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar - takes 1 column */}
          <div className="space-y-6">
            {/* Promote to Partner card */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Promote to Partner</h3>
              <p className="text-sm text-gray-600 mb-4">
                Enter the email address of an existing user to promote them to partner status.
              </p>
              <input
                type="email"
                placeholder="user@example.com"
                className="w-full px-3 py-2 border rounded mb-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Button
                variant="primary"
                className="w-full"
                disabled={creating || !newEmail.trim()}
                onClick={handlePromoteToPartner}
              >
                {creating ? 'Promoting...' : 'Promote to Partner'}
              </Button>
            </div>

            {/* Summary card */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Partners</span>
                  <span className="font-medium">{partners.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Referrals</span>
                  <span className="font-medium">{totalReferrals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Applications</span>
                  <span className="font-medium">{totalApplications}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}