import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWarRoot(): string {
  // 1. Explicit env override
  if (process.env.WAR_ROOT) {
    return path.resolve(process.env.WAR_ROOT);
  }
  // 2. Flat deploy: war/ sits next to package.json, one level up from dist/
  const flatPath = path.resolve(__dirname, '..', 'war');
  if (fs.existsSync(path.join(flatPath, 'chooser.html'))) {
    return flatPath;
  }
  // 3. Monorepo dev: war/ is three levels up from apps/api/src or apps/api/dist
  const monorepoPath = path.resolve(__dirname, '..', '..', '..', 'war');
  return monorepoPath;
}

export const WAR_ROOT = findWarRoot();

function findWebRoot(): string | null {
  if (process.env.WEB_ROOT) {
    return path.resolve(process.env.WEB_ROOT);
  }
  // Production (post-build): apps/api/dist/web/
  const distWeb = path.resolve(__dirname, 'web');
  if (fs.existsSync(path.join(distWeb, 'index.html'))) {
    return distWeb;
  }
  // Monorepo dev (running via tsx): apps/web/dist/
  const monorepoPath = path.resolve(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(path.join(monorepoPath, 'index.html'))) {
    return monorepoPath;
  }
  return null;
}

export const WEB_ROOT: string | null = findWebRoot();
