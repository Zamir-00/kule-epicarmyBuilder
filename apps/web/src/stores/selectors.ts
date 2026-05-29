import type { BuilderState } from './builder-store';

// Shape of war/lists/<list_id>.json
export interface CatalogList {
  list_id: string;
  faction_id?: string;
  ruleset?: string;
  sections: Array<{
    name: string;
    formations: CatalogFormation[];
  }>;
  upgrades?: CatalogUpgrade[];
}

export interface CatalogFormation {
  id?: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
  units?: string;
  upgrades?: number[];
}

export interface CatalogUpgrade {
  id: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
}

export function findFormationByStringId(catalog: CatalogList, string_id: string): CatalogFormation | null {
  for (const section of catalog.sections ?? []) {
    for (const f of section.formations ?? []) {
      if (f.string_id === string_id) return f;
    }
  }
  return null;
}

export function findUpgradeByStringId(catalog: CatalogList, string_id: string): CatalogUpgrade | null {
  return catalog.upgrades?.find((u) => u.string_id === string_id) ?? null;
}

export function totalPoints(state: BuilderState, catalog: CatalogList): number {
  let total = 0;
  for (const inst of state.formations) {
    const def = findFormationByStringId(catalog, inst.formation_string_id);
    if (!def) continue;
    total += def.cost_pts ?? def.pts ?? 0;
    for (const upgradeStringId of inst.upgrade_string_ids) {
      const u = findUpgradeByStringId(catalog, upgradeStringId);
      if (u) total += u.cost_pts ?? u.pts ?? 0;
    }
  }
  return total;
}

export function violations(state: BuilderState, catalog: CatalogList): string[] {
  const msgs: string[] = [];
  if (state.points_target != null) {
    const total = totalPoints(state, catalog);
    if (total > state.points_target) {
      msgs.push(`Over points target by ${total - state.points_target}.`);
    }
  }
  // Detailed constraint rules deferred per design spec.
  return msgs;
}
