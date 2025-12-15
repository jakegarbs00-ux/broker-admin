import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      full_name,
      email,
      phone,
      address,
      dob,
      property_status,
      is_primary_director = false,
    } = body;

    // Validate required fields
    if (!company_id || !email || !full_name) {
      return NextResponse.json(
        { error: 'Company ID, email, and full name are required' },
        { status: 400 }
      );
    }

    // Get service role client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if profile with this email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, company_id')
      .eq('email', email.trim())
      .maybeSingle();

    if (existingProfile) {
      // Profile exists - check if it's already linked to a company
      if (existingProfile.company_id) {
        return NextResponse.json(
          { error: 'This email is already associated with another company' },
          { status: 400 }
        );
      }

      // Update existing profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          company_id,
          is_primary_director,
          role: 'CLIENT',
          full_name: full_name.trim(),
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          dob: dob || null,
          property_status: property_status || null,
        })
        .eq('id', existingProfile.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Error updating profile: ' + updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ director: { id: existingProfile.id } }, { status: 200 });
    }

    // Create new auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role: 'CLIENT',
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: 'Error creating director account: ' + (authError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Update profile with company link and director details
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id,
        is_primary_director,
        role: 'CLIENT',
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        dob: dob || null,
        property_status: property_status || null,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Try to clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Error updating profile: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ director: { id: userId } }, { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

