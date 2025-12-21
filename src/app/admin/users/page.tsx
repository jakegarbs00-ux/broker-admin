'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, PageHeader, Badge, EmptyState } from '@/components/ui';

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'CLIENT' | 'PARTNER' | 'ADMIN';
  phone: string | null;
  created_at: string;
  company_id: string | null;
  partner_company_id: string | null;
  is_primary_contact: boolean | null;
  company?: { id: string; name: string }[] | null;
  partner_company?: { id: string; name: string }[] | null;
};

export default function AdminUsersPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      if (loading) return;
      if (profile?.role !== 'ADMIN') {
        setLoadingData(false);
        return;
      }

      setError(null);

      const { data, error: usersError } = await supabase
        .from('profiles')
        .select(`
          *,
          company:company_id(id, name),
          partner_company:partner_company_id(id, name)
        `)
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error loading users', usersError);
        setError('Error loading users: ' + usersError.message);
      } else if (data) {
        setUsers(data as User[]);
      }
      setLoadingData(false);
    };

    loadUsers();
  }, [loading, profile?.role, supabase]);

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchesSearch =
      !search ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      `${user.first_name || ''} ${user.last_name || ''}`
        .toLowerCase()
        .trim()
        .includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const formatFullName = (firstName?: string | null, lastName?: string | null): string => {
    return [firstName, lastName].filter(Boolean).join(' ') || '—';
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading users...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Users"
        description={`${users.length} total users`}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="CLIENT">Clients</option>
              <option value="PARTNER">Partners</option>
              <option value="ADMIN">Admins</option>
            </select>
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{filteredUsers.length}</span> of{' '}
              <span className="font-medium">{users.length}</span> users
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              title="No users found"
              description={search || roleFilter !== 'ALL' ? 'Try adjusting your filters.' : 'No users have been registered yet.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Name
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Email
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Role
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Association
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Created
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const associationName =
                      user.company?.[0]?.name || user.partner_company?.[0]?.name || '—';
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => (window.location.href = `/admin/users/${user.id}`)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">
                            {formatFullName(user.first_name, user.last_name)}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{user.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              user.role === 'ADMIN'
                                ? 'purple'
                                : user.role === 'PARTNER'
                                  ? 'info'
                                  : 'default'
                            }
                          >
                            {user.role}
                          </Badge>
                          {user.is_primary_contact && (
                            <Badge variant="success" className="ml-2">
                              Primary Contact
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{associationName}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Edit →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

