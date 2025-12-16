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
      name,
      address,
      website,
      registration_number,
      bank_name,
      bank_account_name,
      bank_account_number,
      bank_sort_code,
      user_email,
      user_full_name,
      user_phone,
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    if (!user_email || !user_email.trim()) {
      return NextResponse.json(
        { error: 'Partner user email is required' },
        { status: 400 }
      );
    }

    // Check if user already exists by checking profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', user_email.trim())
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Create partner company
    const { data: partnerCompany, error: companyError } = await supabase
      .from('partner_companies')
      .insert({
        name: name.trim(),
        address: address?.trim() || null,
        website: website?.trim() || null,
        registration_number: registration_number?.trim() || null,
        bank_name: bank_name?.trim() || null,
        bank_account_name: bank_account_name?.trim() || null,
        bank_account_number: bank_account_number?.trim() || null,
        bank_sort_code: bank_sort_code?.trim() || null,
      })
      .select('id')
      .single();

    if (companyError) {
      console.error('Error creating partner company:', companyError);
      return NextResponse.json(
        { error: 'Error creating partner company: ' + companyError.message },
        { status: 500 }
      );
    }

    // Create auth user for the first partner
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user_email.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: user_full_name,
        role: 'PARTNER',
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      // Clean up partner company if user creation fails
      await supabase.from('partner_companies').delete().eq('id', partnerCompany.id);
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
        partner_company_id: partnerCompany.id,
        is_primary_contact: true,
        full_name: user_full_name?.trim() || null,
        phone: user_phone?.trim() || null,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Clean up auth user and partner company if profile update fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('partner_companies').delete().eq('id', partnerCompany.id);
      return NextResponse.json(
        { error: 'Error updating profile: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      partner_company: partnerCompany,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error: any) {
    console.error('Error in partner company creation:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

