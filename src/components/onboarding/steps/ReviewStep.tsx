'use client';

import { useState, useEffect } from 'react';
import { OnboardingFormData } from '../OnboardingWizard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Edit, Check } from 'lucide-react';
import { Button } from '@/components/ui';

interface ReviewStepProps {
  formData: OnboardingFormData;
  onEdit: (step: number) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

interface DocumentCounts {
  bank_statements: number;
  filed_accounts: number;
  management_accounts: number;
  other: number;
}

export function ReviewStep({ formData, onEdit, onSubmit, isSubmitting }: ReviewStepProps) {
  const supabase = getSupabaseClient();
  const [documentCounts, setDocumentCounts] = useState<DocumentCounts>({
    bank_statements: 0,
    filed_accounts: 0,
    management_accounts: 0,
    other: 0,
  });

  // Load document counts
  useEffect(() => {
    const loadDocumentCounts = async () => {
      if (!formData.applicationId) return;

      const { data: docs } = await supabase
        .from('documents')
        .select('category')
        .eq('application_id', formData.applicationId);

      if (docs) {
        const counts: DocumentCounts = {
          bank_statements: 0,
          filed_accounts: 0,
          management_accounts: 0,
          other: 0,
        };

        docs.forEach((doc) => {
          if (doc.category === 'bank_statements') {
            counts.bank_statements++;
          } else if (doc.category === 'filed_accounts') {
            counts.filed_accounts++;
          } else if (doc.category === 'management_accounts') {
            counts.management_accounts++;
          } else if (doc.category === 'other') {
            counts.other++;
          }
        });

        setDocumentCounts(counts);
      }
    };

    loadDocumentCounts();
  }, [formData.applicationId, supabase]);

  const formatCurrency = (value?: number) => {
    if (!value) return 'Not provided';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const getIndustryLabel = (value?: string) => {
    const industries: Record<string, string> = {
      retail: 'Retail',
      hospitality: 'Hospitality',
      construction: 'Construction',
      healthcare: 'Healthcare',
      professional_services: 'Professional Services',
      manufacturing: 'Manufacturing',
      transport_logistics: 'Transport & Logistics',
      technology: 'Technology',
      food_beverage: 'Food & Beverage',
      beauty_wellness: 'Beauty & Wellness',
      automotive: 'Automotive',
      education: 'Education',
      agriculture: 'Agriculture',
      entertainment: 'Entertainment',
      financial_services: 'Financial Services',
      real_estate: 'Real Estate',
      ecommerce: 'E-commerce',
      wholesale: 'Wholesale',
      recruitment: 'Recruitment',
      other: 'Other',
    };
    return industries[value || ''] || value || 'Not provided';
  };

  const getPropertyStatusLabel = (value?: string) => {
    const statuses: Record<string, string> = {
      homeowner: 'Homeowner',
      tenant_private: 'Tenant (Private)',
      tenant_council: 'Tenant (Council)',
      living_with_family: 'Living with Family',
      other: 'Other',
    };
    return statuses[value || ''] || value || 'Not provided';
  };

  const getFundingPurposeLabel = (value?: string) => {
    const purposes: Record<string, string> = {
      working_capital: 'Working Capital',
      stock_inventory: 'Stock/Inventory',
      equipment: 'Equipment',
      expansion: 'Expansion',
      cash_flow: 'Cash Flow',
      other: 'Other',
    };
    return purposes[value || ''] || value || 'Not provided';
  };

  const getOtherDocumentsCount = () => {
    return documentCounts.filed_accounts + documentCounts.management_accounts + documentCounts.other;
  };

  return (
    <div className="space-y-6">
      {/* Your Details Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Your Details</h3>
          <button
            type="button"
            onClick={() => onEdit(1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Name:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.firstName && formData.lastName
                ? `${formData.firstName} ${formData.lastName}`
                : 'Not provided'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Email:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.email || 'Not provided'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Phone:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.phone || 'Not provided'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Property Status:</span>
            <span className="text-sm font-medium text-slate-900">
              {getPropertyStatusLabel(formData.propertyStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Company Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Company</h3>
          <button
            type="button"
            onClick={() => onEdit(2)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Company Name:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.companyName || 'Not provided'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Company Number:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.companyNumber || 'Not provided'}
            </span>
          </div>
          {formData.firstName && formData.lastName && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Selected Director:</span>
              <span className="text-sm font-medium text-slate-900">
                {formData.firstName} {formData.lastName}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Industry:</span>
            <span className="text-sm font-medium text-slate-900">
              {getIndustryLabel(formData.industry)}
            </span>
          </div>
        </div>
      </div>

      {/* Funding Request Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Funding Request</h3>
          <button
            type="button"
            onClick={() => onEdit(3)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Amount:</span>
            <span className="text-sm font-medium text-slate-900">
              {formatCurrency(formData.fundingNeeded)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Purpose:</span>
            <span className="text-sm font-medium text-slate-900">
              {getFundingPurposeLabel(formData.fundingPurpose)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Notes:</span>
            <span className="text-sm font-medium text-slate-900">
              {formData.briefDescription || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Documents Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
          <button
            type="button"
            onClick={() => onEdit(4)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Bank Statements:</span>
            <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
              {documentCounts.bank_statements} file{documentCounts.bank_statements !== 1 ? 's' : ''} uploaded
              {documentCounts.bank_statements > 0 && (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </span>
          </div>
          {getOtherDocumentsCount() > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Other documents:</span>
              <span className="text-sm font-medium text-slate-900">
                {getOtherDocumentsCount()} file{getOtherDocumentsCount() !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-6">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          variant="primary"
          className="w-full py-3 text-base font-medium"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </div>
    </div>
  );
}
