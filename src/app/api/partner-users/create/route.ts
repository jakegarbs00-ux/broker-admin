import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      partner_company_id,
      email,
      full_name,
      phone,
      is_primary_contact = false,
    } = body;

    // Validate required fields
    if (!partner_company_id || !email || !email.trim()) {
      return NextResponse.json(
        { error: 'Partner company ID and email are required' },
        { status: 400 }
      );
    }

    // Check if partner company exists
    const { data: partnerCompany, error: companyError } = await supabase
      .from('partner_companies')
      .select('id')
      .eq('id', partner_company_id)
      .single();

    if (companyError || !partnerCompany) {
      return NextResponse.json(
        { error: 'Partner company not found' },
        { status: 404 }
      );
    }

    // Check if user already exists by checking profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim())
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: full_name,
        role: 'PARTNER',
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: 'Error creating partner user: ' + (authError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Update profile with partner company info
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'PARTNER',
        partner_company_id: partner_company_id,
        is_primary_contact: is_primary_contact,
        full_name: full_name?.trim() || null,
        phone: phone?.trim() || null,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Clean up auth user if profile update fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Error updating profile: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error: any) {
    console.error('Error in partner user creation:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

