'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

const accountSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface CompanyData {
  name: string;
  companyNumber: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  incorporationDate?: string;
  sicCodes?: string[];
  companiesHouseData?: any; // Full CH response
}

function SignupContent() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  
  const [step, setStep] = useState(1); // 1: Account, 2: Company, 3: Confirm
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<AccountFormValues | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Companies House search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
  });

  // Get referrer and lead from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setReferrerId(ref);

    const leadIdParam = searchParams.get('lead_id');
    if (leadIdParam) setLeadId(leadIdParam);
  }, [searchParams]);

  // Step 1: Save account details and move to step 2
  const onAccountSubmit = (values: AccountFormValues) => {
    setAccountData(values);
    setStep(2);
  };

  // Debounced Companies House search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
        return;
      }

    searchTimeoutRef.current = setTimeout(() => {
      searchCompaniesHouse();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Step 2: Companies House search
  const searchCompaniesHouse = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/companies-house/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      // API returns { results: [...] }
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('CH search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectCompany = async (company: any) => {
    // Fetch full company details from Companies House
    try {
      const response = await fetch(`/api/companies-house/company/${company.company_number}`);
      const data = await response.json();
      
      // API returns { company: {...}, officers: [...] }
      const fullData = data.company;
      const address = fullData.registered_office_address || {};
      
      setCompanyData({
        name: fullData.company_name || company.company_name,
        companyNumber: fullData.company_number || company.company_number,
        addressLine1: address.address_line_1,
        addressLine2: address.address_line_2,
        city: address.locality,
        postcode: address.postal_code,
        country: address.country || 'United Kingdom',
        incorporationDate: fullData.date_of_creation,
        sicCodes: fullData.sic_codes || [],
        companiesHouseData: fullData,
      });
      
      setStep(3);
    } catch (err) {
      console.error('Error fetching company details:', err);
      setFormError('Failed to fetch company details');
    }
  };

  // Manual company entry
  const onManualCompanySubmit = (data: CompanyData) => {
    setCompanyData(data);
    setStep(3);
  };

  // Step 3: Create account with company
  const createAccount = async () => {
    if (!accountData || !companyData) return;
    
    setIsLoading(true);
    setFormError(null);

    // Set a timeout fallback - if stuck for more than 30 seconds, show error
    const timeoutId = setTimeout(() => {
      console.error('[Signup] Timeout - process took longer than 30 seconds');
      setFormError('The signup process is taking longer than expected. Please check your browser console and try refreshing the page.');
      setIsLoading(false);
    }, 30000);

    try {
      // 1. Create auth user (or sign in if already exists)
      let userId: string;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
      });

      if (authError) {
        // If error is "user already registered", try to sign in instead
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists') || authError.message?.toLowerCase().includes('email')) {
          console.log('[Signup] User already registered, attempting to sign in...');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: accountData.email,
            password: accountData.password,
          });
          
          if (signInError || !signInData?.user) {
            // If sign in fails, user might have wrong password - redirect to login
            throw new Error('An account with this email already exists. Please sign in instead.');
          }
          
          userId = signInData.user.id;
          console.log('[Signup] Signed in with existing user:', userId);
        } else {
          throw new Error(authError.message || 'Failed to create account');
        }
      } else if (!authData.user) {
        throw new Error('Failed to create user account');
      } else {
        userId = authData.user.id;
        console.log('[Signup] User created:', userId);
      }

      // 2. Create profile immediately (don't wait for trigger - it might not work)
      console.log('[Signup] Creating profile...');
      
      // Try to insert profile - if it exists, upsert will handle it
      const { error: createProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: accountData.email,
          role: 'CLIENT',
        }, {
          onConflict: 'id',
        });
      
      if (createProfileError) {
        // If upsert fails, try regular insert (might fail if exists - that's OK)
        console.log('[Signup] Upsert failed, trying insert...', createProfileError.code);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: accountData.email,
            role: 'CLIENT',
          });
        
        // If insert also fails, profile might already exist - continue anyway
        if (insertError && insertError.code !== '23505') { // 23505 = duplicate key (already exists)
          console.error('[Signup] Failed to create profile:', insertError);
          // Don't throw - continue with signup, profile might exist from trigger
        } else if (insertError?.code === '23505') {
          console.log('[Signup] Profile already exists (created by trigger)');
        } else {
          console.log('[Signup] ✓ Profile created');
        }
      } else {
        console.log('[Signup] ✓ Profile created/updated');
      }

      // 3. Get referrer's partner_company_id if referred
      let partnerCompanyId = null;
    if (referrerId) {
        const { data: referrerProfile } = await supabase
        .from('profiles')
          .select('partner_company_id')
          .eq('id', referrerId)
          .eq('role', 'PARTNER')
          .maybeSingle();
        
        if (referrerProfile?.partner_company_id) {
          partnerCompanyId = referrerProfile.partner_company_id;
        }
      }

      // 4. Create company with referral attribution
      console.log('[Signup] Creating company...');
      console.log('[Signup] Company data:', {
        name: companyData.name,
        companyNumber: companyData.companyNumber,
        hasCHData: !!companyData.companiesHouseData,
      });
      
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          company_number: companyData.companyNumber || null,
          address_line_1: companyData.addressLine1 || null,
          address_line_2: companyData.addressLine2 || null,
          city: companyData.city || null,
          postcode: companyData.postcode || null,
          country: companyData.country || 'United Kingdom',
          companies_house_data: companyData.companiesHouseData || null,
          referred_by: referrerId || null,
          partner_company_id: partnerCompanyId || null,
        })
        .select('id')
        .single();

      if (companyError) {
        console.error('[Signup] Company creation error:', companyError);
        console.error('[Signup] Company error details:', {
          message: companyError.message,
          code: companyError.code,
          details: companyError.details,
          hint: companyError.hint,
        });
        throw new Error(`Failed to create company: ${companyError.message}`);
      }

      if (!newCompany || !newCompany.id) {
        throw new Error('Company was created but no ID was returned');
      }

      console.log('[Signup] ✓ Company created:', newCompany.id);

      // 5. Update profile with company_id (retry if needed)
      console.log('[Signup] Linking company to profile...');
      let profileUpdated = false;
      let updateRetries = 0;
      const maxUpdateRetries = 5;
      
      while (!profileUpdated && updateRetries < maxUpdateRetries) {
        updateRetries++;
        console.log(`[Signup] Updating profile with company_id, attempt ${updateRetries}/${maxUpdateRetries}...`);
        
        const { error: profileError, data: updateData } = await supabase
          .from('profiles')
          .update({
            company_id: newCompany.id,
            is_primary_director: true,
          })
          .eq('id', userId)
          .select('id');

      if (profileError) {
          console.error('[Signup] Profile update error (attempt', updateRetries, '):', profileError);
          console.error('[Signup] Profile update error details:', {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
          });
          
          if (updateRetries < maxUpdateRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          profileUpdated = true;
          console.log('[Signup] ✓ Profile updated successfully with company_id');
        }
      }

      if (!profileUpdated) {
        console.error('[Signup] Failed to update profile after', maxUpdateRetries, 'attempts');
        throw new Error('Failed to link company to profile. Please try again or contact support.');
      }

      // 6. Handle lead conversion if applicable (non-blocking)
    if (leadId) {
        supabase
        .from('leads')
        .update({
            user_id: userId,
          converted_at: new Date().toISOString(),
          status: 'converted',
        })
          .eq('id', leadId)
          .then(({ error }) => {
            if (error) {
              console.error('[Signup] Lead conversion error:', error);
            }
          });
      }

      // 7. Verify session before redirect
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[Signup] No session found, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 8. Success - redirect to application wizard
      console.log('[Signup] Account creation complete!');
      console.log('[Signup] - User ID:', userId);
      console.log('[Signup] - Company ID:', newCompany.id);
      console.log('[Signup] - Profile linked:', profileUpdated);
      console.log('[Signup] - Session active:', !!session);
      
      // Clear any errors
      setFormError(null);
      
      // Force immediate redirect - don't reset loading state
      // This ensures the button stays in "Creating account..." state until redirect
      console.log('[Signup] Redirecting to /apply...');
      
      // Clear timeout since we succeeded
      clearTimeout(timeoutId);
      
      // Use window.location.replace for reliable redirect (prevents back button issues)
      window.location.replace('/apply');
      
    } catch (err: any) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      console.error('[Signup] Error:', err);
      console.error('[Signup] Error stack:', err.stack);
      console.error('[Signup] Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
      setFormError(err.message || 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto space-y-6 py-12 px-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step
                ? 'bg-[var(--color-accent)] text-white'
                : s < step
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'
            }`}
          >
            {s < step ? '✓' : s}
          </div>
        ))}
      </div>

      {/* Step 1: Account Details */}
      {step === 1 && (
        <>
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Create your account</h1>

      {referrerId && (
        <p className="text-sm text-[var(--color-text-secondary)]">
              You were referred by a partner. We&apos;ll link your account automatically.
        </p>
      )}

          <form onSubmit={handleSubmit(onAccountSubmit)} className="space-y-4">
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

            <button
              className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg disabled:opacity-50"
              type="submit"
            >
              Continue
            </button>
          </form>
        </>
      )}

      {/* Step 2: Find Company */}
      {step === 2 && (
        <>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Find your company</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Search Companies House to auto-fill your details
          </p>

          {!manualEntry ? (
            <div className="space-y-4">
              <div className="relative">
          <input
            className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  placeholder="Search by company name or number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
        </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto">
                  {searchResults.map((company) => (
                    <button
                      key={company.company_number}
                      onClick={() => selectCompany(company)}
                      className="w-full p-3 text-left hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <p className="font-medium text-[var(--color-text-primary)]">{company.company_name}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {company.company_number} • {company.address || ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setManualEntry(true)}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Can&apos;t find your company? Enter details manually
              </button>
            </div>
          ) : (
            /* Manual entry form */
            <ManualCompanyForm 
              onSubmit={onManualCompanySubmit}
              onBack={() => setManualEntry(false)}
            />
          )}

          <button
            onClick={() => setStep(1)}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Back
          </button>
        </>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && companyData && (
        <>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Confirm details</h1>
          
          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 space-y-3">
          <div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Email</p>
              <p className="font-medium text-[var(--color-text-primary)]">{accountData?.email}</p>
          </div>
            
            <div className="border-t border-[var(--color-border)] pt-3">
              <p className="text-sm text-[var(--color-text-tertiary)]">Company</p>
              <p className="font-medium text-[var(--color-text-primary)]">{companyData.name}</p>
              {companyData.companyNumber && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Company No: {companyData.companyNumber}
                </p>
              )}
        </div>

            {companyData.addressLine1 && (
              <div className="border-t border-[var(--color-border)] pt-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">Registered Address</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {[
                    companyData.addressLine1,
                    companyData.addressLine2,
                    companyData.city,
                    companyData.postcode,
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {companyData.incorporationDate && (
              <div className="border-t border-[var(--color-border)] pt-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">Incorporated</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {new Date(companyData.incorporationDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{formError}</p>
          </div>
        )}

        <button
            onClick={createAccount}
            disabled={isLoading}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white p-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>

          <button
            onClick={() => setStep(2)}
            disabled={isLoading}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Back
        </button>
        </>
      )}
    </main>
  );
}

// Manual company entry form component
function ManualCompanyForm({ 
  onSubmit, 
  onBack 
}: { 
  onSubmit: (data: CompanyData) => void;
  onBack: () => void;
}) {
  const [formData, setFormData] = useState<CompanyData>({
    name: '',
    companyNumber: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          Company Name <span className="text-red-600">*</span>
        </label>
        <input
          className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          Company Number
        </label>
        <input
          className="w-full border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
          value={formData.companyNumber}
          onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-[var(--color-border)] text-[var(--color-text-primary)] p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
        >
          Back to search
        </button>
        <button
          type="submit"
          className="flex-1 bg-[var(--color-accent)] text-white p-2 rounded-lg hover:bg-[var(--color-accent-hover)]"
        >
          Continue
        </button>
      </div>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}
