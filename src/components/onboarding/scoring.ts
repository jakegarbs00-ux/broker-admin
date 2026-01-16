'use client';

import { getSupabaseClient } from '@/lib/supabaseClient';
import { OnboardingAnswers, MatchedLender } from './types';

export interface Lender {
  id: string;
  name: string;
  is_eligible_panel: boolean | null;
  min_trading_months: number | null;
  min_monthly_revenue: number | null;
  max_monthly_revenue_multiple: number | null;
  max_annual_revenue_percentage: number | null;
  absolute_min_loan: number | null;
  absolute_max_loan: number | null;
  accepted_business_types: string[] | null;
  prohibited_industries: string[] | null;
  requires_filed_accounts: boolean | null;
  min_filed_accounts_years: number | null;
  accepts_ccjs: boolean | null;
  max_ccj_value: number | null;
  requires_homeowner: boolean | null;
  homeowner_min_loan: number | null;
  requires_card_payments: boolean | null;
  min_card_payment_percentage: number | null;
  requires_existing_lending: boolean | null;
  max_existing_lenders: number | null;
  min_profit_margin_percentage: number | null;
  requires_profitable: boolean | null;
  min_net_assets_ratio: number | null;
  requires_positive_net_assets: boolean | null;
}

export async function fetchEligibleLenders(answers: OnboardingAnswers): Promise<MatchedLender[]> {
  const supabase = getSupabaseClient();
  
  // Fetch all lenders that are enabled for eligibility panel
  const { data: lenders, error } = await supabase
    .from('lenders')
    .select('*')
    .eq('is_eligible_panel', true)
    .eq('status', 'active');

  if (error || !lenders) {
    console.error('Error fetching lenders:', error);
    return [];
  }

  const matched: MatchedLender[] = [];

  for (const lender of lenders as Lender[]) {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;

    // Convert trading time to months
    const tradingMonths = getTradingMonths(answers.tradingTime);
    
    // Check trading months
    if (lender.min_trading_months !== null && tradingMonths < lender.min_trading_months) {
      eligible = false;
    } else if (lender.min_trading_months !== null) {
      score += 10;
      reasons.push(`Meets minimum trading time requirement`);
    }

    // Check monthly revenue
    if (answers.monthlyRevenue) {
      if (lender.min_monthly_revenue !== null && answers.monthlyRevenue < lender.min_monthly_revenue) {
        eligible = false;
      } else if (lender.min_monthly_revenue !== null) {
        score += 10;
        reasons.push(`Meets minimum monthly revenue`);
      }

      // Check revenue multiple
      if (lender.max_monthly_revenue_multiple !== null && answers.fundingNeeded) {
        const multiple = answers.fundingNeeded / answers.monthlyRevenue;
        if (multiple > lender.max_monthly_revenue_multiple) {
          eligible = false;
        } else {
          score += 10;
          reasons.push(`Loan amount within revenue multiple`);
        }
      }
    }

    // Check loan amount
    if (answers.fundingNeeded) {
      if (lender.absolute_min_loan !== null && answers.fundingNeeded < lender.absolute_min_loan) {
        eligible = false;
      }
      if (lender.absolute_max_loan !== null && answers.fundingNeeded > lender.absolute_max_loan) {
        eligible = false;
      }
      if (lender.absolute_min_loan !== null || lender.absolute_max_loan !== null) {
        score += 10;
        reasons.push(`Loan amount within range`);
      }
    }

    // Check business type
    if (lender.accepted_business_types && lender.accepted_business_types.length > 0) {
      if (answers.businessType && lender.accepted_business_types.includes(answers.businessType)) {
        score += 10;
        reasons.push(`Accepts your business type`);
      } else {
        eligible = false;
      }
    }

    // Check prohibited industries
    if (lender.prohibited_industries && lender.prohibited_industries.length > 0) {
      if (answers.industry && lender.prohibited_industries.includes(answers.industry)) {
        eligible = false;
      } else if (answers.industry) {
        score += 5;
        reasons.push(`Industry not prohibited`);
      }
    }

    // Check filed accounts
    if (lender.requires_filed_accounts !== null) {
      if (lender.requires_filed_accounts && !answers.filedAccounts) {
        eligible = false;
      } else if (answers.filedAccounts) {
        score += 10;
        reasons.push(`Has filed accounts`);
      }
    }

    // Check CCJs
    if (lender.accepts_ccjs !== null) {
      if (!lender.accepts_ccjs && answers.ccjs) {
        eligible = false;
      } else if (lender.accepts_ccjs && !answers.ccjs) {
        score += 10;
        reasons.push(`No CCJs`);
      } else if (lender.accepts_ccjs && answers.ccjs && lender.max_ccj_value !== null) {
        if (answers.ccjValue && answers.ccjValue <= lender.max_ccj_value) {
          score += 5;
          reasons.push(`CCJ value within acceptable range`);
        } else {
          eligible = false;
        }
      }
    }

    // Check homeowner requirement
    if (lender.requires_homeowner !== null) {
      if (lender.requires_homeowner && !answers.directorsHomeowners) {
        eligible = false;
      } else if (answers.directorsHomeowners) {
        score += 10;
        reasons.push(`Director is homeowner`);
      }
    }

    // Check card payments
    if (lender.requires_card_payments !== null && lender.min_card_payment_percentage !== null) {
      if (lender.requires_card_payments && (!answers.cardPaymentPercentage || answers.cardPaymentPercentage < lender.min_card_payment_percentage)) {
        eligible = false;
      } else if (answers.cardPaymentPercentage && answers.cardPaymentPercentage >= lender.min_card_payment_percentage) {
        score += 10;
        reasons.push(`Meets card payment requirement`);
      }
    }

    // Check existing lending
    if (lender.requires_existing_lending !== null) {
      if (lender.requires_existing_lending && !answers.existingLoans) {
        eligible = false;
      } else if (answers.existingLoans && lender.max_existing_lenders !== null) {
        if (answers.existingLendersCount && answers.existingLendersCount <= lender.max_existing_lenders) {
          score += 5;
          reasons.push(`Existing lenders within limit`);
        } else {
          eligible = false;
        }
      }
    }

    // Check profit requirements
    if (lender.requires_profitable !== null && answers.annualProfit !== undefined) {
      if (lender.requires_profitable && answers.annualProfit <= 0) {
        eligible = false;
      } else if (answers.annualProfit > 0) {
        score += 10;
        reasons.push(`Profitable business`);
      }
    }

    // Check net assets
    if (lender.requires_positive_net_assets !== null && answers.netAssets !== undefined) {
      if (lender.requires_positive_net_assets && answers.netAssets <= 0) {
        eligible = false;
      } else if (answers.netAssets > 0) {
        score += 10;
        reasons.push(`Positive net assets`);
      }
    }

    if (eligible && score > 0) {
      matched.push({
        id: lender.id,
        name: lender.name,
        matchScore: score,
        reasons,
      });
    }
  }

  // Sort by match score descending
  return matched.sort((a, b) => b.matchScore - a.matchScore);
}

function getTradingMonths(tradingTime?: string): number {
  if (!tradingTime) return 0;
  
  const ranges: Record<string, number> = {
    '0-3': 1,
    '3-6': 4,
    '6-12': 9,
    '12-24': 18,
    '24+': 30,
  };
  
  return ranges[tradingTime] || 0;
}

