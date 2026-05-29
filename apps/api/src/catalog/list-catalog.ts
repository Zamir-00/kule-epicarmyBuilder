import fs from 'node:fs/promises';
import path from 'node:path';
import { WAR_ROOT } from '../paths.js';

const LISTS_DIR = path.join(WAR_ROOT, 'lists');

// Minimal subset of the list catalog needed for save-time validation.
export interface CatalogSwapVariant {
  upgrade_id: number | string;
  is_default?: boolean;
}

export interface CatalogSwapSlot {
  string_id: string;
  label: string;
  variants: CatalogSwapVariant[];
}

export interface CatalogFormation {
  string_id?: string;
  swap_slots?: CatalogSwapSlot[];
  upgrades?: number[];
}

export interface CatalogUpgrade {
  id: number | string;
  string_id?: string;
}

export interface ListCatalog {
  list_id: string;
  formationsByStringId: Map<string, CatalogFormation>;
  upgradesById: Map<number | string, CatalogUpgrade>;
  upgradesByStringId: Map<string, CatalogUpgrade>;
}

const cache = new Map<string, ListCatalog | null>();

async function findFileForListId(list_id: string): Promise<string | null> {
  const entries = await fs.readdir(LISTS_DIR);
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    try {
      const body = await fs.readFile(path.join(LISTS_DIR, f), 'utf8');
      const parsed = JSON.parse(body);
      if (parsed.list_id === list_id) return path.join(LISTS_DIR, f);
    } catch { /* ignore */ }
  }
  return null;
}

export async function getListCatalog(list_id: string): Promise<ListCatalog | null> {
  if (cache.has(list_id)) return cache.get(list_id) ?? null;
  const filePath = await findFileForListId(list_id);
  if (!filePath) {
    cache.set(list_id, null);
    return null;
  }
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const upgrades: CatalogUpgrade[] = Array.isArray(parsed.upgrades) ? parsed.upgrades : [];
  const upgradesById = new Map<number | string, CatalogUpgrade>(upgrades.map((u) => [u.id, u]));
  const upgradesByStringId = new Map<string, CatalogUpgrade>(
    upgrades.filter((u) => typeof u.string_id === 'string').map((u) => [u.string_id!, u]),
  );
  const formations: CatalogFormation[] = [];
  for (const section of parsed.sections ?? []) {
    for (const f of section.formations ?? []) formations.push(f);
  }
  const formationsByStringId = new Map<string, CatalogFormation>(
    formations.filter((f) => typeof f.string_id === 'string').map((f) => [f.string_id!, f]),
  );
  const catalog: ListCatalog = { list_id, formationsByStringId, upgradesById, upgradesByStringId };
  cache.set(list_id, catalog);
  return catalog;
}

/** Test helper — reset the cache on next call. */
export function invalidateListCatalogCache(): void {
  cache.clear();
}
