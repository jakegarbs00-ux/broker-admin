'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type UserRole = 'CLIENT' | 'PARTNER' | 'ADMIN';

interface SidebarProps {
  role: UserRole;
  userId?: string;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  industry: string | null;
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['CLIENT', 'PARTNER'],
  },
  {
    label: 'My Applications',
    href: '/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    roles: ['CLIENT'],
  },
  {
    label: 'Client Applications',
    href: '/partner/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    roles: ['PARTNER'],
  },
  {
    label: 'All Applications',
    href: '/admin/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    roles: ['ADMIN'],
  },
  {
    label: 'Lenders',
    href: '/admin/lenders',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    roles: ['ADMIN'],
  },
];

export default function Sidebar({ role, userId, onClose }: SidebarProps) {
  const pathname = usePathname();
  const supabase = getSupabaseClient();
  const [company, setCompany] = useState<Company | null>(null);

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  // Load company info for clients
  useEffect(() => {
    if (role !== 'CLIENT' || !userId) return;

    const loadCompany = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, company_number, industry')
        .eq('owner_id', userId)
        .maybeSingle();

      if (data) {
        setCompany(data as Company);
      }
    };

    loadCompany();
  }, [role, userId, supabase]);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Logo / Brand */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-xl font-semibold text-gray-900">Flôka</span>
        </Link>
        
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg -mr-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1 flex-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Client company info section */}
      {role === 'CLIENT' && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Company</p>
            <Link 
              href="/onboarding/company" 
              onClick={onClose}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Edit
            </Link>
          </div>
          
          {company ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 truncate">{company.name}</p>
              {company.company_number && (
                <p className="text-xs text-gray-500">#{company.company_number}</p>
              )}
              {company.industry && (
                <p className="text-xs text-gray-500">{company.industry}</p>
              )}
            </div>
          ) : (
            <Link
              href="/onboarding/company"
              onClick={onClose}
              className="block text-sm text-blue-600 hover:text-blue-700"
            >
              + Add company info
            </Link>
          )}
        </div>
      )}

      {/* Role-specific sections */}
      {role === 'PARTNER' && (
        <div className="px-4 pb-4">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Partner Tools
          </p>
          <div className="mt-2 space-y-1">
            <Link
              href="/partner/applications/new"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Client Application
            </Link>
          </div>
        </div>
      )}

      {role === 'CLIENT' && (
        <div className="px-4 pb-4">
          <Link
            href="/applications/new"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Application
          </Link>
        </div>
      )}
    </aside>
  );
}