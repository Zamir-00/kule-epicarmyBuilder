import { describe, test } from 'node:test';
import assert from 'node:assert';
import { totalPoints, violations, type CatalogList } from '../selectors';
import type { BuilderState } from '../builder-store';

const sampleCatalog: CatalogList = {
  list_id: 'TEST',
  sections: [
    {
      name: 'CORE',
      formations: [
        { string_id: 'inf', name: 'Infantry', cost_pts: 100, upgrades: [1, 2] },
        { string_id: 'tank', name: 'Tank', cost_pts: 250, upgrades: [1] },
      ],
    },
  ],
  upgrades: [
    { id: 1, string_id: 'commander', name: 'Commander', cost_pts: 50 },
    { id: 2, string_id: 'banner', name: 'Banner', cost_pts: 25 },
  ],
};

function emptyState(): BuilderState {
  return {
    list_id: 'TEST',
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    formations: [],
    initFromCatalog: () => {},
    initFromSavedList: () => {},
    addFormation: () => {},
    removeFormation: () => {},
    toggleUpgrade: () => {},
    setTitle: () => {},
    setPointsTarget: () => {},
    setIsPublic: () => {},
    setUserListId: () => {},
    reset: () => {},
  } as BuilderState;
}

describe('selectors.totalPoints', () => {
  test('empty list = 0', () => {
    assert.strictEqual(totalPoints(emptyState(), sampleCatalog), 0);
  });
  test('one formation = its cost', () => {
    const s = emptyState();
    s.formations.push({ instance_id: 'a', formation_string_id: 'inf', upgrade_string_ids: [] });
    assert.strictEqual(totalPoints(s, sampleCatalog), 100);
  });
  test('formation + upgrade adds upgrade cost', () => {
    const s = emptyState();
    s.formations.push({ instance_id: 'a', formation_string_id: 'inf', upgrade_string_ids: ['commander'] });
    assert.strictEqual(totalPoints(s, sampleCatalog), 150);
  });
  test('multiple formations sum independently', () => {
    const s = emptyState();
    s.formations.push({ instance_id: 'a', formation_string_id: 'inf', upgrade_string_ids: ['commander'] });
    s.formations.push({ instance_id: 'b', formation_string_id: 'tank', upgrade_string_ids: [] });
    assert.strictEqual(totalPoints(s, sampleCatalog), 150 + 250);
  });
});

describe('selectors.violations', () => {
  test('no points_target = no violations', () => {
    const s = emptyState();
    s.formations.push({ instance_id: 'a', formation_string_id: 'inf', upgrade_string_ids: [] });
    assert.deepStrictEqual(violations(s, sampleCatalog), []);
  });
  test('under target = no violations', () => {
    const s = emptyState();
    s.points_target = 500;
    s.formations.push({ instance_id: 'a', formation_string_id: 'tank', upgrade_string_ids: [] });
    assert.deepStrictEqual(violations(s, sampleCatalog), []);
  });
  test('over target reports overage', () => {
    const s = emptyState();
    s.points_target = 200;
    s.formations.push({ instance_id: 'a', formation_string_id: 'tank', upgrade_string_ids: [] });
    const v = violations(s, sampleCatalog);
    assert.strictEqual(v.length, 1);
    assert.match(v[0]!, /Over points target by 50/);
  });
});
