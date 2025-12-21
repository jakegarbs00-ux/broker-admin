'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button } from '@/components/ui';

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  phone: string | null;
  created_at: string;
  company_id: string | null;
  partner_company_id: string | null;
  is_primary_contact: boolean | null;
  company?: { id: string; name: string }[] | null;
  partner_company?: { id: string; name: string }[] | null;
};

type Company = {
  id: string;
  name: string;
};

type PartnerCompany = {
  id: string;
  name: string;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [userData, setUserData] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partnerCompanies, setPartnerCompanies] = useState<PartnerCompany[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'CLIENT' as 'CLIENT' | 'PARTNER' | 'ADMIN',
    company_id: '',
    partner_company_id: '',
    is_primary_contact: false,
  });

  useEffect(() => {
    const loadData = async () => {
      if (loading) return;
      if (profile?.role !== 'ADMIN') {
        setLoadingData(false);
        return;
      }

      setError(null);

      // Load user
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select(`
          *,
          company:company_id(id, name),
          partner_company:partner_company_id(id, name)
        `)
        .eq('id', id)
        .single();

      if (userError || !userData) {
        setError('User not found');
        setLoadingData(false);
        return;
      }

      setUserData(userData as User);
      setFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: (userData.role as 'CLIENT' | 'PARTNER' | 'ADMIN') || 'CLIENT',
        company_id: userData.company_id || '',
        partner_company_id: userData.partner_company_id || '',
        is_primary_contact: userData.is_primary_contact || false,
      });

      // Load companies for dropdown
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name', { ascending: true });
      setCompanies((companiesData || []) as Company[]);

      // Load partner companies for dropdown
      const { data: partnerCompaniesData } = await supabase
        .from('partner_companies')
        .select('id, name')
        .order('name', { ascending: true });
      setPartnerCompanies((partnerCompaniesData || []) as PartnerCompany[]);

      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, id, supabase]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!userData) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const updatePayload: any = {
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      phone: formData.phone || null,
      role: formData.role,
      is_primary_contact: formData.is_primary_contact || null,
    };

    // Set company/partner_company based on role
    if (formData.role === 'CLIENT') {
      updatePayload.company_id = formData.company_id || null;
      updatePayload.partner_company_id = null;
    } else if (formData.role === 'PARTNER') {
      updatePayload.partner_company_id = formData.partner_company_id || null;
      updatePayload.company_id = null;
    } else {
      // ADMIN - clear both
      updatePayload.company_id = null;
      updatePayload.partner_company_id = null;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      setError('Error saving user: ' + updateError.message);
    } else {
      setSuccess('User updated successfully.');
      // Reload user data
      const { data: updatedUser } = await supabase
        .from('profiles')
        .select(`
          *,
          company:company_id(id, name),
          partner_company:partner_company_id(id, name)
        `)
        .eq('id', id)
        .single();
      if (updatedUser) {
        setUserData(updatedUser as User);
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!userData) return;

    setDeleting(true);
    setError(null);

    // Delete the user's auth account first (requires admin client)
    // For now, just delete the profile - auth cleanup should be done separately
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id);

    if (deleteError) {
      setError('Error deleting user: ' + deleteError.message);
      setDeleting(false);
      return;
    }

    // Redirect to users list
    router.push('/admin/users');
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading user...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!userData) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">User not found</p>
          <Link href="/admin/users" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to Users
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-4">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </Link>
      </div>

      <PageHeader
        title={`${formData.first_name || ''} ${formData.last_name || ''}`.trim() || userData.email}
        description={userData.email}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">User Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email changes require auth account update</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CLIENT">Client</option>
                  <option value="PARTNER">Partner</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {formData.role === 'CLIENT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <select
                    name="company_id"
                    value={formData.company_id}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.role === 'PARTNER' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partner Company
                    </label>
                    <select
                      name="partner_company_id"
                      value={formData.partner_company_id}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No partner company</option>
                      {partnerCompanies.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_primary_contact"
                      checked={formData.is_primary_contact}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Primary Contact
                    </label>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={() => router.push('/admin/users')}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">User ID</p>
                <p className="text-sm text-gray-900 font-mono">{userData.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
                <p className="text-sm text-gray-900">
                  {new Date(userData.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Current Association</p>
                <p className="text-sm text-gray-900">
                  {userData.company?.[0]?.name ||
                    userData.partner_company?.[0]?.name ||
                    '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900 text-red-600">Danger Zone</h2>
            </CardHeader>
            <CardContent>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete User
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    Are you sure you want to delete this user? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

