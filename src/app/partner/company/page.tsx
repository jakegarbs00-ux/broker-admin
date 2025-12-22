'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';

type PartnerCompany = {
  id: string;
  name: string | null;
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
};

export default function PartnerCompanyPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PartnerCompany | null>(null);
  const [originalData, setOriginalData] = useState<PartnerCompany | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.role !== 'PARTNER') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      // Get profile with partner_company_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('partner_company_id, is_primary_contact')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData?.partner_company_id) {
        console.error('Error loading profile:', profileError);
        setError('Partner company not found');
        setLoadingData(false);
        return;
      }

      // Get partner company details
      const { data: companyData, error: companyError } = await supabase
        .from('partner_companies')
        .select('*')
        .eq('id', profileData.partner_company_id)
        .single();

      if (companyError || !companyData) {
        console.error('Error loading partner company:', companyError);
        setError('Partner company not found');
        setLoadingData(false);
        return;
      }

      setPartnerCompany(companyData as PartnerCompany);
      setFormData(companyData as PartnerCompany);
      setOriginalData(companyData as PartnerCompany);
      setLoadingData(false);
    };

    loadData();
  }, [loading, profile?.role, user, supabase]);

  const handleChange = (field: keyof PartnerCompany, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value || null });
  };

  const handleCancel = () => {
    setFormData(originalData ? { ...originalData } : null);
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!formData || !partnerCompany) return;
    
    // Only primary contact can edit
    if (!profile?.is_primary_contact) {
      setError('Only the primary contact can edit company information');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('partner_companies')
      .update({
        name: formData.name,
        registration_number: formData.registration_number,
        address_line_1: formData.address_line_1,
        address_line_2: formData.address_line_2,
        city: formData.city,
        postcode: formData.postcode,
        country: formData.country || 'United Kingdom',
        website: formData.website,
        bank_name: formData.bank_name,
        bank_account_name: formData.bank_account_name,
        bank_account_number: formData.bank_account_number,
        bank_sort_code: formData.bank_sort_code,
      })
      .eq('id', partnerCompany.id);

    if (updateError) {
      setError('Error saving: ' + updateError.message);
    } else {
      setSuccess('Company information saved successfully.');
      setPartnerCompany({ ...formData });
      setOriginalData({ ...formData });
      setIsEditing(false);
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

  if (!partnerCompany || !formData) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Partner Company Not Found</p>
          <p className="text-sm text-gray-500 mt-1">{error || 'Unable to load partner company information.'}</p>
        </div>
      </DashboardShell>
    );
  }

  const canEdit = profile?.is_primary_contact === true;

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
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-900">Business Information</h2>
              {canEdit && !isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="text-sm"
                >
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="Your Company Ltd"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => handleChange('registration_number', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address_line_1 || ''}
                onChange={(e) => handleChange('address_line_1', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="123 Business Street"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address_line_2 || ''}
                onChange={(e) => handleChange('address_line_2', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="Suite, Floor, etc. (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="London"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  value={formData.postcode || ''}
                  onChange={(e) => handleChange('postcode', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="EC1A 1AA"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <input
                type="text"
                value={formData.country || 'United Kingdom'}
                onChange={(e) => handleChange('country', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="United Kingdom"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                disabled={!isEditing}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="https://yourcompany.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">Payment Information</h2>
                <p className="text-sm text-gray-500">For commission payments</p>
              </div>
              {canEdit && !isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="text-sm"
                >
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="Barclays"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.bank_account_name || ''}
                  onChange={(e) => handleChange('bank_account_name', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="Your Company Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.bank_account_number || ''}
                  onChange={(e) => handleChange('bank_account_number', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Code
                </label>
                <input
                  type="text"
                  value={formData.bank_sort_code || ''}
                  onChange={(e) => handleChange('bank_sort_code', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    !isEditing ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="12-34-56"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      {canEdit && (
        <div className="mt-6 flex justify-end gap-3">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      )}

      {!canEdit && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-600">
            Only the primary contact can edit company information. Contact your administrator to make changes.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
