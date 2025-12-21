'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';

type PartnerCompanyInfo = {
  // Business info
  company_name: string | null;
  company_address: string | null;
  company_website: string | null;
  company_registration_number: string | null;
  // Director info
  director_name: string | null;
  director_email: string | null;
  director_phone: string | null;
  director_address: string | null;
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
    company_name: null,
    company_address: null,
    company_website: null,
    company_registration_number: null,
    director_name: null,
    director_email: null,
    director_phone: null,
    director_address: null,
    bank_name: null,
    bank_account_name: null,
    bank_account_number: null,
    bank_sort_code: null,
  });

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'PARTNER' || !user) {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          company_name, company_address, company_website, company_registration_number,
          director_name, director_email, director_phone, director_address,
          bank_name, bank_account_name, bank_account_number, bank_sort_code
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading partner info:', error);
      } else if (data) {
        setFormData({
          company_name: data.company_name || null,
          company_address: data.company_address || null,
          company_website: data.company_website || null,
          company_registration_number: data.company_registration_number || null,
          director_name: data.director_name || null,
          director_email: data.director_email || null,
          director_phone: data.director_phone || null,
          director_address: data.director_address || null,
          bank_name: data.bank_name || null,
          bank_account_name: data.bank_account_name || null,
          bank_account_number: data.bank_account_number || null,
          bank_sort_code: data.bank_sort_code || null,
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
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: formData.company_name,
        company_address: formData.company_address,
        company_website: formData.company_website,
        company_registration_number: formData.company_registration_number,
        director_name: formData.director_name,
        director_email: formData.director_email,
        director_phone: formData.director_phone,
        director_address: formData.director_address,
        bank_name: formData.bank_name,
        bank_account_name: formData.bank_account_name,
        bank_account_number: formData.bank_account_number,
        bank_sort_code: formData.bank_sort_code,
      })
      .eq('id', user.id);

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
                name="company_name"
                value={formData.company_name || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Your Company Ltd"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                name="company_registration_number"
                value={formData.company_registration_number || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Address
              </label>
              <textarea
                name="company_address"
                value={formData.company_address || ''}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="123 Business Street&#10;London&#10;EC1A 1AA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="company_website"
                value={formData.company_website || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="https://yourcompany.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Director Information */}
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Director Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director Name
              </label>
              <input
                type="text"
                name="director_name"
                value={formData.director_name || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director Email
              </label>
              <input
                type="email"
                name="director_email"
                value={formData.director_email || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="director@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director Phone
              </label>
              <input
                type="tel"
                name="director_phone"
                value={formData.director_phone || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="+44 7700 900000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director Address
              </label>
              <textarea
                name="director_address"
                value={formData.director_address || ''}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="123 Home Street&#10;London&#10;SW1A 1AA"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="12-34-56"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </DashboardShell>
  );
}