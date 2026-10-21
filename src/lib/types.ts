export interface Solution {
  id: number;
  battle_id: string;
  galaxy_id: number;
  combat_stats: number;
  fr_used: number;
  fr_committed: number | null;
  notes: string | null;
  screenshot_url: string | null;
  advanced_solution: string | null;
  flagged: boolean;
  submitted_by: string | null;
  submitted_at: string;
  rank_in_group?: number | null;
  hazards: boolean;
  hazard_nodes: string[];
  support: boolean;
  support_nodes: string[];
  boss_alive: boolean | null;
}

export interface Galaxy {
  id: number;
  notes: string | null;
}
