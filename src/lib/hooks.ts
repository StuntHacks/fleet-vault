import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSolutionsForBattle, getSolutionsForGalaxy, getBattlesForGalaxy, getGalaxy, getFlaggedCount, getUpdateCount, getGalaxies, getAuditLog, AUDIT_PAGE } from './api';
import { galaxies, orderBattles } from './battles';
import type { AuditFilter, RankedSolutions } from './api';
import type { Solution, Galaxy, AuditEntry } from './types';

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

let galaxyRows: Promise<Galaxy[] | null> | null = null;
const loadGalaxyRows = () => galaxyRows ??= getGalaxies().catch(() => null);

export function refreshGalaxies() {
  galaxyRows = null;
  window.dispatchEvent(new Event('fv:galaxies-changed'));
  return loadGalaxyRows();
}

function useGalaxyRows() {
  const [rows, setRows] = useState<Galaxy[] | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    const load = () => { loadGalaxyRows().then((r) => { if (current) setRows(r); }); };
    load();
    window.addEventListener('fv:galaxies-changed', load);
    return () => {
      current = false;
      window.removeEventListener('fv:galaxies-changed', load);
    };
  }, []);

  return rows;
}

export function useGalaxyAccess() {
  const session = useAdminSession();
  const rows = useGalaxyRows();
  const hidden = rows === undefined ? undefined : !rows ? [] : galaxies.map((_, i) => i + 1).filter((id) => {
    const row = rows.find((r) => r.id === id);
    return !row || !!row.hidden;
  });

  const loading = session === undefined || hidden === undefined;
  return {
    loading,
    isHidden: (galaxyId: number) => !!hidden?.includes(galaxyId),
    canView: (galaxyId: number) => !loading && (!!session || !hidden!.includes(galaxyId)),
  };
}

export function useGalaxyBattles(galaxyId: number) {
  const rows = useGalaxyRows();
  const order = rows?.find((r) => r.id === galaxyId)?.battle_order;
  return useMemo(() => orderBattles(galaxyId, order), [galaxyId, order]);
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
  const reload = () => getSolutionsForGalaxy(galaxyId).then(setByBattle);
  return { byBattle, forBattle, reload, loading, error };
}

export function useSolutionQueue(load: () => Promise<Solution[]>) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let current = true;
    load()
      .then((result) => { if (current) setSolutions(result); })
      .catch((e) => { if (current) setError(e); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [load]);

  const reload = () => load().then(setSolutions);
  return { solutions, reload, loading, error };
}

export function useAuditLog(filter: AuditFilter) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setEntries([]);
    getAuditLog(filter)
      .then((result) => { if (current) { setEntries(result); setHasMore(result.length === AUDIT_PAGE); } })
      .catch((e) => { if (current) setError(e); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filter, version]);

  const reload = () => setVersion((v) => v + 1);

  const loadMore = () => {
    setLoading(true);
    getAuditLog(filter, entries[entries.length - 1]?.id)
      .then((result) => { setEntries((prev) => [...prev, ...result]); setHasMore(result.length === AUDIT_PAGE); })
      .catch(setError)
      .finally(() => setLoading(false));
  };

  return { entries, hasMore, loadMore, reload, loading, error };
}


function usePendingCount(enabled: boolean, load: () => Promise<number>, event: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let current = true;
    const reload = () => { load().then((c) => { if (current) setCount(c); }).catch(() => { }); };

    const poll = () => { if (document.visibilityState === 'visible') reload(); };
    const interval = setInterval(poll, 60000);
    
    reload();
    window.addEventListener(event, reload);
    document.addEventListener('visibilitychange', poll);

    return () => {
      current = false;
      clearInterval(interval);
      window.removeEventListener(event, reload);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [enabled, load, event]);

  return count;
}

export const useFlaggedCount = (enabled: boolean) => usePendingCount(enabled, getFlaggedCount, 'fv:flags-changed');
export const useUpdateCount = (enabled: boolean) => usePendingCount(enabled, getUpdateCount, 'fv:updates-changed');

export function useSelectedSolution() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const closing = useRef(false);

  useEffect(() => {
    closing.current = false;
  }, [location.key]);

  const selectedId = Number(searchParams.get("solution")) || null;

  const openSolution = (s: Solution) => {
    setSearchParams((params) => {
      params.set("solution", String(s.id));
      return params;
    }, { state: { popup: true } });
  };

  const switchSolution = (s: Solution) => {
    setSearchParams((params) => {
      params.set("solution", String(s.id));
      return params;
    }, { replace: true, state: location.state });
  };

  const closeSolution = () => {
    if (closing.current) return;
    closing.current = true;
    if ((location.state as { popup?: boolean } | null)?.popup) {
      navigate(-1);
      return;
    }
    setSearchParams((params) => {
      params.delete("solution");
      return params;
    }, { replace: true });
  };

  return { selectedId, openSolution, switchSolution, closeSolution };
}

type ReviewPresence = { label: string, solutionId: number };

const trackPresence = (channel: RealtimeChannel, presence: ReviewPresence | null) => presence ? channel.track(presence) : channel.untrack();

export function useReviewPresence(solutionId: number | null) {
  const session = useAdminSession();
  const userId = session?.user.id;
  const label: string = session?.user.app_metadata?.admin_label ?? 'Another admin';
  const [viewers, setViewers] = useState<Record<number, string[]>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const current = useRef<ReviewPresence | null>(null);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('admin-review', { config: { private: true, presence: { key: userId } } });

    channel
      .on('presence', { event: 'sync' }, () => {
        const result: Record<number, string[]> = {};

        for (const [key, metas] of Object.entries(channel.presenceState<ReviewPresence>())) {
          if (key === userId) continue;

          for (const { label, solutionId } of metas) {
            const list = (result[solutionId] ??= []);

            if (!list.includes(label)) list.push(label);
          }
        }

        setViewers(result);
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;

        channelRef.current = channel;
        trackPresence(channel, current.current);
      });

    return () => {
      channelRef.current = null;
      setViewers({});
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    current.current = solutionId == null ? null : { label, solutionId };

    if (channelRef.current) trackPresence(channelRef.current, current.current);
  }, [label, solutionId]);

  return viewers;
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
    let current = true;
    setLoading(true);
    setError(null);
    getGalaxy(galaxyId)
      .then((result) => { if (current) setGalaxy(result); })
      .catch((e) => { if (current) setError(e); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [galaxyId]);

  const reload = () => getGalaxy(galaxyId).then(setGalaxy);
  return { galaxy, reload, loading, error };
}
