'use client';

import { Check } from 'lucide-react';

interface ApplicationProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = [
  'Your Details',
  'Your Company',
  'Funding Request',
  'Documents',
  'Review',
];

export function ApplicationProgress({ currentStep, totalSteps }: ApplicationProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, index) => {
          const step = index + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          
          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* Step Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isCompleted
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                      : isCurrent
                      ? 'border-[var(--color-accent)] bg-white text-[var(--color-accent)]'
                      : 'border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step}</span>
                  )}
                </div>
                {/* Step Label */}
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent
                      ? 'text-[var(--color-accent)]'
                      : isCompleted
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {/* Connector Line */}
              {step < totalSteps && (
                <div
                  className={`h-0.5 flex-1 mx-2 -mt-5 ${
                    isCompleted ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

