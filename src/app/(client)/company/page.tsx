'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';
import { Building2, MapPin, Calendar, FileText, ArrowLeft, Globe, Hash, Briefcase } from 'lucide-react';
import Link from 'next/link';

type Company = {
  id: string;
  name: string;
  company_number?: string | null;
  industry?: string | null;
  website?: string | null;
  companies_house_data?: any; // Full Companies House API response
  created_at: string;
};

export default function CompanyPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Get profile to find company_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData?.company_id) {
        setError('No company found. Please complete the application to add your company.');
        setLoading(false);
        return;
      }

      // Get company with Companies House data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profileData.company_id)
        .maybeSingle();

      if (companyError) {
        console.error('Error loading company:', companyError);
        setError('Failed to load company information.');
        setLoading(false);
        return;
      }

      if (!companyData) {
        setError('Company not found.');
        setLoading(false);
        return;
      }

      setCompany(companyData);
      setLoading(false);
    };

    loadCompany();
  }, []);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading company information...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !company) {
    return (
      <DashboardShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                  {error || 'Company not found'}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  {error || 'Please complete the application to add your company information.'}
                </p>
                <Link href="/apply">
                  <Button variant="primary">Start Application</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  // Extract Companies House data
  const chData = company?.companies_house_data;
  const address = chData?.registered_office_address || {};
  
  // Format registered address from Companies House data
  const formatAddress = () => {
    if (chData?.registered_office_address) {
      const addr = chData.registered_office_address;
      const parts = [
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.region,
        addr.postal_code,
        addr.country,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Not provided';
    }
    return 'Not provided';
  };

  // Format SIC codes with descriptions
  const formatSicCodes = () => {
    const sicCodes = chData?.sic_codes || [];
    if (sicCodes.length === 0) return 'Not provided';
    
    return sicCodes.map((code: string) => {
      // Extract the code and description if available
      const parts = code.split(' - ');
      return parts.length > 1 ? `${parts[0]}: ${parts[1]}` : code;
    }).join(', ');
  };

  // Format incorporation date
  const formatIncorporationDate = () => {
    if (!chData?.date_of_creation) return 'Not provided';
    try {
      const date = new Date(chData.date_of_creation);
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return chData.date_of_creation;
    }
  };

  const sicCodes = chData?.sic_codes || [];
  const incorporationDate = chData?.date_of_creation;
  const companyStatus = chData?.company_status || 'Unknown';

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Company Information</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              View your company details
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Company Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {company.name}
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Number */}
            {company.company_number && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <Hash className="w-4 h-4" />
                  <span>Company Number</span>
                </div>
                <p className="text-[var(--color-text-primary)] font-medium">{company.company_number}</p>
              </div>
            )}

            {/* Company Status */}
            {companyStatus && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <FileText className="w-4 h-4" />
                  <span>Status</span>
                </div>
                <p className="text-[var(--color-text-primary)] font-medium capitalize">{companyStatus}</p>
              </div>
            )}

            {/* Registered Address */}
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <MapPin className="w-4 h-4" />
                <span>Registered Address</span>
              </div>
              <p className="text-[var(--color-text-primary)]">{formatAddress()}</p>
            </div>

            {/* SIC Codes */}
            {sicCodes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span>SIC Codes</span>
                </div>
                <p className="text-[var(--color-text-primary)]">{formatSicCodes()}</p>
              </div>
            )}

            {/* Incorporation Date */}
            {incorporationDate && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>Incorporation Date</span>
                </div>
                <p className="text-[var(--color-text-primary)]">{formatIncorporationDate()}</p>
              </div>
            )}

            {/* Industry (from our form) */}
            {company.industry && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span>Industry</span>
                </div>
                <p className="text-[var(--color-text-primary)] font-medium capitalize">
                  {company.industry.replace(/_/g, ' ')}
                </p>
              </div>
            )}

            {/* Website */}
            {company.website && (
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                  <Globe className="w-4 h-4" />
                  <span>Website</span>
                </div>
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
                >
                  {company.website}
                </a>
              </div>
            )}

            {/* Created Date */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Added on {new Date(company.created_at).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

