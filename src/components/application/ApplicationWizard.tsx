'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useToastContext } from '@/components/ui/ToastProvider';
import { PersonalDetailsStep } from './PersonalDetailsStep';
import { CompanyInfoStep } from './CompanyInfoStep';
import { ApplicationDetailsStep } from './ApplicationDetailsStep';
import { DocumentUploadStep } from './DocumentUploadStep';
import { ApplicationReviewStep } from './ApplicationReviewStep';
import { ApplicationProgress } from './ApplicationProgress';
import { Button } from '@/components/ui';

export interface ApplicationFormData {
  // Step 1: Personal Details
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  propertyStatus?: string;
  
  // Step 2: Company Information
  companyName?: string;
  companyNumber?: string;
  industry?: string;
  website?: string;
  companiesHouseData?: any;
  
  // Step 3: Application Details
  fundingNeeded?: number;
  fundingPurpose?: string;
  briefDescription?: string;
  applicationId?: string;
}

interface StepConfig {
  label: string;
  title: string;
  subtitle: string;
}

const STEP_CONFIG: Record<number, StepConfig> = {
  1: {
    label: 'Your Company',
    title: 'Find Your Company',
    subtitle: 'Search Companies House to auto-fill your details',
  },
  2: {
    label: 'Your Details',
    title: 'Personal Information',
    subtitle: 'Just a few quick details',
  },
  3: {
    label: 'Funding Request',
    title: 'What You Need',
    subtitle: 'Tell us about your funding requirements',
  },
  4: {
    label: 'Documents',
    title: 'Upload Documents',
    subtitle: 'Bank statements required, others optional',
  },
  5: {
    label: 'Review',
    title: 'Review & Submit',
    subtitle: 'Review your information before submitting',
  },
};

interface ApplicationWizardProps {
  applicationId?: string;
}

export function ApplicationWizard({ applicationId: propApplicationId }: ApplicationWizardProps) {
  const router = useRouter();
  const { profile, user, loading: profileLoading, refresh } = useUserProfile();
  const toast = useToastContext();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApplicationFormData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // Track data loading
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | undefined>(propApplicationId);

  const totalSteps = 5;

  // Load all data and pre-populate fields (always start at step 1)
  // Self-contained initialization - doesn't depend on useUserProfile hook state
  useEffect(() => {
    const initWizard = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Check auth directly - don't rely on hook state
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          // Not authenticated - let the page handle redirect
          setIsLoadingData(false);
          return;
        }

        // Check if user has any in-progress application (not draft, not closed)
        const closedStages = ['funded', 'declined', 'withdrawn'];
        
        const { data: inProgressApp } = await supabase
          .from('applications')
          .select('id, stage')
          .eq('created_by', authUser.id)
          .not('stage', 'in', `(created,${closedStages.join(',')})`)
          .limit(1)
          .maybeSingle();

        if (inProgressApp) {
          // User has an in-progress application - redirect to it, can't create new one
          router.push(`/applications/${inProgressApp.id}`);
          return;
        }

        // Query profile directly - might not exist for new users
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (!profileData) {
          // New user - no profile yet, show empty wizard immediately
          setIsLoadingData(false);
          setCurrentStep(1);
          return;
        }

        // Profile exists - load and pre-populate data
        const initialData: ApplicationFormData = {};

        // Pre-fill Personal Details from profile
        if (profileData.first_name) initialData.firstName = profileData.first_name;
        if (profileData.last_name) initialData.lastName = profileData.last_name;
        if (profileData.phone) initialData.phone = profileData.phone;
        if (profileData.date_of_birth) initialData.dateOfBirth = profileData.date_of_birth;
        if (profileData.property_status) initialData.propertyStatus = profileData.property_status;

        // Load company data if company_id exists
        if (profileData.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('id, name, company_number, industry, website')
            .eq('id', profileData.company_id)
            .maybeSingle();

          if (!companyError && companyData) {
            initialData.companyName = companyData.name;
            initialData.companyNumber = companyData.company_number || undefined;
            initialData.industry = companyData.industry || undefined;
            initialData.website = companyData.website || undefined;
          }
        }

        // Load application data (check for existing or use propApplicationId)
        let appId = propApplicationId;

        if (!appId) {
          // Check for existing application in 'created' stage
          const { data: existingApp, error: appError } = await supabase
            .from('applications')
            .select('id, requested_amount, purpose, admin_notes, stage, company_id')
            .eq('created_by', authUser.id)
            .eq('stage', 'created')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!appError && existingApp) {
            appId = existingApp.id;
            initialData.fundingNeeded = existingApp.requested_amount;
            initialData.fundingPurpose = existingApp.purpose || undefined;
            initialData.briefDescription = existingApp.admin_notes || undefined;
            initialData.applicationId = existingApp.id;
            setApplicationId(existingApp.id);
          }
        } else {
          const { data: appData, error: appError2 } = await supabase
            .from('applications')
            .select('id, requested_amount, purpose, admin_notes, stage, company_id')
            .eq('id', appId)
            .maybeSingle();

          if (!appError2 && appData) {
            initialData.fundingNeeded = appData.requested_amount;
            initialData.fundingPurpose = appData.purpose || undefined;
            initialData.briefDescription = appData.admin_notes || undefined;
            initialData.applicationId = appData.id;
            setApplicationId(appData.id);
          }
        }

        // Load documents if application exists
        if (appId) {
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('application_id', appId);

          if (docsError) {
            console.error('[ApplicationWizard] Error loading documents:', docsError);
          }
        }

        // Update form data (pre-populate fields)
        setFormData(initialData);

        // Always start at step 1
        setCurrentStep(1);
        setIsLoadingData(false);
      } catch (error) {
        console.error('[ApplicationWizard] Error initializing:', error);
        // On error, show empty wizard at step 1
        setCurrentStep(1);
        setIsLoadingData(false);
      }
    };

    initWizard();
  }, []); // Empty deps - run once on mount

  const updateFormData = (field: keyof ApplicationFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        // Step 1 is Company
        if (!formData.companyName || !formData.industry) {
          setError('Please provide your company name and industry');
          return false;
        }
        if (!formData.firstName || !formData.lastName) {
          setError('Please select yourself as a director or enter your name');
          return false;
        }
        return true;
      case 2:
        // Step 2 is Personal Details
        if (!formData.firstName || !formData.lastName || !formData.phone || !formData.dateOfBirth || !formData.propertyStatus) {
          setError('Please fill in all required fields');
          return false;
        }
        // Validate UK phone format
        const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
        const cleanPhone = formData.phone.replace(/\s+/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          setError('Please enter a valid UK phone number');
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
        return true;
      case 3:
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
        // Validate bank statements
        // If application doesn't exist, create it first
        let appIdToCheck = applicationId || formData.applicationId;
        
        if (!appIdToCheck) {
          // Ensure we have required data to create application
          if (!formData.fundingNeeded) {
            setError('Please complete the funding request step first');
            return false;
          }
          
          try {
            // Create application if it doesn't exist
            const newAppId = await saveApplication();
            if (!newAppId) {
              setError('Failed to create application. Please try again.');
              return false;
            }
            appIdToCheck = newAppId;
          } catch (err) {
            setError('Failed to create application. Please try again.');
            return false;
          }
        }
        
        const supabase = getSupabaseClient();
        const { data: docs } = await supabase
          .from('documents')
          .select('id')
          .eq('application_id', appIdToCheck)
          .eq('category', 'bank_statements')
          .limit(1);
        
        if (!docs || docs.length === 0) {
          setError('Please upload at least one bank statement to continue');
          return false;
        }
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const saveProgress = async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      // Get current authenticated user directly
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        toast.error('You must be logged in to save progress');
        setIsLoading(false);
        return;
      }

      // Load existing profile to check for changes (may not exist yet)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, date_of_birth, property_status')
        .eq('id', currentUser.id)
        .maybeSingle();

      // Save personal details to profile - only update changed fields
      const profileUpdate: Record<string, any> = {};
      if (formData.firstName && formData.firstName !== existingProfile?.first_name) {
        profileUpdate.first_name = formData.firstName;
      }
      if (formData.lastName && formData.lastName !== existingProfile?.last_name) {
        profileUpdate.last_name = formData.lastName;
      }
      if (formData.phone && formData.phone !== existingProfile?.phone) {
        profileUpdate.phone = formData.phone;
      }
      if (formData.dateOfBirth && formData.dateOfBirth !== existingProfile?.date_of_birth) {
        profileUpdate.date_of_birth = formData.dateOfBirth;
      }
      if (formData.propertyStatus && formData.propertyStatus !== existingProfile?.property_status) {
        profileUpdate.property_status = formData.propertyStatus;
      }

      if (Object.keys(profileUpdate).length > 0) {
        await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            email: currentUser.email || '',
            ...profileUpdate,
          }, {
            onConflict: 'id',
          });
      }

      // Save company if provided and changed
      if (formData.companyName) {
        await saveCompany();
      }

      // Save application if provided and changed
      if (formData.fundingNeeded) {
        await saveApplication();
      }

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

  const saveCompany = async () => {
    if (!formData.companyName) return;

    const supabase = getSupabaseClient();
    
    try {
      // Get current authenticated user directly
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        console.error('Error: User not authenticated');
        return;
      }

      // Load existing profile to check for company_id (may not exist yet)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .maybeSingle();

      // If company exists, check what changed
      if (existingProfile?.company_id) {
        const { data: existingCompany, error: companyError } = await supabase
          .from('companies')
          .select('id, name, company_number, industry, website, companies_house_data')
          .eq('id', existingProfile.company_id)
          .maybeSingle();
        
        if (companyError) {
          console.error('Error loading company for update:', companyError);
          return;
        }

        if (existingCompany) {
          // Only update changed fields
          const companyUpdate: any = {};
          if (formData.companyName?.trim() !== existingCompany.name) {
            companyUpdate.name = formData.companyName.trim();
          }
          if ((formData.companyNumber?.trim() || null) !== existingCompany.company_number) {
            companyUpdate.company_number = formData.companyNumber?.trim() || null;
          }
          if (formData.industry !== existingCompany.industry) {
            companyUpdate.industry = formData.industry || null;
          }
          if ((formData.website?.trim() || null) !== existingCompany.website) {
            companyUpdate.website = formData.website?.trim() || null;
          }
          // Update Companies House data if provided
          if (formData.companiesHouseData && JSON.stringify(formData.companiesHouseData) !== JSON.stringify(existingCompany.companies_house_data)) {
            companyUpdate.companies_house_data = formData.companiesHouseData;
          }

          if (Object.keys(companyUpdate).length > 0) {
            await supabase
              .from('companies')
              .update(companyUpdate)
              .eq('id', existingProfile.company_id);
          }
        }
      } else {
        // Create new company
        const companyPayload: any = {
          name: formData.companyName.trim(),
          company_number: formData.companyNumber?.trim() || null,
          industry: formData.industry || null,
          website: formData.website?.trim() || null,
          companies_house_data: formData.companiesHouseData || null,
        };

        const { data: newCompany } = await supabase
          .from('companies')
          .insert(companyPayload)
          .select('id')
          .single();

        if (newCompany) {
          // Update or create profile with company_id
          await supabase
            .from('profiles')
            .upsert({
              id: currentUser.id,
              email: currentUser.email || '',
              company_id: newCompany.id,
              is_primary_director: true,
              first_name: formData.firstName || null,
              last_name: formData.lastName || null,
            }, {
              onConflict: 'id',
            });
        }
      }
    } catch (err) {
      console.error('Error saving company:', err);
    }
  };

  const saveApplication = async (): Promise<string | null> => {
    if (!formData.fundingNeeded) return null;

    const supabase = getSupabaseClient();
    
    try {
      // Get current authenticated user directly
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        console.error('Error: User not authenticated');
        return null;
      }

      // Load profile to get company_id (may not exist yet)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (applicationId) {
        // Check what changed
        const { data: existingApp } = await supabase
          .from('applications')
          .select('*')
          .eq('id', applicationId)
          .maybeSingle();

        if (existingApp) {
          const appUpdate: any = {};
          if (formData.fundingNeeded !== existingApp.requested_amount) {
            appUpdate.requested_amount = formData.fundingNeeded;
          }
          if (formData.fundingPurpose !== existingApp.purpose) {
            appUpdate.purpose = formData.fundingPurpose || null;
          }
          if ((formData.briefDescription?.trim() || null) !== existingApp.admin_notes) {
            appUpdate.admin_notes = formData.briefDescription?.trim() || null;
          }

          if (Object.keys(appUpdate).length > 0) {
            await supabase
              .from('applications')
              .update(appUpdate)
              .eq('id', applicationId);
          }
          return applicationId;
        }
      }
      
      // Create new application
      const applicationPayload: any = {
        company_id: existingProfile?.company_id || null,
        created_by: currentUser.id,
        requested_amount: formData.fundingNeeded,
        purpose: formData.fundingPurpose || null,
        admin_notes: formData.briefDescription?.trim() || null,
        stage: 'created',
        loan_type: 'term_loan', // Default to term_loan (required field, can be updated later)
        urgency: null, // NOTE: Urgency not currently collected in simplified form (ApplicationDetailsStep)
        // To add urgency back: 1) Add urgency?: string to ApplicationFormData, 2) Add field to ApplicationDetailsStep, 3) Update formData.urgency here
        monthly_revenue: null,
        trading_months: null,
      };

      const { data: newApplication, error } = await supabase
        .from('applications')
        .insert(applicationPayload)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating application:', error);
        throw error;
      }

      if (newApplication) {
        setApplicationId(newApplication.id);
        setFormData((prev) => ({
          ...prev,
          applicationId: newApplication.id,
        }));
        return newApplication.id;
      }
      
      return null;
    } catch (err) {
      console.error('Error saving application:', err);
      throw err;
    }
  };

  const nextStep = async () => {
    setError(null);
    
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      return;
    }

    // Save data at each step
    if (currentStep === 1) {
      // Step 1 is Company - save company first
      await saveCompany();
    } else if (currentStep === 2) {
      // NEW: Step 2 is Personal Details
      const supabase = getSupabaseClient();
      
      // Get current authenticated user directly
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        setError('You must be logged in to continue');
        return;
      }

      const profileUpdate: any = {};
      if (formData.firstName) profileUpdate.first_name = formData.firstName;
      if (formData.lastName) profileUpdate.last_name = formData.lastName;
      if (formData.phone) profileUpdate.phone = formData.phone;
      if (formData.dateOfBirth) profileUpdate.date_of_birth = formData.dateOfBirth;
      if (formData.propertyStatus) profileUpdate.property_status = formData.propertyStatus;

      if (Object.keys(profileUpdate).length > 0) {
        // Upsert profile (create if doesn't exist, update if it does)
        await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            email: currentUser.email || '',
            ...profileUpdate,
          }, {
            onConflict: 'id',
          });
      }
    } else if (currentStep === 3) {
      try {
        await saveApplication();
      } catch (err) {
        setError('Failed to save application. Please try again.');
        return;
      }
    }

    // Only advance to next step after successful validation and save
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalSubmit = async () => {
    if (!applicationId) {
      setError('Please complete all steps before submitting');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Get current authenticated user directly
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        throw new Error('You must be logged in to submit');
      }

      // Update application to submitted
      const { error: appError } = await supabase
        .from('applications')
        .update({
          stage: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (appError) {
        throw appError;
      }

      // Update profile with final data
      const profileUpdate: any = {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        phone: formData.phone || null,
        date_of_birth: formData.dateOfBirth || null,
        property_status: formData.propertyStatus || null,
      };

      // Upsert profile (create if doesn't exist, update if it does)
      await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          email: currentUser.email || '',
          ...profileUpdate,
        }, {
          onConflict: 'id',
        });

      toast.success("Application submitted! We'll be in touch within 24-48 hours.");

      // Redirect to dashboard immediately
      router.push('/dashboard');
      router.refresh(); // Ensure dashboard refreshes to show updated application
    } catch (err: any) {
      console.error('Error submitting application:', err);
      const errorMessage = err?.message || 'Failed to submit application. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        // Company first (most valuable step)
        return (
          <CompanyInfoStep
            formData={formData}
            updateFormData={updateFormData}
            profile={profile}
          />
        );
      case 2:
        // Personal details second
        return (
          <PersonalDetailsStep
            formData={formData}
            updateFormData={updateFormData}
            profile={profile}
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
            applicationId={applicationId}
          />
        );
      case 5:
        return (
          <ApplicationReviewStep
            formData={formData}
            onEdit={(step) => setCurrentStep(step)}
            onSubmit={handleFinalSubmit}
            isSubmitting={isLoading}
            applicationId={applicationId}
          />
        );
      default:
        return null;
    }
  };

  const stepConfig = STEP_CONFIG[currentStep];

  // Show loading while loading data
  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading your application...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with Save & Exit */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {stepConfig.title}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {stepConfig.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={saveProgress}
          disabled={isLoading}
          className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors disabled:opacity-50"
        >
          Save & Exit
        </button>
      </div>

      {/* Progress Bar */}
      <ApplicationProgress currentStep={currentStep} totalSteps={totalSteps} />

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="mt-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      {currentStep < 5 && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1 || isLoading}
            variant="secondary"
          >
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={isLoading}
            variant="primary"
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

