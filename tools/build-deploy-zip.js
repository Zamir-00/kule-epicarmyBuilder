#!/usr/bin/env node
// tools/build-deploy-zip.js
// Builds a zip ready to upload to GoDaddy's Setup Node.js App.
// Usage: node tools/build-deploy-zip.js
// Output: deploy/kule-armybuilder.zip

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, 'deploy', 'stage');
const OUT   = path.join(ROOT, 'deploy', 'kule-armybuilder.zip');

console.log('1/3 building apps/api...');
execSync('npm run build --workspace apps/api', { cwd: ROOT, stdio: 'inherit' });

console.log('2/3 staging files...');
if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

function copy(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

copy(path.join(ROOT, 'package.json'),      path.join(STAGE, 'package.json'));
copy(path.join(ROOT, 'package-lock.json'), path.join(STAGE, 'package-lock.json'));

fs.mkdirSync(path.join(STAGE, 'apps', 'api'), { recursive: true });
copy(path.join(ROOT, 'apps', 'api', 'package.json'), path.join(STAGE, 'apps', 'api', 'package.json'));
copy(path.join(ROOT, 'apps', 'api', 'dist'),         path.join(STAGE, 'apps', 'api', 'dist'));

copy(path.join(ROOT, 'war'), path.join(STAGE, 'war'));

console.log('3/3 zipping...');
if (fs.existsSync(OUT)) fs.rmSync(OUT);
execSync(`cd "${STAGE}" && zip -rq "${OUT}" .`, { stdio: 'inherit' });

const stats = fs.statSync(OUT);
console.log(`Wrote ${OUT} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
console.log('Upload this zip via GoDaddy cPanel > File Manager into your Node app directory,');
console.log('then in Setup Node.js App: run npm install, set startup file to apps/api/dist/index.js,');
console.log('and click Restart.');
