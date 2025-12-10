'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';

type Lender = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
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

  if (!loading && profile?.role !== 'ADMIN') {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Admin – lenders</h1>
        <p className="text-sm text-red-600">
          You do not have permission to view this page.
        </p>
      </main>
    );
  }

  useEffect(() => {
    const loadLenders = async () => {
      setError(null);
      const { data, error } = await supabase
        .from('lenders')
        .select('id, name, status, notes')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading lenders', error);
        setError('Error loading lenders: ' + error.message);
      } else if (data) {
        setLenders(data as any);
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
      .select('id, name, status, notes')
      .single();

    if (error) {
      alert('Error creating lender: ' + error.message);
    } else if (data) {
      setLenders((prev) => [...prev, data as any]);
      setNewName('');
      setNewNotes('');
    }
    setCreating(false);
  };

  const handleStatusToggle = async (lender: Lender) => {
    const newStatus = lender.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from('lenders')
      .update({ status: newStatus })
      .eq('id', lender.id);

    if (error) {
      alert('Error updating status: ' + error.message);
      return;
    }

    setLenders((prev) =>
      prev.map((l) => (l.id === lender.id ? { ...l, status: newStatus } : l)),
    );
  };

  if (loading || loadingLenders) {
    return <p className="p-4">Loading…</p>;
  }

  if (!user) return null;

  return (
    <main className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-red-600">Admin</p>
          <h1 className="text-2xl font-semibold">Lenders</h1>
        </div>
        <Link
          href="/admin/applications"
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Back to applications
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* New lender form */}
      <section className="rounded-md border bg-white px-4 py-3 space-y-3">
        <p className="font-medium text-gray-800 text-sm">Add lender</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Lender name"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            rows={2}
            placeholder="Notes (optional)"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={handleCreate}
              className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create lender'}
            </button>
          </div>
        </div>
      </section>

      {/* Lenders list */}
      <section className="space-y-3">
        {lenders.length === 0 ? (
          <p className="text-sm text-gray-600">
            No lenders configured yet. Add one above.
          </p>
        ) : (
          lenders.map((l) => (
            <div
              key={l.id}
              className="flex items-start justify-between rounded-md border bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-sm">{l.name}</p>
                <p className="text-xs text-gray-500">ID: {l.id}</p>
                {l.notes && (
                  <p className="mt-1 text-xs text-gray-600">{l.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {l.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(l)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  {l.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
