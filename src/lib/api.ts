import { supabase } from './supabase';
import { Galaxy, Solution } from './types';

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

  const solutions = data as Solution[];
  const best = solutions.filter(s => s.rank_in_group === 1);
  const obsolete = solutions.filter(s => s.rank_in_group != null && s.rank_in_group > 1);
  const flagged = solutions.filter(s => s.flagged);

  return { best, obsolete, flagged };
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

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function submitSolution(params: {
  galaxyId: number;
  battleId: string;
  combatStats: number;
  frUsed: number;
  frCommitted?: number;
  notes: string;
  submittedBy: string;
  screenshot?: File;
  advancedSolution?: string;
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
}): Promise<void> {
  let screenshotUrl: string | null = null;

  if (params.screenshot) {
    const ext = IMAGE_EXTENSIONS[params.screenshot.type] ?? 'png';
    const path = `${params.galaxyId}/${params.battleId}/${Date.now()}.${ext}`;
    const { data: upload, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(path, params.screenshot);
    if (uploadError) throw uploadError;
    screenshotUrl = supabase.storage.from('screenshots').getPublicUrl(upload.path).data.publicUrl;
  }

  const { error } = await supabase.from('solutions').insert({
    galaxy_id: params.galaxyId,
    battle_id: params.battleId,
    combat_stats: params.combatStats,
    fr_used: params.frUsed,
    fr_committed: Number.isFinite(params.frCommitted) ? params.frCommitted : null,
    notes: params.notes,
    submitted_by: params.submittedBy,
    screenshot_url: screenshotUrl,
    advanced_solution: params.advancedSolution ?? null,
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
  });

  if (error) throw error;
}

// admin stuff
export async function deleteSolution(id: number): Promise<void> {
  await setAdminContext();
  const { error } = await supabase.from('solutions').delete().eq('id', id);
  if (error) throw error;
}

export async function updateGalaxyNotes(galaxyId: number, notes: string): Promise<void> {
  await setAdminContext();
  const { error } = await supabase.from('galaxies').update({ notes }).eq('id', galaxyId);
  if (error) throw error;
}

export async function flagSolution(id: number): Promise<void> {
  const { error } = await supabase.rpc('flag_solution', { solution_id: id });
  if (error) throw error;
}

export async function unflagSolution(id: number): Promise<void> {
  await setAdminContext();
  const { error } = await supabase
    .from('solutions')
    .update({ flagged: false })
    .eq('id', id);
  if (error) throw error;
}

export async function getFlaggedSolutions(): Promise<Solution[]> {
  const { data, error } = await supabase
    .from('solutions')
    .select('*')
    .eq('flagged', true)
    .order('submitted_at');
  if (error) throw error;
  return data;
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

  const { session, adminLabel } = await res.json();

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  localStorage.setItem('fleetvault_admin_label', adminLabel);
}

async function setAdminContext(): Promise<void> {
  const label = localStorage.getItem('fleetvault_admin_label') ?? 'unknown';
  await supabase.rpc('set_config', { key: 'app.fleetvault_admin_label', value: label });
}

export async function adminLogout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem('fleetvault_admin_label');
}
