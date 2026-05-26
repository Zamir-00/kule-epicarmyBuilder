// tools/audit-source-json-completeness.js
// For each STATIC-OK faction (as classified by tools/inventory-factions.js):
//   - Loads the hardcoded profiles:{} literal from war/js/unitProfiles.<faction>.js via vm sandbox
//   - Loads war/source-json/<faction>.json
//   - Compares profile names (case-insensitive)
//   - Writes docs/roadmap/stage-1/source-json-gaps/<faction-slug>.md
// Also writes a summary README.md in that directory.
//
// NOTE: The Prototype.js polyfills (String.prototype.strip, Array.prototype.member)
// are injected into each vm sandbox context. This keeps the host process prototype
// chain clean. Each vm context has its own primitive wrappers, so the polyfills
// must be added there rather than (or in addition to) the host prototype.
//
// NOTE: viorlaTau.js calls ArmyforgeUnitProfiles.createXenosProfileSet(), which is
// defined in tau.js. The sandbox pre-loading map below handles this dependency.

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'war', 'js');
const SRC_DIR = path.join(ROOT, 'war', 'source-json');
const OUT_DIR = path.join(ROOT, 'docs', 'roadmap', 'stage-1', 'source-json-gaps');

// Map: jsFile -> list of jsFiles that must be loaded into the same sandbox first
// (inter-file dependencies for STATIC-OK faction files)
const PRELOAD_DEPS = {
	'unitProfiles.viorlaTau.js': ['unitProfiles.tau.js'],
};

// ---------------------------------------------------------------------------
// Load & classify factions by spawning inventory-factions.js
// ---------------------------------------------------------------------------
function loadInventory() {
	const inventoryScript = path.join(__dirname, 'inventory-factions.js');
	const output = execSync('node ' + JSON.stringify(inventoryScript), { encoding: 'utf8' });
	const entries = [];
	for (const line of output.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parts = trimmed.split('\t');
		if (parts.length < 3) continue;
		const [status, jsFile, sourceFile] = parts;
		entries.push({ status, jsFile, sourceFile });
	}
	return entries;
}

// ---------------------------------------------------------------------------
// Execute a unitProfiles JS file in a vm sandbox and return:
//   { armyforge, preloadedNamespaces }
// preloadFiles is an optional array of JS file paths to load into the sandbox
// first (to satisfy inter-file dependencies).
// preloadedNamespaces is the set of namespace keys that existed BEFORE the
// target file was loaded — caller uses this to filter out pre-loaded namespaces
// from findFactionNamespaces() results.
// ---------------------------------------------------------------------------
function loadFactionJs(jsPath, preloadFiles) {
	const sandbox = {
		ArmyforgeUnitProfiles: {},
		Ajax: { Request: function() {} },
		console: { warn: function() {}, log: function() {}, error: function() {} },
	};
	vm.createContext(sandbox);

	// Polyfills for Prototype.js methods — must be injected into the vm context
	// because each vm context has its own String/Array primitives.
	vm.runInContext('String.prototype.strip = function() { return this.trim(); };', sandbox);
	vm.runInContext('Array.prototype.member = function(v) { return this.indexOf(v) !== -1; };', sandbox);

	// Pre-load dependency files (e.g. tau.js before viorlaTau.js)
	if (preloadFiles) {
		for (const depPath of preloadFiles) {
			vm.runInContext(fs.readFileSync(depPath, 'utf8'), sandbox);
		}
	}

	// Capture which namespaces came from pre-loaded deps so we can ignore them later
	const preloadedNamespaces = new Set(Object.keys(sandbox.ArmyforgeUnitProfiles));

	const code = fs.readFileSync(jsPath, 'utf8');
	vm.runInContext(code, sandbox);
	return { armyforge: sandbox.ArmyforgeUnitProfiles, preloadedNamespaces };
}

// ---------------------------------------------------------------------------
// Find namespace(s) in ArmyforgeUnitProfiles that look like faction objects.
// Most files use armyIds (array), but some older files use armyId (string).
// We accept both.
// ---------------------------------------------------------------------------
function findFactionNamespaces(armyforge) {
	const found = [];
	for (const key of Object.keys(armyforge)) {
		const v = armyforge[key];
		if (v && typeof v === 'object' && v.profiles && (v.armyIds || v.armyId)) {
			found.push({ name: key, faction: v });
		}
	}
	return found;
}

// ---------------------------------------------------------------------------
// Extract profile display names from source-json profiles map
// source-json profiles values are objects with a .name string
// ---------------------------------------------------------------------------
function sourceJsonProfileNames(profiles) {
	const names = [];
	for (const key of Object.keys(profiles)) {
		const entry = profiles[key];
		if (entry && typeof entry === 'object' && entry.name) {
			names.push(entry.name);
		} else if (typeof entry === 'string') {
			names.push(entry);
		} else {
			// Fallback: use the key itself
			names.push(key);
		}
	}
	return names;
}

// ---------------------------------------------------------------------------
// Build the set intersection/difference given two name arrays
// Comparison is case-insensitive
// ---------------------------------------------------------------------------
function compareProfiles(jsNames, srcNames) {
	const jsLower = new Map(jsNames.map(n => [n.toLowerCase(), n]));
	const srcLower = new Map(srcNames.map(n => [n.toLowerCase(), n]));

	const shared = [];
	const missingInSourceJson = [];
	const missingInJs = [];

	for (const [lc, orig] of jsLower) {
		if (srcLower.has(lc)) {
			shared.push(orig);
		} else {
			missingInSourceJson.push(orig);
		}
	}
	for (const [lc, orig] of srcLower) {
		if (!jsLower.has(lc)) {
			missingInJs.push(orig);
		}
	}

	// Sort for stable output
	shared.sort((a, b) => a.localeCompare(b));
	missingInSourceJson.sort((a, b) => a.localeCompare(b));
	missingInJs.sort((a, b) => a.localeCompare(b));

	return { shared, missingInSourceJson, missingInJs };
}

// ---------------------------------------------------------------------------
// Build Markdown for a single faction report
// ---------------------------------------------------------------------------
function buildFactionReport(opts) {
	const {
		factionSlug,
		jsFile,
		sourceJsonFile,
		jsProfileNames,
		srcProfileNames,
		shared,
		missingInSourceJson,
		missingInJs,
		errorMessage,
	} = opts;

	if (errorMessage) {
		return [
			'# Source-JSON gap report: ' + factionSlug,
			'',
			'**ERROR loading faction data:**',
			'',
			'```',
			errorMessage,
			'```',
			'',
			'Unable to produce completeness data for this faction.',
			'',
		].join('\n');
	}

	const jsCount = jsProfileNames.length;
	const srcCount = srcProfileNames.length;
	const sharedCount = shared.length;
	const missingInSrcCount = missingInSourceJson.length;
	const missingInJsCount = missingInJs.length;

	const lines = [
		'# Source-JSON gap report: ' + factionSlug,
		'',
		'**JS file:** `war/js/' + jsFile + '`',
		'**Source-JSON file:** `war/source-json/' + sourceJsonFile + '`',
		'',
		'| Metric | Count |',
		'|---|---|',
		'| JS profiles | ' + jsCount + ' |',
		'| Source-JSON profiles | ' + srcCount + ' |',
		'| Shared (by name, case-insensitive) | ' + sharedCount + ' |',
		'| **Missing in source-json (needs transcription)** | **' + missingInSrcCount + '** |',
		'| Missing in JS (informational) | ' + missingInJsCount + ' |',
		'',
		'## Missing in source-json',
		'',
		'These profiles exist in the JS literal but not in source-json. They need to be transcribed into source-json (Phase 2 of S1.4).',
		'',
	];

	if (missingInSourceJson.length === 0) {
		lines.push('_(none — source-json appears complete for this faction)_');
	} else {
		for (const name of missingInSourceJson) {
			lines.push('- `' + name + '`');
		}
	}

	lines.push('');
	lines.push('## Missing in JS (informational)');
	lines.push('');
	lines.push('These profiles exist in source-json but not in JS. Usually fine; may indicate source-json has more units than the UI currently exposes.');
	lines.push('');

	if (missingInJs.length === 0) {
		lines.push('_(none)_');
	} else {
		for (const name of missingInJs) {
			lines.push('- `' + name + '`');
		}
	}

	lines.push('');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Build summary README
// ---------------------------------------------------------------------------
function buildSummaryReadme(rows) {
	const totalMissing = rows.reduce((sum, r) => sum + (r.missingInSrcCount || 0), 0);

	const lines = [
		'# Source-JSON completeness audit summary',
		'',
		'Generated by `tools/audit-source-json-completeness.js`. See per-faction reports in this directory for details.',
		'',
		'| Faction | JS profiles | source-JSON profiles | Missing in source-JSON | Missing in JS |',
		'|---|---:|---:|---:|---:|',
	];

	for (const r of rows) {
		if (r.error) {
			lines.push('| ' + r.factionSlug + ' | ERROR | ERROR | ERROR | ERROR |');
		} else {
			lines.push(
				'| ' + r.factionSlug +
				' | ' + r.jsCount +
				' | ' + r.srcCount +
				' | ' + r.missingInSrcCount +
				' | ' + r.missingInJsCount + ' |'
			);
		}
	}

	lines.push('');
	lines.push('**Total profiles missing in source-JSON across all STATIC-OK factions: ' + totalMissing + '**');
	lines.push('');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Derive the kebab-slug for the output filename from the jsFile name
// e.g. unitProfiles.bloodAngels.js -> bloodAngels
// ---------------------------------------------------------------------------
function factionSlugFromJsFile(jsFile) {
	return jsFile.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
	fs.mkdirSync(OUT_DIR, { recursive: true });

	const inventory = loadInventory();
	const staticOk = inventory.filter(e => e.status === 'STATIC-OK');

	console.log('Processing ' + staticOk.length + ' STATIC-OK factions...');

	const summaryRows = [];

	for (const entry of staticOk) {
		const { jsFile, sourceFile } = entry;
		const factionSlug = factionSlugFromJsFile(jsFile);
		const jsPath = path.join(JS_DIR, jsFile);
		const srcPath = path.join(SRC_DIR, sourceFile);
		const outPath = path.join(OUT_DIR, factionSlug + '.md');

		console.log('  ' + factionSlug + '...');

		// --- Load JS profiles ---
		let jsProfileNames = [];
		let jsError = null;
		let namespaceCount = 0;
		let primaryNamespace = null;

		const preloadDeps = (PRELOAD_DEPS[jsFile] || []).map(dep => path.join(JS_DIR, dep));

		try {
			const { armyforge, preloadedNamespaces } = loadFactionJs(jsPath, preloadDeps);
			// Filter out namespaces that came from pre-loaded dependency files
			const namespaces = findFactionNamespaces(armyforge)
				.filter(ns => !preloadedNamespaces.has(ns.name));
			namespaceCount = namespaces.length;

			if (namespaceCount === 0) {
				jsError = 'No faction namespace found in ' + jsFile + ' (no object with armyIds + profiles)';
			} else if (namespaceCount > 1) {
				// Multi-namespace: use the one whose armyIds is most likely to match the sourceFile
				// Heuristic: pick the first one whose namespace key (lowercased kebab) appears in sourceFile
				const srcBase = sourceFile.replace('.json', '');
				let chosen = null;
				for (const ns of namespaces) {
					const nsKebab = ns.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
					if (srcBase.includes(nsKebab) || nsKebab.includes(srcBase.replace(/-/g, ''))) {
						chosen = ns;
						break;
					}
				}
				if (!chosen) chosen = namespaces[0];
				primaryNamespace = chosen;
				console.log('    NOTICE: ' + namespaceCount + ' namespaces found in ' + jsFile +
					'; using "' + chosen.name + '" to match ' + sourceFile +
					' (others: ' + namespaces.filter(n => n !== chosen).map(n => n.name).join(', ') + ')');
				jsProfileNames = Object.values(chosen.faction.profiles).map(p => p.name || '').filter(Boolean);
			} else {
				primaryNamespace = namespaces[0];
				jsProfileNames = Object.values(primaryNamespace.faction.profiles).map(p => p.name || '').filter(Boolean);
			}
		} catch (e) {
			jsError = e.message;
			console.error('    ERROR loading JS: ' + e.message);
		}

		// --- Load source-json profiles ---
		let srcProfileNames = [];
		let srcError = null;

		try {
			const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
			if (srcData.profiles) {
				srcProfileNames = sourceJsonProfileNames(srcData.profiles);
			} else {
				srcError = 'No "profiles" key found in ' + sourceFile;
				console.error('    ERROR: ' + srcError);
			}
		} catch (e) {
			srcError = e.message;
			console.error('    ERROR loading source-json: ' + e.message);
		}

		// --- Compare ---
		const errorMessage = jsError || srcError || null;
		let comparison = { shared: [], missingInSourceJson: [], missingInJs: [] };
		if (!errorMessage) {
			comparison = compareProfiles(jsProfileNames, srcProfileNames);
		}

		// --- Write per-faction report ---
		const report = buildFactionReport({
			factionSlug,
			jsFile,
			sourceJsonFile: sourceFile,
			jsProfileNames,
			srcProfileNames,
			shared: comparison.shared,
			missingInSourceJson: comparison.missingInSourceJson,
			missingInJs: comparison.missingInJs,
			errorMessage,
		});
		fs.writeFileSync(outPath, report, 'utf8');

		// --- Accumulate summary row ---
		if (errorMessage) {
			summaryRows.push({ factionSlug, error: true });
		} else {
			summaryRows.push({
				factionSlug,
				jsCount: jsProfileNames.length,
				srcCount: srcProfileNames.length,
				missingInSrcCount: comparison.missingInSourceJson.length,
				missingInJsCount: comparison.missingInJs.length,
				error: false,
			});
		}
	}

	// --- Write summary README ---
	const readmePath = path.join(OUT_DIR, 'README.md');
	const readme = buildSummaryReadme(summaryRows);
	fs.writeFileSync(readmePath, readme, 'utf8');

	const totalMissing = summaryRows.reduce((sum, r) => sum + (r.missingInSrcCount || 0), 0);
	console.log('\nDone. Reports written to: ' + OUT_DIR);
	console.log('Total profiles missing in source-JSON: ' + totalMissing);
}

main();
