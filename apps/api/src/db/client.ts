import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { env } from '../env.js';

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(path: string): Db {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

// Default singleton for production. Tests use createDb(':memory:') directly.
export const db: Db = createDb(env.DATABASE_PATH);
