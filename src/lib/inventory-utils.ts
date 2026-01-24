import type { InventoryItem, ItemCategory } from "@/types/database";

export type ExpiryStatus = "fresh" | "warning" | "urgent" | "expired";

export function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return "fresh";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) return "expired";
  if (daysUntil <= 2) return "urgent";
  if (daysUntil <= 7) return "warning";
  return "fresh";
}

export type InventoryStats = {
  total: number;
  byStatus: Record<ExpiryStatus, number>;
  byCategory: Record<ItemCategory, number>;
};

export function getInventoryStats(items: InventoryItem[]): InventoryStats {
  const stats: InventoryStats = {
    total: items.length,
    byStatus: { fresh: 0, warning: 0, urgent: 0, expired: 0 },
    byCategory: { fridge: 0, freezer: 0, pantry: 0, spices: 0 },
  };

  for (const item of items) {
    const status = getExpiryStatus(item.expiry_date);
    stats.byStatus[status]++;
    stats.byCategory[item.category]++;
  }

  return stats;
}