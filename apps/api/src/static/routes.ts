import type { FastifyInstance, FastifyReply } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { WAR_ROOT } from '../paths.js';

const SOURCE_JSON_DIR = path.join(WAR_ROOT, 'source-json');
const LISTS_DIR = path.join(WAR_ROOT, 'lists');

// Validates a single-segment filename like "death-guard.json".
// Rejects anything with path separators or traversal.
function safeFilename(name: string): string | null {
  if (!name) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return null;
  if (name.startsWith('.') || name === '..' || name === '.') return null;
  if (!name.endsWith('.json')) return null;
  return name;
}

async function serveJsonFile(filename: string, dir: string, reply: FastifyReply): Promise<void> {
  const filePath = path.join(dir, filename);
  // Resolved-path guard: even after safeFilename, double-check the resolved path is under dir.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    reply.code(404).send({ error: 'not found' });
    return;
  }
  try {
    const body = await fs.readFile(resolved, 'utf8');
    // Validate it's JSON before sending — avoids serving a corrupted file as application/json
    try {
      JSON.parse(body);
    } catch {
      reply.code(500).send({ error: 'invalid json on disk' });
      return;
    }
    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .send(body);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      reply.code(404).send({ error: 'not found' });
    } else {
      reply.code(500).send({ error: 'read failed' });
    }
  }
}

export async function registerStaticRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { file: string } }>('/data/source-json/:file', async (req, reply) => {
    const filename = safeFilename(req.params.file);
    if (!filename) {
      reply.code(400).send({ error: 'invalid filename' });
      return;
    }
    await serveJsonFile(filename, SOURCE_JSON_DIR, reply);
  });

  app.get('/data/lists', async (_req, reply) => {
    const index = await buildListsIndex();
    reply.header('Cache-Control', 'public, max-age=60').send(index);
  });

  app.get<{ Params: { file: string } }>('/data/lists/:file', async (req, reply) => {
    const filename = safeFilename(req.params.file);
    if (!filename) {
      reply.code(400).send({ error: 'invalid filename' });
      return;
    }
    await serveJsonFile(filename, LISTS_DIR, reply);
  });

  app.get('/data/factions', async (_req, reply) => {
    const inventory = await buildFactionInventory();
    reply
      .header('Cache-Control', 'public, max-age=60')
      .send(inventory);
  });
}

interface ListIndexEntry {
  list_id: string;
  faction_id?: string;
  faction_group: string;
  ruleset?: string;
  version?: string;
  by?: string;
  display_name?: string;
}

// Maps the first underscore-separated token of list_id to a human-readable
// parent-faction label. The legacy war/index*.html nav pages group lists by
// these same buckets; this map is the data-driven equivalent.
const FACTION_GROUP_BY_PREFIX: Record<string, string> = {
  SM: 'Space Marines',
  IG: 'Imperial Guard',
  CHAOS: 'Chaos',
  EL: 'Eldar',
  XENOS: 'Xenos',
  ORK: 'Orks',
  AMTL: 'Adeptus Mechanicus',
  INQ: 'Inquisition',
  '30K': 'Horus Heresy',
  SQ: 'Squats',
};

export function factionGroupFor(list_id: string): string {
  const prefix = list_id.split('_', 1)[0] ?? '';
  return FACTION_GROUP_BY_PREFIX[prefix] ?? 'Other';
}

let listsIndexCache: ListIndexEntry[] | null = null;
let listsIndexCacheAt = 0;
const LISTS_INDEX_TTL_MS = 60_000;

async function buildListsIndex(): Promise<ListIndexEntry[]> {
  if (listsIndexCache && Date.now() - listsIndexCacheAt < LISTS_INDEX_TTL_MS) return listsIndexCache;

  const entries: ListIndexEntry[] = [];
  const files = await fs.readdir(LISTS_DIR);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const body = await fs.readFile(path.join(LISTS_DIR, f), 'utf8');
      const parsed = JSON.parse(body);
      if (typeof parsed.list_id !== 'string' || !parsed.list_id) continue;
      entries.push({
        list_id: parsed.list_id,
        faction_id: typeof parsed.faction_id === 'string' ? parsed.faction_id : undefined,
        faction_group: factionGroupFor(parsed.list_id),
        ruleset: typeof parsed.ruleset === 'string' ? parsed.ruleset : undefined,
        version: typeof parsed.version === 'string' ? parsed.version : undefined,
        by: typeof parsed.by === 'string' ? parsed.by : undefined,
        display_name: typeof parsed.id === 'string' ? parsed.id : undefined,
      });
    } catch {
      // skip unparseable files
    }
  }
  listsIndexCache = entries.sort((a, b) => a.list_id.localeCompare(b.list_id));
  listsIndexCacheAt = Date.now();
  return listsIndexCache;
}

interface FactionEntry {
  slug: string;
  js_file: string | null;
  source_json: string | null;
  status: 'MIGRATED' | 'DYNAMIC' | 'STATIC-OK' | 'STATIC-NO-SOURCE';
}

let inventoryCache: FactionEntry[] | null = null;
let inventoryCacheAt = 0;
const INVENTORY_TTL_MS = 60_000;

async function buildFactionInventory(): Promise<FactionEntry[]> {
  if (inventoryCache && Date.now() - inventoryCacheAt < INVENTORY_TTL_MS) return inventoryCache;

  const jsDir = path.join(WAR_ROOT, 'js');
  const srcDir = SOURCE_JSON_DIR;

  const jsFiles = (await fs.readdir(jsDir))
    .filter(f => f.startsWith('unitProfiles.') && f.endsWith('.js'))
    .sort();
  const srcFiles = new Set(
    (await fs.readdir(srcDir))
      .filter(f => f.endsWith('.json') && !f.includes('-v3.1-'))
  );

  function jsToSourceCandidates(jsName: string): string[] {
    const ns = jsName.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
    const kebab = ns.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return [kebab + '.json', kebab.replace('sm-', 'space-marine-') + '.json'];
  }

  async function readHeaderSource(jsFile: string): Promise<string | null> {
    const body = await fs.readFile(path.join(jsDir, jsFile), 'utf8');
    const head = body.split('\n').slice(0, 10).join('\n');
    const m = head.match(/Source:\s*(?:war\/)?source-json\/([\w-]+\.json)/);
    return m ? (m[1] ?? null) : null;
  }

  async function isDynamic(jsFile: string): Promise<boolean> {
    const body = await fs.readFile(path.join(jsDir, jsFile), 'utf8');
    return /Ajax\.Request|new\s+XMLHttpRequest|fetch\(/.test(body);
  }

  async function usesLoader(jsFile: string): Promise<boolean> {
    const body = await fs.readFile(path.join(jsDir, jsFile), 'utf8');
    return /ArmyforgeUnitProfiles\.registerFaction\s*\(/.test(body);
  }

  const entries: FactionEntry[] = [];
  for (const f of jsFiles) {
    const sourceFromHeader = await readHeaderSource(f);
    let sourceFile: string | null = sourceFromHeader;
    if (!sourceFile) {
      for (const candidate of jsToSourceCandidates(f)) {
        if (srcFiles.has(candidate)) {
          sourceFile = candidate;
          break;
        }
      }
    }
    const ok = sourceFile != null && srcFiles.has(sourceFile);
    const slug = f.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
    let status: FactionEntry['status'];
    if (await usesLoader(f)) status = 'MIGRATED';
    else if (await isDynamic(f)) status = 'DYNAMIC';
    else if (ok) status = 'STATIC-OK';
    else status = 'STATIC-NO-SOURCE';

    entries.push({ slug, js_file: f, source_json: sourceFile, status });
  }

  inventoryCache = entries;
  inventoryCacheAt = Date.now();
  return entries;
}
