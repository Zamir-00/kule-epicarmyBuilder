import { describe, test } from 'node:test';
import assert from 'node:assert';
import { resolveCompositionText } from '../UnitProfiles';
import type { CatalogList, CatalogFormation } from '../../stores/selectors';

const catalog: CatalogList = {
  list_id: 'TEST',
  sections: [],
  upgrades: [
    { id: 100, string_id: 'gun_servitor_unit', name: '5 Gun Servitor Unit', cost_pts: 0 },
    { id: 101, string_id: 'rapier_laser_unit', name: '3 Rapier Laser Destroyer Unit', cost_pts: 30 },
  ],
};

const def: CatalogFormation = {
  string_id: 'sagitarii_demi_century',
  name: 'Sagitarii Demi-Century',
  cost_pts: 275,
  swap_slots: [
    {
      string_id: 'support_slot',
      label: 'Support',
      variants: [
        { upgrade_id: 100, is_default: true },
        { upgrade_id: 101 },
      ],
    },
  ],
};

const SOURCE_TEXT = 'Five Sagitarii units and five Gun Servitor units';

describe('resolveCompositionText', () => {
  test('default selected → resolved text equals source text', () => {
    // When no swap_choices (or the default is chosen), the text is unchanged
    const result = resolveCompositionText(SOURCE_TEXT, def, catalog, undefined);
    assert.strictEqual(result, SOURCE_TEXT);
  });

  test('default explicitly chosen → resolved text equals source text', () => {
    const result = resolveCompositionText(
      SOURCE_TEXT,
      def,
      catalog,
      { support_slot: 'gun_servitor_unit' },
    );
    assert.strictEqual(result, SOURCE_TEXT);
  });

  test('non-default selected → resolved text contains chosen variant name', () => {
    const result = resolveCompositionText(
      SOURCE_TEXT,
      def,
      catalog,
      { support_slot: 'rapier_laser_unit' },
    );
    // The chosen noun "Rapier Laser Destroyer" should appear in place of "Gun Servitor"
    assert.ok(
      result.toLowerCase().includes('rapier laser destroyer'),
      `Expected "rapier laser destroyer" in "${result}"`,
    );
    assert.ok(
      !result.toLowerCase().includes('gun servitor'),
      `Expected "gun servitor" to be replaced in "${result}"`,
    );
  });

  test('no def → returns source text unchanged', () => {
    const result = resolveCompositionText(SOURCE_TEXT, undefined, catalog, undefined);
    assert.strictEqual(result, SOURCE_TEXT);
  });

  test('no catalog → returns source text unchanged', () => {
    const result = resolveCompositionText(SOURCE_TEXT, def, undefined, undefined);
    assert.strictEqual(result, SOURCE_TEXT);
  });

  test('null unitsText → returns empty string', () => {
    const result = resolveCompositionText(null, def, catalog, undefined);
    assert.strictEqual(result, '');
  });
});
