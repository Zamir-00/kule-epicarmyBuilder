import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/lists')({
  component: ListsPage,
});

interface ListEntryMeta {
  list_id: string;
  display_name?: string;
  ruleset?: string;
}

interface UserList {
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

function ListsPage() {
  return (
    <AuthGuard>
      <ListsContent />
    </AuthGuard>
  );
}

function ListsContent() {
  const utils = trpc.useUtils();
  const listMineQ = trpc.lists.listMine.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (last: any) => last.nextCursor ?? undefined,
    }
  );

  const listsIndexQ = useQuery({
    queryKey: ['lists-index'],
    queryFn: async () => {
      const r = await fetch('/data/lists');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as ListEntryMeta[];
    },
    staleTime: 5 * 60_000,
  });

  const deleteMutation = trpc.lists.delete.useMutation({
    onSuccess: () => utils.lists.listMine.invalidate(),
  });

  const setVisibilityMutation = trpc.lists.setVisibility.useMutation({
    onMutate: async (vars: any) => {
      await utils.lists.listMine.cancel();
      const previous = utils.lists.listMine.getInfiniteData({ limit: 20 });
      utils.lists.listMine.setInfiniteData({ limit: 20 }, (data: any) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p: any) => ({
            ...p,
            items: p.items.map((it: UserList) =>
              it.id === vars.id ? { ...it, is_public: vars.is_public, updated_at: Date.now() } : it
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.previous) utils.lists.listMine.setInfiniteData({ limit: 20 }, ctx.previous);
    },
    onSettled: () => utils.lists.listMine.invalidate(),
  });

  const lookupName = (list_id: string) => {
    const entry = listsIndexQ.data?.find((l) => l.list_id === list_id);
    return entry?.display_name ?? list_id;
  };

  const allItems: UserList[] = listMineQ.data?.pages.flatMap((p: any) => p.items) ?? [];

  if (listMineQ.isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading your lists…</main>;
  }
  if (listMineQ.error) {
    return (
      <main className="container mx-auto p-8 text-destructive">
        Failed to load lists: {(listMineQ.error as unknown as Error).message}
      </main>
    );
  }

  if (allItems.length === 0) {
    return (
      <main className="container mx-auto p-8">
        <h1 className="mb-4 text-2xl font-bold">My lists</h1>
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground">You haven't saved any lists yet.</p>
          <div className="mt-4">
            <Link to="/">
              <Button>Build your first list</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My lists</h1>
        <Link to="/">
          <Button variant="outline">New list</Button>
        </Link>
      </div>

      <ul className="space-y-3">
        {allItems.map((list) => (
          <ListRow
            key={list.id}
            list={list}
            factionName={lookupName(list.list_id)}
            onDelete={() => deleteMutation.mutate({ id: list.id })}
            onToggleVisibility={() =>
              setVisibilityMutation.mutate({ id: list.id, is_public: !list.is_public })
            }
          />
        ))}
      </ul>

      {listMineQ.hasNextPage && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => listMineQ.fetchNextPage()}
            disabled={listMineQ.isFetchingNextPage}
          >
            {listMineQ.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </main>
  );
}

function ListRow({
  list,
  factionName,
  onDelete,
  onToggleVisibility,
}: {
  list: UserList;
  factionName: string;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/v2/list/${list.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select prompt if clipboard API blocked
      window.prompt('Copy this URL:', url);
    }
  }

  return (
    <li className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <Link
            to="/build/$listId"
            params={{ listId: list.list_id }}
            search={{ from: list.id }}
            className="block"
          >
            <p className="truncate font-medium hover:underline">{list.title || 'Untitled list'}</p>
            <p className="text-xs text-muted-foreground">
              {factionName}
              {list.points_target != null && <> · {list.points_target} pts target</>}
              {' · '}
              updated {formatRelative(list.updated_at)}
            </p>
          </Link>
        </div>

        <span
          className={`rounded px-2 py-0.5 text-xs ${
            list.is_public
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {list.is_public ? 'Public' : 'Private'}
        </span>

        <div className="flex items-center gap-2">
          {list.is_public && (
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onToggleVisibility}>
            Make {list.is_public ? 'private' : 'public'}
          </Button>
          {confirmingDelete ? (
            <>
              <Button size="sm" variant="destructive" onClick={onDelete}>
                Confirm delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function formatRelative(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
