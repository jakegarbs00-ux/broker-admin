'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

type Partner = {
  id: string;
  full_name: string | null;
  email: string;
  company_name: string | null;
};

export default function AdminEditCompanyPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [formData, setFormData] = useState({
    // Company fields
    name: '',
    company_number: '',
    industry: '',
    website: '',
    referred_by: '',
    // Director fields
    director_id: '',
    director_full_name: '',
    director_email: '',
    director_phone: '',
    director_address: '',
    director_dob: '',
    property_status: '',
  });

  useEffect(() => {
    if (loading || !user || !id) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      // Load partners
      const { data: partnersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_name')
        .eq('role', 'PARTNER')
        .order('full_name', { ascending: true });

      if (partnersData) {
        setPartners(partnersData as Partner[]);
      }

      // Load company
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (!companyData) {
        setError('Company not found');
        setLoadingData(false);
        return;
      }

      // Load primary director
      const { data: directorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', id)
        .eq('is_primary_director', true)
        .single();

      setFormData({
        name: companyData.name || '',
        company_number: companyData.company_number || '',
        industry: companyData.industry || '',
        website: companyData.website || '',
        referred_by: companyData.referred_by || '',
        director_id: directorData?.id || '',
        director_full_name: directorData?.full_name || '',
        director_email: directorData?.email || '',
        director_phone: directorData?.phone || '',
        director_address: directorData?.address || '',
        director_dob: directorData?.dob || '',
        property_status: directorData?.property_status || '',
      });

      setLoadingData(false);
    };

    loadData();
  }, [loading, user, profile?.role, id, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || profile?.role !== 'ADMIN') return;

    setSaving(true);
    setError(null);

    try {
      // Map property_status
      let finalPropertyStatus: string | null = null;
      if (formData.property_status && formData.property_status.trim()) {
        const status = formData.property_status.trim().toLowerCase();
        const statusMap: Record<string, string | null> = {
          'homeowner': 'owner',
          'owner': 'owner',
          'tenant': 'renter',
          'renter': 'renter',
          'living_with_family': 'renter',
          'other': null,
        };
        finalPropertyStatus = statusMap[status] ?? null;
      }

      // Update company
      const { error: companyError } = await supabase
        .from('companies')
        .update({
          name: formData.name.trim(),
          company_number: formData.company_number.trim() || null,
          industry: formData.industry.trim() || null,
          website: formData.website.trim() || null,
          referred_by: formData.referred_by || null,
        })
        .eq('id', id);

      if (companyError) {
        setError('Error updating company: ' + companyError.message);
        setSaving(false);
        return;
      }

      // Update director profile
      if (formData.director_id) {
        const { error: directorError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.director_full_name.trim() || null,
            phone: formData.director_phone.trim() || null,
            address: formData.director_address.trim() || null,
            dob: formData.director_dob || null,
            property_status: finalPropertyStatus,
          })
          .eq('id', formData.director_id);

        if (directorError) {
          setError('Error updating director: ' + directorError.message);
          setSaving(false);
          return;
        }
      }

      router.push(`/admin/companies/${id}`);
    } catch (err: any) {
      console.error('Error:', err);
      setError('An unexpected error occurred: ' + err.message);
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
        title="Edit Company"
        description="Update company and director information"
        actions={
          <Link href={`/admin/companies/${id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Company Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Number
                </label>
                <input
                  type="text"
                  name="company_number"
                  value={formData.company_number}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referred By
              </label>
              <select
                name="referred_by"
                value={formData.referred_by}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No referrer (direct signup)</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.full_name || partner.company_name || partner.email}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Director Information */}
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Primary Director Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="director_full_name"
                  value={formData.director_full_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="director_email"
                  value={formData.director_email}
                  onChange={handleChange}
                  disabled
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="director_phone"
                value={formData.director_phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="director_address"
                value={formData.director_address}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="director_dob"
                  value={formData.director_dob}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Status
                </label>
                <select
                  name="property_status"
                  value={formData.property_status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="homeowner">Homeowner</option>
                  <option value="tenant">Tenant</option>
                  <option value="living_with_family">Living with Family</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/admin/companies/${id}`}>
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            loading={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </DashboardShell>
  );
}

