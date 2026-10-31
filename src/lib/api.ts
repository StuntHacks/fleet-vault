import { supabase } from './supabase';
import { AuditEntry, ChainRun, Galaxy, Solution, SolutionFlag, SolutionUpdate } from './types';

export async function getBattlesForGalaxy(galaxyId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('solution_battles')
    .select('battle_id')
    .eq('galaxy_id', galaxyId);

  if (error) throw error;

  return data.map(r => r.battle_id);
}

export async function getSolutionsForBattle(galaxyId: number, battleId: string) {
  const { data, error } = await supabase
    .from('solutions_ranked')
    .select('*')
    .eq('galaxy_id', galaxyId)
    .eq('battle_id', battleId)
    .order('combat_stats')
    .order('rank_in_group');

  if (error) throw error;

  return splitRanked(data as Solution[]);
}

export interface RankedSolutions {
  best: Solution[];
  obsolete: Solution[];
  flagged: Solution[];
}

const verifiedFirst = (a: Solution, b: Solution) =>
  a.combat_stats - b.combat_stats || Number(b.verified_at != null) - Number(a.verified_at != null);

function splitRanked(solutions: Solution[]): RankedSolutions {
  return {
    best: solutions.filter(s => s.rank_in_group === 1).sort(verifiedFirst),
    obsolete: solutions.filter(s => s.rank_in_group != null && s.rank_in_group > 1).sort(verifiedFirst),
    flagged: solutions.filter(s => s.flagged),
  };
}

export async function getSolutionsForGalaxy(galaxyId: number): Promise<Record<string, RankedSolutions>> {
  const PAGE = 1000;
  const solutions: Solution[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('solutions_ranked')
      .select('*')
      .eq('galaxy_id', galaxyId)
      .order('battle_id')
      .order('combat_stats')
      .order('rank_in_group')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    solutions.push(...(data as Solution[]));
    if (data.length < PAGE) break;
  }

  const byBattle: Record<string, Solution[]> = {};
  for (const s of solutions) (byBattle[s.battle_id] ??= []).push(s);
  return Object.fromEntries(Object.entries(byBattle).map(([battleId, list]) => [battleId, splitRanked(list)]));
}

export async function getGalaxy(galaxyId: number): Promise<Galaxy> {
  const { data, error } = await supabase
    .from('galaxies')
    .select('*')
    .eq('id', galaxyId)
    .single();

  if (error) throw error;
  return data;
}

export interface SolutionFields {
  galaxyId: number;
  battleId: string;
  combatStats: number;
  frUsed: number;
  frCommitted?: number;
  notes: string;
  screenshot?: File;
  hazards: boolean;
  hazardNodes: string[];
  support: boolean;
  supportNodes: string[];
  bossAlive: boolean | null;
  unlocks: string[];
  purchases: Record<string, string>;
  shots: number | null;
  frTotal: number | null;
  bossDamage: number | null;
  chain: RunFields[];
}

export interface RunFields {
  frUsed: number;
  frCommitted?: number;
  screenshot?: File;
  uploaded?: ChainRun;
}

const THUMBNAIL_WIDTH = 480;
const PORTRAIT_FLAG_REASON = 'Automatic: portrait screenshot (mobile version?)';

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function makeThumbnail(bitmap: ImageBitmap): Promise<Blob | null> {
  const scale = Math.min(1, THUMBNAIL_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // no webP for safari :'(
  const webp = await encodeCanvas(canvas, 'image/webp', 0.75);
  return webp?.type === 'image/webp' ? webp : encodeCanvas(canvas, 'image/jpeg', 0.8);
}

async function uploadScreenshot(galaxyId: number, battleId: string, screenshot: File) {
  const bitmap = await createImageBitmap(screenshot).catch(() => null);
  const portrait = !!bitmap && bitmap.height > bitmap.width;
  const thumbnail = bitmap && await makeThumbnail(bitmap).catch(() => null);

  const form = new FormData();
  form.append('galaxyId', String(galaxyId));
  form.append('battleId', battleId);
  form.append('screenshot', screenshot);
  if (thumbnail) form.append('thumbnail', thumbnail);

  const res = await fetch(`${process.env.REACT_APP_IMAGES_URL}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Screenshot upload failed: ${await res.text()}`);

  const images: { screenshot_url: string; thumbnail_url: string | null } = await res.json();
  return { portrait, images };
}

async function uploadChain(params: SolutionFields) {
  let portrait = false;
  const chain: ChainRun[] = [];

  for (const run of params.chain) {
    const upload = run.screenshot ? await uploadScreenshot(params.galaxyId, params.battleId, run.screenshot) : null;
    portrait ||= !!upload?.portrait;
    chain.push({
      fr_used: run.frUsed,
      fr_committed: Number.isFinite(run.frCommitted) ? run.frCommitted! : null,
      screenshot_url: upload ? upload.images.screenshot_url : run.uploaded?.screenshot_url ?? null,
      thumbnail_url: upload ? upload.images.thumbnail_url : run.uploaded?.thumbnail_url ?? null,
    });
  }

  return { portrait, chain };
}

function solutionRow(params: SolutionFields) {
  return {
    galaxy_id: params.galaxyId,
    battle_id: params.battleId,
    combat_stats: params.combatStats,
    fr_used: params.frUsed,
    fr_committed: Number.isFinite(params.frCommitted) ? params.frCommitted : null,
    notes: params.notes,
    hazards: params.hazards,
    hazard_nodes: params.hazardNodes,
    support: params.support,
    support_nodes: params.supportNodes,
    boss_alive: params.bossAlive,
    unlocks: params.unlocks,
    purchases: params.purchases,
    shots: params.shots,
    fr_total: params.frTotal,
    boss_damage: params.bossDamage,
  };
}

export async function submitSolution(params: SolutionFields & {
  submittedBy: string;
  advancedSolution?: string;
}): Promise<number> {
  const { portrait, images } = params.screenshot
    ? await uploadScreenshot(params.galaxyId, params.battleId, params.screenshot)
    : { portrait: false, images: { screenshot_url: null, thumbnail_url: null } };
  const { portrait: portraitRun, chain } = await uploadChain(params);

  const { data, error } = await supabase.from('solutions').insert({
    ...solutionRow(params),
    submitted_by: params.submittedBy,
    ...images,
    advanced_solution: params.advancedSolution ?? null,
    chain,
  }).select('id').single();

  if (error) throw error;
  if (portrait || portraitRun) await flagSolution(data.id, PORTRAIT_FLAG_REASON).catch(() => { });

  return data.id;
}

export const isEmpty = (value: unknown) =>
  value == null || value === '' || (typeof value === 'object' && !Object.keys(value).length);

export function missingInfo(s: Solution, params: SolutionFields): Partial<Solution> {
  const row = {
    ...solutionRow(params),
    purchases: Object.fromEntries(Object.entries(params.purchases).filter(([node]) => !s.purchases?.[node])),
  };

  return Object.fromEntries(Object.entries(row).filter(([key, value]) =>
    !isEmpty(value) && (key === 'purchases' || (key === 'notes' ? value !== s.notes : isEmpty(s[key as keyof Solution])))));
}

export async function suggestSolutionUpdate(id: number, changes: Partial<Solution>): Promise<number> {
  const { data, error } = await supabase.rpc('suggest_solution_update', { solution_id: id, changes });
  if (error) throw error;

  return data;
}

export async function getOpenUpdateIds(ids: number[]): Promise<number[]> {
  const { data, error } = await supabase.rpc('open_solution_updates', { update_ids: ids });
  if (error) throw error;

  return data;
}

export async function getSolution(id: number): Promise<Solution | null> {
  const { data, error } = await supabase
    .from('solutions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;

  return data;
}

// admin stuff
export async function updateSolution(id: number, params: SolutionFields, unflag: boolean, verified: boolean): Promise<void> {
  const row = {
    ...solutionRow(params),
    ...(params.screenshot && (await uploadScreenshot(params.galaxyId, params.battleId, params.screenshot)).images),
    chain: (await uploadChain(params)).chain,
    ...(unflag && { flagged: false }),
    verified_at: verified ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase.from('solutions').update(row).eq('id', id).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Solution not updated');
}

export async function deleteSolution(id: number): Promise<void> {
  const { data, error } = await supabase.from('solutions').delete().eq('id', id).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Solution not deleted');
}

export async function getGalaxies(): Promise<Galaxy[]> {
  const { data, error } = await supabase.from('galaxies').select('*');
  if (error) throw error;

  return data;
}

export async function enableGalaxy(galaxyId: number): Promise<void> {
  const { data, error } = await supabase.from('galaxies').update({ hidden: false }).eq('id', galaxyId).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Galaxy not enabled');
}

export async function updateGalaxyNotes(galaxyId: number, notes: string | null): Promise<void> {
  const { data, error } = await supabase.from('galaxies').update({ notes }).eq('id', galaxyId).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Galaxy notes not saved');
}

export async function updateBattleOrder(galaxyId: number, battleOrder: string[] | null): Promise<void> {
  const { data, error } = await supabase.from('galaxies').update({ battle_order: battleOrder }).eq('id', galaxyId).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Battle order not saved');
}

export async function flagSolution(id: number, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('flag_solution', { solution_id: id, reason: reason?.trim() || null });
  if (error) throw error;
}

export async function unflagSolution(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('solutions')
    .update({ flagged: false })
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Solution not unflagged');
}

export async function setSolutionVerified(id: number, verified: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('solutions')
    .update({ verified_at: verified ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data.length) throw new Error(`Solution not ${verified ? 'verified' : 'unverified'}`);
}

export async function getFlaggedSolutions(): Promise<Solution[]> {
  const { data, error } = await supabase
    .from('solutions_ranked')
    .select('*')
    .eq('flagged', true)
    .order('galaxy_id')
    .order('battle_id')
    .order('combat_stats')
    .order('rank_in_group')
    .order('id');

  if (error) throw error;
  return data as Solution[];
}

export async function getFlaggedCount(): Promise<number> {
  const { count, error } = await supabase
    .from('solutions')
    .select('id', { count: 'exact', head: true })
    .eq('flagged', true);

  if (error) throw error;
  return count ?? 0;
}

export async function getSolutionFlags(solutionId: number): Promise<SolutionFlag[]> {
  const { data, error } = await supabase
    .from('solution_flags')
    .select('*')
    .eq('solution_id', solutionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getUpdatedSolutions(): Promise<Solution[]> {
  const { data, error } = await supabase.from('solution_updates').select('solution_id').is('resolved_at', null);
  if (error) throw error;

  const ids = [...new Set(data.map((u) => u.solution_id))];
  if (!ids.length) return [];

  const { data: solutions, error: solutionsError } = await supabase
    .from('solutions_ranked')
    .select('*')
    .in('id', ids)
    .order('galaxy_id')
    .order('battle_id')
    .order('combat_stats')
    .order('rank_in_group')
    .order('id');

  if (solutionsError) throw solutionsError;
  return solutions as Solution[];
}

export async function getUpdateCount(): Promise<number> {
  const { count, error } = await supabase
    .from('solution_updates')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function getSolutionUpdates(solutionId: number): Promise<SolutionUpdate[]> {
  const { data, error } = await supabase
    .from('solution_updates')
    .select('*')
    .eq('solution_id', solutionId)
    .is('resolved_at', null)
    .order('created_at');

  if (error) throw error;
  return data;
}

export async function getSolutionUpdate(id: number): Promise<SolutionUpdate | null> {
  const { data, error } = await supabase
    .from('solution_updates')
    .select('*')
    .eq('id', id)
    .is('resolved_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function resolveSolutionUpdate(id: number, applied: boolean): Promise<void> {
  const { error } = await supabase.rpc('resolve_solution_update', { update_id: id, applied });
  if (error) throw error;
}

export const AUDIT_PAGE = 50;

export type AuditType = 'flags' | 'changes' | 'galaxies' | 'updates' | 'submissions';
export type AuditFilter = Record<AuditType, boolean>;

const AUDIT_CONDITIONS: Record<AuditType, string[]> = {
  flags: ['table_name.eq.solution_flags'],
  changes: ['and(table_name.eq.solutions,operation.neq.INSERT)'],
  galaxies: ['table_name.eq.galaxies'],
  updates: ['table_name.eq.solution_updates'],
  submissions: ['and(table_name.eq.solutions,operation.eq.INSERT)'],
};

export async function getAuditLog(filter: AuditFilter, beforeId?: number): Promise<AuditEntry[]> {
  const conditions = (Object.keys(AUDIT_CONDITIONS) as AuditType[]).filter((t) => filter[t]).flatMap((t) => AUDIT_CONDITIONS[t]);
  if (!conditions.length) return [];

  let query = supabase
    .from('audit_log')
    .select('*')
    .or(conditions.join(','))
    .order('id', { ascending: false })
    .limit(AUDIT_PAGE);

  if (beforeId) query = query.lt('id', beforeId);
  const { data, error } = await query;
  if (error) throw error;

  return data;
}

export async function getExistingSolutionIds(ids: number[]): Promise<number[]> {
  const { data, error } = await supabase.from('solutions').select('id').in('id', ids);
  if (error) throw error;
  return data.map((r) => r.id);
}

export async function undoAuditEntry(entry: AuditEntry, fields: string[]): Promise<void> {
  const row = Object.fromEntries(fields.map((f) => [f, entry.old_data?.[f] ?? null]));
  const { data, error } = await supabase.from(entry.table_name).update(row).eq('id', entry.record_id).select('id');

  if (error) throw error;
  if (!data.length) throw new Error('Record no longer exists');
}

export async function adminLogin(token: string): Promise<void> {
  const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/admin-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) throw new Error('Invalid token');

  const { session } = await res.json();

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

export async function adminLogout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
