import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useBuilderStore } from '@/stores/builder-store';
import {
  totalPoints,
  violations,
  findUpgradeByStringId,
  findUpgradeById,
  getSwapChoice,
  swapDeltaForFormation,
  type CatalogList,
  type CatalogSwapSlot,
} from '@/stores/selectors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { FormationProfiles, useSourceForList, type SourceJson } from '@/components/UnitProfiles';

const searchSchema = z.object({
  from: z.string().optional(),
});

export const Route = createFileRoute('/build/$listId')({
  component: BuilderPage,
  validateSearch: searchSchema,
});

async function fetchCatalog(listId: string): Promise<CatalogList> {
  const res = await fetch(`/data/lists/${encodeURIComponent(listId)}.json`);
  if (!res.ok) throw new Error(`Catalog not found for ${listId} (HTTP ${res.status})`);
  return res.json() as Promise<CatalogList>;
}

function BuilderPage() {
  const { listId } = Route.useParams();
  const { from } = Route.useSearch();
  const builder = useBuilderStore();

  // Fetch catalog
  const catalogQ = useQuery({
    queryKey: ['catalog', listId],
    queryFn: () => fetchCatalog(listId),
    staleTime: 5 * 60_000,
  });

  // Optionally load a saved list to edit
  const savedQ = trpc.lists.load.useQuery(
    { id: from ?? '' },
    { enabled: !!from }
  );

  // Initialize Zustand store on mount / when listId changes
  useEffect(() => {
    if (savedQ.data) {
      builder.initFromSavedList({
        id: savedQ.data.id,
        list_id: savedQ.data.list_id,
        title: savedQ.data.title,
        points_target: savedQ.data.points_target ?? null,
        is_public: !!savedQ.data.is_public,
        body: savedQ.data.body,
      });
    } else if (!from) {
      // New list — only init if not already pointed at this list_id
      if (builder.list_id !== listId) {
        builder.initFromCatalog(listId);
      }
    }
    // Intentionally narrow deps: only re-init when listId or savedQ.data identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, savedQ.data, from]);

  if (catalogQ.isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading list…</main>;
  }
  if (catalogQ.error || !catalogQ.data) {
    return (
      <main className="container mx-auto p-8">
        <p className="text-destructive">Failed to load list "{listId}".</p>
        <p className="mt-2"><Link to="/" className="underline underline-offset-4">Back to list picker</Link></p>
      </main>
    );
  }
  const catalog = catalogQ.data;

  return <BuilderUI catalog={catalog} />;
}

function BuilderUI({ catalog }: { catalog: CatalogList }) {
  const builder = useBuilderStore();
  const { isSignedIn } = useAuth();
  const trpcUtils = trpc.useUtils();
  const sourceQ = useSourceForList(catalog.list_id);

  const total = totalPoints(builder, catalog);
  const violationList = violations(builder, catalog);

  const saveMutation = trpc.lists.save.useMutation({
    onSuccess: (saved: { id: string }) => {
      builder.setUserListId(saved.id);
      void trpcUtils.lists.listMine.invalidate();
      // Update URL with ?from=<id> via window.history (no full navigation)
      const url = new URL(window.location.href);
      url.searchParams.set('from', saved.id);
      window.history.replaceState({}, '', url.toString());
    },
  });

  function handleSave() {
    if (!isSignedIn) return;
    saveMutation.mutate({
      id: builder.user_list_id ?? undefined,
      title: builder.title.trim() || 'Untitled list',
      list_id: catalog.list_id,
      points_target: builder.points_target ?? undefined,
      body: { body_version: builder.body_version as 1 | 2, formations: builder.formations },
      is_public: builder.is_public,
    });
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{builder.title || catalog.list_id}</h1>
          <p className="text-xs text-muted-foreground">
            {catalog.list_id}
            {catalog.ruleset && ` · ${catalog.ruleset}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{total} pts</p>
            {builder.points_target != null && (
              <p className={`text-xs ${total > builder.points_target ? 'text-destructive' : 'text-muted-foreground'}`}>
                of {builder.points_target}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {isSignedIn ? (
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            ) : (
              <Link to="/sign-in">
                <Button variant="outline">Sign in to save</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </header>

      {violationList.length > 0 && (
        <ul className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {violationList.map((v, i) => <li key={i}>• {v}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:grid-cols-1">
        <section className="print:hidden">
          <h2 className="mb-2 text-lg font-semibold">Add formations</h2>
          {catalog.sections.map((section) => (
            <div key={section.name} className="mb-4">
              <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{section.name}</h3>
              <ul className="space-y-1">
                {section.formations.map((f) => (
                  <li key={f.string_id ?? f.name} className="flex items-center justify-between rounded border bg-card px-3 py-2 text-sm">
                    <span>
                      {f.name}
                      <span className="ml-2 text-xs text-muted-foreground">{f.cost_pts ?? f.pts ?? 0} pts</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!f.string_id}
                      onClick={() => f.string_id && builder.addFormation(f.string_id)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold print:hidden">Your army</h2>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 print:hidden">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Title</span>
              <input
                type="text"
                value={builder.title}
                onChange={(e) => builder.setTitle(e.target.value)}
                placeholder="Untitled list"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Points target</span>
              <input
                type="number"
                min={0}
                value={builder.points_target ?? ''}
                onChange={(e) => builder.setPointsTarget(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 3000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          {builder.formations.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No formations yet. Pick from the left to add.
            </p>
          ) : (
            <ul className="space-y-3">
              {builder.formations.map((inst) => (
                <FormationCard key={inst.instance_id} instance={inst} catalog={catalog} sourceJson={sourceQ.data ?? null} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function FormationCard({
  instance,
  catalog,
  sourceJson,
}: {
  instance: { instance_id: string; formation_string_id: string; upgrade_string_ids: string[]; swap_choices?: Record<string, string> };
  catalog: CatalogList;
  sourceJson: SourceJson | null;
}) {
  const builder = useBuilderStore();
  const def = catalog.sections.flatMap((s) => s.formations).find((f) => f.string_id === instance.formation_string_id);
  if (!def) {
    return (
      <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
        Unknown formation: {instance.formation_string_id}
        <Button size="sm" variant="ghost" onClick={() => builder.removeFormation(instance.instance_id)} className="ml-2">Remove</Button>
      </li>
    );
  }

  const availableUpgrades = (def.upgrades ?? [])
    .map((id) => catalog.upgrades?.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  let totalCost = def.cost_pts ?? def.pts ?? 0;
  for (const usid of instance.upgrade_string_ids) {
    const u = findUpgradeByStringId(catalog, usid);
    if (u) totalCost += u.cost_pts ?? u.pts ?? 0;
  }
  totalCost += swapDeltaForFormation(catalog, def, instance.swap_choices);

  const selectedUpgrades = availableUpgrades.filter(
    (u) => u.string_id && instance.upgrade_string_ids.includes(u.string_id),
  );

  return (
    <li className="rounded-md border bg-card p-3 break-inside-avoid">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium">{def.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{totalCost} pts</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => builder.removeFormation(instance.instance_id)} className="print:hidden">×</Button>
      </div>

      {(def.swap_slots ?? []).length > 0 && (
        <div className="mt-3 border-t pt-2 print:hidden">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Composition</p>
          <ul className="space-y-2">
            {(def.swap_slots ?? []).map((slot) => (
              <SwapSlotControl
                key={slot.string_id}
                slot={slot}
                catalog={catalog}
                instanceId={instance.instance_id}
                currentChoiceStringId={getSwapChoice(catalog, def, instance.swap_choices, slot.string_id)}
              />
            ))}
          </ul>
        </div>
      )}

      {availableUpgrades.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 print:hidden">
          {availableUpgrades.map((u) => {
            const checked = u.string_id ? instance.upgrade_string_ids.includes(u.string_id) : false;
            return (
              <li key={u.id} className="text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!u.string_id}
                    onChange={() => u.string_id && builder.toggleUpgrade(instance.instance_id, u.string_id)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>
                    {u.name}
                    {(u.cost_pts ?? u.pts ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">+{u.cost_pts ?? u.pts ?? 0}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* Print view: selected upgrades and resolved swap choices */}
      {(selectedUpgrades.length > 0 || (def.swap_slots ?? []).length > 0) && (
        <ul className="mt-2 hidden space-y-1 print:block">
          {(def.swap_slots ?? []).map((slot) => {
            const chosenSid = getSwapChoice(catalog, def, instance.swap_choices, slot.string_id);
            const chosen = chosenSid ? findUpgradeByStringId(catalog, chosenSid) : null;
            return chosen ? (
              <li key={slot.string_id} className="text-sm">
                • {slot.label}: {chosen.name}
              </li>
            ) : null;
          })}
          {selectedUpgrades.map((u) => (
            <li key={u.id} className="text-sm">
              • {u.name}
              {(u.cost_pts ?? u.pts ?? 0) > 0 && (
                <span className="ml-1 text-xs">(+{u.cost_pts ?? u.pts ?? 0})</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <FormationProfiles
        formationName={def.name}
        sourceJson={sourceJson}
        def={def}
        catalog={catalog}
        swapChoices={instance.swap_choices}
      />
    </li>
  );
}

function SwapSlotControl({
  slot,
  catalog,
  instanceId,
  currentChoiceStringId,
}: {
  slot: CatalogSwapSlot;
  catalog: CatalogList;
  instanceId: string;
  currentChoiceStringId: string | null;
}) {
  const builder = useBuilderStore();
  const defaultVariant = slot.variants.find((v) => v.is_default === true);
  if (!defaultVariant) return null;
  const defaultUp = findUpgradeById(catalog, defaultVariant.upgrade_id);
  if (!defaultUp) return null;
  const defaultStringId = defaultUp.string_id ?? null;
  if (!defaultStringId) return null;

  if (slot.variants.length === 2) {
    // 2 variants → single checkbox toggle labeled with the non-default variant
    const other = slot.variants.find((v) => v.is_default !== true);
    if (!other) return null;
    const otherUp = findUpgradeById(catalog, other.upgrade_id);
    if (!otherUp || !otherUp.string_id) return null;
    const checked = currentChoiceStringId === otherUp.string_id;
    const delta = (otherUp.cost_pts ?? otherUp.pts ?? 0) - (defaultUp.cost_pts ?? defaultUp.pts ?? 0);
    return (
      <li className="text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => builder.selectSwapVariant(
              instanceId,
              slot.string_id,
              checked ? defaultStringId : otherUp.string_id!,
              defaultStringId,
            )}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="text-xs text-muted-foreground">{slot.label}: </span>
            Replace {defaultUp.name.toLowerCase()} with {otherUp.name.toLowerCase()}
            <span className="ml-1 text-xs text-muted-foreground">
              ({delta === 0 ? '+0' : delta > 0 ? `+${delta}` : `${delta}`})
            </span>
          </span>
        </label>
      </li>
    );
  }

  // 3+ variants → radio group
  return (
    <li className="text-sm">
      <fieldset>
        <legend className="text-xs text-muted-foreground">{slot.label}</legend>
        <div className="mt-1 space-y-1">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up || !up.string_id) return null;
            const checked = currentChoiceStringId === up.string_id;
            const delta = (up.cost_pts ?? up.pts ?? 0) - (defaultUp.cost_pts ?? defaultUp.pts ?? 0);
            return (
              <label key={String(v.upgrade_id)} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`swap-${instanceId}-${slot.string_id}`}
                  checked={checked}
                  onChange={() => builder.selectSwapVariant(
                    instanceId,
                    slot.string_id,
                    up.string_id!,
                    defaultStringId,
                  )}
                  className="h-4 w-4 border-input"
                />
                <span>
                  {up.name}
                  {delta !== 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({delta > 0 ? `+${delta}` : `${delta}`})
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </li>
  );
}
