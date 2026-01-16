import { Question, OnboardingAnswers } from './types';

interface OnboardingQuestionProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  answers: OnboardingAnswers;
  error?: string;
}

export function OnboardingQuestion({
  question,
  value,
  onChange,
  answers,
  error,
}: OnboardingQuestionProps) {
  // Check if question should be shown based on conditional logic
  if (question.conditional) {
    const conditionalValue = answers[question.conditional.questionId as keyof OnboardingAnswers];
    if (conditionalValue !== question.conditional.value) {
      return null;
    }
  }

  const renderInput = () => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          >
            <option value="">Select an option...</option>
            {question.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => onChange(true)}
              className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                value === true
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange(false)}
              className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                value === false
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              No
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--color-text-primary)]">
        {question.label}
        {question.required && <span className="text-[var(--color-error)] ml-1">*</span>}
      </label>
      {question.helpText && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{question.helpText}</p>
      )}
      {renderInput()}
      {error && (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}

