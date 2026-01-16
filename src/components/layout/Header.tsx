'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Search, Bell, User, LogOut, ChevronDown } from 'lucide-react';

interface HeaderProps {
  email: string;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  onMenuClick?: () => void;
}

export default function Header({ email, role, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    // CRITICAL: Clear ALL cached data before signing out
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    
    // Sign out - this will trigger onAuthStateChange in useRequireAuth
    // which will clear the user and profile state
    await supabase.auth.signOut();
    
    // Redirect to login
    router.push('/auth/login');
  };

  // Get user initials from email
  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-[var(--color-border)] shadow-sm fixed top-0 right-0 left-[260px] z-30">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left side - Search */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side - Notifications and User */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-error)] rounded-full border-2 border-white"></span>
          </button>

          {/* User Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-medium">
                {getInitials(email)}
              </div>
              <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50">
                  <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{email.split('@')[0]}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate">{email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}