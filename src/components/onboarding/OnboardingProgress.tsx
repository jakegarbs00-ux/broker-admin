interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {Math.round(percentage)}% Complete
        </span>
      </div>
      <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2">
        <div
          className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

