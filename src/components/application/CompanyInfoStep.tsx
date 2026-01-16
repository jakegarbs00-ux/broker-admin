'use client';

import { useState, useEffect, useRef } from 'react';
import { ApplicationFormData } from './ApplicationWizard';
import { Search, Loader2, CheckCircle2, Edit2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface CompanyInfoStepProps {
  formData: ApplicationFormData;
  updateFormData: (field: keyof ApplicationFormData, value: any) => void;
  profile?: any;
}

interface CompanySearchResult {
  company_number: string;
  company_name: string;
  status: string;
  address: string;
}

interface Officer {
  name: string;
  forename: string;
  surname: string;
  date_of_birth?: {
    month: number;
    year: number;
  } | null;
  appointed_on: string;
  nationality?: string;
  occupation?: string;
}

interface CompanyDetails {
  company: any;
  officers: Officer[];
}

export function CompanyInfoStep({ formData, updateFormData, profile }: CompanyInfoStepProps) {
  const supabase = getSupabaseClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [selectedDirector, setSelectedDirector] = useState<string | null>(null);
  const [showManualName, setShowManualName] = useState(false);
  const [manualFirstName, setManualFirstName] = useState(formData.firstName || '');
  const [manualLastName, setManualLastName] = useState(formData.lastName || '');
  const [showSearch, setShowSearch] = useState(false);
  const [existingCompanyLoaded, setExistingCompanyLoaded] = useState(false);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load existing company data if company_id exists
  useEffect(() => {
    const loadExistingCompany = async () => {
      if (!profile?.company_id || existingCompanyLoaded) return;

      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (company) {
        setExistingCompanyLoaded(true);
        // Pre-fill form data
        updateFormData('companyName', company.name);
        updateFormData('companyNumber', company.company_number);
        updateFormData('industry', company.industry);
        updateFormData('website', company.website);

        // Set UI state to show company is selected
        setSearchQuery(company.name || '');
        if (company.company_number) {
          setSelectedCompany({
            company_number: company.company_number,
            company_name: company.name || '',
            status: 'active',
            address: '',
          });
        }

        // Always fetch company details from Companies House API if company_number exists
        if (company.company_number) {
          setLoadingOfficers(true);
          try {
            const response = await fetch(`/api/companies-house/company/${company.company_number}`);
            if (response.ok) {
              const details: CompanyDetails = await response.json();
              setCompanyDetails(details);
              
              // Store Companies House data in formData
              updateFormData('companiesHouseData', details.company);
              
              // Try to match current user with director
              if (profile.first_name && profile.last_name) {
                const matchingOfficer = details.officers.findIndex(
                  (o) => 
                    o.forename.toLowerCase() === profile.first_name?.toLowerCase() &&
                    o.surname.toLowerCase() === profile.last_name?.toLowerCase()
                );
                if (matchingOfficer >= 0) {
                  setSelectedDirector(matchingOfficer.toString());
                  updateFormData('firstName', details.officers[matchingOfficer].forename);
                  updateFormData('lastName', details.officers[matchingOfficer].surname);
                } else {
                  setShowManualName(true);
                  setSelectedDirector('manual');
                  // Pre-fill with profile name
                  if (profile.first_name) {
                    setManualFirstName(profile.first_name);
                    updateFormData('firstName', profile.first_name);
                  }
                  if (profile.last_name) {
                    setManualLastName(profile.last_name);
                    updateFormData('lastName', profile.last_name);
                  }
                }
              } else {
                setShowManualName(true);
                setSelectedDirector('manual');
              }
            } else {
              // API call failed, show manual entry
              setShowManualName(true);
              setSelectedDirector('manual');
              if (profile.first_name) {
                setManualFirstName(profile.first_name);
                updateFormData('firstName', profile.first_name);
              }
              if (profile.last_name) {
                setManualLastName(profile.last_name);
                updateFormData('lastName', profile.last_name);
              }
            }
          } catch (error) {
            console.error('Error loading company details:', error);
            setShowManualName(true);
            setSelectedDirector('manual');
            if (profile.first_name) {
              setManualFirstName(profile.first_name);
              updateFormData('firstName', profile.first_name);
            }
            if (profile.last_name) {
              setManualLastName(profile.last_name);
              updateFormData('lastName', profile.last_name);
            }
          } finally {
            setLoadingOfficers(false);
          }
        } else {
          // No company number, show manual entry
          setShowManualName(true);
          setSelectedDirector('manual');
          if (profile.first_name) {
            setManualFirstName(profile.first_name);
            updateFormData('firstName', profile.first_name);
          }
          if (profile.last_name) {
            setManualLastName(profile.last_name);
            updateFormData('lastName', profile.last_name);
          }
        }
      }
    };

    // Load company if profile has company_id
    if (profile?.company_id && !existingCompanyLoaded) {
      loadExistingCompany();
    }
    
    // Also check if formData already has company info (from wizard pre-loading)
    if (formData.companyName && formData.companyNumber && !existingCompanyLoaded && !companyDetails) {
      // Company info is in formData, fetch officers
      setLoadingOfficers(true);
      const fetchOfficers = async () => {
        try {
          const response = await fetch(`/api/companies-house/company/${formData.companyNumber}`);
          if (response.ok) {
            const details: CompanyDetails = await response.json();
            setCompanyDetails(details);
            setSearchQuery(formData.companyName || '');
            setSelectedCompany({
              company_number: formData.companyNumber || '',
              company_name: formData.companyName || '',
              status: 'active',
              address: '',
            });
            updateFormData('companiesHouseData', details.company);
            
            // Try to match user with director
            if (profile?.first_name && profile?.last_name) {
              const matchingOfficer = details.officers.findIndex(
                (o) => 
                  o.forename.toLowerCase() === profile.first_name?.toLowerCase() &&
                  o.surname.toLowerCase() === profile.last_name?.toLowerCase()
              );
              if (matchingOfficer >= 0) {
                setSelectedDirector(matchingOfficer.toString());
                updateFormData('firstName', details.officers[matchingOfficer].forename);
                updateFormData('lastName', details.officers[matchingOfficer].surname);
              } else {
                setShowManualName(true);
                setSelectedDirector('manual');
                if (profile.first_name) {
                  setManualFirstName(profile.first_name);
                  updateFormData('firstName', profile.first_name);
                }
                if (profile.last_name) {
                  setManualLastName(profile.last_name);
                  updateFormData('lastName', profile.last_name);
                }
              }
            } else {
              setShowManualName(true);
              setSelectedDirector('manual');
            }
          }
        } catch (error) {
          console.error('Error fetching company officers:', error);
          setShowManualName(true);
          setSelectedDirector('manual');
        } finally {
          setLoadingOfficers(false);
        }
      };
      fetchOfficers();
    }
  }, [profile, supabase, existingCompanyLoaded, updateFormData, formData.companyName, formData.companyNumber, companyDetails]);

  // Initialize manual name fields from formData if available
  useEffect(() => {
    if (formData.firstName && !manualFirstName) {
      setManualFirstName(formData.firstName);
    }
    if (formData.lastName && !manualLastName) {
      setManualLastName(formData.lastName);
    }
  }, [formData.firstName, formData.lastName, manualFirstName, manualLastName]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if a company is already selected (prevents dropdown reopening)
    if (selectedCompany) {
      setShowResults(false);
      return;
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/companies-house/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching companies:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCompany]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectCompany = async (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setSearchQuery(company.company_name);
    setShowResults(false);
    updateFormData('companyName', company.company_name);
    updateFormData('companyNumber', company.company_number);
    setSelectedDirector(null);
    setShowManualName(false);

    // Fetch full company details and officers
    try {
      const response = await fetch(`/api/companies-house/company/${company.company_number}`);
      if (response.ok) {
        const details: CompanyDetails = await response.json();
        setCompanyDetails(details);
        
        // Store Companies House data
        updateFormData('companiesHouseData', details.company);
      } else {
        setShowManualName(true);
        setSelectedDirector('manual');
      }
    } catch (error) {
      console.error('Error fetching company details:', error);
      setShowManualName(true);
      setSelectedDirector('manual');
    }
  };

  const handleSelectDirector = (officerIndex: string) => {
    if (officerIndex === 'manual') {
      setShowManualName(true);
      setSelectedDirector('manual');
      if (!formData.firstName && manualFirstName) {
        updateFormData('firstName', manualFirstName);
      }
      if (!formData.lastName && manualLastName) {
        updateFormData('lastName', manualLastName);
      }
    } else {
      setShowManualName(false);
      setSelectedDirector(officerIndex);
      const officer = companyDetails?.officers[parseInt(officerIndex)];
      if (officer) {
        updateFormData('firstName', officer.forename);
        updateFormData('lastName', officer.surname);
        setManualFirstName(officer.forename);
        setManualLastName(officer.surname);
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const hasExistingCompany = profile?.company_id && formData.companyName && !showSearch;

  return (
    <div className="space-y-6">
      {/* Show existing company or search */}
      {hasExistingCompany ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Your Company</span>
                </div>
                <p className="font-medium text-green-900">{formData.companyName}</p>
                {formData.companyNumber && (
                  <p className="text-sm text-green-700 mt-1">
                    Company Number: {formData.companyNumber}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearch(true);
                  setSearchQuery('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Company Search */}
          <div>
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>💡 Quick tip:</strong> Search for your company on Companies House to auto-fill your details. This saves time and ensures accuracy!
              </p>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search for your company on Companies House <span className="text-[var(--color-error)]">*</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchQuery(newValue);
                    // Clear selected company if user starts typing a different value
                    if (selectedCompany && newValue !== selectedCompany.company_name) {
                      setSelectedCompany(null);
                      setCompanyDetails(null);
                      setSelectedDirector(null);
                      setShowManualName(false);
                      updateFormData('companyName', '');
                      updateFormData('companyNumber', '');
                      updateFormData('companiesHouseData', null);
                    }
                    if (!newValue) {
                      setSelectedCompany(null);
                      setCompanyDetails(null);
                      setSelectedDirector(null);
                      setShowManualName(false);
                      updateFormData('companyName', '');
                      updateFormData('companyNumber', '');
                      updateFormData('companiesHouseData', null);
                    }
                  }}
                  placeholder="Start typing company name..."
                  className="w-full pl-10 pr-10 rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.company_number}
                      type="button"
                      onClick={() => handleSelectCompany(result)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{result.company_name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {result.company_number} • {result.status}
                          </p>
                          {result.address && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{result.address}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
                  <p className="text-sm text-slate-500">No companies found. Try a different search term.</p>
                </div>
              )}
            </div>
          </div>

          {/* Selected Company Info */}
          {selectedCompany && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">{selectedCompany.company_name}</p>
                  <p className="text-sm text-green-700 mt-1">
                    Company Number: {selectedCompany.company_number} • Status: {selectedCompany.status}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Director Selection - Show when company is selected */}
      {(formData.companyName || selectedCompany || hasExistingCompany) && (
        <div className="pt-4 border-t border-slate-200">
          {loadingOfficers ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading directors from Companies House...</span>
            </div>
          ) : companyDetails && companyDetails.officers.length > 0 ? (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Which director are you? <span className="text-[var(--color-error)]">*</span>
              </label>
              <div className="space-y-2">
                {companyDetails.officers.map((officer, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDirector === index.toString()
                        ? 'border-[var(--color-accent)] bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="director"
                      value={index}
                      checked={selectedDirector === index.toString()}
                      onChange={() => handleSelectDirector(index.toString())}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {officer.forename} {officer.surname}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Director, appointed {formatDate(officer.appointed_on)}
                      </p>
                    </div>
                  </label>
                ))}
                <label
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDirector === 'manual'
                      ? 'border-[var(--color-accent)] bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="director"
                    value="manual"
                    checked={selectedDirector === 'manual'}
                    onChange={() => handleSelectDirector('manual')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">I'm not listed here</p>
                  </div>
                </label>
              </div>

              {/* Manual Name Entry */}
              {showManualName && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        First Name <span className="text-[var(--color-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualFirstName}
                        onChange={(e) => {
                          setManualFirstName(e.target.value);
                          updateFormData('firstName', e.target.value);
                        }}
                        required
                        className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Last Name <span className="text-[var(--color-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualLastName}
                        onChange={(e) => {
                          setManualLastName(e.target.value);
                          updateFormData('lastName', e.target.value);
                        }}
                        required
                        className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Director Information <span className="text-[var(--color-error)]">*</span>
              </label>
              <p className="text-sm text-slate-500 mb-4">
                No directors found in Companies House records. Please enter your details manually.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    First Name <span className="text-[var(--color-error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName || ''}
                    onChange={(e) => {
                      updateFormData('firstName', e.target.value);
                      setManualFirstName(e.target.value);
                    }}
                    placeholder="John"
                    required
                    className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Name <span className="text-[var(--color-error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName || ''}
                    onChange={(e) => {
                      updateFormData('lastName', e.target.value);
                      setManualLastName(e.target.value);
                    }}
                    placeholder="Smith"
                    required
                    className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Industry <span className="text-[var(--color-error)]">*</span>
        </label>
        <select
          value={formData.industry || ''}
          onChange={(e) => updateFormData('industry', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        >
          <option value="">Select an industry...</option>
          <option value="retail">Retail</option>
          <option value="hospitality">Hospitality</option>
          <option value="construction">Construction</option>
          <option value="healthcare">Healthcare</option>
          <option value="professional_services">Professional Services</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="transport_logistics">Transport & Logistics</option>
          <option value="technology">Technology</option>
          <option value="food_beverage">Food & Beverage</option>
          <option value="beauty_wellness">Beauty & Wellness</option>
          <option value="automotive">Automotive</option>
          <option value="education">Education</option>
          <option value="agriculture">Agriculture</option>
          <option value="entertainment">Entertainment</option>
          <option value="financial_services">Financial Services</option>
          <option value="real_estate">Real Estate</option>
          <option value="ecommerce">E-commerce</option>
          <option value="wholesale">Wholesale</option>
          <option value="recruitment">Recruitment</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Website
        </label>
        <input
          type="url"
          value={formData.website || ''}
          onChange={(e) => updateFormData('website', e.target.value)}
          placeholder="https://www.example.com"
          className="w-full rounded-lg border border-slate-200 p-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
      </div>
    </div>
  );
}

