'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type UserRole = 'CLIENT' | 'PARTNER' | 'ADMIN';

interface HeaderProps {
  email: string;
  role: UserRole;
}

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  CLIENT: { label: 'Client', color: 'bg-blue-100 text-blue-700' },
  PARTNER: { label: 'Partner', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-700' },
};

export default function Header({ email, role }: HeaderProps) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const roleInfo = roleLabels[role];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left side - can add breadcrumbs or page title here later */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button - for future mobile nav */}
        <button className="lg:hidden p-2 text-gray-500 hover:text-gray-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Right side - user info */}
      <div className="flex items-center gap-4">
        {/* Role badge */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
          {roleInfo.label}
        </span>

        {/* User email */}
        <span className="text-sm text-gray-600 hidden sm:block">{email}</span>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}