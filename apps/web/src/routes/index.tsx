import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';

interface ListEntry {
  list_id: string;
  faction_id?: string;
  faction_group: string;
  ruleset?: string;
  version?: string;
  by?: string;
  display_name?: string;
}

// Display order for faction groups. Mirrors the backend prefix table.
// Groups not in this list (shouldn't happen — backend assigns "Other" as the
// catch-all) sort to the end alphabetically.
const FACTION_GROUP_ORDER = [
  'Space Marines',
  'Imperial Guard',
  'Chaos',
  'Eldar',
  'Xenos',
  'Orks',
  'Adeptus Mechanicus',
  'Inquisition',
  'Horus Heresy',
  'Squats',
  'Other',
];

function groupOrderIndex(group: string): number {
  const i = FACTION_GROUP_ORDER.indexOf(group);
  return i === -1 ? FACTION_GROUP_ORDER.length : i;
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
  const [faction, setFaction] = useState<string>('');

  const all = lists.data ?? [];
  const rulesets = useMemo(
    () => Array.from(new Set(all.map((l) => l.ruleset).filter((r): r is string => !!r))).sort(),
    [all],
  );

  // Lists in the current ruleset (faction filter not yet applied) drive the
  // faction dropdown options — so the dropdown only shows groups that have any
  // lists at the current ruleset.
  const inRuleset = useMemo(
    () => all.filter((l) => !ruleset || l.ruleset === ruleset),
    [all, ruleset],
  );

  const factionsInRuleset = useMemo(() => {
    const set = new Set(inRuleset.map((l) => l.faction_group));
    return Array.from(set).sort((a, b) => groupOrderIndex(a) - groupOrderIndex(b));
  }, [inRuleset]);

  const filtered = useMemo(
    () => inRuleset.filter((l) => !faction || l.faction_group === faction),
    [inRuleset, faction],
  );

  // Group + order: by FACTION_GROUP_ORDER, then alphabetical within a group.
  const grouped = useMemo(() => {
    const map = new Map<string, ListEntry[]>();
    for (const e of filtered) {
      const arr = map.get(e.faction_group) ?? [];
      arr.push(e);
      map.set(e.faction_group, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        (a.display_name ?? a.list_id).localeCompare(b.display_name ?? b.list_id),
      );
    }
    return Array.from(map.entries()).sort(
      (a, b) => groupOrderIndex(a[0]) - groupOrderIndex(b[0]),
    );
  }, [filtered]);

  if (lists.isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading lists…</main>;
  }
  if (lists.error) {
    return <main className="container mx-auto p-8 text-destructive">Failed to load list catalog.</main>;
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Pick an army list</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            <label htmlFor="faction-filter">Faction:</label>
            <select
              id="faction-filter"
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2"
            >
              <option value="">All</option>
              {factionsInRuleset.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No lists for this filter.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([group, items]) => (
            <section key={group}>
              <h2 className="mb-3 border-b pb-1 text-xl font-semibold">
                {group} <span className="text-sm font-normal text-muted-foreground">· {items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((entry) => (
                  <Link
                    key={entry.list_id}
                    to="/build/$listId"
                    params={{ listId: entry.list_id }}
                    className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{entry.display_name ?? entry.list_id}</h3>
                      {entry.ruleset && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{entry.ruleset}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.list_id}</p>
                    {entry.version && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{entry.version}</p>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
