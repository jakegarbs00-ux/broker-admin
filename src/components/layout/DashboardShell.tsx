'use client';

import { ReactNode } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const { user, profile, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Loading...</p>
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
    <div className="min-h-screen bg-gray-50 flex">
      <div className="block">
        <Sidebar role={role} />
      </div>
      <div className="flex-1 flex flex-col min-h-screen">
        <Header email={email} role={role} />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}