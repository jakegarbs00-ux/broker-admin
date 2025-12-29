'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

export default function AdminNewCompanyPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createApplication, setCreateApplication] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    company_number: '',
    industry: '',
    website: '',
    director_first_name: '',
    director_last_name: '',
    director_address_line_1: '',
    director_address_line_2: '',
    director_city: '',
    director_postcode: '',
    director_country: 'United Kingdom',
    director_dob: '',
    property_status: '',
    client_email: '',
    requested_amount: '',
    loan_type: 'term_loan',
    purpose: '',
    urgency: '',
    monthly_revenue: '',
    trading_months: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.name.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!formData.client_email.trim()) {
      setError('Client email is required.');
      return;
    }
    if (createApplication && !formData.requested_amount) {
      setError('Requested amount is required when creating an application.');
      return;
    }

    setSaving(true);
    setError(null);

    // Use API route to create company with director info (handles user creation)
    const response = await fetch('/api/companies/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name.trim(),
        company_number: formData.company_number.trim() || null,
        industry: formData.industry.trim() || null,
        website: formData.website.trim() || null,
        director_first_name: formData.director_first_name.trim() || null,
        director_last_name: formData.director_last_name.trim() || null,
        director_address_line_1: formData.director_address_line_1.trim() || null,
        director_address_line_2: formData.director_address_line_2.trim() || null,
        director_city: formData.director_city.trim() || null,
        director_postcode: formData.director_postcode.trim() || null,
        director_country: formData.director_country || 'United Kingdom',
        director_dob: formData.director_dob || null,
        property_status: formData.property_status || null,
        client_email: formData.client_email.trim(),
        // Note: no partner_id for admin-created companies
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      setError(result.error || 'Error creating company');
      setSaving(false);
      return;
    }

    const newCompanyId = result.companyId;

    // Create application if checkbox is checked
    if (createApplication && formData.requested_amount) {
      const { data: newApp, error: appError } = await supabase
        .from('applications')
        .insert({
          company_id: newCompanyId,
          requested_amount: parseFloat(formData.requested_amount),
          loan_type: formData.loan_type || 'term_loan',
          purpose: formData.purpose || null,
          urgency: formData.urgency || null,
          monthly_revenue: formData.monthly_revenue ? parseFloat(formData.monthly_revenue) : null,
          trading_months: formData.trading_months ? parseInt(formData.trading_months) : null,
          stage: 'created',
          workflow_status: 'pending',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (appError) {
        setError('Company created but error creating application: ' + appError.message);
        setSaving(false);
        return;
      }

      // Redirect to applications list if application was created
      router.push('/admin/applications');
      return;
    }

    // Redirect to company detail page if no application
    router.push(`/admin/companies/${newCompanyId}`);
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
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
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Create Company"
        description="Create a new company and optionally start an application"
      />

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Company Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Company Name <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="Acme Ltd"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Company Number
                </label>
                <input
                  type="text"
                  name="company_number"
                  value={formData.company_number}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="Technology, Retail, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="https://example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Client & Director Information */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-[var(--color-text-primary)]">Client & Director Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Client Email <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="email"
                  name="client_email"
                  value={formData.client_email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="client@example.com"
                  required
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  The client will be linked to this company when they sign up with this email.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Director First Name
                  </label>
                  <input
                    type="text"
                    name="director_first_name"
                    value={formData.director_first_name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Director Last Name
                  </label>
                  <input
                    type="text"
                    name="director_last_name"
                    value={formData.director_last_name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Director Date of Birth
                </label>
                <input
                  type="date"
                  name="director_dob"
                  value={formData.director_dob}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="director_address_line_1"
                  value={formData.director_address_line_1}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="director_address_line_2"
                  value={formData.director_address_line_2}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="Apartment, Suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="director_city"
                    value={formData.director_city}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="London"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Postcode
                  </label>
                  <input
                    type="text"
                    name="director_postcode"
                    value={formData.director_postcode}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="SW1A 1AA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Country
                </label>
                <input
                  type="text"
                  name="director_country"
                  value={formData.director_country}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="United Kingdom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Property Status
                </label>
                <select
                  name="property_status"
                  value={formData.property_status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                >
                  <option value="">Select...</option>
                  <option value="homeowner">Homeowner</option>
                  <option value="tenant">Tenant</option>
                  <option value="living_with_family">Living with Family</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Application Details */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="createApplication"
                  checked={createApplication}
                  onChange={(e) => setCreateApplication(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <label htmlFor="createApplication" className="font-medium text-[var(--color-text-primary)] cursor-pointer">
                  Create application for this company
                </label>
              </div>
            </CardHeader>
            {createApplication && (
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Requested Amount (£) <span className="text-[var(--color-error)]">*</span>
                  </label>
                  <input
                    type="number"
                    name="requested_amount"
                    value={formData.requested_amount}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="50000"
                    required={createApplication}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Loan Type
                  </label>
                  <select
                    name="loan_type"
                    value={formData.loan_type}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  >
                    <option value="term_loan">Term Loan</option>
                    <option value="revolving">Revolving Credit</option>
                    <option value="invoice_finance">Invoice Finance</option>
                    <option value="asset_finance">Asset Finance</option>
                    <option value="merchant_cash_advance">Merchant Cash Advance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Purpose of Funding
                  </label>
                  <textarea
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    placeholder="Describe what the funding will be used for..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Urgency
                  </label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  >
                    <option value="">Select...</option>
                    <option value="asap">ASAP</option>
                    <option value="within_1_month">Within 1 Month</option>
                    <option value="within_3_months">Within 3 Months</option>
                    <option value="no_rush">No Rush</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Monthly Revenue (£)
                    </label>
                    <input
                      type="number"
                      name="monthly_revenue"
                      value={formData.monthly_revenue}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Trading History (months)
                    </label>
                    <input
                      type="number"
                      name="trading_months"
                      value={formData.trading_months}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                      placeholder="24"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Submit */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Company'}
          </Button>
        </div>
      </form>
    </DashboardShell>
  );
}

