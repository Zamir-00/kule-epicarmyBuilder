import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

interface Faction {
  slug: string;
  js_file: string | null;
  source_json: string | null;
  status: 'MIGRATED' | 'DYNAMIC' | 'STATIC-OK' | 'STATIC-NO-SOURCE';
}

async function fetchFactions(): Promise<Faction[]> {
  const res = await fetch('/data/factions');
  if (!res.ok) throw new Error(`Failed to fetch factions: ${res.status}`);
  return res.json() as Promise<Faction[]>;
}

export const Route = createFileRoute('/')({
  component: FactionPicker,
});

function FactionPicker() {
  const factions = useQuery({
    queryKey: ['factions'],
    queryFn: fetchFactions,
    staleTime: 5 * 60_000,
  });

  if (factions.isLoading) {
    return <div className="container mx-auto p-8 text-muted-foreground">Loading factions…</div>;
  }
  if (factions.error) {
    return (
      <div className="container mx-auto p-8 text-destructive">
        Failed to load factions: {(factions.error as Error).message}
      </div>
    );
  }
  const items = factions.data ?? [];

  return (
    <main className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Pick a faction</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((f) => (
          <FactionCard key={f.slug} faction={f} />
        ))}
      </div>
    </main>
  );
}

function FactionCard({ faction }: { faction: Faction }) {
  const tag =
    faction.status === 'MIGRATED' ? 'Live' :
    faction.status === 'DYNAMIC' ? 'Live' :
    faction.status === 'STATIC-OK' ? 'Static' :
    'No source';
  const tagColor =
    faction.status === 'STATIC-NO-SOURCE'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-secondary text-secondary-foreground';

  return (
    <Link
      to="/build/$listId"
      params={{ listId: faction.slug }}
      className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold leading-tight">{faction.slug}</h2>
        <span className={`rounded px-2 py-0.5 text-xs ${tagColor}`}>{tag}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {faction.source_json ?? 'no source-json'}
      </p>
    </Link>
  );
}
