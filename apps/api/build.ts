import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

execSync('tsc', { stdio: 'inherit' });

const migrationsSrc = path.join(__dirname, 'src/db/migrations');
const migrationsDest = path.join(__dirname, 'dist/db/migrations');
if (existsSync(migrationsSrc)) {
  cpSync(migrationsSrc, migrationsDest, { recursive: true });
  console.log('Copied migrations to dist/db/migrations');
}

// Copy apps/web/dist into apps/api/dist/web (if it exists).
const webSrc = path.resolve(__dirname, '..', 'web', 'dist');
const webDest = path.join(__dirname, 'dist', 'web');
if (existsSync(webSrc)) {
  if (existsSync(webDest)) rmSync(webDest, { recursive: true, force: true });
  cpSync(webSrc, webDest, { recursive: true });
  console.log('Copied apps/web/dist to apps/api/dist/web');
} else {
  console.warn('apps/web/dist not found — /v2 routes will not work until you build apps/web first.');
}
