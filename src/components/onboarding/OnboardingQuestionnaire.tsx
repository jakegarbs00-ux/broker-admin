'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { onboardingQuestions } from './questions';
import { OnboardingQuestion } from './OnboardingQuestion';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingAnswers, MatchedLender } from './types';
import { fetchEligibleLenders } from './scoring';
import { Card, CardContent, Button } from '@/components/ui';

export function OnboardingQuestionnaire() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { user, profile } = useUserProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [matchedLenders, setMatchedLenders] = useState<MatchedLender[]>([]);

  // Get visible questions based on current step and conditional logic
  const getVisibleQuestions = () => {
    const visible: typeof onboardingQuestions = [];
    
    for (const question of onboardingQuestions) {
      if (question.conditional) {
        const conditionalValue = answers[question.conditional.questionId as keyof OnboardingAnswers];
        if (conditionalValue !== question.conditional.value) {
          continue;
        }
      }
      visible.push(question);
    }
    
    return visible;
  };

  const visibleQuestions = getVisibleQuestions();
  const currentQuestion = visibleQuestions[currentStep];
  const totalSteps = visibleQuestions.length;

  // Fetch lenders as user answers questions
  useEffect(() => {
    const loadLenders = async () => {
      if (currentStep >= 5) { // Start matching after basic questions
        const lenders = await fetchEligibleLenders(answers);
        setMatchedLenders(lenders);
      }
    };
    
    loadLenders();
  }, [answers, currentStep]);

  const handleNext = () => {
    // Validate current question
    if (currentQuestion.required && !answers[currentQuestion.id as keyof OnboardingAnswers]) {
      setErrors({ [currentQuestion.id]: 'This field is required' });
      return;
    }

    setErrors({});

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile) {
      return;
    }

    setLoading(true);

    try {
      // Update profile with personal info
      const profileUpdate: any = {
        first_name: answers.firstName,
        last_name: answers.lastName,
        phone: answers.phone,
      };

      // CRITICAL: Verify authenticated user ID before updating
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        console.error('[OnboardingQuestionnaire] SECURITY: User ID mismatch');
        throw new Error('Authentication error');
      }

      // Try to update with onboarding_completed, but handle if column doesn't exist
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

      // Create or update company
      let companyId: string | null = null;
      
      // Check if company exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (existingCompany) {
        companyId = existingCompany.id;
        // Update company
        await supabase
          .from('companies')
          .update({
            name: answers.companyName,
            company_number: answers.companyNumber || null,
            industry: answers.industry || null,
          })
          .eq('id', companyId);
      } else {
        // Create company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: answers.companyName,
            company_number: answers.companyNumber || null,
            industry: answers.industry || null,
            owner_id: user.id,
          })
          .select('id')
          .single();

        if (companyError || !newCompany) {
          console.error('Error creating company:', companyError);
          throw companyError;
        }

        companyId = newCompany.id;

        // Link company to profile
        // CRITICAL: Use authenticated user ID
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== user.id) {
          console.error('[OnboardingQuestionnaire] SECURITY: User ID mismatch');
          throw new Error('Authentication error');
        }

        await supabase
          .from('profiles')
          .update({ company_id: companyId })
          .eq('id', currentUser.id); // Use authenticated user ID
      }

      // Calculate trading months
      const tradingMonthsMap: Record<string, number> = {
        '0-3': 1,
        '3-6': 4,
        '6-12': 9,
        '12-24': 18,
        '24+': 30,
      };
      const tradingMonths = tradingMonthsMap[answers.tradingTime || ''] || 0;

      // Create application with eligibility results
      const eligibilityResult = {
        ...answers,
        matchedLenders: matchedLenders.map(l => ({
          id: l.id,
          name: l.name,
          matchScore: l.matchScore,
        })),
      };

      const { error: appError } = await supabase
        .from('applications')
        .insert({
          company_id: companyId,
          owner_id: user.id,
          requested_amount: answers.fundingNeeded || 0,
          loan_type: 'term_loan',
          stage: 'created',
          monthly_revenue: answers.monthlyRevenue || null,
          trading_months: tradingMonths,
          eligibility_result: eligibilityResult,
        });

      if (appError) {
        console.error('Error creating application:', appError);
        throw appError;
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      setErrors({ submit: error?.message || 'Failed to save your information. Please try again.' });
      setLoading(false);
    }
  };

  if (!currentQuestion) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <OnboardingProgress currentStep={currentStep + 1} totalSteps={totalSteps} />

      <Card>
        <CardContent className="p-6">
          <OnboardingQuestion
            question={currentQuestion}
            value={answers[currentQuestion.id as keyof OnboardingAnswers]}
            onChange={(value) => {
              setAnswers((prev) => ({
                ...prev,
                [currentQuestion.id]: value,
              }));
              // Clear error when user starts typing
              if (errors[currentQuestion.id]) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors[currentQuestion.id];
                  return newErrors;
                });
              }
            }}
            answers={answers}
            error={errors[currentQuestion.id]}
          />

          {errors.submit && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <Button
              onClick={handleNext}
              disabled={loading}
              variant="primary"
            >
              {loading ? 'Saving...' : currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Show matched lenders if available */}
      {matchedLenders.length > 0 && currentStep >= 5 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              Potential Matches ({matchedLenders.length})
            </h3>
            <div className="space-y-2">
              {matchedLenders.slice(0, 5).map((lender) => (
                <div
                  key={lender.id}
                  className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {lender.name}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {lender.matchScore}% match
                    </span>
                  </div>
                  {lender.reasons.length > 0 && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {lender.reasons.slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

