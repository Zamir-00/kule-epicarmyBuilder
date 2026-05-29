import { create } from 'zustand';
import { ulid } from 'ulid';

export interface BuilderFormation {
  instance_id: string;
  formation_string_id: string;
  upgrade_string_ids: string[];
  /** Map from swap_slot.string_id to the chosen variant's upgrade.string_id.
   * Only non-default selections are stored; absence = default. Optional for backward compat. */
  swap_choices?: Record<string, string>;
}

export interface SavedListSummary {
  id: string;
  list_id: string;
  title: string;
  points_target: number | null;
  is_public: boolean;
  body: unknown;
}

export interface BuilderState {
  list_id: string | null;
  user_list_id: string | null;
  title: string;
  points_target: number | null;
  is_public: boolean;
  /** Body schema version. Absent/1 = legacy; 2 = with swap_choices. Always written as 2 going forward. */
  body_version: number;
  formations: BuilderFormation[];

  initFromCatalog(list_id: string): void;
  initFromSavedList(saved: SavedListSummary): void;
  addFormation(formation_string_id: string): void;
  removeFormation(instance_id: string): void;
  toggleUpgrade(instance_id: string, upgrade_string_id: string): void;
  /** Set the chosen variant for a swap slot on a formation instance.
   * If the chosen variant equals the slot's default, this implementation removes the key
   * (save-only-non-defaults rule). The caller must pass `default_variant_string_id` so
   * the store can detect equality without reading the catalog. */
  selectSwapVariant(
    instance_id: string,
    slot_string_id: string,
    chosen_variant_string_id: string,
    default_variant_string_id: string,
  ): void;
  setTitle(title: string): void;
  setPointsTarget(n: number | null): void;
  setIsPublic(b: boolean): void;
  setUserListId(id: string): void;
  reset(): void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  list_id: null,
  user_list_id: null,
  title: '',
  points_target: null,
  is_public: false,
  body_version: 2,
  formations: [],

  initFromCatalog: (list_id) => set({
    list_id,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 2,
    formations: [],
  }),
  initFromSavedList: (saved) => set(() => {
    const body = (saved.body && typeof saved.body === 'object') ? saved.body as {
      formations?: BuilderFormation[];
      body_version?: number;
    } : {};
    return {
      list_id: saved.list_id,
      user_list_id: saved.id,
      title: saved.title,
      points_target: saved.points_target,
      is_public: saved.is_public,
      body_version: typeof body.body_version === 'number' ? body.body_version : 1,
      formations: Array.isArray(body.formations) ? body.formations : [],
    };
  }),
  addFormation: (formation_string_id) => set((s) => ({
    formations: [
      ...s.formations,
      {
        instance_id: ulid(),
        formation_string_id,
        upgrade_string_ids: [],
      },
    ],
  })),
  removeFormation: (instance_id) => set((s) => ({
    formations: s.formations.filter((f) => f.instance_id !== instance_id),
  })),
  toggleUpgrade: (instance_id, upgrade_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const has = f.upgrade_string_ids.includes(upgrade_string_id);
      return {
        ...f,
        upgrade_string_ids: has
          ? f.upgrade_string_ids.filter((u) => u !== upgrade_string_id)
          : [...f.upgrade_string_ids, upgrade_string_id],
      };
    }),
  })),
  selectSwapVariant: (instance_id, slot_string_id, chosen_variant_string_id, default_variant_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const current = { ...(f.swap_choices ?? {}) };
      if (chosen_variant_string_id === default_variant_string_id) {
        // Save-only-non-defaults rule: remove the key
        delete current[slot_string_id];
      } else {
        current[slot_string_id] = chosen_variant_string_id;
      }
      const next: BuilderFormation = { ...f };
      if (Object.keys(current).length === 0) {
        delete next.swap_choices;
      } else {
        next.swap_choices = current;
      }
      return next;
    }),
  })),
  setTitle: (title) => set({ title }),
  setPointsTarget: (n) => set({ points_target: n }),
  setIsPublic: (b) => set({ is_public: b }),
  setUserListId: (id) => set({ user_list_id: id }),
  reset: () => set({
    list_id: null,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 2,
    formations: [],
  }),
}));
