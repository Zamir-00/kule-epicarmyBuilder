#!/usr/bin/env node
// tools/assign-list-ids.js
// Adds list_id, faction_id, ruleset to top-level of war/lists/*.json (top-level only),
// and string_id to formations and upgrades.
// Operates on war/lists/*.json (root only, skips subdirectories and .tmpl files).
// Usage: node tools/assign-list-ids.js

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function slugify(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Known ruleset suffixes (matched case-insensitively).
 */
const KNOWN_RULESETS = new Set(['NETEA', 'EPICUK', 'FERC', 'GW', 'ISSTVAN', 'WM']);

/**
 * Known tag prefixes that identify the faction group.
 */
const KNOWN_TAGS = new Set(['30K', '30KAU', 'AMTL', 'CHAOS', 'EL', 'IG', 'INQ', 'ORK', 'SM', 'SQ', 'XENOS']);

/**
 * Parse a list filename stem into { list_id, faction_id, ruleset }.
 * faction_id and ruleset may be undefined if parsing is ambiguous.
 */
function parseFilename(stem) {
	const list_id = stem;
	const parts = stem.split('_');

	if (parts.length < 2) {
		return { list_id };
	}

	const tag = parts[0];
	const lastToken = parts[parts.length - 1];
	const lastUpper = lastToken.toUpperCase();

	// Only recognise ruleset if the LAST token matches a known ruleset
	const hasRuleset = KNOWN_RULESETS.has(lastUpper);

	let ruleset;
	let middleParts;

	if (hasRuleset) {
		// Preserve original casing of the ruleset token but normalise to uppercase
		ruleset = lastToken.toUpperCase();
		middleParts = parts.slice(1, -1);
	} else {
		// Can't reliably identify ruleset — omit it
		middleParts = parts.slice(1);
	}

	// faction_id = middle parts joined with '-', lowercased
	const faction_id = middleParts.length > 0
		? middleParts.map(p => p.toLowerCase()).join('-')
		: undefined;

	const result = { list_id };
	if (faction_id) result.faction_id = faction_id;
	if (ruleset) result.ruleset = ruleset;
	return result;
}

/**
 * Insert fields into an object after the key `afterKey`.
 * Returns new object with all original keys preserved plus the new ones.
 * If afterKey is not found, new fields are inserted at the start.
 */
function insertAfterKey(obj, afterKey, newFields) {
	const result = {};
	let inserted = false;

	for (const k of Object.keys(obj)) {
		result[k] = obj[k];
		if (k === afterKey && !inserted) {
			for (const [nk, nv] of Object.entries(newFields)) {
				if (!(nk in obj)) {
					result[nk] = nv;
				}
			}
			inserted = true;
		}
	}

	// If afterKey not found, prepend
	if (!inserted) {
		const withNew = {};
		for (const [nk, nv] of Object.entries(newFields)) {
			if (!(nk in obj)) {
				withNew[nk] = nv;
			}
		}
		Object.assign(withNew, result);
		return withNew;
	}

	return result;
}

/**
 * Add `string_id` as FIRST key to an item object (if absent).
 * Returns the reordered object.
 */
function insertStringIdFirst(obj, string_id) {
	if ('string_id' in obj) return obj;
	const result = { string_id };
	for (const k of Object.keys(obj)) {
		result[k] = obj[k];
	}
	return result;
}

/**
 * Process an array of items (formations or upgrades), adding string_id.
 * Returns { updated, newCount, collisions }.
 */
function processListItems(items, label) {
	const seen = new Map();
	const collisions = [];
	let newCount = 0;

	const updated = items.map((item, idx) => {
		if (typeof item !== 'object' || item === null) return item;

		if (!item.name || typeof item.name !== 'string') {
			return item;
		}

		const slug = slugify(item.name);

		if (!slug) {
			console.warn(`  WARN: ${label}[${idx}] name "${item.name}" slugs to empty — skipping`);
			return item;
		}

		// Collision check
		if (seen.has(slug)) {
			const prev = seen.get(slug);
			if (prev !== item.name) {
				collisions.push({ id: slug, names: [prev, item.name] });
				return item;
			}
			// Same name, same slug: idempotent
			return item;
		}
		seen.set(slug, item.name);

		if ('string_id' in item) return item; // already set

		newCount++;
		return insertStringIdFirst(item, slug);
	});

	return { updated, newCount, collisions };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const listsDir = path.resolve(__dirname, '..', 'war', 'lists');
const files = fs.readdirSync(listsDir)
	.filter(f => f.endsWith('.json') && !f.endsWith('.tmpl'))
	.sort()
	.map(f => path.join(listsDir, f));

let totalFiles = 0;
let totalListIdAdds = 0;
let totalFormationStringIds = 0;
let totalUpgradeStringIds = 0;
let totalCollisions = 0;
let errorFiles = 0;

for (const filePath of files) {
	const fname = path.basename(filePath);
	const stem = fname.replace(/\.json$/, '');

	let raw;
	try {
		raw = fs.readFileSync(filePath, 'utf8');
	} catch (e) {
		console.error(`ERROR reading ${fname}: ${e.message}`);
		errorFiles++;
		continue;
	}

	let data;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		console.error(`ERROR parsing ${fname}: ${e.message} — skipping`);
		errorFiles++;
		continue;
	}

	const parsed = parseFilename(stem);
	const fileCollisions = [];
	let dirty = false;

	// --- top-level fields ---
	const topNew = {};
	if (!('list_id' in data)) topNew.list_id = parsed.list_id;
	if (!('faction_id' in data) && parsed.faction_id !== undefined) topNew.faction_id = parsed.faction_id;
	if (!('ruleset' in data) && parsed.ruleset !== undefined) topNew.ruleset = parsed.ruleset;

	const topNewCount = Object.keys(topNew).length;
	if (topNewCount > 0) {
		data = insertAfterKey(data, 'id', topNew);
		dirty = true;
	}

	// --- sections[].formations[] ---
	let formationStringIds = 0;
	if (Array.isArray(data.sections)) {
		const newSections = data.sections.map(section => {
			if (!Array.isArray(section.formations)) return section;
			const r = processListItems(section.formations, `sections[${section.name}].formations`);
			if (r.collisions.length) fileCollisions.push(...r.collisions.map(c => ({ ...c, in: `section "${section.name}" formations` })));
			formationStringIds += r.newCount;
			if (r.newCount > 0) {
				return { ...section, formations: r.updated };
			}
			return section;
		});
		if (formationStringIds > 0) {
			data.sections = newSections;
			dirty = true;
		}
	}

	// --- upgrades[] ---
	let upgradeStringIds = 0;
	if (Array.isArray(data.upgrades)) {
		const r = processListItems(data.upgrades, 'upgrades');
		if (r.collisions.length) fileCollisions.push(...r.collisions.map(c => ({ ...c, in: 'upgrades' })));
		upgradeStringIds += r.newCount;
		if (r.newCount > 0) {
			data.upgrades = r.updated;
			dirty = true;
		}
	}

	if (fileCollisions.length > 0) {
		console.error(`COLLISION in ${fname}:`);
		for (const c of fileCollisions) {
			console.error(`  [${c.in}] string_id="${c.id}" claimed by: ${c.names.join(' AND ')}`);
		}
		totalCollisions += fileCollisions.length;
		console.error(`  -> Skipping write for ${fname} due to collisions`);
		errorFiles++;
		continue;
	}

	totalFormationStringIds += formationStringIds;
	totalUpgradeStringIds += upgradeStringIds;
	totalListIdAdds += topNewCount;

	if (dirty) {
		const out = JSON.stringify(data, null, 2) + '\n';
		fs.writeFileSync(filePath, out, 'utf8');
		totalFiles++;
		console.log(`${fname}: +${topNewCount} top-level, +${formationStringIds} formation string_ids, +${upgradeStringIds} upgrade string_ids`);
	} else {
		console.log(`${fname}: no changes`);
	}
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`Files written: ${totalFiles}`);
console.log(`Top-level fields added (list_id/faction_id/ruleset): ${totalListIdAdds}`);
console.log(`Formation string_ids added: ${totalFormationStringIds}`);
console.log(`Upgrade string_ids added: ${totalUpgradeStringIds}`);
console.log(`Collisions detected: ${totalCollisions}`);
if (errorFiles > 0) console.error(`Files with errors/skipped: ${errorFiles}`);
if (totalCollisions > 0) process.exit(1);
