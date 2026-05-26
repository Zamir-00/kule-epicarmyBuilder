// tools/transcribe-missing-profiles.js
// Reads each gap report under docs/roadmap/stage-1/source-json-gaps/<faction>.md,
// extracts the "Missing in source-json" list, pulls the profile data from the
// corresponding JS file, transforms it to source-json shape, and appends to
// war/source-json/<faction>.json.
//
// Usage:
//   node tools/transcribe-missing-profiles.js <factionSlug>
//   node tools/transcribe-missing-profiles.js --all
//
// Transformation:
//   JS field "abilities" -> source-json field "abilities_or_notes"
//   All other profile fields (name, type, speed, armour, cc, ff, weapons) are passed through.
//   No provenance fields are added (source_section, parse_confidence, etc.).
//   No id field is added.

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'war', 'js');
const SRC_DIR = path.join(ROOT, 'war', 'source-json');
const GAPS_DIR = path.join(ROOT, 'docs', 'roadmap', 'stage-1', 'source-json-gaps');

// Map: jsFile -> list of jsFiles that must be loaded into the same sandbox first
// (matches the same map in audit-source-json-completeness.js)
const PRELOAD_DEPS = {
	'unitProfiles.viorlaTau.js': ['unitProfiles.tau.js'],
};

// ---------------------------------------------------------------------------
// Load & classify factions (reused from audit script)
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
// Execute a unitProfiles JS file in a vm sandbox (reused from audit script)
// ---------------------------------------------------------------------------
function loadFactionJs(jsPath, preloadFiles) {
	const sandbox = {
		ArmyforgeUnitProfiles: {},
		Ajax: { Request: function() {} },
		console: { warn: function() {}, log: function() {}, error: function() {} },
	};
	vm.createContext(sandbox);

	vm.runInContext('String.prototype.strip = function() { return this.trim(); };', sandbox);
	vm.runInContext('Array.prototype.member = function(v) { return this.indexOf(v) !== -1; };', sandbox);

	if (preloadFiles) {
		for (const depPath of preloadFiles) {
			vm.runInContext(fs.readFileSync(depPath, 'utf8'), sandbox);
		}
	}

	const preloadedNamespaces = new Set(Object.keys(sandbox.ArmyforgeUnitProfiles));

	const code = fs.readFileSync(jsPath, 'utf8');
	vm.runInContext(code, sandbox);
	return { armyforge: sandbox.ArmyforgeUnitProfiles, preloadedNamespaces };
}

// ---------------------------------------------------------------------------
// Find namespace(s) in ArmyforgeUnitProfiles (reused from audit script)
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
// Derive the faction slug from the jsFile name
// e.g. unitProfiles.bloodAngels.js -> bloodAngels
// ---------------------------------------------------------------------------
function factionSlugFromJsFile(jsFile) {
	return jsFile.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
}

// ---------------------------------------------------------------------------
// Parse the gap report markdown to extract missing profile names
// Returns an array of strings (profile names)
// ---------------------------------------------------------------------------
function parseMissingFromGapReport(mdPath) {
	if (!fs.existsSync(mdPath)) {
		return null; // report not found
	}

	const content = fs.readFileSync(mdPath, 'utf8');
	const lines = content.split('\n');

	// Find the "## Missing in source-json" section
	let inSection = false;
	const missing = [];

	for (const line of lines) {
		if (line.trim() === '## Missing in source-json') {
			inSection = true;
			continue;
		}
		// Stop at the next ## heading
		if (inSection && line.startsWith('## ')) {
			break;
		}
		if (inSection) {
			// Lines of the form: - `Profile Name`
			const m = line.match(/^- `(.+)`\s*$/);
			if (m) {
				missing.push(m[1]);
			}
		}
	}

	return missing;
}

// ---------------------------------------------------------------------------
// Transform a JS profile object to source-json shape
// - Rename "abilities" -> "abilities_or_notes"
// - No provenance fields
// - No id field
// ---------------------------------------------------------------------------
function transformProfile(jsProfile) {
	const result = {};

	// Core stat fields in declared order
	result.name = jsProfile.name;
	result.type = jsProfile.type;
	result.speed = jsProfile.speed;
	result.armour = jsProfile.armour;
	result.cc = jsProfile.cc;
	result.ff = jsProfile.ff;

	// Weapons: pass through as-is (each weapon has name/range/firepower/notes)
	if (Array.isArray(jsProfile.weapons)) {
		result.weapons = jsProfile.weapons.map(function(w) {
			const weapon = {};
			weapon.name = w.name;
			weapon.range = w.range;
			weapon.firepower = w.firepower;
			weapon.notes = Array.isArray(w.notes) ? w.notes.slice() : [];
			return weapon;
		});
	} else {
		result.weapons = [];
	}

	// Rename abilities -> abilities_or_notes
	if (Array.isArray(jsProfile.abilities)) {
		result.abilities_or_notes = jsProfile.abilities.slice();
	} else if (Array.isArray(jsProfile.abilities_or_notes)) {
		// Passthrough if already named correctly (unlikely but safe)
		result.abilities_or_notes = jsProfile.abilities_or_notes.slice();
	} else {
		result.abilities_or_notes = [];
	}

	return result;
}

// ---------------------------------------------------------------------------
// Load JS profiles for a faction; return a Map keyed by lowercase name
// ---------------------------------------------------------------------------
function loadJsProfilesByName(jsFile) {
	const jsPath = path.join(JS_DIR, jsFile);
	const preloadDeps = (PRELOAD_DEPS[jsFile] || []).map(dep => path.join(JS_DIR, dep));

	const { armyforge, preloadedNamespaces } = loadFactionJs(jsPath, preloadDeps);
	const namespaces = findFactionNamespaces(armyforge)
		.filter(ns => !preloadedNamespaces.has(ns.name));

	if (namespaces.length === 0) {
		throw new Error('No faction namespace found in ' + jsFile);
	}

	// Multi-namespace: same heuristic as audit script — not needed for our two pilots
	// but handled for correctness
	const ns = namespaces[0];

	const byName = new Map();
	for (const profileObj of Object.values(ns.faction.profiles)) {
		if (profileObj && profileObj.name) {
			byName.set(profileObj.name.toLowerCase(), profileObj);
		}
	}
	return byName;
}

// ---------------------------------------------------------------------------
// Transcribe missing profiles for a single faction
// Returns { transcribed, notFound }
// ---------------------------------------------------------------------------
function transcribeFaction(factionSlug, jsFile, sourceFile) {
	const mdPath = path.join(GAPS_DIR, factionSlug + '.md');
	const srcPath = path.join(SRC_DIR, sourceFile);

	// Parse gap report
	const missingNames = parseMissingFromGapReport(mdPath);
	if (missingNames === null) {
		console.error('  ERROR: gap report not found: ' + mdPath);
		return { transcribed: 0, notFound: [] };
	}
	if (missingNames.length === 0) {
		console.log('  ' + factionSlug + ': no missing profiles in gap report, nothing to do.');
		return { transcribed: 0, notFound: [] };
	}

	console.log('  ' + factionSlug + ': ' + missingNames.length + ' missing profiles listed in gap report');

	// Load JS profiles
	let jsByName;
	try {
		jsByName = loadJsProfilesByName(jsFile);
	} catch (e) {
		console.error('  ERROR loading JS profiles for ' + factionSlug + ': ' + e.message);
		return { transcribed: 0, notFound: missingNames };
	}

	// Load source-json
	if (!fs.existsSync(srcPath)) {
		console.error('  ERROR: source-json not found: ' + srcPath);
		return { transcribed: 0, notFound: missingNames };
	}

	const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
	if (!Array.isArray(srcData.profiles)) {
		console.error('  ERROR: source-json has no profiles array: ' + srcPath);
		return { transcribed: 0, notFound: missingNames };
	}

	// For each missing name: find in JS, transform, append
	const notFound = [];
	let transcribed = 0;

	for (const name of missingNames) {
		const jsProfile = jsByName.get(name.toLowerCase());
		if (!jsProfile) {
			console.warn('  WARNING: "' + name + '" listed as missing but not found in JS profiles for ' + factionSlug);
			notFound.push(name);
			continue;
		}

		const transformed = transformProfile(jsProfile);
		srcData.profiles.push(transformed);
		transcribed++;
		console.log('    + transcribed: ' + name);
	}

	// Write back with 2-space indentation and trailing newline
	fs.writeFileSync(srcPath, JSON.stringify(srcData, null, 2) + '\n', 'utf8');

	return { transcribed, notFound };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error('Usage: node tools/transcribe-missing-profiles.js <factionSlug>');
		console.error('       node tools/transcribe-missing-profiles.js --all');
		process.exit(1);
	}

	const inventory = loadInventory();
	const staticOk = inventory.filter(e => e.status === 'STATIC-OK');

	// Build lookup: slug -> { jsFile, sourceFile }
	const bySlug = new Map();
	for (const entry of staticOk) {
		const slug = factionSlugFromJsFile(entry.jsFile);
		bySlug.set(slug, { jsFile: entry.jsFile, sourceFile: entry.sourceFile });
	}

	let factionsToProcess;

	if (args[0] === '--all') {
		// Process every faction that has a non-empty gap report
		factionsToProcess = [];
		for (const [slug, info] of bySlug) {
			const mdPath = path.join(GAPS_DIR, slug + '.md');
			const missing = parseMissingFromGapReport(mdPath);
			if (missing && missing.length > 0) {
				factionsToProcess.push({ slug, ...info });
			}
		}
		console.log('--all mode: ' + factionsToProcess.length + ' factions with missing profiles');
	} else {
		// Single faction slug
		const slug = args[0];
		const info = bySlug.get(slug);
		if (!info) {
			console.error('ERROR: faction "' + slug + '" not found in STATIC-OK inventory.');
			console.error('Available slugs: ' + Array.from(bySlug.keys()).sort().join(', '));
			process.exit(1);
		}
		factionsToProcess = [{ slug, ...info }];
	}

	let totalTranscribed = 0;
	let totalNotFound = 0;

	for (const { slug, jsFile, sourceFile } of factionsToProcess) {
		const { transcribed, notFound } = transcribeFaction(slug, jsFile, sourceFile);
		totalTranscribed += transcribed;
		totalNotFound += notFound.length;
		if (notFound.length > 0) {
			console.warn('  WARNING: ' + notFound.length + ' profiles listed in gap report but not found in JS: ' + notFound.join(', '));
		}
	}

	console.log('\nDone.');
	console.log('  Profiles transcribed: ' + totalTranscribed);
	if (totalNotFound > 0) {
		console.warn('  Profiles not found in JS (check warnings above): ' + totalNotFound);
	}
}

main();
