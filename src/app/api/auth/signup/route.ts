import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, companyName, referrerId } = body;

    // Validate required fields
    if (!email || !password || !companyName) {
      return NextResponse.json(
        { error: 'Email, password, and company name are required' },
        { status: 400 }
      );
    }

    // Get service role client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      });
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

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'CLIENT',
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: 'Error creating account: ' + (authError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Ensure profile exists and has correct role
    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          role: 'CLIENT',
          email: email.trim(),
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    } else {
      // Create profile if it doesn't exist (in case trigger didn't fire)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: email.trim(),
          role: 'CLIENT',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Try to clean up auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Error creating profile: ' + profileError.message },
          { status: 500 }
        );
      }
    }

    // Create company
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName.trim(),
        referred_by: referrerId || null,
      })
      .select('id')
      .single();

    if (companyError) {
      console.error('Error creating company:', companyError);
      // Try to clean up auth user if company creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Error creating company: ' + companyError.message },
        { status: 500 }
      );
    }

    // Update profile with company_id and is_primary_director
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyData.id,
        is_primary_director: true,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile with company:', updateError);
      // Company was created, but profile update failed - this is a problem
      // We could rollback, but for now just log it
      return NextResponse.json(
        { error: 'Account created but failed to link company: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        user: authData.user,
        company: companyData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

