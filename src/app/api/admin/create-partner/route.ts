import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName, partnerCompanyId } = await request.json();
    
    if (!email || !password || !firstName || !lastName || !partnerCompanyId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, firstName, lastName, partnerCompanyId' },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });
    
    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    
    // Wait a moment for the profile trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update profile (trigger should have created it, just update role and partner_company_id)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'PARTNER',
        partner_company_id: partnerCompanyId,
        first_name: firstName,
        last_name: lastName,
      })
      .eq('id', authData.user.id);
    
    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Try to create profile if update failed (trigger might not have run)
      const { error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          role: 'PARTNER',
          partner_company_id: partnerCompanyId,
          first_name: firstName,
          last_name: lastName,
        });
      
      if (createError) {
        console.error('Error creating profile:', createError);
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (error: any) {
    console.error('Unexpected error in create-partner:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


