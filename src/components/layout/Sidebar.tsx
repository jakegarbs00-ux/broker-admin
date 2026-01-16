'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Building2, 
  Users, 
  Settings, 
  DollarSign,
  UserPlus,
  Folder
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type UserRole = 'CLIENT' | 'PARTNER' | 'ADMIN';

interface SidebarProps {
  role: UserRole;
  userId?: string;
  email?: string;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

// Admin and Partner navigation items
const adminPartnerNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="w-5 h-5" />,
    roles: ['PARTNER', 'ADMIN'],
  },
  {
    label: 'Applications',
    href: '/partner/applications',
    icon: <FileText className="w-5 h-5" />,
    roles: ['PARTNER'],
  },
  {
    label: 'Companies',
    href: '/partner/companies',
    icon: <Building2 className="w-5 h-5" />,
    roles: ['PARTNER'],
  },
  {
    label: 'Applications',
    href: '/admin/applications',
    icon: <FileText className="w-5 h-5" />,
    roles: ['ADMIN'],
  },
  {
    label: 'Companies',
    href: '/admin/companies',
    icon: <Building2 className="w-5 h-5" />,
    roles: ['ADMIN'],
  },
  {
    label: 'Lenders',
    href: '/admin/lenders',
    icon: <DollarSign className="w-5 h-5" />,
    roles: ['ADMIN'],
  },
  {
    label: 'Partners',
    href: '/admin/partners',
    icon: <Users className="w-5 h-5" />,
    roles: ['ADMIN'],
  },
  {
    label: 'Leads',
    href: '/admin/leads',
    icon: <UserPlus className="w-5 h-5" />,
    roles: ['ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['PARTNER', 'ADMIN'],
  },
];

// Client navigation items (simplified)
const clientNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="w-5 h-5" />,
    roles: ['CLIENT'],
  },
  {
    label: 'My Application',
    href: '/application', // Will be updated dynamically if user has an application
    icon: <FileText className="w-5 h-5" />,
    roles: ['CLIENT'],
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: <Folder className="w-5 h-5" />,
    roles: ['CLIENT'],
  },
  {
    label: 'Company',
    href: '/company',
    icon: <Building2 className="w-5 h-5" />,
    roles: ['CLIENT'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['CLIENT'],
  },
];

export default function Sidebar({ role, userId, email, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [hasApplication, setHasApplication] = useState(false);

  // Fetch CLIENT user's application ID
  useEffect(() => {
    if (role === 'CLIENT' && userId) {
      const fetchApplicationId = async () => {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('applications')
          .select('id')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.id) {
          setApplicationId(data.id);
          setHasApplication(true);
        } else {
          setHasApplication(false);
        }
      };

      fetchApplicationId();
    }
  }, [role, userId]);

  // Get navigation items based on role
  const getNavItems = (): (NavItem & { disabled?: boolean })[] => {
    if (role === 'CLIENT') {
      // For CLIENT, use simplified navigation and update hrefs/disabled states
      return clientNavItems.map((item) => {
        const navItem: NavItem & { disabled?: boolean } = { ...item };
        
        if (item.label === 'My Application') {
          if (applicationId) {
            navItem.href = `/applications/${applicationId}`;
            navItem.disabled = false;
          } else {
            navItem.disabled = true;
          }
        }
        
        if (item.label === 'Documents') {
          navItem.disabled = !hasApplication;
        }
        
        return navItem;
      });
    } else {
      // For ADMIN and PARTNER, use the full navigation
      return adminPartnerNavItems.filter((item) => item.roles.includes(role));
    }
  };

  const filteredItems = getNavItems();

  // Get user initials from email
  const getInitials = (email?: string) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const roleLabels = {
    CLIENT: 'Client',
    PARTNER: 'Partner',
    ADMIN: 'Admin',
  };

  return (
    <aside className="w-[260px] bg-[var(--color-primary)] border-r border-[var(--color-primary-dark)] min-h-screen flex flex-col fixed left-0 top-0">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-[var(--color-primary-dark)]">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <span className="font-semibold text-lg tracking-tight text-white">Broker Portal</span>
        </Link>
        
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-[var(--color-primary-light)] rounded-lg transition-colors"
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
          const isDisabled = 'disabled' in item && item.disabled;
          
          const content = (
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed text-white/40'
                  : isActive
                  ? 'bg-[var(--color-primary-light)] text-white font-medium'
                  : 'text-white/80 hover:bg-[var(--color-primary-light)] hover:text-white'
              }`}
            >
              {isActive && !isDisabled && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
              <span className={isActive && !isDisabled ? 'text-white' : 'text-white/70'}>
                {item.icon}
              </span>
              {item.label}
            </div>
          );

          if (isDisabled) {
            return <div key={item.href}>{content}</div>;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* User Info at Bottom */}
      {email && (
        <div className="p-4 border-t border-[var(--color-primary-dark)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-medium text-sm">
              {getInitials(email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{email.split('@')[0]}</p>
              <p className="text-white/70 text-xs truncate">{roleLabels[role]}</p>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}