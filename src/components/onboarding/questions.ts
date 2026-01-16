import { Question } from './types';

export const onboardingQuestions: Question[] = [
  // Personal Information Section
  {
    id: 'firstName',
    type: 'text',
    label: 'First Name',
    placeholder: 'Enter your first name',
    required: true,
  },
  {
    id: 'lastName',
    type: 'text',
    label: 'Last Name',
    placeholder: 'Enter your last name',
    required: true,
  },
  {
    id: 'phone',
    type: 'text',
    label: 'Phone Number',
    placeholder: 'Enter your phone number',
    required: false,
  },
  
  // Company Information Section
  {
    id: 'companyName',
    type: 'text',
    label: 'Company Name',
    placeholder: 'Enter your company name',
    required: true,
  },
  {
    id: 'companyNumber',
    type: 'text',
    label: 'Company Number (Optional)',
    placeholder: 'Enter your Companies House number',
    required: false,
  },
  
  // Eligibility Questions
  {
    id: 'tradingTime',
    type: 'select',
    label: 'How long have you been trading?',
    required: true,
    options: [
      { value: '0-3', label: '0-3 months' },
      { value: '3-6', label: '3-6 months' },
      { value: '6-12', label: '6-12 months' },
      { value: '12-24', label: '12-24 months' },
      { value: '24+', label: '24+ months' },
    ],
  },
  {
    id: 'monthlyRevenue',
    type: 'number',
    label: 'Monthly Revenue (£)',
    placeholder: 'Enter your average monthly revenue',
    required: true,
    validation: {
      min: 0,
    },
  },
  {
    id: 'annualProfit',
    type: 'number',
    label: 'Annual Profit (£)',
    placeholder: 'Enter your annual profit',
    required: false,
    conditional: {
      questionId: 'tradingTime',
      value: '12-24',
    },
    validation: {
      min: 0,
    },
  },
  {
    id: 'netAssets',
    type: 'number',
    label: 'Net Assets (£)',
    placeholder: 'Enter your net assets',
    required: false,
    conditional: {
      questionId: 'tradingTime',
      value: '24+',
    },
    validation: {
      min: 0,
    },
  },
  {
    id: 'fundingNeeded',
    type: 'number',
    label: 'How much funding do you need? (£)',
    placeholder: 'Enter the amount you need',
    required: true,
    validation: {
      min: 1000,
    },
  },
  {
    id: 'businessType',
    type: 'select',
    label: 'Business Type',
    required: true,
    options: [
      { value: 'sole_trader', label: 'Sole Trader' },
      { value: 'partnership', label: 'Partnership' },
      { value: 'limited_company', label: 'Limited Company' },
      { value: 'llp', label: 'LLP' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'industry',
    type: 'select',
    label: 'Industry',
    required: true,
    options: [
      { value: 'retail', label: 'Retail' },
      { value: 'hospitality', label: 'Hospitality' },
      { value: 'construction', label: 'Construction' },
      { value: 'professional_services', label: 'Professional Services' },
      { value: 'technology', label: 'Technology' },
      { value: 'manufacturing', label: 'Manufacturing' },
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'transport', label: 'Transport' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'ccjs',
    type: 'boolean',
    label: 'Do you have any CCJs or defaults?',
    required: true,
  },
  {
    id: 'ccjValue',
    type: 'number',
    label: 'Total CCJ Value (£)',
    placeholder: 'Enter total CCJ value',
    required: false,
    conditional: {
      questionId: 'ccjs',
      value: true,
    },
    validation: {
      min: 0,
    },
  },
  {
    id: 'directorsHomeowners',
    type: 'boolean',
    label: 'Are any directors homeowners?',
    required: true,
  },
  {
    id: 'cardPaymentPercentage',
    type: 'number',
    label: 'What percentage of revenue comes from card payments?',
    placeholder: 'Enter percentage (0-100)',
    required: false,
    validation: {
      min: 0,
      max: 100,
    },
  },
  {
    id: 'existingLoans',
    type: 'boolean',
    label: 'Do you have any existing loans?',
    required: true,
  },
  {
    id: 'existingLendersCount',
    type: 'number',
    label: 'How many existing lenders?',
    placeholder: 'Enter number of lenders',
    required: false,
    conditional: {
      questionId: 'existingLoans',
      value: true,
    },
    validation: {
      min: 0,
    },
  },
  {
    id: 'filedAccounts',
    type: 'boolean',
    label: 'Have you filed accounts?',
    required: true,
  },
];

