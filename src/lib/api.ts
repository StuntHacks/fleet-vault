import { supabase } from './supabase';
import { Galaxy, Solution } from './types';

export async function getBattlesForGalaxy(galaxyId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('solutions')
    .select('battle_id')
    .eq('galaxy_id', galaxyId)
    .order('battle_id');

  if (error) throw error;

  return [...new Set(data.map(r => r.battle_id))];
}

export async function getSolutionsForBattle(galaxyId: number, battleId: number) {
  const { data, error } = await supabase
    .from('solutions_ranked')
    .select('*')
    .eq('galaxy_id', galaxyId)
    .eq('battle_id', battleId)
    .order('combat_stats')
    .order('rank_in_group');

  if (error) throw error;

  const best = data.filter(s => s.rank_in_group === 1);
  const obsolete = data.filter(s => s.rank_in_group > 1);

  return { best, obsolete };
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

export async function submitSolution(params: {
  galaxyId: number;
  battleId: number;
  combatStats: number;
  frUsed: number;
  notes: string;
  submittedBy: string;
  screenshot?: File;
  advancedSolution?: string;
  hazards: boolean;
  support: boolean;
}): Promise<void> {
  let screenshotUrl: string | null = null;

  if (params.screenshot) {
    const path = `${params.galaxyId}/${params.battleId}/${Date.now()}.png`;
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
    notes: params.notes,
    submitted_by: params.submittedBy,
    screenshot_url: screenshotUrl,
    advanced_solution: params.advancedSolution ?? null,
    hazards: params.hazards,
    support: params.support,
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

  localStorage.setItem('admin_label', adminLabel);
}

async function setAdminContext(): Promise<void> {
  const label = localStorage.getItem('admin_label') ?? 'unknown';
  await supabase.rpc('set_config', { key: 'app.admin_label', value: label });
}

export async function adminLogout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem('admin_label');
}
