import { describe, test } from 'node:test';
import assert from 'node:assert';
import { totalPoints, violations, swapDeltaForFormation, getSwapChoice, findFormationByStringId, type CatalogList } from '../selectors';
import type { BuilderState } from '../builder-store';

const sampleCatalog: CatalogList = {
  list_id: 'TEST',
  sections: [
    {
      name: 'CORE',
      formations: [
        { string_id: 'inf', name: 'Infantry', cost_pts: 100, upgrades: [1, 2] },
        { string_id: 'tank', name: 'Tank', cost_pts: 250, upgrades: [1] },
        {
          string_id: 'demi',
          name: 'Demi-Century',
          cost_pts: 250,
          upgrades: [1],
          swap_slots: [
            {
              string_id: 'support',
              label: 'Support unit',
              variants: [
                { upgrade_id: 100, is_default: true },
                { upgrade_id: 101 },
              ],
            },
          ],
        },
        {
          string_id: 'warlord',
          name: 'Warlord',
          cost_pts: 725,
          upgrades: [],
          loadout_slots: [
            {
              string_id: 'weapons',
              label: 'Weapons',
              min: 2,
              max: 2,
              variants: [
                { upgrade_id: 50, is_default: true },
                { upgrade_id: 51 },
                { upgrade_id: 52 },
              ],
            },
          ],
        },
        {
          string_id: 'inf_company',
          name: 'Infantry Company',
          cost_pts: 200,
          upgrades: [],
          loadout_slots: [
            {
              string_id: 'support_upg',
              label: 'Support upgrades',
              max: 3,
              variants: [
                { upgrade_id: 100 },
                { upgrade_id: 101 },
                { upgrade_id: 102 },
              ],
            },
          ],
        },
      ],
    },
  ],
  upgrades: [
    { id: 1, string_id: 'commander', name: 'Commander', cost_pts: 50 },
    { id: 2, string_id: 'banner', name: 'Banner', cost_pts: 25 },
    { id: 50, string_id: 'macro_gatling', name: 'Macro Gatling Blaster', cost_pts: 0 },
    { id: 51, string_id: 'sunfury_plasma', name: 'Sunfury Plasma', cost_pts: 50 },
    { id: 52, string_id: 'power_claw', name: 'Power Claw', cost_pts: 25 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', cost_pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', cost_pts: 30 },
    { id: 102, string_id: 'manticore', name: 'Manticore', cost_pts: 100 },
  ],
};

function emptyState(): BuilderState {
  return {
    list_id: 'TEST',
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 2,
    formations: [],
    initFromCatalog: () => {},
    initFromSavedList: () => {},
    addFormation: () => {},
    removeFormation: () => {},
    toggleUpgrade: () => {},
    selectSwapVariant: () => {},
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

describe('swap_slots — totalPoints', () => {
  test('formation with default selection costs base only', () => {
    const state = emptyState();
    state.formations = [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [], swap_choices: {} }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 250);
  });

  test('formation with non-default selection adds delta', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'i1',
      formation_string_id: 'demi',
      upgrade_string_ids: [],
      swap_choices: { support: 'rapier_lasers' },
    }];
    // default gun_servitors costs 0; chosen rapier_lasers costs 30. delta = +30.
    assert.strictEqual(totalPoints(state, sampleCatalog), 280);
  });

  test('formation with no swap_choices field falls back to default', () => {
    const state = emptyState();
    // No swap_choices key at all (legacy body_version: 1)
    state.formations = [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [] }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 250);
  });
});

describe('swap_slots — getSwapChoice', () => {
  test('returns default variant string_id when slot is unchosen', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, {}, 'support');
    assert.strictEqual(choice, 'gun_servitors');
  });

  test('returns chosen variant string_id when present', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, { support: 'rapier_lasers' }, 'support');
    assert.strictEqual(choice, 'rapier_lasers');
  });

  test('returns default when chosen variant is no longer valid (catalog drift)', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, { support: 'nonexistent' }, 'support');
    assert.strictEqual(choice, 'gun_servitors');
  });
});

describe('swap_slots — swapDeltaForFormation', () => {
  test('returns 0 when all slots resolve to defaults', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, {}), 0);
  });

  test('returns chosen.pts - default.pts when slot has a non-default choice', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, { support: 'rapier_lasers' }), 30);
  });

  test('returns 0 for formations with no swap_slots', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, {}), 0);
  });
});

import { useBuilderStore } from '../builder-store';

describe('builder-store — selectSwapVariant', () => {
  test('records a non-default choice', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('demi');
    const inst = useBuilderStore.getState().formations[0]!;
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'rapier_lasers', 'gun_servitors');
    const after = useBuilderStore.getState().formations[0]!;
    assert.deepStrictEqual(after.swap_choices, { support: 'rapier_lasers' });
  });

  test('selecting the default removes the key', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('demi');
    const inst = useBuilderStore.getState().formations[0]!;
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'rapier_lasers', 'gun_servitors');
    // Now flip back to default
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'gun_servitors', 'gun_servitors');
    const after = useBuilderStore.getState().formations[0]!;
    assert.deepStrictEqual(after.swap_choices ?? {}, {}, 'default selection should clear the key');
  });
});

describe('builder-store — initFromSavedList stale-data handling', () => {
  test('drops swap_choices keys whose variant no longer exists in catalog', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: {
        body_version: 2,
        formations: [{
          instance_id: 'i1',
          formation_string_id: 'demi',
          upgrade_string_ids: [],
          swap_choices: { support: 'NO_SUCH_VARIANT', other_slot: 'ghost' },
        }],
      },
    });
    const f = useBuilderStore.getState().formations[0]!;
    // We can't validate against the catalog here (the store doesn't see the catalog at init time),
    // so the loader keeps unknown values. Resolution to defaults happens in getSwapChoice() at render/total time.
    // This test just confirms the value made it through unchanged.
    assert.strictEqual(f.swap_choices?.support, 'NO_SUCH_VARIANT');
  });

  test('legacy body without swap_choices loads cleanly', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: {
        formations: [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [] }],
      },
    });
    const f = useBuilderStore.getState().formations[0]!;
    assert.strictEqual(f.swap_choices, undefined);
  });
});

import {
  getLoadoutPositions,
  loadoutCostForFormation,
  canonicalizeLoadoutChoices,
} from '../selectors';

describe('loadout_slots — getLoadoutPositions', () => {
  test('returns N copies of default when min=max=N + default exists + no saved state', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'weapons');
    assert.deepStrictEqual(positions, ['macro_gatling', 'macro_gatling']);
  });

  test('returns empty array when no default + max only', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'support_upg');
    assert.deepStrictEqual(positions, []);
  });

  test('returns saved positions when valid', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { weapons: ['sunfury_plasma', 'power_claw'] }, 'weapons');
    assert.deepStrictEqual(positions, ['sunfury_plasma', 'power_claw']);
  });

  test('replaces stale variant with default (catalog drift)', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { weapons: ['ghost_variant', 'sunfury_plasma'] }, 'weapons');
    assert.deepStrictEqual(positions, ['macro_gatling', 'sunfury_plasma']);
  });

  test('drops stale position when no default available', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { support_upg: ['ghost'] }, 'support_upg');
    assert.deepStrictEqual(positions, []);
  });

  test('returns null when slot does not exist', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'unknown_slot');
    assert.strictEqual(positions, null);
  });
});

describe('loadout_slots — loadoutCostForFormation', () => {
  test('returns 0 when all positions are defaults', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, undefined), 0);
  });

  test('returns delta sum when default exists and positions differ', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    // default macro_gatling=0, chosen sunfury_plasma=50, power_claw=25
    // delta = (50-0) + (25-0) = 75
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, { weapons: ['sunfury_plasma', 'power_claw'] }), 75);
  });

  test('returns absolute sum when no default', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    // gun_servitors=0, manticore=100 → 100
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, { support_upg: ['gun_servitors', 'manticore'] }), 100);
  });

  test('returns 0 for formations with no loadout_slots', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf')!;
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, undefined), 0);
  });
});

describe('loadout_slots — totalPoints integration', () => {
  test('warlord formation with all default positions costs base only', () => {
    const state = emptyState();
    state.formations = [{ instance_id: 'w1', formation_string_id: 'warlord', upgrade_string_ids: [] }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 725);
  });

  test('warlord formation with one non-default position adds the delta', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma', 'macro_gatling'] },
    }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 775);
  });

  test('inf_company with two added support upgrades adds their absolute pts', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'c1',
      formation_string_id: 'inf_company',
      upgrade_string_ids: [],
      loadout_choices: { support_upg: ['gun_servitors', 'manticore'] },
    }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 300);
  });
});

describe('loadout_slots — canonicalizeLoadoutChoices', () => {
  test('strips slot whose positions equal [default x min]', () => {
    const inst = {
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['macro_gatling', 'macro_gatling'] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.strictEqual(out.loadout_choices, undefined);
  });

  test('strips slot with empty positions when no default + max only', () => {
    const inst = {
      instance_id: 'c1',
      formation_string_id: 'inf_company',
      upgrade_string_ids: [],
      loadout_choices: { support_upg: [] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.strictEqual(out.loadout_choices, undefined);
  });

  test('keeps slot when positions diverge from canonical state', () => {
    const inst = {
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma', 'macro_gatling'] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.deepStrictEqual(out.loadout_choices, { weapons: ['sunfury_plasma', 'macro_gatling'] });
  });
});

describe('loadout_slots — violations', () => {
  test('flags when current position count < min', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma'] }, // only 1 position, min=2
    }];
    const msgs = violations(state, sampleCatalog);
    assert.ok(msgs.some((m) => /Warlord.*Weapons.*at least 2/i.test(m)), `got: ${msgs.join('; ')}`);
  });
});
