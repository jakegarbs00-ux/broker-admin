'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';

type Company = {
  id: string;
  name: string;
};

type Lender = {
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

const STAGES = [
  'created',
  'submitted',
  'in_credit',
  'information_requested',
  'approved',
  'onboarding',
  'funded',
  'declined',
  'withdrawn',
];

export default function AdminEditApplicationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);

  const [formData, setFormData] = useState({
    company_id: '',
    requested_amount: '',
    loan_type: '',
    urgency: '',
    purpose: '',
    lender_id: '',
    stage: 'created',
  });

  useEffect(() => {
    if (loading || !user || !id) return;
    if (profile?.role !== 'ADMIN') {
      setLoadingData(false);
      return;
    }

    const loadData = async () => {
      // Load companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name', { ascending: true });

      if (companiesData) {
        setCompanies(companiesData as Company[]);
      }

      // Load lenders
      const { data: lendersData } = await supabase
        .from('lenders')
        .select('id, name')
        .order('name', { ascending: true });

      if (lendersData) {
        setLenders(lendersData as Lender[]);
      }

      // Load application
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .single();

      if (appError || !appData) {
        setError('Application not found');
        setLoadingData(false);
        return;
      }

      setFormData({
        company_id: appData.company_id || '',
        requested_amount: appData.requested_amount?.toString() || '',
        loan_type: appData.loan_type || '',
        urgency: appData.urgency || '',
        purpose: appData.purpose || '',
        lender_id: appData.lender_id || '',
        stage: appData.stage || 'created',
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
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          company_id: formData.company_id || null,
          requested_amount: parseFloat(formData.requested_amount),
          loan_type: formData.loan_type,
          urgency: formData.urgency,
          purpose: formData.purpose,
          lender_id: formData.lender_id || null,
          stage: formData.stage,
        })
        .eq('id', id);

      if (updateError) {
        setError('Error updating application: ' + updateError.message);
        setSaving(false);
        return;
      }

      router.push(`/admin/applications/${id}`);
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
        title="Edit Application"
        description="Update application details"
        actions={
          <Link href={`/admin/applications/${id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Company Selection */}
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Company</h2>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No company (draft)</option>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lender
                </label>
                <select
                  name="lender_id"
                  value={formData.lender_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No lender assigned</option>
                  {lenders.map((lender) => (
                    <option key={lender.id} value={lender.id}>
                      {lender.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage <span className="text-red-500">*</span>
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/admin/applications/${id}`}>
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

