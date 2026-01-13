'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

type PartnerCompanyFormData = {
  name: string;
  registration_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postcode: string;
  country: string;
  website: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_sort_code: string;
};

export default function AdminCreatePartnerPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPartnerId, setCreatedPartnerId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState<PartnerCompanyFormData>({
    name: '',
    registration_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    postcode: '',
    country: 'United Kingdom',
    website: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_sort_code: '',
  });

  const handleChange = (field: keyof PartnerCompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    setSaving(true);

    const payload: any = {
      name: formData.name.trim(),
      registration_number: formData.registration_number.trim() || null,
      address_line_1: formData.address_line_1.trim() || null,
      address_line_2: formData.address_line_2.trim() || null,
      city: formData.city.trim() || null,
      postcode: formData.postcode.trim() || null,
      country: formData.country.trim() || null,
      website: formData.website.trim() || null,
      bank_name: formData.bank_name.trim() || null,
      bank_account_name: formData.bank_account_name.trim() || null,
      bank_account_number: formData.bank_account_number.trim() || null,
      bank_sort_code: formData.bank_sort_code.trim() || null,
    };

    const { data: newPartner, error: createError } = await supabase
      .from('partner_companies')
      .insert(payload)
      .select('id')
      .single();

    if (createError || !newPartner) {
      setError(createError?.message || 'Error creating partner company');
      setSaving(false);
      return;
    }

    setCreatedPartnerId(newPartner.id as string);
    setSaving(false);
  };

  const handleInvite = async () => {
    if (!createdPartnerId) return;
    setInviteError(null);
    setInviteStatus(null);

    const email = inviteEmail.trim();
    if (!email) {
      setInviteError('Email is required');
      return;
    }

    setInviting(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setInviteError('Unable to verify your session. Please refresh and try again.');
      setInviting(false);
      return;
    }

    const response = await fetch('/api/admin/invite-partner-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
        partner_company_id: createdPartnerId,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      setInviteError(data.error || 'Error sending invite');
    } else {
      setInviteStatus('Invitation sent successfully');
      setInviteEmail('');
    }

    setInviting(false);
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
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

  if (!user) return null;

  return (
    <DashboardShell>
      <div className="p-6">
        <PageHeader
          title="Create Partner Company"
          description="Add a new partner company to the system"
        />
        <div className="mt-6">
          <Link href="/admin/partners" className="text-sm text-[var(--color-text-tertiary)] hover:underline mb-4 inline-block">
            ← Back to Partners
          </Link>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main content - 2 columns */}
              <div className="lg:col-span-2 space-y-6">
                {/* Company Information */}
                <Card>
                  <CardHeader>
                    <h2 className="text-lg font-semibold">Company Information</h2>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Registration Number</label>
                        <input
                          type="text"
                          value={formData.registration_number}
                          onChange={(e) => handleChange('registration_number', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Address Line 1</label>
                        <input
                          type="text"
                          value={formData.address_line_1}
                          onChange={(e) => handleChange('address_line_1', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Address Line 2</label>
                        <input
                          type="text"
                          value={formData.address_line_2}
                          onChange={(e) => handleChange('address_line_2', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">City</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleChange('city', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Postcode</label>
                        <input
                          type="text"
                          value={formData.postcode}
                          onChange={(e) => handleChange('postcode', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Country</label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => handleChange('country', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Website</label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => handleChange('website', e.target.value)}
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - 1 column */}
              <div className="space-y-6">
                {/* Bank Details */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">Bank Details</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={formData.bank_name}
                          onChange={(e) => handleChange('bank_name', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Account Name</label>
                        <input
                          type="text"
                          value={formData.bank_account_name}
                          onChange={(e) => handleChange('bank_account_name', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Account Number</label>
                        <input
                          type="text"
                          value={formData.bank_account_number}
                          onChange={(e) => handleChange('bank_account_number', e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">Sort Code</label>
                        <input
                          type="text"
                          value={formData.bank_sort_code}
                          onChange={(e) => handleChange('bank_sort_code', e.target.value)}
                          placeholder="00-00-00"
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-6 flex justify-end gap-4">
              <Link href="/admin/partners">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button variant="primary" type="submit" disabled={saving || !!createdPartnerId}>
                {createdPartnerId ? 'Partner Created' : saving ? 'Creating...' : 'Create Partner Company'}
              </Button>
            </div>
          </form>

          {createdPartnerId && (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <h2 className="text-lg font-semibold">Invite a User</h2>
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      Optional: invite a partner user to access this company.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-[var(--color-text-tertiary)] block mb-1">
                          User Email
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      {inviteError && (
                        <p className="text-sm text-red-600">{inviteError}</p>
                      )}
                      {inviteStatus && !inviteError && (
                        <p className="text-sm text-green-600">{inviteStatus}</p>
                      )}
                      <div className="flex justify-end gap-3">
                        <Link href={`/admin/partners/${createdPartnerId}`}>
                          <Button variant="secondary" type="button">
                            Skip for now
                          </Button>
                        </Link>
                        <Button
                          variant="primary"
                          type="button"
                          onClick={handleInvite}
                          disabled={inviting}
                        >
                          {inviting ? 'Sending...' : 'Send Invite'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

