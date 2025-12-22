import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      company_number,
      industry,
      website,
      director_first_name,
      director_last_name,
      director_address_line_1,
      director_address_line_2,
      director_city,
      director_postcode,
      director_country,
      director_dob,
      property_status,
      client_email,
      partner_id,
    } = body;

    // Validation
    if (!name || !client_email) {
      return NextResponse.json(
        { error: 'Company name and client email are required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find or create director profile
    let directorProfileId: string | null = null;

    // Check if profile exists with this email
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', client_email.trim())
      .maybeSingle();

    if (existingProfile) {
      directorProfileId = existingProfile.id;
      // Update referred_by if not already set and partner_id provided
      if (partner_id && !existingProfile.referred_by) {
        await supabaseAdmin
          .from('profiles')
          .update({ referred_by: partner_id })
          .eq('id', directorProfileId);
      }
    } else {
      // Create auth user and profile
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: client_email.trim(),
        password: Math.random().toString(36).slice(-12) + 'A1!', // Temporary password
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        return NextResponse.json(
          { error: `Error creating user: ${authError?.message || 'Unknown error'}` },
          { status: 500 }
        );
      }

      directorProfileId = authUser.user.id;

      // Update profile with director details
      const profileUpdate: any = {
        role: 'CLIENT',
        first_name: director_first_name || null,
        last_name: director_last_name || null,
        address_line_1: director_address_line_1 || null,
        address_line_2: director_address_line_2 || null,
        city: director_city || null,
        postcode: director_postcode || null,
        country: director_country || 'United Kingdom',
        date_of_birth: director_dob || null,
        property_status: property_status || null,
      };

      if (partner_id) {
        profileUpdate.referred_by = partner_id;
      }

      await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', directorProfileId);
    }

    // Map property_status values
    let mappedPropertyStatus: string | null = null;
    if (property_status) {
      if (property_status === 'homeowner') {
        mappedPropertyStatus = 'owner';
      } else if (property_status === 'tenant' || property_status === 'living_with_family') {
        mappedPropertyStatus = 'renter';
      } else if (property_status !== 'other') {
        mappedPropertyStatus = property_status;
      }
    }

    // Create company
    const companyPayload: any = {
      name: name.trim(),
      company_number: company_number?.trim() || null,
      industry: industry?.trim() || null,
      website: website?.trim() || null,
    };

    if (partner_id) {
      companyPayload.referred_by = partner_id;
    }

    const { data: newCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert(companyPayload)
      .select('id')
      .single();

    if (companyError || !newCompany) {
      return NextResponse.json(
        { error: `Error creating company: ${companyError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Link director profile to company
    await supabaseAdmin
      .from('profiles')
      .update({
        company_id: newCompany.id,
        is_primary_director: true,
      })
      .eq('id', directorProfileId);

    return NextResponse.json({
      success: true,
      companyId: newCompany.id,
    });
  } catch (error: any) {
    console.error('Error in /api/companies/create:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

