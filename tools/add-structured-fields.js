#!/usr/bin/env node
// tools/add-structured-fields.js
// Adds structured (typed) sibling fields next to existing raw-text fields in
// source-json profiles and list formations (S1.12 — additive only, idempotent).
//
// Usage:
//   node tools/add-structured-fields.js --source-json   # process war/source-json/*.json
//   node tools/add-structured-fields.js --lists          # process war/lists/*.json
//   node tools/add-structured-fields.js                  # process both

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a "save" value like "4+" → 4.
 * Returns null for non-parseable values.
 *
 * Rules:
 *  - "-", "n/a", "N/A", "", missing → null
 *  - Anything not starting with a digit → null
 *  - "4+" or "4" → 4
 *  - "5+ (4+)" — compound/annotated: extract leading int (5), LOG WARNING
 *    that parenthesised portion was ignored.
 *  - "4+/3+" — slash-separated: extract leading int (4), which is the primary value.
 */
function parseSave(raw, fieldName, profileName) {
	if (raw === undefined || raw === null) return { value: null, warning: null };
	const s = String(raw).trim();
	if (s === '' || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'none') {
		return { value: null, warning: null };
	}
	// Must start with a digit
	const m = s.match(/^(\d+)/);
	if (!m) return { value: null, warning: null };

	const num = parseInt(m[1], 10);

	// Warn if there's extra content after the leading digit pattern
	const remainder = s.slice(m[0].length).trim();
	// Acceptable: "+", "+/...", e.g. "4+", "4+/3+"
	// Warn if parenthesised annotation present, e.g. "5+ (4+)"
	let warning = null;
	if (/\(/.test(remainder)) {
		warning = `${profileName}: ${fieldName}="${raw}" has parenthesised annotation — extracted leading ${num}, ignored parens`;
	}

	return { value: num, warning };
}

/**
 * Parse speed value like "15cm" → 15.
 * Returns null for aircraft speed classes (Bomber, Fighter, etc.) and non-cm values.
 *
 * "0cm" → 0 (not null).
 * Anything not matching /^\d+\s*cm$/i → null.
 * Exceptions: Immobile, Bomber, Fighter, Fighter-Bomber, Fighter / Bomber → null.
 */
function parseSpeed(raw, profileName) {
	if (raw === undefined || raw === null) return { value: null, warning: null };
	const s = String(raw).trim();
	if (s === '' || s === '-' || s.toLowerCase() === 'n/a') {
		return { value: null, warning: null };
	}
	// Aircraft / special speed classes
	const lower = s.toLowerCase();
	if (
		lower === 'bomber' ||
		lower === 'fighter' ||
		lower === 'fighter-bomber' ||
		lower === 'fighter / bomber' ||
		lower === 'f' ||
		lower === 'b' ||
		lower === 'immobile'
	) {
		return { value: null, warning: null };
	}

	// Check for cm pattern. Accept "15cm", "15 cm", "0cm"
	const cmMatch = s.match(/^(\d+)\s*cm$/i);
	if (cmMatch) {
		return { value: parseInt(cmMatch[1], 10), warning: null };
	}

	// Annotated / compound speeds like "15cm (25cm)", "15cm (30cm)" — not pure cm
	const partialCm = s.match(/^(\d+)\s*cm\b/i);
	if (partialCm) {
		const num = parseInt(partialCm[1], 10);
		return {
			value: null,
			warning: `${profileName}: speed="${raw}" is compound — not extracting to speed_cm (would need manual review)`
		};
	}

	// Other unrecognised patterns — also null for save-style strings that
	// ended up in the speed column (e.g. "5+", "6+" found in some files)
	return { value: null, warning: null };
}

/**
 * Derive type_code from raw "type" field.
 * Pass-through: copy value verbatim (permissive). null if missing.
 */
function parseTypeCode(raw) {
	if (raw === undefined || raw === null) return null;
	const s = String(raw).trim();
	if (s === '') return null;
	return s;
}

// ---------------------------------------------------------------------------
// Object key-ordering utilities
// ---------------------------------------------------------------------------

/**
 * Build a new ordered copy of `profile` with structured siblings inserted
 * immediately after their raw counterparts.
 *
 * Sibling map: raw key → structured key
 * Processing order: iterate original keys; when we encounter a raw key whose
 * structured sibling is to be written, append both in sequence.
 */
const SIBLINGS = {
	type:   'type_code',
	armour: 'armour_save',
	cc:     'cc_target',
	ff:     'ff_target',
	speed:  'speed_cm',
};

function insertSiblings(obj, newFields) {
	// newFields: { key: value } for fields to add (value may be null)
	// We build a new object, inserting sibling right after its raw key.
	// If sibling is already present, we leave it alone (idempotent).
	const result = {};
	for (const k of Object.keys(obj)) {
		result[k] = obj[k];
		const sibKey = SIBLINGS[k];
		if (sibKey && sibKey in newFields) {
			if (!(sibKey in obj)) {
				// Not yet present — insert sibling now
				result[sibKey] = newFields[sibKey];
			}
			// If already present, we already copied it above when we hit it (or we will)
		}
	}
	// Handle any new fields whose raw key didn't appear (shouldn't happen in
	// well-formed profiles, but guard for completeness)
	for (const [k, v] of Object.entries(newFields)) {
		if (!(k in result)) {
			result[k] = v;
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Process source-json files
// ---------------------------------------------------------------------------

function processSourceJson(filePath) {
	const fname = path.basename(filePath);
	let data;
	try {
		data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (e) {
		console.error(`ERROR reading/parsing ${fname}: ${e.message}`);
		return null;
	}

	if (!Array.isArray(data.profiles) || data.profiles.length === 0) {
		return {
			fname,
			dirty: false,
			added: { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 },
			nulls: { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 },
			warnings: []
		};
	}

	const stats = {
		added:    { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 },
		nulls:    { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 },
		warnings: []
	};

	let dirty = false;

	data.profiles = data.profiles.map((profile) => {
		if (typeof profile !== 'object' || profile === null) return profile;
		const pname = profile.name || '(unnamed)';

		const newFields = {};

		// type_code
		if (!('type_code' in profile)) {
			const val = parseTypeCode(profile.type);
			newFields.type_code = val;
			stats.added.type_code++;
			if (val === null) stats.nulls.type_code++;
			dirty = true;
		}

		// armour_save
		if (!('armour_save' in profile)) {
			const { value, warning } = parseSave(profile.armour, 'armour', pname);
			newFields.armour_save = value;
			stats.added.armour_save++;
			if (value === null) stats.nulls.armour_save++;
			if (warning) stats.warnings.push(warning);
			dirty = true;
		}

		// cc_target
		if (!('cc_target' in profile)) {
			const { value, warning } = parseSave(profile.cc, 'cc', pname);
			newFields.cc_target = value;
			stats.added.cc_target++;
			if (value === null) stats.nulls.cc_target++;
			if (warning) stats.warnings.push(warning);
			dirty = true;
		}

		// ff_target
		if (!('ff_target' in profile)) {
			const { value, warning } = parseSave(profile.ff, 'ff', pname);
			newFields.ff_target = value;
			stats.added.ff_target++;
			if (value === null) stats.nulls.ff_target++;
			if (warning) stats.warnings.push(warning);
			dirty = true;
		}

		// speed_cm
		if (!('speed_cm' in profile)) {
			const { value, warning } = parseSpeed(profile.speed, pname);
			newFields.speed_cm = value;
			stats.added.speed_cm++;
			if (value === null) stats.nulls.speed_cm++;
			if (warning) stats.warnings.push(warning);
			dirty = true;
		}

		if (Object.keys(newFields).length === 0) return profile;
		return insertSiblings(profile, newFields);
	});

	if (dirty) {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
	}

	return { fname, dirty, ...stats };
}

// ---------------------------------------------------------------------------
// Process list files
// ---------------------------------------------------------------------------

/**
 * Parse cost_pts for a formation:
 *  1. numeric pts → use directly
 *  2. no pts but cost string → extract leading int
 *  3. otherwise → null (don't add)
 */
function parseCostPts(formation) {
	if ('pts' in formation) {
		const pts = formation.pts;
		if (typeof pts === 'number' && Number.isFinite(pts)) return pts;
		if (typeof pts === 'string') {
			const m = String(pts).match(/^(\d+)/);
			if (m) return parseInt(m[1], 10);
		}
	}
	if ('cost' in formation && formation.cost) {
		const m = String(formation.cost).match(/^(\d+)/);
		if (m) return parseInt(m[1], 10);
	}
	return null;
}

function processListFile(filePath) {
	const fname = path.basename(filePath);
	let data;
	try {
		data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (e) {
		console.error(`ERROR reading/parsing ${fname}: ${e.message}`);
		return null;
	}

	if (!Array.isArray(data.sections)) {
		return { fname, dirty: false, added: 0, warnings: [] };
	}

	let added = 0;
	let dirty = false;

	data.sections = data.sections.map((section) => {
		if (!Array.isArray(section.formations)) return section;
		section.formations = section.formations.map((formation) => {
			if (typeof formation !== 'object' || formation === null) return formation;
			if ('cost_pts' in formation) return formation; // idempotent

			const val = parseCostPts(formation);
			if (val === null) return formation; // nothing to derive — omit

			// Insert cost_pts after pts (if present) or after name
			const result = {};
			let placed = false;
			for (const k of Object.keys(formation)) {
				result[k] = formation[k];
				if ((k === 'pts' || (!placed && k === 'name')) && !placed) {
					// Place after pts; if pts not found, will be placed after name
					if (k === 'pts') {
						result.cost_pts = val;
						placed = true;
					}
				}
			}
			if (!placed) {
				result.cost_pts = val;
			}

			added++;
			dirty = true;
			return result;
		});
		return section;
	});

	if (dirty) {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
	}

	return { fname, dirty, added, warnings: [] };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const doSourceJson = args.length === 0 || args.includes('--source-json');
const doLists = args.length === 0 || args.includes('--lists');

const root = path.resolve(__dirname, '..', 'war');

// ---- Source-JSON ----
if (doSourceJson) {
	const srcDir = path.join(root, 'source-json');
	const files = fs.readdirSync(srcDir)
		.filter(f => f.endsWith('.json'))
		.sort()
		.map(f => path.join(srcDir, f));

	let totalAdded = { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 };
	let totalNulls  = { type_code: 0, armour_save: 0, cc_target: 0, ff_target: 0, speed_cm: 0 };
	let allWarnings = [];
	let touched = 0;

	for (const fp of files) {
		const r = processSourceJson(fp);
		if (!r) continue;
		if (r.dirty) {
			touched++;
			console.log(`${r.fname}: +type_code=${r.added.type_code} +armour_save=${r.added.armour_save} +cc_target=${r.added.cc_target} +ff_target=${r.added.ff_target} +speed_cm=${r.added.speed_cm}`);
		} else {
			console.log(`${r.fname}: no changes`);
		}
		for (const k of Object.keys(totalAdded)) {
			totalAdded[k] += r.added[k];
			totalNulls[k]  += r.nulls[k];
		}
		allWarnings.push(...r.warnings);
	}

	console.log('');
	console.log('=== SOURCE-JSON SUMMARY ===');
	console.log(`Files touched: ${touched} / ${files.length}`);
	for (const k of Object.keys(totalAdded)) {
		console.log(`  ${k}: ${totalAdded[k]} added (${totalNulls[k]} null)`);
	}
	if (allWarnings.length > 0) {
		console.log(`\n  WARNINGS (${allWarnings.length}):`);
		for (const w of allWarnings) console.log(`    WARN: ${w}`);
	} else {
		console.log('  No parse warnings.');
	}
}

// ---- Lists ----
if (doLists) {
	const listsDir = path.join(root, 'lists');
	// Known-invalid JSON files excluded per schema description
	const EXCLUDED = new Set(['EL_mymeara_NETEA.json', 'TEMPLATE.json']);
	const files = fs.readdirSync(listsDir)
		.filter(f => f.endsWith('.json') && !EXCLUDED.has(f))
		.sort()
		.map(f => path.join(listsDir, f));

	let totalAdded = 0;
	let allWarnings = [];
	let touched = 0;

	for (const fp of files) {
		const r = processListFile(fp);
		if (!r) continue;
		if (r.dirty) {
			touched++;
			console.log(`${r.fname}: +cost_pts=${r.added}`);
		} else {
			console.log(`${r.fname}: no changes`);
		}
		totalAdded += r.added;
		allWarnings.push(...r.warnings);
	}

	console.log('');
	console.log('=== LISTS SUMMARY ===');
	console.log(`Files touched: ${touched} / ${files.length}`);
	console.log(`  cost_pts added: ${totalAdded}`);
	if (allWarnings.length > 0) {
		console.log(`  WARNINGS (${allWarnings.length}):`);
		for (const w of allWarnings) console.log(`    WARN: ${w}`);
	} else {
		console.log('  No parse warnings.');
	}
}
