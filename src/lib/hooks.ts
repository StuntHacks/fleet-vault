import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSolutionsForBattle, getBattlesForGalaxy, getGalaxy } from './api';
import type { Solution, Galaxy } from './types';

export function useAdminSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return session;
}

export function useUsername(): string | null {
  const session = useAdminSession();
  if (!session) return null;
  return localStorage.getItem('fleetvault_admin_label');
}

export function useBattles(galaxyId: number) {
  const [battles, setBattles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getBattlesForGalaxy(galaxyId)
      .then(setBattles)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [galaxyId]);

  return { battles, loading, error };
}

export function useSolutions(galaxyId: number, battleId: string) {
  const [best, setBest] = useState<Solution[]>([]);
  const [obsolete, setObsolete] = useState<Solution[]>([]);
  const [flagged, setFlagged] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getSolutionsForBattle(galaxyId, battleId)
      .then(({ best, obsolete, flagged }) => { setBest(best); setObsolete(obsolete); setFlagged(flagged); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [galaxyId, battleId]);

  return { best, obsolete, flagged, loading, error };
}

export function useGalaxy(galaxyId: number) {
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getGalaxy(galaxyId)
      .then(setGalaxy)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [galaxyId]);

  return { galaxy, loading, error };
}
