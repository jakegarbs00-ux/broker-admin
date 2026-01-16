'use client';

import { ReactNode, useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const { user, profile, loading } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const role = profile.role as 'CLIENT' | 'PARTNER' | 'ADMIN';
  const email = user.email ?? 'Unknown';

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - fixed on all screen sizes, hidden on mobile unless open */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar role={role} userId={user.id} email={email} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen">
        <Header 
          email={email} 
          role={role} 
          onMenuClick={() => setSidebarOpen(true)} 
        />
        
        {/* Page content - full width, no max-width constraint */}
        <main className="flex-1 pt-16 bg-[var(--color-bg-primary)] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}