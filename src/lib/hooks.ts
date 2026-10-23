import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSolutionsForBattle, getSolutionsForGalaxy, getBattlesForGalaxy, getGalaxy } from './api';
import type { RankedSolutions } from './api';
import type { Solution, Galaxy } from './types';

const isAdminSession = (s: Session | null) => !!s?.user?.app_metadata?.fleetvault_admin;
let staleSessionHandled = false;

function handleStaleSession() {
  if (staleSessionHandled) return;
  staleSessionHandled = true;
  localStorage.removeItem('fleetvault_admin_label');
  setTimeout(() => {
    supabase.auth.signOut();
    alert('Admin logins have changed. Please log in again with your token.');
  }, 0);
}

export function useAdminSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const apply = (s: Session | null) => {
      if (s && !isAdminSession(s)) {
        handleStaleSession();
        setSession(null);
      } else {
        setSession(s);
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => apply(s));
    return () => subscription.unsubscribe();
  }, []);

  return session;
}

export function useUsername(): string | null {
  const session = useAdminSession();
  return session?.user?.app_metadata?.admin_label ?? null;
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

const NO_SOLUTIONS: RankedSolutions = { best: [], obsolete: [], flagged: [] };

export function useGalaxySolutions(galaxyId: number) {
  const [byBattle, setByBattle] = useState<Record<string, RankedSolutions>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    getSolutionsForGalaxy(galaxyId)
      .then((result) => { if (current) setByBattle(result); })
      .catch((e) => { if (current) setError(e); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [galaxyId]);

  const forBattle = (battleId: string) => byBattle[battleId] ?? NO_SOLUTIONS;
  return { byBattle, forBattle, loading, error };
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
