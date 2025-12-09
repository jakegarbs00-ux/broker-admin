'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type Company = { id: string; name: string };

type ReferredClient = {
  id: string;
  email: string | null;
};

function ClientDashboard({
  userEmail,
  company,
}: {
  userEmail: string;
  company: Company | null;
}) {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Client dashboard</h1>
      </div>

      <p className="text-gray-700">
        Logged in as <span className="font-medium">{userEmail}</span>
      </p>

      {!company ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="font-medium text-yellow-800">Complete your company profile</p>
          <p className="text-sm text-yellow-800">
            We need your company details before you can submit a funding application.
          </p>
          <Link
            href="/onboarding/company"
            className="mt-2 inline-block rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Complete company information
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white px-4 py-3">
            <p className="text-sm text-gray-500">Company</p>
            <p className="text-lg font-semibold">{company.name}</p>
          </div>

          <div className="rounded-md border bg-white px-4 py-3 space-y-2">
            <p className="font-medium">Applications</p>
            <p className="text-sm text-gray-600">
              Create and track your funding applications.
            </p>
            <Link
              href="/applications"
              className="inline-block rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              View applications
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function PartnerDashboard({
  userEmail,
  userId,
}: {
  userEmail: string;
  userId: string;
}) {
  const supabase = getSupabaseClient();
  const [referralLink, setReferralLink] = useState('');
  const [clients, setClients] = useState<ReferredClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setReferralLink(`${origin}/auth/signup?ref=${userId}`);
    }
  }, [userId]);

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'CLIENT')
        .eq('referred_by', userId);

      if (error) {
        console.error('Error loading referred clients', error);
      } else if (data) {
        setClients(data as ReferredClient[]);
      }

      setLoadingClients(false);
    };

    loadClients();
  }, [supabase, userId]);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Partner / broker dashboard</h1>
      <p className="text-gray-700">
        Logged in as <span className="font-medium">{userEmail}</span>
      </p>

      {/* Referral link */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-2">
        <p className="font-medium">Your referral link</p>
        <p className="text-sm text-gray-600">
          Share this link with clients so their accounts are automatically attached to you.
        </p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            readOnly
            value={referralLink}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard && referralLink) {
                navigator.clipboard.writeText(referralLink);
              }
            }}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
          >
            Copy link
          </button>
        </div>
      </section>

      {/* Referred clients */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-2">
        <p className="font-medium">Referred clients</p>
        {loadingClients ? (
          <p className="text-sm text-gray-500">Loading clients…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-600">
            No clients have signed up with your link yet.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.email ?? 'Unknown email'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Client applications */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-2">
        <p className="font-medium">Client applications</p>
        <p className="text-sm text-gray-600">
          View all funding applications created by your referred clients.
        </p>
        <Link
          href="/partner/applications"
          className="inline-block rounded-md border border-purple-500 px-3 py-1 text-sm text-purple-700 hover:bg-purple-50"
        >
          View client applications
        </Link>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const userEmail = user?.email ?? 'Unknown';

  // 👉 Use DB role only
  const effectiveRole: 'CLIENT' | 'PARTNER' | 'ADMIN' =
    (profile?.role as 'CLIENT' | 'PARTNER' | 'ADMIN') ?? 'CLIENT';

  useEffect(() => {
    if (!user) return;
    if (effectiveRole === 'ADMIN') {
      setLoadingCompany(false);
      return;
    }

    const fetchCompany = async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) console.error('Error loading company', error);
      if (data) setCompany(data as Company);
      setLoadingCompany(false);
    };

    fetchCompany();
  }, [user, effectiveRole, supabase]);

  useEffect(() => {
    if (!loading && effectiveRole === 'ADMIN') {
      router.replace('/admin/applications');
    }
  }, [loading, effectiveRole, router]);

  if (loading || loadingCompany) return <p>Loading...</p>;
  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {effectiveRole === 'PARTNER' && (
            <p className="text-xs uppercase tracking-wide text-purple-600">
              Partner / broker
            </p>
          )}
          {effectiveRole === 'CLIENT' && (
            <p className="text-xs uppercase tracking-wide text-blue-600">Client</p>
          )}
          {effectiveRole === 'ADMIN' && (
            <p className="text-xs uppercase tracking-wide text-red-600">Admin</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          Log out
        </button>
      </div>

      {effectiveRole === 'PARTNER' && (
        <PartnerDashboard userEmail={userEmail} userId={user.id} />
      )}

      {effectiveRole === 'CLIENT' && (
        <ClientDashboard userEmail={userEmail} company={company} />
      )}

      {effectiveRole === 'ADMIN' && (
        <main className="space-y-4">
          <p className="text-sm text-gray-600">
            Redirecting to admin applications...
          </p>
        </main>
      )}
    </div>
  );
}
