'use client';

import { useState } from 'react';
import { StockEntryWithProduct } from '@/types/database';
import {
  ExpiryStatus,
  getInventoryStats,
  filterByExpiryStatus,
  sortByConsumePriority,
} from '@/lib/inventory-utils';
import { StockCard } from './StockCard';
import { InventoryWarnings } from './InventoryWarning';
import { InventoryStatsDisplay } from './InventoryStats';

type StockListProps = {
  entries: StockEntryWithProduct[];
  onEdit?: (entry: StockEntryWithProduct) => void;
  onDelete?: (entry: StockEntryWithProduct) => void;
};

export function StockList({ entries, onEdit, onDelete }: StockListProps) {
  const [filter, setFilter] = useState<ExpiryStatus | 'all'>('all');

  const stats = getInventoryStats(entries);
  const sorted = sortByConsumePriority(entries);
  const filtered = filterByExpiryStatus(sorted, filter);

  const handleFilterClick = (status: 'expired' | 'expiring') => {
    setFilter((prev) => (prev === status ? 'all' : status));
  };

  return (
    <div>
      {/* Stats */}
      <InventoryStatsDisplay stats={stats} />

      {/* Warnings */}
      <InventoryWarnings stats={stats} onFilterClick={handleFilterClick} />

      {/* Active Filter */}
      {filter !== 'all' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Showing: <strong>{filter}</strong>
          </span>
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">
            {entries.length === 0
              ? 'No items in stock. Add your first item!'
              : 'No items match the current filter.'}
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry) => (
          <StockCard
            key={entry.id}
            entry={entry}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}