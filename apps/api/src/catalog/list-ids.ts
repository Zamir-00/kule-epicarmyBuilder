import fs from 'node:fs/promises';
import path from 'node:path';
import { WAR_ROOT } from '../paths.js';

const LISTS_DIR = path.join(WAR_ROOT, 'lists');

let cachedListIds: Set<string> | null = null;

/** Loads the set of valid list_ids from war/lists/*.json. Cached after first call.
 * In production, list files don't change at runtime, so a process-lifetime cache is fine.
 * Tests can call invalidateListIdCache() to reset. */
export async function getValidListIds(): Promise<Set<string>> {
  if (cachedListIds) return cachedListIds;

  const result = new Set<string>();
  const entries = await fs.readdir(LISTS_DIR);
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;       // skip TEMPLATE.json.tmpl and other non-json
    try {
      const body = await fs.readFile(path.join(LISTS_DIR, f), 'utf8');
      const parsed = JSON.parse(body);
      if (typeof parsed.list_id === 'string' && parsed.list_id.length > 0) {
        result.add(parsed.list_id);
      }
    } catch {
      // Skip files that fail to parse (e.g. malformed legacy files); don't crash startup
    }
  }
  cachedListIds = result;
  return result;
}

/** For tests — reload from disk on next call. */
export function invalidateListIdCache(): void {
  cachedListIds = null;
}
