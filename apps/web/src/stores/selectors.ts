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
  loadout_slots?: CatalogLoadoutSlot[];   // NEW
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

export interface CatalogLoadoutSlot {
  string_id: string;
  label: string;
  min?: number;
  max?: number;
  variants: CatalogLoadoutVariant[];
}

export interface CatalogLoadoutVariant {
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

/**
 * The default variant's upgrade.string_id for a given loadout slot. Returns null when no default exists.
 */
function loadoutDefaultStringId(catalog: CatalogList, slot: CatalogLoadoutSlot): string | null {
  const def = slot.variants.find((v) => v.is_default === true);
  if (!def) return null;
  const up = findUpgradeById(catalog, def.upgrade_id);
  return up?.string_id ?? null;
}

/**
 * Resolves the array of variant string_ids currently in the slot's positions.
 *
 * - If the saved choices contain a valid array for this slot, returns that array, replacing
 *   stale variants with the default (or dropping the position when no default is available).
 * - Otherwise returns the canonical initial state:
 *   - `[default × min]` when default exists and min is set (min >= 1)
 *   - `[]` otherwise
 *
 * Returns `null` when the slot itself doesn't exist on the formation.
 */
export function getLoadoutPositions(
  catalog: CatalogList,
  formation: CatalogFormation,
  loadout_choices: Record<string, string[]> | undefined,
  slot_string_id: string,
): string[] | null {
  const slot = formation.loadout_slots?.find((s) => s.string_id === slot_string_id);
  if (!slot) return null;
  const defaultStringId = loadoutDefaultStringId(catalog, slot);
  const saved = loadout_choices?.[slot_string_id];

  if (Array.isArray(saved)) {
    const validVariantStringIds = new Set(
      slot.variants
        .map((v) => findUpgradeById(catalog, v.upgrade_id)?.string_id)
        .filter((s): s is string => !!s),
    );
    const out: string[] = [];
    for (const p of saved) {
      if (validVariantStringIds.has(p)) {
        out.push(p);
      } else if (defaultStringId) {
        out.push(defaultStringId);
      }
      // else: drop the position
    }
    return out;
  }

  // No saved state — return canonical initial state.
  if (defaultStringId && typeof slot.min === 'number' && slot.min >= 1) {
    return Array(slot.min).fill(defaultStringId);
  }
  return [];
}

/**
 * Total pts contribution from a formation's loadout slots.
 *
 * - When a slot has a default: cost = Σ (chosen.pts − default.pts) across positions (delta semantics).
 * - When a slot has no default: cost = Σ chosen.pts across positions (absolute; formation.cost_pts
 *   does not include any baseline loadout cost for these slots).
 */
export function loadoutCostForFormation(
  catalog: CatalogList,
  formation: CatalogFormation,
  loadout_choices: Record<string, string[]> | undefined,
): number {
  let total = 0;
  for (const slot of formation.loadout_slots ?? []) {
    const positions = getLoadoutPositions(catalog, formation, loadout_choices, slot.string_id);
    if (!positions) continue;
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    const defaultUp = defaultVar ? findUpgradeById(catalog, defaultVar.upgrade_id) : null;
    const defaultPts = defaultUp ? (defaultUp.cost_pts ?? defaultUp.pts ?? 0) : 0;
    for (const p of positions) {
      const up = findUpgradeByStringId(catalog, p);
      const pts = up ? (up.cost_pts ?? up.pts ?? 0) : 0;
      total += defaultUp ? pts - defaultPts : pts;
    }
  }
  return total;
}

/**
 * Returns a new BuilderFormation with `loadout_choices` stripped to canonical form:
 * slots whose positions equal the canonical initial state are dropped from the map.
 * If the resulting map is empty, `loadout_choices` is omitted entirely.
 *
 * Used at save-time to keep persisted bodies small.
 */
export function canonicalizeLoadoutChoices<T extends { formation_string_id: string; loadout_choices?: Record<string, string[]> }>(
  catalog: CatalogList,
  instance: T,
): T {
  const def = findFormationByStringId(catalog, instance.formation_string_id);
  if (!def || !instance.loadout_choices) return instance;
  const canonical: Record<string, string[]> = {};
  for (const [slotKey, positions] of Object.entries(instance.loadout_choices)) {
    const slot = def.loadout_slots?.find((s) => s.string_id === slotKey);
    if (!slot) continue; // drop stale slots silently
    const defaultStringId = loadoutDefaultStringId(catalog, slot);
    const initialState: string[] =
      defaultStringId && typeof slot.min === 'number' && slot.min >= 1
        ? Array(slot.min).fill(defaultStringId)
        : [];
    if (positions.length === initialState.length && positions.every((p, i) => p === initialState[i])) {
      continue; // canonical, drop
    }
    canonical[slotKey] = positions;
  }
  const next = { ...instance };
  if (Object.keys(canonical).length === 0) {
    delete next.loadout_choices;
  } else {
    next.loadout_choices = canonical;
  }
  return next;
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
    total += loadoutCostForFormation(catalog, def, inst.loadout_choices);  // NEW
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
  // NEW: loadout slot min violations
  for (const inst of state.formations) {
    const def = findFormationByStringId(catalog, inst.formation_string_id);
    if (!def) continue;
    for (const slot of def.loadout_slots ?? []) {
      if (typeof slot.min !== 'number' || slot.min === 0) continue;
      const positions = getLoadoutPositions(catalog, def, inst.loadout_choices, slot.string_id);
      if (!positions) continue;
      if (positions.length < slot.min) {
        const noun = slot.min === 1 ? 'selection' : 'selections';
        msgs.push(`${def.name}: '${slot.label}' requires at least ${slot.min} ${noun} (currently ${positions.length}).`);
      }
    }
  }
  return msgs;
}
