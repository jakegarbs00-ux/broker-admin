'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

type Company = {
  id: string;
  name: string;
};

const LOAN_TYPES = [
  { value: 'term_loan', label: 'Term loan' },
  { value: 'revolving', label: 'Revolving facility' },
  { value: 'asset_finance', label: 'Asset finance' },
  { value: 'invoice_finance', label: 'Invoice finance' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'asap', label: 'ASAP' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'three_plus_months', label: '3+ months' },
];

function AdminCreateApplicationPageContent() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const preSelectedCompanyId = searchParams.get('company_id');

  const [formData, setFormData] = useState({
    company_id: preSelectedCompanyId || '',
    requested_amount: '',
    loan_type: '',
    urgency: '',
    purpose: '',
    lender_id: '',
    stage: 'created',
  });

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingCompanies(false);
      return;
    }

    const loadCompanies = async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading companies:', error);
      } else {
        setCompanies((data || []) as Company[]);
      }
      setLoadingCompanies(false);
    };

    loadCompanies();
  }, [loading, user, profile?.role, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || profile?.role !== 'ADMIN') return;
    setSubmitError(null);

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company_id: formData.company_id || null,
        created_by: user.id,
        requested_amount: parseFloat(formData.requested_amount),
        loan_type: formData.loan_type,
        urgency: formData.urgency,
        purpose: formData.purpose,
        lender_id: formData.lender_id || null,
        stage: formData.stage,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating application:', error);
      setSubmitError('Error creating application: ' + error.message);
      return;
    }

    router.push(`/admin/applications/${data.id}`);
  };

  if (loading || loadingCompanies) {
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
          <p className="text-sm text-gray-500 mt-1">This page is only available to admins.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Create Application"
        description="Create a new funding application"
        actions={
          <Link href="/admin/applications">
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />

      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Selection */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Company</h2>
            </CardHeader>
            <CardContent>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <select
                  name="company_id"
                  value={formData.company_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a company...</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Application Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requested Amount (£) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="requested_amount"
                  value={formData.requested_amount}
                  onChange={handleChange}
                  required
                  min="1000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loan Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="loan_type"
                    value={formData.loan_type}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {LOAN_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>
                        {lt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Urgency <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {URGENCY_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="created">Created</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="funded">Funded</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/admin/applications">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
            >
              Create Application
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}

export default function AdminCreateApplicationPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </DashboardShell>
    }>
      <AdminCreateApplicationPageContent />
    </Suspense>
  );
}

