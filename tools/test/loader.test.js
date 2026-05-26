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
