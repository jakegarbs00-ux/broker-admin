import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();

    // Require an authenticated caller and verify they're an ADMIN
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const adminId = userData.user.id;
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', adminId)
      .maybeSingle();

    if (adminProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { profileId } = body as { profileId?: string };
    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    // 1) Get the client profile
    const { data: clientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, company_id, address')
      .eq('id', profileId)
      .single();

    if (profileError || !clientProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (clientProfile.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Only CLIENT profiles can be promoted' }, { status: 400 });
    }

    if (!clientProfile.company_id) {
      return NextResponse.json({ error: 'Profile must have a company_id' }, { status: 400 });
    }

    // 2) Load company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, website, company_number')
      .eq('id', clientProfile.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found for profile' }, { status: 404 });
    }

    // 3) Create partner company
    const { data: partnerCompany, error: partnerCompanyError } = await supabase
      .from('partner_companies')
      .insert({
        name: company.name,
        address: clientProfile.address ?? null,
        website: company.website ?? null,
        registration_number: company.company_number ?? null,
      })
      .select('id')
      .single();

    if (partnerCompanyError || !partnerCompany) {
      return NextResponse.json(
        { error: 'Error creating partner company: ' + (partnerCompanyError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // 4) Update profile to partner
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'PARTNER',
        partner_company_id: partnerCompany.id,
        company_id: null,
        is_primary_contact: true,
      })
      .eq('id', profileId);

    if (updateError) {
      return NextResponse.json({ error: 'Error updating profile: ' + updateError.message }, { status: 500 });
    }

    // 5) Delete company if it has no applications
    const { count, error: countError } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', clientProfile.company_id);

    if (!countError && (count ?? 0) === 0) {
      await supabase.from('companies').delete().eq('id', clientProfile.company_id);
    }

    return NextResponse.json({
      success: true,
      partner_company_id: partnerCompany.id,
    });
  } catch (err: any) {
    console.error('promote-to-partner error', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}


