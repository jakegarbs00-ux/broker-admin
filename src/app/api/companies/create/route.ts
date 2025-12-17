import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      company_number,
      industry,
      website,
      director_full_name,
      director_address,
      director_dob,
      property_status,
      client_email,
      partner_id,
    } = body;

    // Validate required fields
    // partner_id is OPTIONAL (admin can create direct companies with no referrer)
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Get service role client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Debug: Log all env vars that start with SUPABASE (without showing values)
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0,
      allSupabaseVars: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        urlValue: supabaseUrl ? 'present' : 'missing',
        serviceKeyValue: supabaseServiceKey ? 'present' : 'missing',
        serviceKeyLength: supabaseServiceKey?.length || 0
      });
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: !supabaseUrl ? 'Missing NEXT_PUBLIC_SUPABASE_URL' : 'Missing SUPABASE_SERVICE_ROLE_KEY'
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate that we have director email (required to create/find director profile)
    if (!client_email || !client_email.trim()) {
      return NextResponse.json(
        { error: 'Director email (client_email) is required' },
        { status: 400 }
      );
    }

    const directorEmail = client_email.trim();

    // Find or create director profile
    let directorProfileId: string;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('email', directorEmail)
      .maybeSingle();

    if (existingProfile) {
      // Profile exists - verify it's a CLIENT role
      if (existingProfile.role !== 'CLIENT') {
        return NextResponse.json(
          { error: 'Email is already registered with a different role' },
          { status: 400 }
        );
      }
      // Check if they already have a company
      if (existingProfile.company_id) {
        return NextResponse.json(
          { error: 'This director already has a company associated with them' },
          { status: 400 }
        );
      }
      directorProfileId = existingProfile.id;
    } else {
      // Create auth user first - this will trigger profile creation
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: directorEmail,
        email_confirm: true,
        user_metadata: { 
          full_name: director_full_name,
          role: 'CLIENT'
        }
      });

      if (authError || !authData.user) {
        console.error('Error creating auth user:', authError);
        return NextResponse.json(
          { error: 'Error creating director account: ' + (authError?.message || 'Unknown error') },
          { status: 500 }
        );
      }

      directorProfileId = authData.user.id;

      // Update the profile with role
      await supabase
        .from('profiles')
        .update({ 
          role: 'CLIENT',
          full_name: director_full_name 
        })
        .eq('id', directorProfileId);
    }

    // Map property_status values to match database constraint
    // Database constraint only allows: 'owner', 'renter', or NULL
    let finalPropertyStatus: string | null = null;
    if (property_status && property_status.trim()) {
      const status = property_status.trim().toLowerCase();
      const statusMap: Record<string, string | null> = {
        'homeowner': 'owner',
        'owner': 'owner',
        'tenant': 'renter',
        'renter': 'renter',
        'living_with_family': 'renter',
        'other': null,
      };
      finalPropertyStatus = statusMap[status] ?? null;
    }

    // Create the company - NO owner_id, NO director fields
    const companyPayload: any = {
      name: name.trim(),
      referred_by: partner_id, // Set the partner who referred this company
      company_number: company_number?.trim() || null,
      industry: industry?.trim() || null,
      website: website?.trim() || null,
    };

    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert(companyPayload)
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating company:', createError);
      return NextResponse.json(
        { error: 'Error creating company: ' + createError.message },
        { status: 500 }
      );
    }

    // Update director's profile: link to company, set as primary director, add director details
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        company_id: newCompany.id,
        is_primary_director: true,
        full_name: director_full_name?.trim() || null,
        address: director_address?.trim() || null,
        dob: director_dob || null,
        property_status: finalPropertyStatus,
      })
      .eq('id', directorProfileId);

    if (profileUpdateError) {
      console.error('Error updating director profile:', profileUpdateError);
      // Company was created, but profile update failed - this is a problem
      // We could rollback, but for now just log it
      return NextResponse.json(
        { error: 'Company created but failed to link director: ' + profileUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ company: newCompany }, { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

