export type QuestionType = 
  | 'text'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'boolean';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: QuestionOption[];
  conditional?: {
    questionId: string;
    value: string | number | boolean;
  };
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  helpText?: string;
}

export interface OnboardingAnswers {
  // Personal info
  firstName?: string;
  lastName?: string;
  phone?: string;
  
  // Company info
  companyName?: string;
  companyNumber?: string;
  
  // Eligibility questions
  tradingTime?: string;
  monthlyRevenue?: number;
  annualProfit?: number;
  netAssets?: number;
  fundingNeeded?: number;
  businessType?: string;
  industry?: string;
  ccjs?: boolean;
  ccjValue?: number;
  directorsHomeowners?: boolean;
  cardPaymentPercentage?: number;
  existingLoans?: boolean;
  existingLendersCount?: number;
  filedAccounts?: boolean;
}

export interface MatchedLender {
  id: string;
  name: string;
  matchScore: number;
  reasons: string[];
}

