'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashboardShell } from '@/components/layout';
import { Card, CardContent, CardHeader, PageHeader, Badge, Button } from '@/components/ui';

type Lender = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export default function AdminLendersPage() {
  const { user, profile, loading } = useUserProfile();
  const supabase = getSupabaseClient();

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loadingLenders, setLoadingLenders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadLenders = async () => {
      setError(null);
      const { data, error } = await supabase
        .from('lenders')
        .select('id, name, notes, created_at')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading lenders', error);
        setError('Error loading lenders: ' + error.message);
      } else if (data) {
        setLenders(data as Lender[]);
      }
      setLoadingLenders(false);
    };

    if (!loading && profile?.role === 'ADMIN') {
      loadLenders();
    }
  }, [loading, profile?.role, supabase]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from('lenders')
      .insert({
        name: newName.trim(),
        status: 'ACTIVE',
        notes: newNotes.trim() || null,
      })
      .select('id, name, notes, created_at')
      .single();

    if (error) {
      alert('Error creating lender: ' + error.message);
    } else if (data) {
      setLenders((prev) => [...prev, data as Lender].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewNotes('');
    }
    setCreating(false);
  };

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

  if (loading || loadingLenders) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Loading lenders...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <PageHeader
        title="Lenders"
        description={`${lenders.length} lender${lenders.length !== 1 ? 's' : ''} configured`}
        actions={
          <Link href="/admin/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - lenders list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">All Lenders</h2>
                <Badge variant="default">{lenders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {lenders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No lenders configured yet. Add one using the form.
                </p>
              ) : (
                <div className="space-y-3">
                  {lenders.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{l.name}</p>
                        {l.notes && (
                          <p className="text-sm text-gray-600 mt-1">{l.notes}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Added {new Date(l.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Add lender form */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Add New Lender</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lender Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. HSBC, Funding Circle"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional notes about this lender..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                {creating ? 'Adding...' : 'Add Lender'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}