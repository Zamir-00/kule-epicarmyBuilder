// tools/inventory-factions.js
// Lists which war/js/unitProfiles.*.js files have a corresponding war/source-json/*.json file.
// Output goes to stdout: one line per faction, marked OK / MISSING / DYNAMIC / MIGRATED.

'use strict';

const fs = require('fs');
const path = require('path');

const jsDir = path.resolve(__dirname, '..', 'war', 'js');
const srcDir = path.resolve(__dirname, '..', 'war', 'source-json');

const jsFiles = fs.readdirSync(jsDir)
    .filter(f => f.startsWith('unitProfiles.') && f.endsWith('.js'))
    .sort();

const srcFiles = new Set(fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.json') && !f.includes('-v3.1-')));

function jsToSourceCandidates(jsName) {
    // unitProfiles.smCodexAstartes.js → space-marine-codex-astartes.json (informed guess)
    const ns = jsName.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
    const kebab = ns.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return [kebab + '.json', kebab.replace('sm-', 'space-marine-') + '.json'];
}

function readHeaderSource(jsFile) {
    const head = fs.readFileSync(path.join(jsDir, jsFile), 'utf8').split('\n').slice(0, 10);
    for (const line of head) {
        const m = line.match(/Source:\s*(?:war\/)?source-json\/([\w-]+\.json)/);
        if (m) return m[1];
    }
    return null;
}

function isDynamic(jsFile) {
    const body = fs.readFileSync(path.join(jsDir, jsFile), 'utf8');
    return /Ajax\.Request|new\s+XMLHttpRequest|fetch\(/.test(body);
}

function usesLoader(jsFile) {
    const body = fs.readFileSync(path.join(jsDir, jsFile), 'utf8');
    return /ArmyforgeUnitProfiles\.registerFaction\s*\(/.test(body);
}

for (const f of jsFiles) {
    const sourceFromHeader = readHeaderSource(f);
    let sourceFile = sourceFromHeader;
    if (!sourceFile) {
        for (const candidate of jsToSourceCandidates(f)) {
            if (srcFiles.has(candidate)) { sourceFile = candidate; break; }
        }
    }
    const ok = sourceFile && srcFiles.has(sourceFile);
    const status = usesLoader(f) ? 'MIGRATED' :
                   isDynamic(f) ? 'DYNAMIC' :
                   ok ? 'STATIC-OK' : 'STATIC-NO-SOURCE';
    console.log(`${status}\t${f}\t${sourceFile || '(none)'}`);
}
