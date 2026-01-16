'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useToastContext } from '@/components/ui/ToastProvider';
import {
  PersonalDetailsStep,
  CompanyInfoStep,
  ApplicationDetailsStep,
  DocumentUploadStep,
  ReviewStep,
} from './steps';
import { Button } from '@/components/ui';

export interface OnboardingFormData {
  // Step 1: Personal Details
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  propertyStatus?: string;
  
  // Step 2: Company Information
  companyName?: string;
  companyNumber?: string;
  industry?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  companiesHouseData?: any; // Full Companies House data
  
  // Step 3: Application Details
  fundingNeeded?: number;
  fundingPurpose?: string;
  briefDescription?: string;
  applicationId?: string;
  
  // Step 4: Document Upload
  documents?: File[];
  
  // Step 5: Review (no additional fields)
}

interface StepConfig {
  label: string;
  title: string;
  subtitle: string;
}

const STEP_CONFIG: Record<number, StepConfig> = {
  1: {
    label: 'Your Details',
    title: 'Personal Information',
    subtitle: 'Tell us about yourself',
  },
  2: {
    label: 'Company',
    title: 'Company Information',
    subtitle: 'Tell us about your business',
  },
  3: {
    label: 'Funding',
    title: 'Application Details',
    subtitle: 'What funding do you need?',
  },
  4: {
    label: 'Documents',
    title: 'Document Upload',
    subtitle: 'Upload required documents',
  },
  5: {
    label: 'Review',
    title: 'Review & Submit',
    subtitle: 'Review your information before submitting',
  },
};

const STORAGE_KEY = 'onboarding_progress';

interface OnboardingWizardProps {
  initialStep?: number;
}

export function OnboardingWizard({ initialStep }: OnboardingWizardProps = {}) {
  const router = useRouter();
  const { profile, user, refresh } = useUserProfile();
  const toast = useToastContext();
  const [currentStep, setCurrentStep] = useState(initialStep ? Math.max(1, Math.min(5, initialStep)) : 1);
  const [formData, setFormData] = useState<OnboardingFormData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const totalSteps = 5;
  const currentStepConfig = STEP_CONFIG[currentStep];

  // Load progress from localStorage on mount, but prioritize initialStep from profile
  // CRITICAL: Only load if user ID matches (prevent loading another user's data)
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Verify this data belongs to the current user
          if (parsed.userId && parsed.userId !== user.id) {
            // Different user's data - clear it
            console.warn('[OnboardingWizard] Clearing stale localStorage data from different user');
            localStorage.removeItem(STORAGE_KEY);
            return;
          }
          
          if (parsed.formData) {
            setFormData(parsed.formData);
          }
          // Only use saved step if no initialStep was provided
          if (!initialStep && parsed.currentStep) {
            setCurrentStep(parsed.currentStep);
          }
          if (parsed.completedSteps) {
            setCompletedSteps(new Set(parsed.completedSteps));
          }
        } catch (e) {
          console.error('Error loading saved progress:', e);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [initialStep, user?.id]);

  // Save progress to localStorage whenever formData or currentStep changes
  // CRITICAL: Include user ID to prevent cross-user data leakage
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id && Object.keys(formData).length > 0) {
      const progress = {
        userId: user.id, // CRITICAL: Store user ID with progress
        formData,
        currentStep,
        completedSteps: Array.from(completedSteps),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [formData, currentStep, completedSteps, user?.id]);

  // Clear localStorage when onboarding is completed
  const clearProgress = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Pre-fill email from profile
  useEffect(() => {
    if (profile?.email && !formData.email) {
      setFormData((prev) => ({
        ...prev,
        email: profile.email || '',
      }));
    }
  }, [profile?.email]);

  const updateFormData = (field: keyof OnboardingFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        // Personal Details validation
        if (!formData.firstName || !formData.lastName) {
          setError('Please fill in all required fields');
          return false;
        }
        if (!formData.phone) {
          setError('Phone number is required');
          return false;
        }
        // Validate UK phone format
        const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
        const cleanPhone = formData.phone.replace(/\s+/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          setError('Please enter a valid UK phone number');
          return false;
        }
        if (!formData.dateOfBirth) {
          setError('Date of birth is required');
          return false;
        }
        // Validate age 18+
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (age < 18 || (age === 18 && monthDiff < 0) || (age === 18 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          setError('You must be 18 or older to apply');
          return false;
        }
        if (!formData.propertyStatus) {
          setError('Property status is required');
          return false;
        }
        return true;
      case 2:
        // Company Information validation
        if (!formData.companyName || !formData.industry) {
          setError('Please fill in all required fields');
          return false;
        }
        // Address is optional (can come from Companies House)
        // But we still need firstName and lastName from director selection
        if (!formData.firstName || !formData.lastName) {
          setError('Please select or enter your name as a director');
          return false;
        }
        return true;
      case 3:
        // Application Details validation
        if (!formData.fundingNeeded || formData.fundingNeeded <= 0) {
          setError('Please enter a valid funding amount');
          return false;
        }
        if (!formData.fundingPurpose) {
          setError('Please select a funding purpose');
          return false;
        }
        return true;
      case 4:
        // Document Upload validation - at least one bank statement required
        const hasBankStatements = await validateBankStatements();
        if (!hasBankStatements) {
          setError('Please upload at least one bank statement to continue');
          return false;
        }
        return true;
      case 5:
        // Review step - no validation needed
        return true;
      default:
        return true;
    }
  };

  const saveProgress = async () => {
    // Save current progress to database/localStorage
    try {
      if (typeof window !== 'undefined' && user?.id) {
        // CRITICAL: Include user ID when saving progress
        localStorage.setItem('onboarding_progress', JSON.stringify({
          userId: user.id,
          formData,
        }));
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  };

  const nextStep = async () => {
    setError(null);
    
    // Validate current step
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      return;
    }

    // If completing step 2 (Company Info), create/update company
    if (currentStep === 2) {
      await saveCompany();
    }

    // If completing step 3 (Application Details), create application
    if (currentStep === 3) {
      await saveApplication();
    }

    // Mark current step as completed
    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    // Save progress
    await saveProgress();

    // Update onboarding_step in profile
    const nextStepNum = currentStep + 1;
    await updateOnboardingStep(nextStepNum);

    // Move to next step
    if (currentStep < totalSteps) {
      setCurrentStep(nextStepNum);
    }
  };

  const handleSaveAndExit = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Save current progress
      await saveProgress();

      // Update onboarding_step in profile
      await updateOnboardingStep(currentStep);

      toast.success('Progress saved. You can continue later.');

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err) {
      console.error('Error saving progress:', err);
      toast.error('Failed to save progress');
      setIsLoading(false);
    }
  };

  const updateOnboardingStep = async (step: number) => {
    if (!user) return;

    const supabase = getSupabaseClient();
    // CRITICAL: Verify authenticated user ID
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== user.id) {
      console.error('[OnboardingWizard] SECURITY: User ID mismatch');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('id', currentUser.id); // Use authenticated user ID

    if (error) {
      console.error('Error updating onboarding step:', error);
      // Don't throw - this is not critical
    } else {
      // Refresh profile to get updated step
      refresh();
    }
  };

  const validateBankStatements = async (): Promise<boolean> => {
    if (!formData.applicationId) return false;

    const supabase = getSupabaseClient();
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('application_id', formData.applicationId)
      .eq('category', 'bank_statements')
      .limit(1);

    return (docs?.length || 0) > 0;
  };

  const saveCompany = async () => {
    if (!profile) return;

    const supabase = getSupabaseClient();
    
    try {
      const companyPayload: any = {
        name: formData.companyName?.trim(),
        company_number: formData.companyNumber?.trim() || null,
        industry: formData.industry || null,
        website: formData.website?.trim() || null,
        address_line_1: formData.addressLine1?.trim() || null,
        address_line_2: formData.addressLine2?.trim() || null,
        city: formData.city?.trim() || null,
        postcode: formData.postcode?.trim() || null,
        country: formData.country || 'United Kingdom',
        companies_house_data: formData.companiesHouseData || null,
      };

      // Check if company already exists
      if (profile.company_id) {
        // Update existing company
        const { error: updateError } = await supabase
          .from('companies')
          .update(companyPayload)
          .eq('id', profile.company_id);

        if (updateError) {
          console.error('Error updating company:', updateError);
          setError('Failed to update company information');
          return;
        }

        // Update director info if changed
        const profileUpdate: any = {};
        
        if (formData.firstName) {
          profileUpdate.first_name = formData.firstName;
        }
        if (formData.lastName) {
          profileUpdate.last_name = formData.lastName;
        }

        if (Object.keys(profileUpdate).length > 0 && user) {
          // CRITICAL: Verify authenticated user ID
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser || currentUser.id !== user.id) {
            console.error('[OnboardingWizard] SECURITY: User ID mismatch during profile update');
            return;
          }
          
          await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', currentUser.id); // Use authenticated user ID
        }
      } else {
        // Create new company
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert(companyPayload)
          .select('id')
          .single();

        if (createError || !newCompany) {
          console.error('Error creating company:', createError);
          setError('Failed to create company');
          return;
        }

        // Link company to profile and mark as primary director
        const profileUpdate: any = {
          company_id: newCompany.id,
          is_primary_director: true,
        };

        // Update name if provided (from director selection)
        if (formData.firstName) {
          profileUpdate.first_name = formData.firstName;
        }
        if (formData.lastName) {
          profileUpdate.last_name = formData.lastName;
        }

        // CRITICAL: Verify authenticated user ID
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || !user || currentUser.id !== user.id) {
          console.error('[OnboardingWizard] SECURITY: User ID mismatch during company link');
          setError('Authentication error');
          return;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', currentUser.id); // Use authenticated user ID

        if (profileError) {
          console.error('Error linking company to profile:', profileError);
          setError('Failed to link company to your profile');
          toast.error('Failed to save company information');
          return;
        }
      }

      toast.success('Company information saved');
    } catch (err) {
      console.error('Error saving company:', err);
      setError('An error occurred while saving company information');
      toast.error('Failed to save company information');
    }
  };

  const saveApplication = async () => {
    if (!profile || !profile.company_id) {
      setError('Company information must be completed first');
      return;
    }

    const supabase = getSupabaseClient();
    
    try {
      const applicationPayload: any = {
        company_id: profile.company_id,
        owner_id: profile.id,
        requested_amount: formData.fundingNeeded || 0,
        purpose: formData.fundingPurpose || null,
        admin_notes: formData.briefDescription?.trim() || null,
        stage: 'created',
        // Leave these fields null for now - can be collected later
        loan_type: null,
        urgency: null,
        monthly_revenue: null,
        trading_months: null,
      };

      const { data: newApplication, error: createError } = await supabase
        .from('applications')
        .insert(applicationPayload)
        .select('id')
        .single();

      if (createError || !newApplication) {
        console.error('Error creating application:', createError);
        setError('Failed to create application');
        return;
      }

      // Store application ID in formData for later use
      setFormData((prev) => ({
        ...prev,
        applicationId: newApplication.id,
      }));

      toast.success('Application details saved');
    } catch (err) {
      console.error('Error saving application:', err);
      setError('An error occurred while saving application');
      toast.error('Failed to save application details');
    }
  };

  const handleFinalSubmit = async () => {
    if (!user || !profile || !formData.applicationId) {
      setError('Missing required information');
      toast.error('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Update application to submitted
      const { error: appError } = await supabase
        .from('applications')
        .update({
          stage: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', formData.applicationId);

      if (appError) {
        console.error('Error updating application:', appError);
        throw appError;
      }

      // Update profile with onboarding_completed = true
      const profileUpdate: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        date_of_birth: formData.dateOfBirth || null,
        property_status: formData.propertyStatus || null,
      };

      // CRITICAL: Verify authenticated user ID before updating
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[OnboardingWizard] SECURITY: User ID mismatch during final submit');
        throw new Error('Authentication error');
      }

      // Try to update with onboarding_completed, handle if column doesn't exist
      let profileError;
      const updateWithOnboarding = { ...profileUpdate, onboarding_completed: true };
      
      const result = await supabase
        .from('profiles')
        .update(updateWithOnboarding)
        .eq('id', currentUser.id); // Use authenticated user ID

      profileError = result.error;

      // If error is about missing onboarding_completed column, try without it
      if (profileError && profileError.code === '42703' && profileError.message?.includes('onboarding_completed')) {
        const fallbackResult = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', currentUser.id); // Use authenticated user ID
        
        profileError = fallbackResult.error;
      }

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
      }

      // Clear saved progress
      clearProgress();

      // Mark onboarding as completed (step 5)
      await updateOnboardingStep(5);

      // Show success toast
      toast.success("Application submitted! We'll be in touch within 24-48 hours.");

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      const errorMessage = err?.message || 'Failed to submit application. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalDetailsStep
            formData={formData}
            updateFormData={updateFormData}
            profile={profile}
          />
        );
      case 2:
        return (
          <CompanyInfoStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <ApplicationDetailsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 4:
        return (
          <DocumentUploadStep
            formData={formData}
            updateFormData={updateFormData}
            applicationId={formData.applicationId}
          />
        );
      case 5:
        return (
          <ReviewStep
            formData={formData}
            onEdit={(step) => {
              setCurrentStep(step);
              setError(null);
            }}
            onSubmit={handleFinalSubmit}
            isSubmitting={isLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
            const stepConfig = STEP_CONFIG[step];
            const isCompleted = completedSteps.has(step);
            const isCurrent = currentStep === step;
            const isPast = currentStep > step;

            return (
              <div key={step} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  {/* Step Circle */}
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                      isCurrent
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : isCompleted || isPast
                        ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                        : 'bg-white border-[var(--color-border)] text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="font-semibold">{step}</span>
                    )}
                  </div>
                  {/* Step Label */}
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isCurrent
                        ? 'text-[var(--color-primary)]'
                        : isCompleted || isPast
                        ? 'text-[var(--color-text-secondary)]'
                        : 'text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    {stepConfig.label}
                  </span>
                </div>
                {/* Connector Line */}
                {step < totalSteps && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      isPast || isCompleted
                        ? 'bg-[var(--color-success)]'
                        : 'bg-[var(--color-border)]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Header with Save & Exit */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] mb-1">
            {currentStepConfig.title}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {currentStepConfig.subtitle}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleSaveAndExit}
          disabled={isLoading}
          size="sm"
          className="sm:ml-4"
        >
          Save & Exit
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Form Content Area */}
      <div className="mb-6">{renderStep()}</div>

      {/* Footer with Back / Continue buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStep === 1 || isLoading}
          className="px-6 py-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors order-2 sm:order-1"
        >
          Back
        </button>
        {currentStep < totalSteps ? (
          <Button
            onClick={nextStep}
            disabled={isLoading}
            variant="primary"
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleFinalSubmit}
            disabled={isLoading}
            variant="primary"
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

