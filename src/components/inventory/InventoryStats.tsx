import type { InventoryStats } from "@/lib/inventory-utils";

type Props = {
  stats: InventoryStats;
};

export function InventoryStatsDisplay({ stats }: Props) {
  if (stats.total === 0) return null;

  return (
    <p className="text-sm text-muted-foreground">
      {stats.total} item{stats.total !== 1 && "s"} · {stats.byCategory.fridge} fridge · {stats.byCategory.freezer} freezer · {stats.byCategory.pantry} pantry · {stats.byCategory.spices} spices
    </p>
  );
}