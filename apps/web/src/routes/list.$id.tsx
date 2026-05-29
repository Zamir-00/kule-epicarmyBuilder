import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { useBuilderStore, type BuilderFormation } from '@/stores/builder-store';
import {
  totalPoints,
  violations,
  findFormationByStringId,
  findUpgradeByStringId,
  type CatalogList,
} from '@/stores/selectors';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';

interface ListIndexEntry {
  list_id: string;
  display_name?: string;
  ruleset?: string;
  version?: string;
}

interface LoadedList {
  id: string;
  owner_id: string;
  title: string;
  list_id: string;
  points_target: number | null;
  body: unknown;
  is_public: boolean;
  created_at: number;
  updated_at: number;
}

export const Route = createFileRoute('/list/$id')({
  component: ListViewerPage,
});

async function fetchCatalog(listId: string): Promise<CatalogList> {
  const res = await fetch(`/data/lists/${encodeURIComponent(listId)}.json`);
  if (!res.ok) throw new Error(`Catalog not found for ${listId} (HTTP ${res.status})`);
  return res.json();
}

async function fetchListsIndex(): Promise<ListIndexEntry[]> {
  const res = await fetch('/data/lists');
  if (!res.ok) throw new Error(`Index fetch failed (HTTP ${res.status})`);
  return res.json();
}

function ListViewerPage() {
  const { id } = Route.useParams();
  const { user, isSignedIn } = useAuth();
  const navigate = useNavigate();

  const listQ = trpc.lists.load.useQuery({ id });
  const list = listQ.data as LoadedList | undefined;

  const catalogQ = useQuery({
    queryKey: ['catalog', list?.list_id],
    queryFn: () => fetchCatalog(list!.list_id),
    enabled: !!list?.list_id,
    staleTime: 5 * 60_000,
  });

  const indexQ = useQuery({
    queryKey: ['lists-index'],
    queryFn: fetchListsIndex,
    staleTime: 5 * 60_000,
  });

  const body = (list?.body && typeof list.body === 'object')
    ? (list.body as { formations?: BuilderFormation[] })
    : {};
  const formations: BuilderFormation[] = Array.isArray(body.formations) ? body.formations : [];

  const catalog = catalogQ.data;

  const total = useMemo(
    () => (list && catalog ? totalPoints({ ...list, formations } as any, catalog) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, formations, catalog],
  );

  const violationList = useMemo(
    () => (list && catalog ? violations({ ...list, formations } as any, catalog) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, formations, catalog],
  );

  const isOwner = isSignedIn && !!user && !!list && user.id === list.owner_id;

  function handleMakeCopy() {
    if (!list) return;
    useBuilderStore.setState({
      list_id: list.list_id,
      user_list_id: null,
      title: `${list.title} (copy)`,
      points_target: list.points_target,
      is_public: false,
      formations,
    });
    navigate({ to: '/build/$listId', params: { listId: list.list_id } });
  }

  // Loading
  if (listQ.isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading list…</main>;
  }

  // NOT_FOUND or other error
  if (listQ.error) {
    const isNotFound =
      listQ.error instanceof TRPCClientError && listQ.error.data?.code === 'NOT_FOUND';
    return (
      <main className="container mx-auto p-8">
        <h1 className="text-2xl font-bold">List not found</h1>
        <p className="mt-2 text-muted-foreground">
          {isNotFound
            ? 'This list either does not exist or is private.'
            : `Couldn't load this list: ${listQ.error.message ?? 'unknown error'}.`}
        </p>
        <p className="mt-4">
          <Link to="/" className="underline underline-offset-4">
            Back to faction picker
          </Link>
        </p>
      </main>
    );
  }

  if (!list) {
    return <main className="container mx-auto p-8 text-muted-foreground">No data.</main>;
  }

  if (catalogQ.isLoading) {
    return (
      <main className="container mx-auto p-8 text-muted-foreground">
        Loading faction catalog…
      </main>
    );
  }
  if (catalogQ.error || !catalog) {
    return (
      <main className="container mx-auto p-8">
        <p className="text-destructive">
          Failed to load faction catalog for "{list.list_id}".
        </p>
        <p className="mt-2">
          <Link to="/" className="underline underline-offset-4">
            Back to faction picker
          </Link>
        </p>
      </main>
    );
  }

  const indexEntry = indexQ.data?.find((e) => e.list_id === list.list_id);
  const factionName = indexEntry?.display_name ?? list.list_id;
  const ruleset = indexEntry?.ruleset;

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{list.title || 'Untitled list'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {factionName}
              {ruleset ? ` · ${ruleset}` : ''}
              {list.points_target != null && ` · ${list.points_target} pts target`}
              {' · '}
              updated {new Date(list.updated_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{total} pts</p>
              {list.points_target != null && (
                <p
                  className={`text-xs ${
                    total > list.points_target ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  of {list.points_target}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {isOwner && (
            <Link
              to="/build/$listId"
              params={{ listId: list.list_id }}
              search={{ from: list.id }}
            >
              <Button>Edit this list</Button>
            </Link>
          )}
          {!isOwner && list.is_public && isSignedIn && (
            <Button variant="outline" onClick={handleMakeCopy}>
              Make a copy
            </Button>
          )}
          {!isOwner && list.is_public && !isSignedIn && (
            <Link to="/sign-in">
              <Button variant="outline">Sign in to make a copy</Button>
            </Link>
          )}
        </div>
      </header>

      {violationList.length > 0 && (
        <ul className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {violationList.map((v, i) => (
            <li key={i}>• {v}</li>
          ))}
        </ul>
      )}

      {formations.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Empty list — no formations.
        </p>
      ) : (
        <ul className="space-y-3">
          {formations.map((inst) => (
            <FormationViewRow key={inst.instance_id} instance={inst} catalog={catalog} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FormationViewRow({
  instance,
  catalog,
}: {
  instance: BuilderFormation;
  catalog: CatalogList;
}) {
  const def = findFormationByStringId(catalog, instance.formation_string_id);
  if (!def) {
    return (
      <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
        Unknown formation: {instance.formation_string_id}
      </li>
    );
  }

  let totalCost = def.cost_pts ?? def.pts ?? 0;
  const selectedUpgrades: { name: string; cost: number }[] = [];
  for (const usid of instance.upgrade_string_ids) {
    const u = findUpgradeByStringId(catalog, usid);
    if (u) {
      const cost = u.cost_pts ?? u.pts ?? 0;
      totalCost += cost;
      selectedUpgrades.push({ name: u.name, cost });
    }
  }

  return (
    <li className="rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{def.name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{totalCost} pts</p>
      </div>
      {selectedUpgrades.length > 0 && (
        <ul className="mt-2 space-y-1">
          {selectedUpgrades.map((u, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              • {u.name}
              {u.cost > 0 && <span className="ml-1 text-xs">(+{u.cost})</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
