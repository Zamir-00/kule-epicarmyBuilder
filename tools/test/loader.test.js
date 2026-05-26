// tools/test/loader.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// The loader is dual-mode: a browser <script> AND a CJS module.
// require() triggers the module.exports branch at the end of the IIFE.
const loaderPath = path.resolve(__dirname, '..', '..', 'war', 'js', 'unitProfileLoader.js');

test('loader module loads under Node without throwing', () => {
    const loader = require(loaderPath);
    assert.ok(loader, 'loader should export an object');
});

test('cloneProfile renames abilities_or_notes to abilities', () => {
    const { cloneProfile } = require(loaderPath);
    const input = {
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [],
        abilities_or_notes: ['Leader', 'MW']
    };
    const result = cloneProfile(input);
    assert.deepStrictEqual(result.abilities, ['Leader', 'MW']);
    assert.strictEqual(result.abilities_or_notes, undefined);
});

test('cloneProfile falls back to abilities when abilities_or_notes is absent', () => {
    const { cloneProfile } = require(loaderPath);
    const result = cloneProfile({
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [],
        abilities: ['Scout', 'Infiltrator']
    });
    assert.deepStrictEqual(result.abilities, ['Scout', 'Infiltrator']);
});

test('cloneProfile deep-copies weapons and their notes', () => {
    const { cloneProfile } = require(loaderPath);
    const input = {
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [{ name: 'Bolter', range: '15cm', firepower: 'Small Arms', notes: ['MW'] }],
        abilities_or_notes: []
    };
    const result = cloneProfile(input);
    // Mutating the original should not affect the clone.
    input.weapons[0].notes.push('EA(+1)');
    assert.deepStrictEqual(result.weapons[0].notes, ['MW']);
});

test('cloneProfile drops provenance fields (parse_confidence etc.)', () => {
    const { cloneProfile } = require(loaderPath);
    const result = cloneProfile({
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [], abilities_or_notes: [],
        source_section: 'Whatever',
        parse_confidence: 'high',
        parse_warnings: ['stuff'],
        ambiguity_reasons: ['stuff'],
        is_reference_or_ambiguous: true
    });
    assert.strictEqual(result.source_section, undefined);
    assert.strictEqual(result.parse_confidence, undefined);
    assert.strictEqual(result.parse_warnings, undefined);
    assert.strictEqual(result.ambiguity_reasons, undefined);
    assert.strictEqual(result.is_reference_or_ambiguous, undefined);
});

test('deriveKey converts name to snake_case via normalizer', () => {
    const { deriveKey } = require(loaderPath);
    const noopNormalizer = (s) => String(s).toLowerCase();
    assert.strictEqual(deriveKey('Lord of Contagion', noopNormalizer), 'lord_of_contagion');
    assert.strictEqual(deriveKey('Plague  Marines', noopNormalizer), 'plague_marines');
});

test('deriveKey returns empty string when normalizer returns empty', () => {
    const { deriveKey } = require(loaderPath);
    const stripNormalizer = () => '';
    assert.strictEqual(deriveKey('whatever', stripNormalizer), '');
});

test('deriveKey is empty for empty input', () => {
    const { deriveKey } = require(loaderPath);
    const noopNormalizer = (s) => String(s || '').toLowerCase();
    assert.strictEqual(deriveKey('', noopNormalizer), '');
    assert.strictEqual(deriveKey(null, noopNormalizer), '');
});

test('registerAlias stores normalized alias → key', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s).toLowerCase();
    registerAlias(faction, 'Plague Marines', 'plague_marines', normalizer);
    assert.strictEqual(faction.nameToKey['plague marines'], 'plague_marines');
});

test('registerAlias also stores compact (no-space) variant', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s).toLowerCase();
    registerAlias(faction, 'Plague Marines', 'plague_marines', normalizer);
    assert.strictEqual(faction.nameToKey['plaguemarines'], 'plague_marines');
});

test('registerAlias is a no-op when alias or key is empty', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s || '').toLowerCase();
    registerAlias(faction, '', 'k', normalizer);
    registerAlias(faction, 'a', '', normalizer);
    assert.deepStrictEqual(faction.nameToKey, {});
});

test('registerAlias is a no-op when normalizer returns empty', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const stripNormalizer = () => '';
    registerAlias(faction, 'whatever', 'k', stripNormalizer);
    assert.deepStrictEqual(faction.nameToKey, {});
});

test('buildFinder returns null for empty displayName', () => {
    const { buildFinder } = require(loaderPath);
    // Set up a faction in the global namespace for the finder to look up.
    global.ArmyforgeUnitProfiles = global.ArmyforgeUnitProfiles || {};
    global.ArmyforgeUnitProfiles.testNs = {
        armyIds: ['TEST_NETEA'],
        profiles: { plague_marines: { name: 'Plague Marines' } },
        nameToKey: { 'plague marines': 'plague_marines' }
    };
    // Stub Array.prototype.member (used by Prototype.js; absent in plain Node).
    if (!Array.prototype.member) {
        Array.prototype.member = function(value) { return this.indexOf(value) !== -1; };
    }
    const noopNormalizer = (s) => String(s || '').toLowerCase();
    const finder = buildFinder('testNs', noopNormalizer);
    assert.strictEqual(finder('', 'TEST_NETEA'), null);
    assert.strictEqual(finder(null, 'TEST_NETEA'), null);
});

test('buildFinder returns null when listId does not match armyIds', () => {
    const { buildFinder } = require(loaderPath);
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    assert.strictEqual(finder('Plague Marines', 'WRONG_ID'), null);
});

test('buildFinder resolves displayName via nameToKey', () => {
    const { buildFinder } = require(loaderPath);
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    const result = finder('Plague Marines', 'TEST_NETEA');
    assert.strictEqual(result.name, 'Plague Marines');
});

test('buildFinder falls back to compact (no-space) lookup', () => {
    const { buildFinder } = require(loaderPath);
    global.ArmyforgeUnitProfiles.testNs.nameToKey = { 'plaguemarines': 'plague_marines' };
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    const result = finder('Plague Marines', 'TEST_NETEA');
    assert.strictEqual(result.name, 'Plague Marines');
});

test('buildFinder returns null when key resolution fails', () => {
    const { buildFinder } = require(loaderPath);
    global.ArmyforgeUnitProfiles.testNs.nameToKey = {};
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    assert.strictEqual(finder('Plague Marines', 'TEST_NETEA'), null);
});

test('registerFaction loads source-json, registers profiles and aliases, attaches finder', () => {
    const { registerFaction } = require(loaderPath);
    const fs = require('fs');
    const fixturePath = path.resolve(__dirname, 'fixtures', 'sample-source.json');
    const fixtureBody = fs.readFileSync(fixturePath, 'utf8');

    // Stub Prototype.js Ajax.Request — captures the path and returns the fixture body.
    global.Ajax = {
        Request: function(reqPath, opts) {
            opts.onSuccess({ responseText: fixtureBody });
        }
    };
    if (!Array.prototype.member) {
        Array.prototype.member = function(value) { return this.indexOf(value) !== -1; };
    }
    global.ArmyforgeUnitProfiles = global.ArmyforgeUnitProfiles || {};

    registerFaction({
        namespace: 'sampleFaction',
        findFunctionName: 'findSampleFactionProfileByName',
        armyIds: ['TEST_NETEA'],
        sourceJsonPaths: [fixturePath],
        normalizer: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
        aliases: {
            'Plague Marine Retinue': 'Plague Marines',
            'Lord of Contagion': 'Lord of Contagion'
        }
    });

    const ns = global.ArmyforgeUnitProfiles.sampleFaction;
    assert.ok(ns, 'namespace attached');
    assert.deepStrictEqual(ns.armyIds, ['TEST_NETEA']);
    assert.ok(ns.profiles.plague_marines, 'plague_marines profile registered');
    assert.strictEqual(ns.profiles.plague_marines.name, 'Plague Marines');
    assert.ok(ns.profiles.lord_of_contagion, 'lord_of_contagion profile registered');

    // Aliases were registered.
    assert.strictEqual(ns.nameToKey['plague marine retinue'], 'plague_marines');

    // Finder function attached and resolves both direct names and aliases.
    const finder = global.ArmyforgeUnitProfiles.findSampleFactionProfileByName;
    assert.ok(typeof finder === 'function', 'finder attached');
    assert.strictEqual(finder('Plague Marines', 'TEST_NETEA').name, 'Plague Marines');
    assert.strictEqual(finder('Plague Marine Retinue', 'TEST_NETEA').name, 'Plague Marines');
    assert.strictEqual(finder('Unknown Unit', 'TEST_NETEA'), null);
});

test('registerFaction throws when required config field missing', () => {
    const { registerFaction } = require(loaderPath);
    assert.throws(() => registerFaction({}), /missing required fields/);
    assert.throws(() => registerFaction({ namespace: 'x' }), /missing required fields/);
});
