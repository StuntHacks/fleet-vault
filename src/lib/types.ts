export interface Solution {
  id: number;
  battle_id: number;
  galaxy_id: number;
  combat_stats: number;
  fr_used: number;
  notes: string | null;
  screenshot_url: string | null;
  advanced_solution: string | null;
  flagged: boolean;
  submitted_by: string | null;
  submitted_at: string;
  rank_in_group?: number;
  hazards: boolean;
  support: boolean;
}

export interface Galaxy {
  id: number;
  notes: string | null;
}
