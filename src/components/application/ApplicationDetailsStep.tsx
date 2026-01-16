'use client';

import { ApplicationFormData } from './ApplicationWizard';

interface ApplicationDetailsStepProps {
  formData: ApplicationFormData;
  updateFormData: (field: keyof ApplicationFormData, value: any) => void;
}

export function ApplicationDetailsStep({ formData, updateFormData }: ApplicationDetailsStepProps) {
  // Format currency input with commas
  const formatCurrency = (value: string | number | undefined): string => {
    if (!value) return '';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('en-GB');
  };

  // Handle currency input change
  const handleCurrencyChange = (value: string) => {
    // Remove all non-digit characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');
    // Parse to number
    const numValue = cleaned ? parseFloat(cleaned) : undefined;
    updateFormData('fundingNeeded', numValue);
  };

  return (
    <div className="space-y-6">
      {/* Funding Amount */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Amount needed <span className="text-[var(--color-error)]">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-medium">£</span>
          <input
            type="text"
            value={formData.fundingNeeded ? formatCurrency(formData.fundingNeeded) : ''}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            placeholder="50,000"
            required
            className="w-full rounded-lg border border-slate-200 p-3 pl-8 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Funding Purpose */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Purpose <span className="text-[var(--color-error)]">*</span>
        </label>
        <select
          value={formData.fundingPurpose || ''}
          onChange={(e) => updateFormData('fundingPurpose', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        >
          <option value="">Select a purpose...</option>
          <option value="working_capital">Working Capital</option>
          <option value="stock_inventory">Stock/Inventory</option>
          <option value="equipment">Equipment</option>
          <option value="expansion">Expansion</option>
          <option value="cash_flow">Cash Flow</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Brief Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Anything else we should know? (optional)
        </label>
        <textarea
          value={formData.briefDescription || ''}
          onChange={(e) => updateFormData('briefDescription', e.target.value)}
          placeholder="Any additional context that would help us understand your needs..."
          rows={3}
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}

