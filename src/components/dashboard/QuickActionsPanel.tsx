import Link from 'next/link';
import { Card, CardHeader, CardContent, Button } from '@/components/ui';
import { FileText, Building2, Plus } from 'lucide-react';

interface QuickActionsPanelProps {
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  hasCompany?: boolean;
}

export function QuickActionsPanel({ role, hasCompany = false }: QuickActionsPanelProps) {
  const actions = {
    CLIENT: [
      { label: 'Start Application', href: '/apply', icon: Plus, enabled: true },
      { label: 'My Application', href: '/application', icon: FileText, enabled: true },
      { label: 'Company', href: '/company', icon: Building2, enabled: true },
    ],
    PARTNER: [
      { label: 'New Company', href: '/partner/companies/new', icon: Plus, enabled: true },
      { label: 'View Companies', href: '/partner/companies', icon: Building2, enabled: true },
      { label: 'View Applications', href: '/partner/applications', icon: FileText, enabled: true },
    ],
    ADMIN: [
      { label: 'View Applications', href: '/admin/applications', icon: FileText, enabled: true },
      { label: 'View Companies', href: '/admin/companies', icon: Building2, enabled: true },
    ],
  };

  const roleActions = actions[role] || [];

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-[var(--color-text-primary)]">Quick Actions</h2>
      </CardHeader>
      <CardContent className="space-y-2">
        {roleActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="block">
              <Button
                variant={action.enabled ? 'primary' : 'secondary'}
                className="w-full justify-start"
                disabled={!action.enabled}
              >
                <Icon className="w-4 h-4 mr-2" />
                {action.label}
              </Button>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

