import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema.js';
import { env } from '../env.js';

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(dbPath: string): Db {
  // Ensure the parent directory exists (handles production paths like ./data/prod.db)
  const dir = path.dirname(dbPath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

// Default singleton for production. Tests use createDb(':memory:') directly.
export const db: Db = createDb(env.DATABASE_PATH);
