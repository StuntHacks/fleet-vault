import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSolutionsForBattle, getBattlesForGalaxy, getGalaxy } from './api';
import type { Solution, Galaxy } from './types';

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return session;
}

export function useBattles(galaxyId: number) {
  const [battles, setBattles] = useState<number[]>([]);
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

export function useSolutions(galaxyId: number, battleId: number) {
  const [best, setBest] = useState<Solution[]>([]);
  const [obsolete, setObsolete] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getSolutionsForBattle(galaxyId, battleId)
      .then(({ best, obsolete }) => { setBest(best); setObsolete(obsolete); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [galaxyId, battleId]);

  return { best, obsolete, loading, error };
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
