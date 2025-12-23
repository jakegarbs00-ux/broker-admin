'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  email: string;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  onMenuClick?: () => void;
}

const roleLabels = {
  CLIENT: { label: 'Client', color: 'bg-[var(--color-info-light)] text-[var(--color-info)]' },
  PARTNER: { label: 'Partner', color: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' },
  ADMIN: { label: 'Admin', color: 'bg-[var(--color-error-light)] text-[var(--color-error)]' },
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
    <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] py-3">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:pl-6">
        {/* Left side - menu button on mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <span className="text-lg font-semibold text-[var(--color-text-primary)]">Floka</span>
          </div>
        </div>

        {/* Right side - user info */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <span className={`hidden sm:inline-block px-2 py-0.5 text-xs font-medium rounded bg-[var(--color-accent-light)] text-[var(--color-accent)]`}>
            {label}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:inline truncate max-w-[200px]">{email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
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