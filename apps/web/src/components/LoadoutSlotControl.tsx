import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  findUpgradeById,
  findUpgradeByStringId,
  getLoadoutPositions,
  type CatalogList,
  type CatalogFormation,
  type CatalogLoadoutSlot,
} from '@/stores/selectors';
import { useBuilderStore } from '@/stores/builder-store';

type Props = {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  formation: CatalogFormation;
  instanceId: string;
  loadoutChoices: Record<string, string[]> | undefined;
};

function variantDeltaLabel(catalog: CatalogList, slot: CatalogLoadoutSlot, chosenStringId: string): string {
  const defaultVariant = slot.variants.find((v) => v.is_default === true);
  const chosenUp = findUpgradeByStringId(catalog, chosenStringId);
  const chosenPts = chosenUp?.cost_pts ?? chosenUp?.pts ?? 0;
  if (defaultVariant) {
    const defaultUp = findUpgradeById(catalog, defaultVariant.upgrade_id);
    const defaultPts = defaultUp?.cost_pts ?? defaultUp?.pts ?? 0;
    const delta = chosenPts - defaultPts;
    return delta === 0 ? '(+0)' : delta > 0 ? `(+${delta})` : `(${delta})`;
  }
  return `(${chosenPts})`;
}

export function LoadoutSlotControl({ slot, catalog, formation, instanceId, loadoutChoices }: Props) {
  const positions = getLoadoutPositions(catalog, formation, loadoutChoices, slot.string_id) ?? [];
  const min = slot.min ?? 0;
  const max = slot.max ?? Infinity;
  const isUnderMin = positions.length < min;
  const canAdd = positions.length < max;

  return (
    <li className={`text-sm ${isUnderMin ? 'rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1' : ''}`}>
      <span className="text-xs uppercase text-muted-foreground">{slot.label}:</span>
      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
        {positions.map((pos, idx) => (
          <LoadoutChip
            key={`${slot.string_id}-${idx}`}
            slot={slot}
            catalog={catalog}
            instanceId={instanceId}
            position={pos}
            positionIndex={idx}
            isRemovable={positions.length > min}
          />
        ))}
        {canAdd && (
          <AddLoadoutChip slot={slot} catalog={catalog} instanceId={instanceId} />
        )}
      </span>
    </li>
  );
}

function LoadoutChip({
  slot,
  catalog,
  instanceId,
  position,
  positionIndex,
  isRemovable,
}: {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  instanceId: string;
  position: string;
  positionIndex: number;
  isRemovable: boolean;
}) {
  const builder = useBuilderStore();
  const [open, setOpen] = useState(false);
  const currentUp = position ? findUpgradeByStringId(catalog, position) : null;
  const display = currentUp?.name ?? '(empty)';
  const cost = position ? variantDeltaLabel(catalog, slot, position) : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Position ${positionIndex + 1} of ${slot.label}: ${display}`}
          className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted print:hidden"
        >
          <span>{display} {cost}</span>
          <span aria-hidden>▾</span>
          {isRemovable && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove position ${positionIndex + 1} from ${slot.label}`}
              onClick={(e) => { e.stopPropagation(); builder.removeLoadoutPosition(instanceId, slot.string_id, positionIndex); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); e.stopPropagation();
                  builder.removeLoadoutPosition(instanceId, slot.string_id, positionIndex);
                }
              }}
              className="ml-1 cursor-pointer text-muted-foreground hover:text-destructive"
            >
              ×
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <ul className="space-y-0.5 text-xs">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up?.string_id) return null;
            const checked = up.string_id === position;
            const label = variantDeltaLabel(catalog, slot, up.string_id);
            return (
              <li key={String(v.upgrade_id)}>
                <button
                  type="button"
                  onClick={() => {
                    builder.setLoadoutPosition(instanceId, slot.string_id, positionIndex, up.string_id!);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted ${checked ? 'bg-muted font-medium' : ''}`}
                >
                  <span>{up.name}</span>
                  <span className="text-muted-foreground">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AddLoadoutChip({
  slot,
  catalog,
  instanceId,
}: {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  instanceId: string;
}) {
  const builder = useBuilderStore();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Add ${slot.label} position`}
          className="inline-flex items-center gap-1 rounded-md border border-dashed bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted print:hidden"
        >
          <span>+ Add</span>
          <span aria-hidden>▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <ul className="space-y-0.5 text-xs">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up?.string_id) return null;
            const label = variantDeltaLabel(catalog, slot, up.string_id);
            return (
              <li key={String(v.upgrade_id)}>
                <button
                  type="button"
                  onClick={() => {
                    builder.appendLoadoutPosition(instanceId, slot.string_id, up.string_id!);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted"
                >
                  <span>{up.name}</span>
                  <span className="text-muted-foreground">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
