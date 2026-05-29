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
  swap_slots?: CatalogSwapSlot[];
}

export interface CatalogUpgrade {
  id: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
}

export interface CatalogSwapSlot {
  string_id: string;
  label: string;
  variants: CatalogSwapVariant[];
}

export interface CatalogSwapVariant {
  upgrade_id: number | string;
  is_default?: boolean;
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

export function findUpgradeById(catalog: CatalogList, id: number | string): CatalogUpgrade | null {
  return catalog.upgrades?.find((u) => u.id === id) ?? null;
}

/** The default variant's upgrade.string_id for a given slot. Returns null if the slot has no default (data error). */
function defaultVariantStringId(catalog: CatalogList, slot: CatalogSwapSlot): string | null {
  const def = slot.variants.find((v) => v.is_default === true);
  if (!def) return null;
  const up = findUpgradeById(catalog, def.upgrade_id);
  return up?.string_id ?? null;
}

/**
 * Resolves the chosen variant for a swap slot.
 * - If the saved choice references a still-valid variant, returns it.
 * - Otherwise falls back to the slot's default (catalog drift, missing key, etc.).
 */
export function getSwapChoice(
  catalog: CatalogList,
  formation: CatalogFormation,
  swap_choices: Record<string, string> | undefined,
  slot_string_id: string,
): string | null {
  const slot = formation.swap_slots?.find((s) => s.string_id === slot_string_id);
  if (!slot) return null;
  const chosen = swap_choices?.[slot_string_id];
  if (chosen) {
    // Verify the chosen value still maps to a variant in this slot
    const stillValid = slot.variants.some((v) => {
      const up = findUpgradeById(catalog, v.upgrade_id);
      return up?.string_id === chosen;
    });
    if (stillValid) return chosen;
  }
  return defaultVariantStringId(catalog, slot);
}

/**
 * Total pts delta from swap-slot choices on a formation.
 * delta = Σ (chosen.pts − default.pts) across slots.
 */
export function swapDeltaForFormation(
  catalog: CatalogList,
  formation: CatalogFormation,
  swap_choices: Record<string, string> | undefined,
): number {
  let delta = 0;
  for (const slot of formation.swap_slots ?? []) {
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    if (!defaultVar) continue;
    const defaultUp = findUpgradeById(catalog, defaultVar.upgrade_id);
    const defaultPts = defaultUp?.cost_pts ?? defaultUp?.pts ?? 0;

    const chosenStringId = getSwapChoice(catalog, formation, swap_choices, slot.string_id);
    if (!chosenStringId) continue;
    const chosenUp = findUpgradeByStringId(catalog, chosenStringId);
    const chosenPts = chosenUp?.cost_pts ?? chosenUp?.pts ?? 0;

    delta += chosenPts - defaultPts;
  }
  return delta;
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
    total += swapDeltaForFormation(catalog, def, inst.swap_choices);
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
  return msgs;
}
