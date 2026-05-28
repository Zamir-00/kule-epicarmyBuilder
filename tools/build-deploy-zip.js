#!/usr/bin/env node
// tools/build-deploy-zip.js
// Builds a deploy zip for GoDaddy Node.js Hosting.
// Output: deploy/kule-armybuilder.zip
//
// Structure of the zip (flat, standalone app, no monorepo):
//   package.json           (derived from apps/api/package.json + start/build scripts)
//   package-lock.json      (regenerated for the standalone deps)
//   dist/                  (pre-built compiled JS + migrations)
//   war/                   (static UI directory served by the app)

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, 'deploy', 'stage');
const OUT   = path.join(ROOT, 'deploy', 'kule-armybuilder.zip');

console.log('1/5 building apps/api (tsc + copy migrations)...');
execSync('npm run build --workspace apps/api', { cwd: ROOT, stdio: 'inherit' });

console.log('2/5 staging files...');
if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

function copy(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

// dist/ and war/ go at the staging root
copy(path.join(ROOT, 'apps', 'api', 'dist'), path.join(STAGE, 'dist'));
copy(path.join(ROOT, 'war'),                  path.join(STAGE, 'war'));

console.log('3/5 generating standalone package.json...');
const apiPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'api', 'package.json'), 'utf8'));
const deployPkg = {
  name: 'kule-armybuilder',
  version: apiPkg.version,
  private: true,
  type: apiPkg.type,
  description: 'Kule Army Builder backend',
  main: 'dist/index.js',
  scripts: {
    build: "echo 'pre-built; nothing to do'",
    start: 'node dist/index.js',
  },
  dependencies: apiPkg.dependencies,
};
fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify(deployPkg, null, 2) + '\n');

console.log('4/5 regenerating package-lock.json for standalone deps...');
execSync('npm install --package-lock-only --omit=dev', { cwd: STAGE, stdio: 'inherit' });

console.log('5/5 zipping...');
if (fs.existsSync(OUT)) fs.rmSync(OUT);
execSync(`cd "${STAGE}" && zip -rq "${OUT}" .`, { stdio: 'inherit' });

const stats = fs.statSync(OUT);
console.log(`\nWrote ${OUT} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
console.log('Upload this zip via the GoDaddy Node.js Hosting UI.');
console.log('After upload, set environment variables (NODE_ENV, SESSION_SECRET, BASE_URL,');
console.log('DATABASE_PATH, RESEND_API_KEY, EMAIL_FROM) via the platform UI, then start the app.');
