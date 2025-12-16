'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

export default function AdminAddPartnerUserPage() {
  const params = useParams();
  const router = useRouter();
  const partnerCompanyId = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partnerCompanyName, setPartnerCompanyName] = useState<string>('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    is_primary_contact: false,
  });

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadPartnerCompany = async () => {
      const { data: companyData } = await supabase
        .from('partner_companies')
        .select('name')
        .eq('id', partnerCompanyId)
        .single();

      if (companyData) {
        setPartnerCompanyName(companyData.name);
      }
      setLoadingData(false);
    };

    loadPartnerCompany();
  }, [loading, profile?.role, partnerCompanyId, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || profile?.role !== 'ADMIN') return;

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/partner-users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner_company_id: partnerCompanyId,
          email: formData.email.trim(),
          full_name: formData.full_name.trim() || null,
          phone: formData.phone.trim() || null,
          is_primary_contact: formData.is_primary_contact,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error creating partner user', result);
        setError(result.error || 'Error creating partner user');
        setSaving(false);
        return;
      }

      // Redirect to partner company detail page
      router.push(`/admin/partners/${partnerCompanyId}`);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
      setSaving(false);
    }
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
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

  return (
    <DashboardShell>
      <PageHeader
        title="Add Partner User"
        description={`Add a new partner user to ${partnerCompanyName}`}
      />

      <div className="max-w-2xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">User Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="partner@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+44 7700 900000"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_primary_contact"
                  id="is_primary_contact"
                  checked={formData.is_primary_contact}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_primary_contact" className="ml-2 block text-sm text-gray-700">
                  Set as primary contact
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href={`/admin/partners/${partnerCompanyId}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}

