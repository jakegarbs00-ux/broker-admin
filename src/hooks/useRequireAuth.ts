'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export function useRequireAuth() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/auth/login');
        return;
      }
      setUser(data.user);
      setLoading(false);
    };

    check();
  }, [supabase, router]);

  return { user, loading };
}
