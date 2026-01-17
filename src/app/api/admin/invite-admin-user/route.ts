import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.slice(7).trim();

    // Use anon client to resolve the requesting user from the access token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body as {
      email?: string;
    };

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is an ADMIN
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Error loading admin profile', adminError);
      return NextResponse.json({ error: 'Unable to verify permissions' }, { status: 500 });
    }

    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if a profile already exists for this email
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Error checking existing profile', existingProfileError);
      return NextResponse.json({ error: 'Error checking existing user' }, { status: 500 });
    }

    if (existingProfile) {
      // For now, avoid re-linking or changing roles for existing accounts to keep behaviour explicit
      return NextResponse.json(
        { error: 'A user with this email already exists. Please manage them manually.' },
        { status: 400 }
      );
    }

    // Create auth user with a temporary random password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const { data: authUserResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authUserResult?.user) {
      console.error('Error creating auth user', authError);
      return NextResponse.json(
        { error: authError?.message || 'Error creating user' },
        { status: 500 }
      );
    }

    const newUser = authUserResult.user;

    // Update profile with ADMIN role (no company_id or partner_company_id for admins)
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: trimmedEmail,
        role: 'ADMIN',
        company_id: null,
        partner_company_id: null,
      })
      .eq('id', newUser.id);

    if (profileUpdateError) {
      console.error('Error updating profile', profileUpdateError);
      return NextResponse.json(
        { error: 'User created but error updating profile: ' + profileUpdateError.message },
        { status: 500 }
      );
    }

    // Trigger an invite / password email so the user can set their own password.
    // Supabase will send an invitation email if SMTP is configured.
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(trimmedEmail);
    if (inviteError) {
      console.error('Error sending invite email', inviteError);
      // Do not treat this as a hard failure since the account is created; just surface a warning.
      return NextResponse.json(
        {
          success: true,
          warning: 'User created but failed to send invite email. Please resend manually.',
          user: {
            id: newUser.id,
            email: trimmedEmail,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          email: trimmedEmail,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in /api/admin/invite-admin-user:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

