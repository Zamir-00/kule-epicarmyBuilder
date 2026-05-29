import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface ListEntry {
  list_id: string;
  faction_id?: string;
  ruleset?: string;
  version?: string;
  by?: string;
  display_name?: string;
}

async function fetchLists(): Promise<ListEntry[]> {
  const res = await fetch('/data/lists');
  if (!res.ok) throw new Error(`Failed to fetch lists: ${res.status}`);
  return res.json() as Promise<ListEntry[]>;
}

export const Route = createFileRoute('/')({
  component: ListPicker,
});

function ListPicker() {
  const lists = useQuery({ queryKey: ['lists-index'], queryFn: fetchLists, staleTime: 5 * 60_000 });
  const [ruleset, setRuleset] = useState<string>('NETEA');

  if (lists.isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading lists…</main>;
  }
  if (lists.error) {
    return <main className="container mx-auto p-8 text-destructive">Failed to load list catalog.</main>;
  }

  const all = lists.data ?? [];
  const rulesets = Array.from(new Set(all.map((l) => l.ruleset).filter((r): r is string => !!r))).sort();
  const filtered = all.filter((l) => !ruleset || l.ruleset === ruleset);

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Pick an army list</h1>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="ruleset-filter">Ruleset:</label>
          <select
            id="ruleset-filter"
            value={ruleset}
            onChange={(e) => setRuleset(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2"
          >
            <option value="">All</option>
            {rulesets.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No lists for this ruleset.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <Link
              key={entry.list_id}
              to="/build/$listId"
              params={{ listId: entry.list_id }}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight">{entry.display_name ?? entry.list_id}</h2>
                {entry.ruleset && (
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{entry.ruleset}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{entry.list_id}</p>
              {entry.version && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{entry.version}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
