'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { ApplicationFormData } from './ApplicationWizard';

interface Profile {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  property_status?: string | null;
  company_id?: string | null;
}

interface PersonalDetailsStepProps {
  formData: ApplicationFormData;
  updateFormData: (field: keyof ApplicationFormData, value: any) => void;
  profile?: Profile | null;
}

interface Director {
  name: string;
  officer_role: string;
  appointed_on?: string;
  date_of_birth?: { month: number; year: number } | null;
  resigned_on?: string | null;
}

export function PersonalDetailsStep({ formData, updateFormData, profile }: PersonalDetailsStepProps) {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [selectedDirector, setSelectedDirector] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loadingDirectors, setLoadingDirectors] = useState(true);

  // Pre-fill email from profile if available
  const emailValue = profile?.email || '';

  // Fetch company's Companies House data to get directors
  useEffect(() => {
    const fetchDirectors = async () => {
      if (!profile?.company_id) {
        setLoadingDirectors(false);
        setShowManualEntry(true);
        return;
      }

      const supabase = getSupabaseClient();
      
      // Get company with CH data
      const { data: company } = await supabase
        .from('companies')
        .select('company_number, companies_house_data')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (!company?.companies_house_data && !company?.company_number) {
        setLoadingDirectors(false);
        setShowManualEntry(true);
        return;
      }

      const chData = company.companies_house_data || {};
      
      // If officers aren't in the stored data, fetch them
      if (!chData.officers && company.company_number) {
        try {
          const response = await fetch(`/api/companies-house/officers/${company.company_number}`);
          const officersData = await response.json();
          
          // Filter to only directors (not secretaries, etc.)
          const directorRoles = ['director', 'nominated-director', 'corporate-director'];
          const directorsList = (officersData.items || []).filter((officer: any) => 
            directorRoles.includes(officer.officer_role?.toLowerCase()) && !officer.resigned_on
          );
          
          setDirectors(directorsList);
        } catch (err) {
          console.error('Error fetching officers:', err);
          setShowManualEntry(true);
        }
      } else if (chData.officers) {
        // Use stored officers
        const directorRoles = ['director', 'nominated-director', 'corporate-director'];
        const directorsList = (chData.officers || []).filter((officer: any) => 
          directorRoles.includes(officer.officer_role?.toLowerCase()) && !officer.resigned_on
        );
        setDirectors(directorsList);
      }

      setLoadingDirectors(false);
      
      // If name is already filled, they've already selected - show manual entry mode
      if (formData.firstName && formData.lastName) {
        setShowManualEntry(true);
        setSelectedDirector('manual');
      }
    };

    fetchDirectors();
  }, [profile?.company_id, formData.firstName, formData.lastName]);

  const handleDirectorSelect = (value: string) => {
    setSelectedDirector(value);
    
    if (value === 'not_listed') {
      setShowManualEntry(true);
      // Clear any auto-filled data
      updateFormData('firstName', '');
      updateFormData('lastName', '');
      return;
    }

    // Find selected director
    const director = directors.find(d => d.name === value);
    if (director) {
      // Parse name (Companies House format: "LASTNAME, Firstname Middlename")
      const nameParts = director.name.split(', ');
      if (nameParts.length === 2) {
        const lastName = nameParts[0].charAt(0) + nameParts[0].slice(1).toLowerCase(); // Convert from UPPERCASE
        const firstNames = nameParts[1].split(' ');
        const firstName = firstNames[0];
        
        updateFormData('firstName', firstName);
        updateFormData('lastName', lastName);
      } else {
        // Fallback: just use full name as last name
        updateFormData('lastName', director.name);
      }
      
      // Note: We don't auto-fill DOB from CH (only month/year), user needs to enter full date
      
      setShowManualEntry(true);
    }
  };

  // Helper functions
  const formatDirectorName = (name: string): string => {
    // Convert "SMITH, John David" to "John David Smith"
    const parts = name.split(', ');
    if (parts.length === 2) {
      const lastName = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
      return `${parts[1]} ${lastName}`;
    }
    return name;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loadingDirectors) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Director Selection - only show if we have directors and haven't selected yet */}
      {directors.length > 0 && !showManualEntry && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--color-text-primary)]">
            Select yourself from the company directors <span className="text-red-600">*</span>
          </label>
          
          <div className="space-y-2">
            {directors.map((director) => (
              <button
                key={director.name}
                type="button"
                onClick={() => handleDirectorSelect(director.name)}
                className={`w-full p-4 text-left border rounded-lg transition-colors ${
                  selectedDirector === director.name
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatDirectorName(director.name)}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {director.officer_role} {director.appointed_on && `• Appointed ${formatDate(director.appointed_on)}`}
                </p>
              </button>
            ))}
            
            <button
              type="button"
              onClick={() => handleDirectorSelect('not_listed')}
              className={`w-full p-4 text-left border rounded-lg transition-colors ${
                selectedDirector === 'not_listed'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <p className="font-medium text-[var(--color-text-primary)]">I&apos;m not listed here</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Enter your details manually</p>
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry Fields - show after director selection or if no directors */}
      {(showManualEntry || directors.length === 0) && (
        <>
          {/* Show "Change selection" link if directors exist */}
          {directors.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowManualEntry(false);
                setSelectedDirector(null);
              }}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ← Change director selection
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName || ''}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName || ''}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Email
            </label>
            <input
              type="email"
              value={emailValue}
              disabled
              readOnly
              className="w-full rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => updateFormData('phone', e.target.value)}
              placeholder="07700 900000"
              required
              pattern="^(\+44|0)[1-9]\d{8,9}$"
              className="w-full rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              UK format: 07700 900000 or +44 7700 900000
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Date of Birth <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={formData.dateOfBirth || ''}
              onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
              required
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              className="w-full rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              You must be 18 or older
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              What is your property status? <span className="text-red-600">*</span>
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
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.propertyStatus === option.value
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="propertyStatus"
                    value={option.value}
                    checked={formData.propertyStatus === option.value}
                    onChange={(e) => updateFormData('propertyStatus', e.target.value)}
                    required
                    className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 mr-3"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
