'use client';

import { Package } from 'lucide-react';
import { InventoryStats } from '@/lib/inventory-utils';

type InventoryStatsDisplayProps = {
  stats: InventoryStats;
};

export function InventoryStatsDisplay({ stats }: InventoryStatsDisplayProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Total Items */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <Package className="h-4 w-4" />
          <span className="text-sm">Total</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
      </div>

      {/* Fresh */}
      <div className="rounded-lg bg-green-50 p-4 shadow-sm">
        <div className="text-green-600">
          <span className="text-sm">Fresh</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-green-700">{stats.fresh}</p>
      </div>

      {/* Expiring */}
      <div className="rounded-lg bg-amber-50 p-4 shadow-sm">
        <div className="text-amber-600">
          <span className="text-sm">Expiring</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-amber-700">{stats.expiring}</p>
      </div>

      {/* Expired */}
      <div className="rounded-lg bg-red-50 p-4 shadow-sm">
        <div className="text-red-600">
          <span className="text-sm">Expired</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-red-700">{stats.expired}</p>
      </div>
    </div>
  );
}