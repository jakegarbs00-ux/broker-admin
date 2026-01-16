'use client';

import { ApplicationFormData } from './ApplicationWizard';

interface Profile {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  property_status?: string | null;
}

interface PersonalDetailsStepProps {
  formData: ApplicationFormData;
  updateFormData: (field: keyof ApplicationFormData, value: any) => void;
  profile?: Profile | null;
}

export function PersonalDetailsStep({ formData, updateFormData, profile }: PersonalDetailsStepProps) {
  // Pre-fill email from profile if available
  const emailValue = profile?.email || '';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          First Name <span className="text-[var(--color-error)]">*</span>
        </label>
        <input
          type="text"
          value={formData.firstName || ''}
          onChange={(e) => updateFormData('firstName', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Last Name <span className="text-[var(--color-error)]">*</span>
        </label>
        <input
          type="text"
          value={formData.lastName || ''}
          onChange={(e) => updateFormData('lastName', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Email
        </label>
        <input
          type="email"
          value={emailValue}
          disabled
          readOnly
          className="w-full rounded-lg border border-slate-200 p-3 bg-slate-50 text-slate-500 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Phone Number <span className="text-[var(--color-error)]">*</span>
        </label>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => updateFormData('phone', e.target.value)}
          placeholder="07700 900000"
          required
          pattern="^(\+44|0)[1-9]\d{8,9}$"
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500">
          UK format: 07700 900000 or +44 7700 900000
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Date of Birth <span className="text-[var(--color-error)]">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfBirth || ''}
          onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
          required
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500">
          You must be 18 or older
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What is your property status? <span className="text-[var(--color-error)]">*</span>
        </label>
        <div className="space-y-2">
          {[
            { value: 'homeowner', label: 'Homeowner' },
            { value: 'tenant_private', label: 'Tenant (Private)' },
            { value: 'tenant_council', label: 'Tenant (Council)' },
            { value: 'living_with_family', label: 'Living with Family' },
            { value: 'other', label: 'Other' },
          ].map((option) => (
            <label
              key={option.value}
              className="flex items-center p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <input
                type="radio"
                name="propertyStatus"
                value={option.value}
                checked={formData.propertyStatus === option.value}
                onChange={(e) => updateFormData('propertyStatus', e.target.value)}
                required
                className="w-4 h-4 text-[var(--color-accent)] border-slate-300 focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0"
              />
              <span className="ml-3 text-sm text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

