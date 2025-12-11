'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface HeaderProps {
  email: string;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  onMenuClick?: () => void;
}

const roleLabels = {
  CLIENT: { label: 'Client', color: 'bg-blue-100 text-blue-800' },
  PARTNER: { label: 'Partner', color: 'bg-purple-100 text-purple-800' },
  ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-800' },
};

export default function Header({ email, role, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const { label, color } = roleLabels[role];

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - menu button on mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Flôka</span>
          </div>
        </div>

        {/* Right side - user info */}
        <div className="flex items-center gap-2 sm:gap-4">
          <span className={`hidden sm:inline-block px-2 py-1 text-xs font-medium rounded-full ${color}`}>
            {label}
          </span>
          <span className="text-sm text-gray-600 hidden sm:inline truncate max-w-[200px]">{email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}