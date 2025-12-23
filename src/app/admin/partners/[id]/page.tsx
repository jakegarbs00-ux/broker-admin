'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Badge, Button } from '@/components/ui';

type PartnerCompany = {
  id: string;
  name: string;
  registration_number: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  website: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  created_at: string;
};

type PartnerUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_primary_contact: boolean | null;
  created_at: string;
};

type ReferredCompany = {
  id: string;
  name: string;
  company_number: string | null;
  created_at: string;
  referrer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type Application = {
  id: string;
  requested_amount: number;
  loan_type: string;
  stage: string;
  created_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
};

export default function AdminPartnerCompanyDetailPage() {
  const params = useParams();
  const partnerCompanyId = params.id as string;
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [referredCompanies, setReferredCompanies] = useState<ReferredCompany[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<PartnerCompany>>({});

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      setError(null);

      // Get partner company
      const { data: companyData, error: companyError } = await supabase
        .from('partner_companies')
        .select('*')
        .eq('id', partnerCompanyId)
        .single();

      if (companyError || !companyData) {
        setError('Partner company not found');
        setLoadingData(false);
        return;
      }

      setPartnerCompany(companyData as PartnerCompany);
      setFormData(companyData as PartnerCompany);

      // Get users in this partner company
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_primary_contact, created_at')
        .eq('partner_company_id', partnerCompanyId)
        .order('is_primary_contact', { ascending: false });

      setUsers((usersData || []) as PartnerUser[]);

      const userIds = usersData?.map((u) => u.id) || [];

      // Get referred companies
      const { data: referredCompaniesData } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          company_number,
          created_at,
          referrer:referred_by(id, first_name, last_name)
        `)
        .in('referred_by', userIds.length > 0 ? userIds : ['none'])
        .order('created_at', { ascending: false });

      setReferredCompanies((referredCompaniesData || []) as unknown as ReferredCompany[]);

      // Get applications from referred companies
      const companyIds = referredCompaniesData?.map((c) => c.id) || [];
      const { data: applicationsData } = await supabase
        .from('applications')
        .select(`
          id,
          requested_amount,
          loan_type,
          stage,
          created_at,
          company:company_id(id, name)
        `)
        .in('company_id', companyIds.length > 0 ? companyIds : ['none'])
        .order('created_at', { ascending: false });

      setApplications((applicationsData || []) as unknown as Application[]);

      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, partnerCompanyId, supabase]);

  const handleChange = (field: keyof PartnerCompany, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!partnerCompany) return;
    setSaving(true);

    const { error: updateError } = await supabase
      .from('partner_companies')
      .update(formData)
      .eq('id', partnerCompany.id);

    if (updateError) {
      alert('Error saving: ' + updateError.message);
    } else {
      setPartnerCompany((prev) => (prev ? { ...prev, ...formData } : null));
      setIsEditing(false);
    }

    setSaving(false);
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading partner company...</p>
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
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (error || !partnerCompany) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">{error || 'Partner company not found'}</p>
          <Link href="/admin/partners" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            ← Back to Partners
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const totalFunded = applications.filter((a) => a.stage === 'funded').length;

  return (
    <DashboardShell>
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <Link href="/admin/partners" className="text-sm text-[var(--color-text-tertiary)] hover:underline mb-2 block">
              ← Back to Partners
            </Link>
            <h1 className="text-2xl font-bold">{partnerCompany.name}</h1>
            <p className="text-[var(--color-text-tertiary)]">Partner Company</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Information - EDITABLE */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Company Information</h2>
                <button
                  onClick={() => {
                    if (isEditing) {
                      setFormData(partnerCompany);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Company Name</label>
                  <input
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Registration Number</label>
                  <input
                    value={formData.registration_number || ''}
                    onChange={(e) => handleChange('registration_number', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Address Line 1</label>
                  <input
                    value={formData.address_line_1 || ''}
                    onChange={(e) => handleChange('address_line_1', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">City</label>
                  <input
                    value={formData.city || ''}
                    onChange={(e) => handleChange('city', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Postcode</label>
                  <input
                    value={formData.postcode || ''}
                    onChange={(e) => handleChange('postcode', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Website</label>
                  <input
                    value={formData.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
              </div>
              {isEditing && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            {/* Referred Companies */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Referred Companies</h2>
                <span className="text-[var(--color-text-tertiary)]">{referredCompanies.length}</span>
              </div>
              {referredCompanies.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-[var(--color-text-tertiary)] border-b">
                      <th className="pb-2">Company</th>
                      <th className="pb-2">Referred By</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {referredCompanies.map((company) => (
                      <tr key={company.id} className="border-b">
                        <td className="py-3 font-medium">{company.name}</td>
                        <td className="py-3">
                          {company.referrer?.first_name} {company.referrer?.last_name}
                        </td>
                        <td className="py-3">
                          {new Date(company.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/admin/companies/${company.id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No referred companies yet</p>
              )}
            </div>

            {/* Applications */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Applications</h2>
                <span className="text-[var(--color-text-tertiary)]">{applications.length}</span>
              </div>
              {applications.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-[var(--color-text-tertiary)] border-b">
                      <th className="pb-2">Company</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Stage</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app.id} className="border-b">
                        <td className="py-3">{app.company?.name}</td>
                        <td className="py-3">£{Number(app.requested_amount).toLocaleString()}</td>
                        <td className="py-3">{app.loan_type}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              app.stage === 'funded'
                                ? 'bg-green-100 text-green-800'
                                : app.stage === 'approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : app.stage === 'declined'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-[var(--color-text-primary)]'
                            }`}
                          >
                            {app.stage}
                          </span>
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No applications yet</p>
              )}
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Users</span>
                  <span className="font-medium">{users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Referrals</span>
                  <span className="font-medium">{referredCompanies.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Total Applications</span>
                  <span className="font-medium">{applications.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Funded</span>
                  <span className="font-medium text-green-600">{totalFunded}</span>
                </div>
              </div>
            </div>

            {/* Bank Details - EDITABLE */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Bank Details</h3>
                <button
                  onClick={() => {
                    if (isEditing) {
                      setFormData(partnerCompany);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="text-blue-600 hover:underline text-sm"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Bank Name</label>
                  <input
                    value={formData.bank_name || ''}
                    onChange={(e) => handleChange('bank_name', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded text-sm ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Account Name</label>
                  <input
                    value={formData.bank_account_name || ''}
                    onChange={(e) => handleChange('bank_account_name', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded text-sm ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Account Number</label>
                  <input
                    value={formData.bank_account_number || ''}
                    onChange={(e) => handleChange('bank_account_number', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded text-sm ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Sort Code</label>
                  <input
                    value={formData.bank_sort_code || ''}
                    onChange={(e) => handleChange('bank_sort_code', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded text-sm ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
                {isEditing && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>

            {/* Users in this Partner Company */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Users</h3>
                <span className="text-[var(--color-text-tertiary)] text-sm">{users.length}</span>
              </div>
              {users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)] truncate">{user.email}</p>
                        </div>
                        {user.is_primary_contact && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded ml-2">
                            Primary
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)] text-sm">No users in this partner company</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/admin/partners/${partnerCompanyId}/users/add`}
                  className="block w-full px-4 py-2 text-left text-sm border rounded hover:bg-gray-50"
                >
                  Add User to Company
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
