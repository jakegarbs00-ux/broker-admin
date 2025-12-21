'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button, getStageBadgeVariant, formatStage } from '@/components/ui';

type Partner = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  created_at: string;
};

type ReferredCompany = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  created_at: string;
  owner_email: string | null;
  applications_count: number;
  open_applications_count: number;
};

export default function AdminPartnerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [referredCompanies, setReferredCompanies] = useState<ReferredCompany[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
  });

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Load partner profile
      const { data: partnerData, error: partnerError } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_name, phone, created_at')
        .eq('id', id)
        .eq('role', 'PARTNER')
        .single();

      if (partnerError || !partnerData) {
        setError('Partner not found');
        setLoadingData(false);
        return;
      }

      setPartner(partnerData as Partner);
      setFormData({
        full_name: partnerData.full_name || '',
        company_name: partnerData.company_name || '',
        phone: partnerData.phone || '',
      });

      // Load clients referred by this partner
      const { data: referredClients } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('referred_by', id);

      if (!referredClients || referredClients.length === 0) {
        setReferredCompanies([]);
        setLoadingData(false);
        return;
      }

      const clientIds = referredClients.map((c) => c.id);
      const clientEmailMap: Record<string, string> = {};
      referredClients.forEach((c) => {
        clientEmailMap[c.id] = c.email;
      });

      // Get companies owned by referred clients
      const { data: companiesData } = await supabase
        .from('companies')
        .select(`
          id, name, company_number, industry, created_at, owner_id,
          applications(id, stage)
        `)
        .in('owner_id', clientIds)
        .order('created_at', { ascending: false });

      const closedStages = ['funded', 'declined', 'withdrawn'];

      const processedCompanies: ReferredCompany[] = (companiesData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        company_number: c.company_number,
        industry: c.industry,
        created_at: c.created_at,
        owner_email: clientEmailMap[c.owner_id] || null,
        applications_count: c.applications?.length || 0,
        open_applications_count: c.applications?.filter((a: any) => !closedStages.includes(a.stage)).length || 0,
      }));

      setReferredCompanies(processedCompanies);
      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name.trim() || null,
        company_name: formData.company_name.trim() || null,
        phone: formData.phone.trim() || null,
      })
      .eq('id', id);

    if (error) {
      alert('Error saving: ' + error.message);
    } else {
      setPartner((prev) => prev ? {
        ...prev,
        full_name: formData.full_name.trim() || null,
        company_name: formData.company_name.trim() || null,
        phone: formData.phone.trim() || null,
      } : null);
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading partner...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'ADMIN' || error) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">{error || 'You do not have permission to view this page.'}</p>
        </div>
      </DashboardShell>
    );
  }

  if (!partner) return null;

  const totalApplications = referredCompanies.reduce((sum, c) => sum + c.applications_count, 0);
  const openApplications = referredCompanies.reduce((sum, c) => sum + c.open_applications_count, 0);

  return (
    <DashboardShell>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/admin/partners" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Partners
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {partner.full_name || partner.email}
          </h1>
          {partner.company_name && (
            <p className="text-lg text-gray-600">{partner.company_name}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Partner since {new Date(partner.created_at).toLocaleDateString('en-GB')}
          </p>
        </div>
        <Badge variant="purple">Partner</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Partner info */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Contact Information</h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData((p) => ({ ...p, company_name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Partner Co Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="+44 7700 900000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Email</dt>
                    <dd className="text-sm font-medium text-gray-900">{partner.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Full Name</dt>
                    <dd className="text-sm font-medium text-gray-900">{partner.full_name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Company</dt>
                    <dd className="text-sm font-medium text-gray-900">{partner.company_name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Phone</dt>
                    <dd className="text-sm font-medium text-gray-900">{partner.phone || '—'}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Statistics</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Referred Companies</span>
                <span className="font-medium text-gray-900">{referredCompanies.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Applications</span>
                <span className="font-medium text-gray-900">{totalApplications}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Open Applications</span>
                <span className="font-medium text-gray-900">{openApplications}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Referred companies */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Referred Companies</h2>
                <Badge variant="default">{referredCompanies.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {referredCompanies.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No referred companies yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Company
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Client Email
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Applications
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Open
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                          Created
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {referredCompanies.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{c.name}</p>
                              {c.industry && (
                                <p className="text-xs text-gray-500">{c.industry}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{c.owner_email || '—'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{c.applications_count}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {c.open_applications_count > 0 ? (
                              <Badge variant="info">{c.open_applications_count}</Badge>
                            ) : (
                              <span className="text-sm text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(c.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link
                              href={`/admin/companies/${c.id}`}
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
      </div>
    </DashboardShell>
  );
}