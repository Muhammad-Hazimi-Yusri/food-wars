'use client';

import { AlertTriangle, Clock} from 'lucide-react';
import { InventoryStats } from '@/lib/inventory-utils';
import { cn } from '@/lib/utils';

type InventoryWarningsProps = {
  stats: InventoryStats;
  onFilterClick?: (filter: 'expired' | 'expiring') => void;
};

export function InventoryWarnings({ stats, onFilterClick }: InventoryWarningsProps) {
  if (stats.expired === 0 && stats.expiring === 0) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {stats.expired > 0 && (
        <button
          onClick={() => onFilterClick?.('expired')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'bg-red-100 text-red-800 hover:bg-red-200'
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>{stats.expired} expired</span>
        </button>
      )}

      {stats.expiring > 0 && (
        <button
          onClick={() => onFilterClick?.('expiring')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'bg-amber-100 text-amber-800 hover:bg-amber-200'
          )}
        >
          <Clock className="h-4 w-4" />
          <span>{stats.expiring} expiring soon</span>
        </button>
      )}
    </div>
  );
}