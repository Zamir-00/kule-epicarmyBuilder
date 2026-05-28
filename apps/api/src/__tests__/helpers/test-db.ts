import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import { runMigrations } from '../../db/migrate.js';

export interface TestDbHandle {
  db: BetterSQLite3Database<typeof schema>;
  close(): void;
}

export function createTestDb(): TestDbHandle {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  runMigrations(db);
  return {
    db,
    close: () => sqlite.close(),
  };
}
