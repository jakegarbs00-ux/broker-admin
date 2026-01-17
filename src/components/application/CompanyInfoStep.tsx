'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { ApplicationFormData } from './ApplicationWizard';
import { Building2, MapPin, Calendar, FileText, Globe, Edit2 } from 'lucide-react';

interface CompanyInfoStepProps {
  formData: ApplicationFormData;
  updateFormData: (field: keyof ApplicationFormData, value: any) => void;
  profile: any;
}

interface CompanyDetails {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  companies_house_data: any | null;
}

// Map SIC codes to industry
function mapSicCodeToIndustry(sicCode: string): string | null {
  if (!sicCode) return null;
  
  const code = parseInt(sicCode.substring(0, 5)); // Get first 5 digits
  if (isNaN(code)) return null;
  
  // Agriculture (01xxx - Crop and animal production, 02xxx - Forestry and logging, 03xxx - Fishing and aquaculture)
  if (code >= 1000 && code <= 3999) return 'agriculture';
  
  // Manufacturing (10xxx - 33xxx)
  if (code >= 10000 && code <= 33999) return 'manufacturing';
  
  // Construction (41xxx, 42xxx, 43xxx)
  if (code >= 41000 && code <= 43999) return 'construction';
  
  // Retail (45xxx - Wholesale and retail trade and repair of motor vehicles)
  if (code >= 45100 && code <= 47990) return 'retail';
  
  // Transport & Logistics (49xxx - Land transport and transport via pipelines, 50xxx - Water transport, 51xxx - Air transport, 52xxx - Warehousing and support activities for transportation, 53xxx - Postal and courier activities)
  if (code >= 49000 && code <= 53999) return 'transport';
  
  // Hospitality (55xxx - Accommodation, 56xxx - Food and beverage service activities)
  if (code >= 55100 && code <= 56302) return 'hospitality';
  
  // Technology (62xxx - Computer programming, consultancy and related activities, 63xxx - Information service activities)
  if (code >= 62000 && code <= 63999) return 'technology';
  
  // Professional Services (69xxx - Legal and accounting activities, 70xxx - Activities of head offices, 71xxx - Architectural and engineering activities, 72xxx - Scientific research and development, 73xxx - Advertising and market research, 74xxx - Other professional, scientific and technical activities, 78xxx - Employment activities)
  if ((code >= 69000 && code <= 70229) || (code >= 71000 && code <= 74990) || (code >= 78000 && code <= 78300)) return 'professional_services';
  
  // Property (68xxx - Real estate activities)
  if (code >= 68000 && code <= 68320) return 'property';
  
  // Healthcare (86xxx - Human health activities, 87xxx - Residential care activities, 88xxx - Social work activities)
  if (code >= 86000 && code <= 88999) return 'healthcare';
  
  return null;
}

export function CompanyInfoStep({ formData, updateFormData, profile }: CompanyInfoStepProps) {
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedIndustry, setEditedIndustry] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');

  // Fetch company details
  useEffect(() => {
    const fetchCompany = async () => {
      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (data) {
        // Map SIC codes to industry if not already set
        let industry = data.industry;
        const chData = data.companies_house_data;
        const sicCodes = chData?.sic_codes || [];
        
        if (!industry && sicCodes.length > 0) {
          // Try to find industry from SIC codes
          for (const sicCode of sicCodes) {
            const mappedIndustry = mapSicCodeToIndustry(sicCode);
            if (mappedIndustry) {
              industry = mappedIndustry;
              // Auto-update in database
              supabase
                .from('companies')
                .update({ industry: mappedIndustry })
                .eq('id', data.id);
              break; // Use first matching SIC code
            }
          }
        }
        
        setCompany(data);
        setEditedIndustry(industry || '');
        setEditedWebsite(data.website || '');
        
        // Sync to formData
        updateFormData('companyName', data.name);
        updateFormData('companyNumber', data.company_number || '');
        updateFormData('industry', industry || '');
        updateFormData('website', data.website || '');
        updateFormData('companiesHouseData', data.companies_house_data);
      }

      setLoading(false);
    };

    fetchCompany();
  }, [profile?.company_id, updateFormData]);

  const handleSaveEdits = async () => {
    if (!company) return;

    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('companies')
      .update({
        industry: editedIndustry || null,
        website: editedWebsite || null,
      })
      .eq('id', company.id);

    if (!error) {
      setCompany({ ...company, industry: editedIndustry, website: editedWebsite });
      updateFormData('industry', editedIndustry);
      updateFormData('website', editedWebsite);
      setIsEditing(false);
    }
  };

  // Extract data from Companies House
  const chData = company?.companies_house_data;
  const incorporationDate = chData?.date_of_creation;
  const companyStatus = chData?.company_status;
  const sicCodes = chData?.sic_codes || [];
  const registeredAddress = chData?.registered_office_address;

  // Format address
  const formatAddress = () => {
    if (registeredAddress) {
      return [
        registeredAddress.address_line_1,
        registeredAddress.address_line_2,
        registeredAddress.locality,
        registeredAddress.postal_code,
        registeredAddress.country,
      ].filter(Boolean).join(', ');
    }
    
    return [
      company?.address_line_1,
      company?.address_line_2,
      company?.city,
      company?.postcode,
      company?.country,
    ].filter(Boolean).join(', ') || 'Not provided';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">No company found. Please go back and complete signup.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="bg-[var(--color-bg-tertiary)] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[var(--color-accent-light)] rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                {company.name}
              </h2>
              {company.company_number && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Company No: {company.company_number}
                </p>
              )}
              {companyStatus && (
                <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                  companyStatus === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {companyStatus.charAt(0).toUpperCase() + companyStatus.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Company Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Registered Address */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-tertiary)]">Registered Address</h3>
          </div>
          <p className="text-[var(--color-text-primary)]">{formatAddress()}</p>
        </div>

        {/* Incorporation Date */}
        {incorporationDate && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <h3 className="text-sm font-medium text-[var(--color-text-tertiary)]">Incorporated</h3>
            </div>
            <p className="text-[var(--color-text-primary)]">
              {new Date(incorporationDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        )}

        {/* SIC Codes */}
        {sicCodes.length > 0 && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <h3 className="text-sm font-medium text-[var(--color-text-tertiary)]">SIC Codes</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sicCodes.map((code: string) => (
                <span
                  key={code}
                  className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-sm rounded"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Website */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-tertiary)]">Website</h3>
          </div>
          {isEditing ? (
            <input
              type="url"
              value={editedWebsite}
              onChange={(e) => setEditedWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
          ) : (
            <p className="text-[var(--color-text-primary)]">
              {company.website || <span className="text-[var(--color-text-tertiary)]">Not provided</span>}
            </p>
          )}
        </div>
      </div>

      {/* Industry - Editable */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--color-text-tertiary)]">Industry</h3>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="space-y-3">
            <select
              value={editedIndustry}
              onChange={(e) => setEditedIndustry(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            >
              <option value="">Select industry...</option>
              <option value="professional_services">Professional Services</option>
              <option value="retail">Retail</option>
              <option value="hospitality">Hospitality</option>
              <option value="construction">Construction</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="technology">Technology</option>
              <option value="healthcare">Healthcare</option>
              <option value="transport">Transport & Logistics</option>
              <option value="property">Property</option>
              <option value="agriculture">Agriculture</option>
              <option value="other">Other</option>
            </select>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedIndustry(company?.industry || '');
                  setEditedWebsite(company?.website || '');
                }}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)]"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[var(--color-text-primary)]">
            {company.industry ? formatIndustry(company.industry) : <span className="text-[var(--color-text-tertiary)]">Not provided - please add</span>}
          </p>
        )}
      </div>
    </div>
  );
}

// Helper function
function formatIndustry(industry: string): string {
  const labels: Record<string, string> = {
    professional_services: 'Professional Services',
    retail: 'Retail',
    hospitality: 'Hospitality',
    construction: 'Construction',
    manufacturing: 'Manufacturing',
    technology: 'Technology',
    healthcare: 'Healthcare',
    transport: 'Transport & Logistics',
    property: 'Property',
    agriculture: 'Agriculture',
    other: 'Other',
  };
  return labels[industry] || industry;
}
