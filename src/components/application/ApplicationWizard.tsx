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
  useEffect(() => {
    // Wait for useUserProfile to finish loading
    if (profileLoading) {
      return;
    }

    // If no user, redirect will happen from useRequireAuth
    if (!user) {
      setIsLoadingData(false);
      return;
    }

    // If no profile yet, that's okay - just show wizard with empty fields immediately
    // Don't wait for profile - it might be created by trigger soon
    if (!profile) {
      setIsLoadingData(false);
      return;
    }

    // We have user and profile - load data to pre-populate
    setIsLoadingData(true);

    const loadDataAndPrepopulate = async () => {

      try {
        const supabase = getSupabaseClient();
        const initialData: ApplicationFormData = {};

        // Pre-fill Personal Details from profile
        const profileWithDetails = profile as typeof profile & {
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          property_status?: string | null;
        };
        if (profileWithDetails.first_name) initialData.firstName = profileWithDetails.first_name;
        if (profileWithDetails.last_name) initialData.lastName = profileWithDetails.last_name;
        if (profileWithDetails.phone) initialData.phone = profileWithDetails.phone;
        if (profileWithDetails.date_of_birth) initialData.dateOfBirth = profileWithDetails.date_of_birth;
        if (profileWithDetails.property_status) initialData.propertyStatus = profileWithDetails.property_status;

        // Load company data
        let company = null;
        if (profile.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('id, name, company_number, industry, website')
            .eq('id', profile.company_id)
            .maybeSingle(); // Use maybeSingle to avoid 400 errors

          if (companyError) {
            console.error('[Step Detection] Error loading company:', companyError);
          } else if (companyData) {
            company = companyData;
            initialData.companyName = companyData.name;
            initialData.companyNumber = companyData.company_number || undefined;
            initialData.industry = companyData.industry || undefined;
            initialData.website = companyData.website || undefined;
          }
        }

        // Load application data (check for existing or use propApplicationId)
        let application = null;
        let appId = propApplicationId;

        if (!appId) {
          // Check for existing application in 'created' stage
          const { data: existingApp, error: appError } = await supabase
            .from('applications')
            .select('id, requested_amount, purpose, admin_notes, stage, company_id')
            .eq('created_by', user.id) // Use created_by instead of owner_id
            .eq('stage', 'created')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (appError) {
            console.error('[Step Detection] Error loading application:', appError);
          } else if (existingApp) {
            application = existingApp;
            appId = existingApp.id;
          }
        } else {
          const { data: appData, error: appError2 } = await supabase
            .from('applications')
            .select('id, requested_amount, purpose, admin_notes, stage, company_id')
            .eq('id', appId)
            .maybeSingle(); // Use maybeSingle to avoid 400 errors

          if (appError2) {
            console.error('[Step Detection] Error loading application by ID:', appError2);
          } else if (appData) {
            application = appData;
          }
        }

        if (application) {
          initialData.fundingNeeded = application.requested_amount;
          initialData.fundingPurpose = application.purpose || undefined;
          initialData.briefDescription = application.admin_notes || undefined;
          initialData.applicationId = application.id;
          setApplicationId(application.id);
        }

        // Load documents if application exists
        let documents: any[] = [];
        if (appId) {
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('application_id', appId);

          if (docsError) {
            console.error('[Step Detection] Error loading documents:', docsError);
          } else if (docs) {
            documents = docs;
          }
        }

        // Update form data (pre-populate fields)
        setFormData(initialData);

        // Always start at step 1
        setCurrentStep(1);
        setIsLoadingData(false);
      } catch (error) {
        console.error('[ApplicationWizard] Error loading data:', error);
        // On error, still show wizard at step 1
        setCurrentStep(1);
        setIsLoadingData(false);
      }
    };

    // Only call async function if we have both user and profile
    if (user && profile) {
      loadDataAndPrepopulate();
    }
  }, [user, profile, profileLoading, propApplicationId]);

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
          if (!formData.fundingNeeded || !profile) {
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
    if (!user || !profile) return;

    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      // Save personal details to profile - only update changed fields
      const profileWithDetails = profile as typeof profile & {
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        date_of_birth?: string | null;
        property_status?: string | null;
      };
      const profileUpdate: Record<string, any> = {};
      if (formData.firstName && formData.firstName !== profileWithDetails.first_name) {
        profileUpdate.first_name = formData.firstName;
      }
      if (formData.lastName && formData.lastName !== profileWithDetails.last_name) {
        profileUpdate.last_name = formData.lastName;
      }
      if (formData.phone && formData.phone !== profileWithDetails.phone) {
        profileUpdate.phone = formData.phone;
      }
      if (formData.dateOfBirth && formData.dateOfBirth !== profileWithDetails.date_of_birth) {
        profileUpdate.date_of_birth = formData.dateOfBirth;
      }
      if (formData.propertyStatus && formData.propertyStatus !== profileWithDetails.property_status) {
        profileUpdate.property_status = formData.propertyStatus;
      }

      if (Object.keys(profileUpdate).length > 0 && user) {
        // CRITICAL: Verify user is authenticated and use their ID
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== user.id) {
          console.error('[ApplicationWizard] SECURITY: User ID mismatch during profile update');
          return;
        }
        
        await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', currentUser.id); // Use authenticated user ID
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
    if (!profile || !formData.companyName) return;

    const supabase = getSupabaseClient();
    
    try {
      // If company exists, check what changed
      if (profile.company_id) {
        const { data: existingCompany, error: companyError } = await supabase
          .from('companies')
          .select('id, name, company_number, industry, website')
          .eq('id', profile.company_id)
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
          // Note: companies_house_data doesn't exist in companies table, skip it

          if (Object.keys(companyUpdate).length > 0) {
            await supabase
              .from('companies')
              .update(companyUpdate)
              .eq('id', profile.company_id);
          }
        }
      } else {
        // Create new company
        const companyPayload: any = {
          name: formData.companyName.trim(),
          company_number: formData.companyNumber?.trim() || null,
          industry: formData.industry || null,
          website: formData.website?.trim() || null,
          // Note: companies_house_data doesn't exist in companies table
        };

        const { data: newCompany } = await supabase
          .from('companies')
          .insert(companyPayload)
          .select('id')
          .single();

        if (newCompany) {
          await supabase
            .from('profiles')
            .update({ 
              company_id: newCompany.id,
              is_primary_director: true,
              first_name: formData.firstName,
              last_name: formData.lastName,
            })
            .eq('id', profile.id);
        }
      }
    } catch (err) {
      console.error('Error saving company:', err);
    }
  };

  const saveApplication = async (): Promise<string | null> => {
    if (!profile || !formData.fundingNeeded) return null;

    const supabase = getSupabaseClient();
    
    try {
      if (applicationId) {
        // Check what changed
        const { data: existingApp } = await supabase
          .from('applications')
          .select('*')
          .eq('id', applicationId)
          .single();

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
        company_id: profile.company_id || null,
        created_by: profile.id, // Use created_by instead of owner_id
        requested_amount: formData.fundingNeeded,
        purpose: formData.fundingPurpose || null,
        admin_notes: formData.briefDescription?.trim() || null,
        stage: 'created',
        loan_type: 'term_loan', // Default to term_loan (required field, can be updated later)
        urgency: null,
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
      const profileUpdate: any = {};
      if (formData.firstName) profileUpdate.first_name = formData.firstName;
      if (formData.lastName) profileUpdate.last_name = formData.lastName;
      if (formData.phone) profileUpdate.phone = formData.phone;
      if (formData.dateOfBirth) profileUpdate.date_of_birth = formData.dateOfBirth;
      if (formData.propertyStatus) profileUpdate.property_status = formData.propertyStatus;

      if (Object.keys(profileUpdate).length > 0 && user) {
        // CRITICAL: Verify user is authenticated and use their ID
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== user.id) {
          console.error('[ApplicationWizard] SECURITY: User ID mismatch during profile update');
          return;
        }
        
        await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', currentUser.id); // Use authenticated user ID
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
    if (!user || !profile || !applicationId) {
      setError('Please complete all steps before submitting');
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
        .eq('id', applicationId);

      if (appError) {
        throw appError;
      }

      // Update profile
      // CRITICAL: Verify user is authenticated and use their ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[ApplicationWizard] SECURITY: User ID mismatch during final submit');
        throw new Error('Authentication error');
      }

      const profileUpdate: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        date_of_birth: formData.dateOfBirth || null,
        property_status: formData.propertyStatus || null,
      };

      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', currentUser.id); // Use authenticated user ID

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

