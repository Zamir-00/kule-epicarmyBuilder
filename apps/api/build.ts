import { execSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

execSync('tsc', { stdio: 'inherit' });
if (existsSync('src/db/migrations')) {
  cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
  console.log('Copied migrations to dist/');
}
