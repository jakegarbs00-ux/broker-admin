'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';

type PartnerCompanyInfo = {
  // Business info
  name: string | null;
  address: string | null;
  website: string | null;
  registration_number: string | null;
  // Payment info
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
};

export default function PartnerCompanyPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<PartnerCompanyInfo>({
    name: null,
    address: null,
    website: null,
    registration_number: null,
    bank_name: null,
    bank_account_name: null,
    bank_account_number: null,
    bank_sort_code: null,
  });
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [partnerCompanyId, setPartnerCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'PARTNER' || !user) {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      // Get user's partner_company_id and is_primary_contact
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('partner_company_id, is_primary_contact')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile?.partner_company_id) {
        console.error('Error loading partner profile:', profileError);
        setLoadingData(false);
        return;
      }

      setIsPrimaryContact(userProfile.is_primary_contact || false);
      setPartnerCompanyId(userProfile.partner_company_id);

      // Load partner company details
      const { data: companyData, error: companyError } = await supabase
        .from('partner_companies')
        .select('*')
        .eq('id', userProfile.partner_company_id)
        .single();

      if (companyError) {
        console.error('Error loading partner company:', companyError);
      } else if (companyData) {
        setFormData({
          name: companyData.name || null,
          address: companyData.address || null,
          website: companyData.website || null,
          registration_number: companyData.registration_number || null,
          bank_name: companyData.bank_name || null,
          bank_account_name: companyData.bank_account_name || null,
          bank_account_number: companyData.bank_account_number || null,
          bank_sort_code: companyData.bank_sort_code || null,
        });
      }
      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, user, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleSave = async () => {
    if (!user || !partnerCompanyId) return;

    if (!isPrimaryContact) {
      setError('Only the primary contact can edit company details.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from('partner_companies')
      .update({
        name: formData.name,
        address: formData.address,
        website: formData.website,
        registration_number: formData.registration_number,
        bank_name: formData.bank_name,
        bank_account_name: formData.bank_account_name,
        bank_account_number: formData.bank_account_number,
        bank_sort_code: formData.bank_sort_code,
      })
      .eq('id', partnerCompanyId);

    if (error) {
      setError('Error saving: ' + error.message);
    } else {
      setSuccess('Company information saved successfully.');
    }
    setSaving(false);
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (profile?.role !== 'PARTNER') {
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Company</h1>
        <p className="text-gray-600">Manage your business information and payment details</p>
        {!isPrimaryContact && (
          <p className="text-sm text-amber-600 mt-2">
            Only the primary contact can edit company details. Contact your administrator to make changes.
          </p>
        )}
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Business Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                disabled={!isPrimaryContact}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Your Company Ltd"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number || ''}
                onChange={handleChange}
                disabled={!isPrimaryContact}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Address
              </label>
              <textarea
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                rows={3}
                disabled={!isPrimaryContact}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="123 Business Street&#10;London&#10;EC1A 1AA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website || ''}
                onChange={handleChange}
                disabled={!isPrimaryContact}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="https://yourcompany.com"
              />
            </div>
          </CardContent>
        </Card>


        {/* Payment Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-medium text-gray-900">Payment Information</h2>
            <p className="text-sm text-gray-500">For commission payments</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name || ''}
                  onChange={handleChange}
                  disabled={!isPrimaryContact}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Barclays"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  name="bank_account_name"
                  value={formData.bank_account_name || ''}
                  onChange={handleChange}
                  disabled={!isPrimaryContact}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Your Company Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={formData.bank_account_number || ''}
                  onChange={handleChange}
                  disabled={!isPrimaryContact}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Code
                </label>
                <input
                  type="text"
                  name="bank_sort_code"
                  value={formData.bank_sort_code || ''}
                  onChange={handleChange}
                  disabled={!isPrimaryContact}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="12-34-56"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={handleSave} disabled={saving || !isPrimaryContact}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </DashboardShell>
  );
}