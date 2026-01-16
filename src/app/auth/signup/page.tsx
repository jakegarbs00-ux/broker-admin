'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  companyNumber: z.string().optional(),
  companyName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CompanySearchResult {
  company_number: string;
  company_name: string;
  status: string;
  address: string;
}

function SignupContent() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);
  
  // Companies House search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const companyName = watch('companyName');

  const loadLeadData = async (leadId: string) => {
    setLoadingLead(true);
    try {
      const { data: leadData, error } = await supabase
        .from('leads')
        .select('business_name, contact_name, email, phone')
        .eq('id', leadId)
        .single();

      if (error) {
        console.error('Error loading lead:', error);
        setLoadingLead(false);
        return;
      }

      if (leadData) {
        // Pre-fill form with lead data
        if (leadData.business_name) {
          setSearchQuery(leadData.business_name);
          setValue('companyName', leadData.business_name);
        }
        if (leadData.email) {
          setValue('email', leadData.email);
        }
        
        // Split contact_name into first name
        if (leadData.contact_name) {
          const nameParts = leadData.contact_name.trim().split(/\s+/);
          if (nameParts.length > 0) {
            setValue('firstName', nameParts[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error loading lead data:', err);
    } finally {
      setLoadingLead(false);
    }
  };

  // Read ?ref=... and ?lead_id=... from URL once on load
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerId(ref);
    }

    const leadIdParam = searchParams.get('lead_id');
    if (leadIdParam) {
      setLeadId(leadIdParam);
      loadLeadData(leadIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Debounced Companies House search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
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
  }, [searchQuery]);

  const handleSelectCompany = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setSearchQuery(company.company_name);
    setShowResults(false);
    setValue('companyName', company.company_name);
    setValue('companyNumber', company.company_number);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.companies-house-search')) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSuccessMessage(null);
    const { email, password, firstName, companyName, companyNumber } = values;
    
    // Validate company selection
    if (!companyName || !companyNumber) {
      setFormError('Please select a company from Companies House');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    const newUser = data.user;
    if (!newUser) {
      setFormError('Failed to create user account');
      return;
    }

    // Check if user is signed in (session exists)
    // If email confirmation is disabled, session will be available immediately
    if (data.session) {
      // Wait for the profile to be created by the database trigger
      // The handle_new_user trigger should create the profile automatically
      // Poll for profile creation (max 5 seconds)
      let profileReady = false;
      for (let i = 0; i < 10; i++) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', newUser.id)
          .maybeSingle();
        
        if (profile) {
          profileReady = true;
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!profileReady) {
        console.warn('Profile not yet created, but proceeding with redirect');
      }

      // Update profile with first name from signup
      if (firstName) {
        await supabase
          .from('profiles')
          .update({ first_name: firstName })
          .eq('id', newUser.id);
      }

      // Create company record with Companies House data
      if (companyName && companyNumber) {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            company_number: companyNumber,
          })
          .select('id')
          .single();

        if (companyError) {
          console.error('Error creating company:', companyError);
          // Not fatal - user can create company later
        } else if (newCompany) {
          // Link company to profile
          await supabase
            .from('profiles')
            .update({ company_id: newCompany.id })
            .eq('id', newUser.id);
        }
      }

      // If we have a referrerId, attach the referral
      if (referrerId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ referred_by: referrerId })
          .eq('id', newUser.id);

        if (profileError) {
          console.error('Error attaching referral', profileError);
          // not fatal for signup, so we don't block the user
        }
      }

      // If we have a leadId, update the lead record to mark it as converted
      if (leadId) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({
            user_id: newUser.id,
            converted_at: new Date().toISOString(),
            status: 'converted',
          })
          .eq('id', leadId);

        if (leadError) {
          console.error('Error updating lead record', leadError);
          // not fatal for signup, so we don't block the user
        }
      }

      // Get user profile to check role
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', newUser.id)
        .maybeSingle();

      // Redirect based on role
      if (userProfile?.role === 'CLIENT') {
        router.push('/apply');
      } else if (userProfile?.role === 'PARTNER' || userProfile?.role === 'ADMIN') {
        router.push('/dashboard');
      } else {
        // Default to dashboard if role is unknown
        router.push('/dashboard');
      }
      return;
    }

    // If no session (email confirmation required), wait for profile and update it
    // Wait a bit for profile to be created by trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update profile with first name from signup
    if (firstName) {
      await supabase
        .from('profiles')
        .update({ first_name: firstName })
        .eq('id', newUser.id);
    }

    // Create company record with Companies House data
    if (companyName && companyNumber) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          company_number: companyNumber,
        })
        .select('id')
        .single();

      if (companyError) {
        console.error('Error creating company:', companyError);
        // Not fatal - user can create company later
      } else if (newCompany) {
        // Link company to profile
        await supabase
          .from('profiles')
          .update({ company_id: newCompany.id })
          .eq('id', newUser.id);
      }
    }

    // If we have a referrerId, attach the referral
    if (referrerId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ referred_by: referrerId })
        .eq('id', newUser.id);

      if (profileError) {
        console.error('Error attaching referral', profileError);
        // not fatal for signup, so we don't block the user
      }
    }

    // If we have a leadId, update the lead record to mark it as converted
    if (leadId) {
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          user_id: newUser.id,
          converted_at: new Date().toISOString(),
          status: 'converted',
        })
        .eq('id', leadId);

      if (leadError) {
        console.error('Error updating lead record', leadError);
        // not fatal for signup, so we don't block the user
      }
    }

    // Email confirmation required - show success message and redirect to login
    setSuccessMessage('Account created! Please check your email to confirm your account, then log in.');
    setTimeout(() => {
      router.push('/auth/login');
    }, 3000);
  };

  return (
    <main className="max-w-md mx-auto space-y-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create your account</h1>

      {loadingLead && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Loading your information...
        </p>
      )}

      {referrerId && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          You were referred by a partner. We&apos;ll attach your account to them
          automatically.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            First Name <span className="text-red-600">*</span>
          </label>
          <input 
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="John"
            {...register('firstName')} 
          />
          {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Email <span className="text-red-600">*</span>
          </label>
          <input 
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]" 
            placeholder="john@example.com" 
            type="email"
            {...register('email')} 
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Password <span className="text-red-600">*</span>
          </label>
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            placeholder="At least 6 characters"
            type="password"
            {...register('password')}
          />
          {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div className="relative companies-house-search">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Search for your company on Companies House <span className="text-red-600">*</span>
          </label>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Start typing your company name to search Companies House
          </p>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedCompany(null);
              setValue('companyName', '');
              setValue('companyNumber', '');
            }}
            onFocus={() => {
              if (searchResults.length > 0 && searchQuery.length >= 2) {
                setShowResults(true);
              }
            }}
            placeholder="Start typing company name..."
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
          />
          {isSearching && (
            <div className="absolute right-3 top-10 text-sm text-[var(--color-text-tertiary)]">
              Searching...
            </div>
          )}
          
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((company) => (
                <button
                  key={company.company_number}
                  type="button"
                  onClick={() => handleSelectCompany(company)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors border-b border-[var(--color-border)] last:border-0"
                >
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {company.company_name}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {company.company_number} • {company.status}
                  </div>
                  {company.address && (
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      {company.address}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg p-4 text-center text-sm text-[var(--color-text-secondary)]">
              No companies found. Try a different search term.
            </div>
          )}
          
          {selectedCompany && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-800">
                Selected: {selectedCompany.company_name}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {selectedCompany.company_number}
              </div>
            </div>
          )}
          
          {!selectedCompany && searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Type at least 2 characters to search
            </p>
          )}
          
          {formError && formError.includes('company') && (
            <p className="text-red-600 text-sm mt-1">{formError}</p>
          )}
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{formError}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">{successMessage}</p>
          </div>
        )}

        <button
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg disabled:opacity-50"
          disabled={isSubmitting || loadingLead}
        >
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}
