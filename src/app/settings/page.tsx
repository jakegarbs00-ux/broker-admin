'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Button } from '@/components/ui';
import { UserPlus, Key, Users } from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin user invite
  const [adminEmail, setAdminEmail] = useState('');
  const [invitingAdmin, setInvitingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Password reset
  const [resetEmail, setResetEmail] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetUserType, setResetUserType] = useState<'PARTNER' | 'CLIENT'>('PARTNER');

  useEffect(() => {
    const loadAdminUsers = async () => {
      if (loading) return;
      if (profile?.role !== 'ADMIN') {
        setLoadingData(false);
        return;
      }

      setError(null);

      const { data, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, created_at')
        .eq('role', 'ADMIN')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error loading admin users', usersError);
        setError('Error loading admin users: ' + usersError.message);
      } else if (data) {
        setAdminUsers(data as AdminUser[]);
      }
      setLoadingData(false);
    };

    loadAdminUsers();
  }, [loading, profile?.role, supabase]);

  const handleInviteAdmin = async () => {
    if (!adminEmail.trim()) {
      setAdminError('Email is required');
      return;
    }

    setInvitingAdmin(true);
    setAdminError(null);
    setError(null);
    setSuccess(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setAdminError('Unable to verify your session. Please refresh and try again.');
      setInvitingAdmin(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/invite-admin-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: adminEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setAdminError(data.error || 'Error inviting admin user');
      } else {
        setSuccess('Admin user invited successfully. They will receive an email to set their password.');
        setAdminEmail('');
        // Reload admin users
        const { data: updatedUsers } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, created_at')
          .eq('role', 'ADMIN')
          .order('created_at', { ascending: false });
        if (updatedUsers) {
          setAdminUsers(updatedUsers as AdminUser[]);
        }
      }
    } catch (err: any) {
      setAdminError('Error inviting admin user: ' + err.message);
    }

    setInvitingAdmin(false);
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setResetError('Email is required');
      return;
    }

    setResettingPassword(true);
    setResetError(null);
    setResetSuccess(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resetEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setResetError(data.error || 'Error resetting password');
      } else {
        setResetSuccess(`Password reset email sent to ${resetEmail.trim()}`);
        setResetEmail('');
      }
    } catch (err: any) {
      setResetError('Error resetting password: ' + err.message);
    }

    setResettingPassword(false);
  };

  if (loading || loadingData) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading settings...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-[var(--color-error)] font-medium">Access Denied</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You do not have permission to view this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Settings"
        description="Manage admin users and reset passwords"
      />

      {error && (
        <div className="mb-6 p-4 bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admin Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Admin Users</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                />
                <Button
                  variant="primary"
                  onClick={handleInviteAdmin}
                  disabled={invitingAdmin}
                >
                  {invitingAdmin ? 'Inviting...' : 'Add Admin'}
                </Button>
              </div>
              {adminError && (
                <p className="mt-1 text-sm text-[var(--color-error)]">{adminError}</p>
              )}
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                The new admin will receive an email to set their password.
              </p>
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                Current Admin Users ({adminUsers.length})
              </h3>
              {adminUsers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">No admin users found</p>
              ) : (
                <div className="space-y-2">
                  {adminUsers.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-2 bg-[var(--color-bg-secondary)] rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {admin.email}
                        </p>
                        {(admin.first_name || admin.last_name) && (
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {[admin.first_name, admin.last_name].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {new Date(admin.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Password Reset */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Reset Password</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                User Type
              </label>
              <select
                value={resetUserType}
                onChange={(e) => setResetUserType(e.target.value as 'PARTNER' | 'CLIENT')}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              >
                <option value="PARTNER">Partner</option>
                <option value="CLIENT">Client</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                />
                <Button
                  variant="primary"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? 'Sending...' : 'Reset'}
                </Button>
              </div>
              {resetError && (
                <p className="mt-1 text-sm text-[var(--color-error)]">{resetError}</p>
              )}
              {resetSuccess && (
                <p className="mt-1 text-sm text-green-600">{resetSuccess}</p>
              )}
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                A password reset link will be sent to the user's email address.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

