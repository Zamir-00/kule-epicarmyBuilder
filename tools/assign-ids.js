#!/usr/bin/env node
// tools/assign-ids.js
// Adds stable `id` fields to profiles[], formations[], and special_rules[]
// in war/source-json/*.json files (additive only — existing fields untouched).
// Usage: node tools/assign-ids.js

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
 * Insert `id` as the FIRST key of an object (only if absent).
 * Returns the reordered object (new object reference).
 */
function insertIdFirst(obj, id) {
	if ('id' in obj) return obj; // already present — leave it
	const result = { id };
	for (const k of Object.keys(obj)) {
		result[k] = obj[k];
	}
	return result;
}

/**
 * Process a single array of items (profiles / formations / special_rules).
 * Returns { updated: newArray, newCount, collisions: [{id, names:[]}] }
 */
function processItems(items, label) {
	const seen = new Map(); // id → first name
	const collisions = [];
	let newCount = 0;

	const updated = items.map((item, idx) => {
		if (typeof item !== 'object' || item === null) return item;

		// Items without name: skip
		if (!item.name || typeof item.name !== 'string') {
			console.warn(`  WARN: ${label}[${idx}] has no name — skipping`);
			return item;
		}

		const slug = slugify(item.name);

		// slug might be empty for names like "---"
		if (!slug) {
			console.warn(`  WARN: ${label}[${idx}] name "${item.name}" slugs to empty — skipping`);
			return item;
		}

		// Collision detection (within this array)
		if (seen.has(slug)) {
			const prev = seen.get(slug);
			if (prev !== item.name) {
				// Different name, same slug → collision
				collisions.push({ id: slug, names: [prev, item.name] });
				return item; // don't write
			}
			// Same name again → idempotent (no-op)
			return item;
		}
		seen.set(slug, item.name);

		if ('id' in item) return item; // already has id — leave it

		newCount++;
		return insertIdFirst(item, slug);
	});

	return { updated, newCount, collisions };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const srcDir = path.resolve(__dirname, '..', 'war', 'source-json');
const files = fs.readdirSync(srcDir)
	.filter(f => f.endsWith('.json'))
	.sort()
	.map(f => path.join(srcDir, f));

let totalProfilesNew = 0;
let totalFormationsNew = 0;
let totalSpecialRulesNew = 0;
let totalCollisions = 0;
let totalFiles = 0;
let errorFiles = 0;

for (const filePath of files) {
	const fname = path.basename(filePath);
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
		console.error(`ERROR parsing ${fname}: ${e.message}`);
		errorFiles++;
		continue;
	}

	const fileCollisions = [];
	let fileProfilesNew = 0;
	let fileFormationsNew = 0;
	let fileSpecialRulesNew = 0;
	let dirty = false;

	// --- profiles ---
	if (Array.isArray(data.profiles) && data.profiles.length > 0) {
		const r = processItems(data.profiles, 'profiles');
		if (r.collisions.length) fileCollisions.push(...r.collisions.map(c => ({ ...c, in: 'profiles' })));
		fileProfilesNew += r.newCount;
		if (r.newCount > 0) { data.profiles = r.updated; dirty = true; }
	}

	// --- formations ---
	if (Array.isArray(data.formations) && data.formations.length > 0) {
		const r = processItems(data.formations, 'formations');
		if (r.collisions.length) fileCollisions.push(...r.collisions.map(c => ({ ...c, in: 'formations' })));
		fileFormationsNew += r.newCount;
		if (r.newCount > 0) { data.formations = r.updated; dirty = true; }
	}

	// --- special_rules ---
	if (Array.isArray(data.special_rules) && data.special_rules.length > 0) {
		const r = processItems(data.special_rules, 'special_rules');
		if (r.collisions.length) fileCollisions.push(...r.collisions.map(c => ({ ...c, in: 'special_rules' })));
		fileSpecialRulesNew += r.newCount;
		if (r.newCount > 0) { data.special_rules = r.updated; dirty = true; }
	}

	if (fileCollisions.length > 0) {
		console.error(`COLLISION in ${fname}:`);
		for (const c of fileCollisions) {
			console.error(`  [${c.in}] id="${c.id}" claimed by: ${c.names.join(' AND ')}`);
		}
		totalCollisions += fileCollisions.length;
		console.error(`  -> Skipping write for ${fname} due to collisions`);
		errorFiles++;
		continue;
	}

	totalProfilesNew += fileProfilesNew;
	totalFormationsNew += fileFormationsNew;
	totalSpecialRulesNew += fileSpecialRulesNew;

	if (dirty) {
		// Write back with 2-space indentation + trailing newline
		const out = JSON.stringify(data, null, 2) + '\n';
		fs.writeFileSync(filePath, out, 'utf8');
		totalFiles++;
		console.log(`${fname}: +${fileProfilesNew} profiles, +${fileFormationsNew} formations, +${fileSpecialRulesNew} special_rules`);
	} else {
		console.log(`${fname}: no changes (already up-to-date or no relevant arrays)`);
	}
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`Files written: ${totalFiles}`);
console.log(`Profile IDs added: ${totalProfilesNew}`);
console.log(`Formation IDs added: ${totalFormationsNew}`);
console.log(`Special rule IDs added: ${totalSpecialRulesNew}`);
console.log(`Collisions detected: ${totalCollisions}`);
if (errorFiles > 0) console.error(`Files with errors/skipped: ${errorFiles}`);
if (totalCollisions > 0) process.exit(1);
