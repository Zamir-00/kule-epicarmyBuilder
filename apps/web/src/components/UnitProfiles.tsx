import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  findUpgradeById,
  findUpgradeByStringId,
  getSwapChoice,
  type CatalogFormation,
  type CatalogList,
} from '@/stores/selectors';

export interface SourceWeapon {
  name: string;
  range: string;
  firepower: string;
  notes?: string[];
}

export interface SourceProfile {
  id: string;
  name: string;
  type?: string;
  speed?: string;
  armour?: string;
  cc?: string;
  ff?: string;
  weapons?: SourceWeapon[];
  abilities_or_notes?: string[];
}

export interface SourceFormation {
  id: string;
  name: string;
  units_text?: string | null;
}

export interface SourceJson {
  metadata?: { list_id?: string; army_name?: string; version?: string };
  formations?: SourceFormation[];
  profiles?: SourceProfile[];
}

/** Strip leading "Nx " count + trailing plural "s", lowercase, trim. Used by findWeaponByName
 * to match catalog upgrade names ("2x Macro Gatling Blasters") to weapon entries
 * ("Macro Gatling Blaster") regardless of count prefix or pluralization. */
function normalizeWeaponName(s: string): string {
  return s.toLowerCase().replace(/^\d+\s*x?\s+/i, '').replace(/s$/, '').trim();
}

/** Search every profile's weapons[] for a weapon whose name matches `name` after normalization.
 * Returns the first match (weapons with the same name usually have the same stats across profiles).
 * Returns null when no weapon matches — common for variants that are unit names rather than weapons. */
export function findWeaponByName(sourceJson: SourceJson | null | undefined, name: string): SourceWeapon | null {
  if (!sourceJson?.profiles) return null;
  const target = normalizeWeaponName(name);
  if (!target) return null;
  for (const p of sourceJson.profiles) {
    for (const w of p.weapons ?? []) {
      if (normalizeWeaponName(w.name) === target) return w;
    }
  }
  return null;
}

export function useSourceForList(list_id: string | null | undefined) {
  return useQuery({
    queryKey: ['source-for-list', list_id],
    queryFn: async (): Promise<SourceJson | null> => {
      if (!list_id) return null;
      const r = await fetch(`/data/source-for-list/${encodeURIComponent(list_id)}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!list_id,
    staleTime: 60 * 60_000,
  });
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(1\+|2\+|3\+|companies|company|formation|formations|retinue|retinues|squadron|squadrons|squad|squads|battery|batteries)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findSourceFormation(
  catalogName: string,
  sourceFormations: SourceFormation[] | undefined,
): SourceFormation | null {
  if (!sourceFormations || sourceFormations.length === 0) return null;
  const target = normalizeName(catalogName);
  for (const sf of sourceFormations) {
    if (normalizeName(sf.name) === target) return sf;
  }
  for (const sf of sourceFormations) {
    const n = normalizeName(sf.name);
    if (!n) continue;
    if (n.includes(target) || target.includes(n)) return sf;
  }
  return null;
}

/**
 * Strip a leading numeric count and trailing "Unit"/"Units" from an upgrade name
 * so we can match "5 Gun Servitor Unit" → "gun servitor" against prose like
 * "five Gun Servitor units".
 */
function stripCountAndUnit(name: string): string {
  return name
    .replace(/^\d+\s+/, '')        // strip leading "5 "
    .replace(/\s+Units?$/i, '')     // strip trailing " Unit" or " Units"
    .trim();
}

/**
 * Given a source-json units_text and the catalog swap state for a formation,
 * return a resolved composition string that replaces the default variant noun
 * with the chosen variant noun (when they differ).
 *
 * This makes both the "Composition:" display line and the profile-matching
 * haystack reflect the swap the user has selected.
 *
 * @param unitsText   Raw source-json units_text (e.g. "Five ... and five Gun Servitor units")
 * @param def         Catalog formation definition (for swap_slots)
 * @param catalog     Full catalog (for upgrade lookups)
 * @param swapChoices Record<slot_string_id, chosen_upgrade_string_id> from the army instance
 */
export function resolveCompositionText(
  unitsText: string | null | undefined,
  def: CatalogFormation | undefined,
  catalog: CatalogList | undefined,
  swapChoices: Record<string, string> | undefined,
): string {
  let text = unitsText ?? '';
  if (!def?.swap_slots || !catalog) return text;

  for (const slot of def.swap_slots) {
    // Resolve the default variant's upgrade name
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    if (!defaultVar) continue;
    const defaultUp = findUpgradeById(catalog, defaultVar.upgrade_id);
    if (!defaultUp) continue;

    // Resolve the chosen variant's upgrade name
    const chosenStringId = getSwapChoice(catalog, def, swapChoices, slot.string_id);
    if (!chosenStringId) continue;
    const chosenUp = findUpgradeByStringId(catalog, chosenStringId);
    if (!chosenUp) continue;

    // If chosen is the default, nothing to substitute
    if (defaultUp.string_id === chosenUp.string_id) continue;

    const defaultNoun = stripCountAndUnit(defaultUp.name);
    const chosenNoun = stripCountAndUnit(chosenUp.name);

    if (!defaultNoun) continue;

    // Try a case-insensitive substring replace of the default noun in the text.
    // We also strip trailing "Unit(s)" from the haystack when matching so that
    // "Gun Servitor" matches "Gun Servitor units" in the prose.
    const escapedDefault = defaultNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escapedDefault + '(?:\\s+Units?)?', 'gi');
    const replaced = text.replace(pattern, chosenNoun);

    if (replaced !== text) {
      text = replaced;
    } else {
      // Fallback: the prose phrasing doesn't match our simple substitution
      // (e.g. source-json uses a completely different description).
      // Append the chosen noun so profile matching still works.
      text = `${text} ${chosenNoun}`;
    }
  }

  return text;
}

export function findProfilesForFormation(
  formationName: string,
  unitsText: string | null | undefined,
  profiles: SourceProfile[] | undefined,
): SourceProfile[] {
  if (!profiles || profiles.length === 0) return [];
  const haystack = `${unitsText ?? ''} ${formationName}`.toLowerCase();
  const seen = new Set<string>();
  const matches: SourceProfile[] = [];
  // Match longer names first so we don't dedupe by a short substring of another.
  const sorted = [...profiles].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const n = p.name.toLowerCase();
    if (!n || n.length < 3) continue;
    if (haystack.includes(n) && !seen.has(p.id)) {
      seen.add(p.id);
      matches.push(p);
    }
  }
  // Preserve original profiles[] order in output, not the length-sorted order.
  return profiles.filter((p) => seen.has(p.id));
}

function UnitProfileCard({ profile }: { profile: SourceProfile }) {
  const [open, setOpen] = useState(false);
  const stat = (label: string, value?: string) =>
    value && value !== 'n/a' ? <span><span className="text-muted-foreground">{label}</span> {value}</span> : null;
  // The statline div is always rendered; visibility is controlled by class.
  // `print:block` forces it open when printing so PDFs include every profile.
  return (
    <li className="rounded-md border bg-background break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40 print:hidden"
      >
        <span className="font-medium">{profile.name}</span>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>
      <p className="hidden px-3 py-2 text-sm font-medium print:block">{profile.name}</p>
      <div className={`${open ? '' : 'hidden'} space-y-2 border-t px-3 py-2 text-xs print:block`}>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {stat('Type', profile.type)}
            {stat('Speed', profile.speed)}
            {stat('Armour', profile.armour)}
            {stat('CC', profile.cc)}
            {stat('FF', profile.ff)}
          </p>
          {profile.weapons && profile.weapons.length > 0 && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pr-2 font-normal">Weapon</th>
                  <th className="pr-2 font-normal">Range</th>
                  <th className="font-normal">Firepower</th>
                </tr>
              </thead>
              <tbody>
                {profile.weapons.map((w, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="pr-2">{w.name}</td>
                    <td className="pr-2">{w.range}</td>
                    <td>
                      {w.firepower}
                      {w.notes && w.notes.length > 0 && (
                        <span className="text-muted-foreground"> ({w.notes.join(', ')})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {profile.abilities_or_notes && profile.abilities_or_notes.length > 0 && (
            <p>
              <span className="text-muted-foreground">Abilities:</span>{' '}
              {profile.abilities_or_notes.join(', ')}
            </p>
          )}
        </div>
    </li>
  );
}

export function FormationProfiles({
  formationName,
  sourceJson,
  def,
  catalog,
  swapChoices,
}: {
  formationName: string;
  sourceJson: SourceJson | null | undefined;
  /** Optional: catalog formation definition for swap-slot-aware composition text. */
  def?: CatalogFormation;
  /** Optional: full catalog for upgrade lookups. */
  catalog?: CatalogList;
  /** Optional: the instance's swap_choices so composition reflects the user's selection. */
  swapChoices?: Record<string, string>;
}) {
  if (!sourceJson) return null;
  const sourceFormation = findSourceFormation(formationName, sourceJson.formations);

  // Resolve the composition text, substituting the chosen swap variant name(s)
  // in place of the default variant name(s) when the user has made a non-default selection.
  const resolvedUnitsText = resolveCompositionText(
    sourceFormation?.units_text,
    def,
    catalog,
    swapChoices,
  );

  const profiles = findProfilesForFormation(
    formationName,
    resolvedUnitsText || null,
    sourceJson.profiles,
  );
  if (!resolvedUnitsText && profiles.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t pt-2">
      {resolvedUnitsText && (
        <p className="text-xs italic text-muted-foreground">
          Composition: {resolvedUnitsText}
        </p>
      )}
      {profiles.length > 0 && (
        <ul className="space-y-1">
          {profiles.map((p) => (
            <UnitProfileCard key={p.id} profile={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
