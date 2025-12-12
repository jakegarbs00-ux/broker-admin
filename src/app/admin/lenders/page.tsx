'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button, EmptyState } from '@/components/ui';

type Lender = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
  applications_count: number;
};

export default function AdminLendersPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadLenders = async () => {
      setError(null);

      // Get lenders - select only columns that exist in the database
      const { data: lendersData, error: lendersError } = await supabase
        .from('lenders')
        .select('id, name, status, created_at')
        .order('name', { ascending: true });

      if (lendersError) {
        console.error('Error loading lenders', lendersError);
        setError('Error loading lenders: ' + lendersError.message);
        setLoadingData(false);
        return;
      }

      // Add contact_email and contact_phone as null (columns may not exist in DB)
      const enrichedLendersData = (lendersData || []).map((l: any) => ({
        ...l,
        contact_email: null,
        contact_phone: null,
      }));

      // Get application counts
      const { data: appCounts } = await supabase
        .from('applications')
        .select('lender_id');

      const countMap: Record<string, number> = {};
      (appCounts || []).forEach((a: any) => {
        if (a.lender_id) {
          countMap[a.lender_id] = (countMap[a.lender_id] || 0) + 1;
        }
      });

      const processedLenders: Lender[] = enrichedLendersData.map((l) => ({
        ...l,
        applications_count: countMap[l.id] || 0,
      }));

      setLenders(processedLenders);
      setLoadingData(false);
    };

    loadLenders();
  }, [loading, profile?.role, supabase]);

  const handleAddLender = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);

    const { data, error } = await supabase
      .from('lenders')
      .insert({ name: newName.trim(), status: 'active' })
      .select('id, name, contact_email, contact_phone, status, created_at')
      .single();

    if (error) {
      setError('Error adding lender: ' + error.message);
      setCreating(false);
      return;
    }

    if (data) {
      // Reload lenders to ensure we have the latest data
      const { data: lendersData, error: lendersError } = await supabase
        .from('lenders')
        .select('id, name, status, created_at')
        .order('name', { ascending: true });

      if (lendersError) {
        setError('Error reloading lenders: ' + lendersError.message);
        setCreating(false);
        return;
      }

      // Add contact_email and contact_phone as null (columns may not exist in DB)
      const enrichedLendersData = (lendersData || []).map((l: any) => ({
        ...l,
        contact_email: null,
        contact_phone: null,
      }));

      // Get application counts
      const { data: appCounts } = await supabase
        .from('applications')
        .select('lender_id');

      const countMap: Record<string, number> = {};
      (appCounts || []).forEach((a: any) => {
        if (a.lender_id) {
          countMap[a.lender_id] = (countMap[a.lender_id] || 0) + 1;
        }
      });

      const processedLenders: Lender[] = enrichedLendersData.map((l) => ({
        ...l,
        applications_count: countMap[l.id] || 0,
      }));

      setLenders(processedLenders);
      setNewName('');
      setCreating(false);
    } else {
      setCreating(false);
    }
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading lenders...</p>
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
      <PageHeader
        title="Lenders"
        description={`${lenders.length} lenders registered`}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - lenders list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">All Lenders</h2>
                <Badge variant="default">{lenders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lenders.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    title="No lenders yet"
                    description="Add your first lender using the form."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Lender
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Contact
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Applications
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Added
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lenders.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/admin/lenders/${l.id}`}
                              className="font-medium text-gray-900 hover:text-blue-600"
                            >
                              {l.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {l.contact_email || l.contact_phone || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {l.applications_count > 0 ? (
                              <Badge variant="info">{l.applications_count}</Badge>
                            ) : (
                              <span className="text-sm text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(l.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link
                              href={`/admin/lenders/${l.id}`}
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

        {/* Sidebar - Add lender form */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Add Lender</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lender Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Funding Circle"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddLender();
                  }}
                />
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={creating || !newName.trim()}
                onClick={handleAddLender}
              >
                {creating ? 'Adding...' : 'Add Lender'}
              </Button>
              <p className="text-xs text-gray-500">
                After adding, click the lender to add contact details.
              </p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="mt-6">
            <CardHeader>
              <h2 className="font-medium text-gray-900">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Lenders</span>
                <span className="font-medium text-gray-900">{lenders.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Assigned Apps</span>
                <span className="font-medium text-gray-900">
                  {lenders.reduce((sum, l) => sum + l.applications_count, 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}