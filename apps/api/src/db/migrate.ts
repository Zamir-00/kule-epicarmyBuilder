import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db: Db): void {
  // Resolves to apps/api/src/db/migrations OR apps/api/dist/db/migrations
  const migrationsFolder = path.resolve(__dirname, 'migrations');
  drizzleMigrate(db, { migrationsFolder });
}

// CLI entrypoint: `node --import tsx src/db/migrate.ts` or compiled `node dist/db/migrate.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { db } = await import('./client.js');
  runMigrations(db);
  console.log('Migrations complete.');
}
