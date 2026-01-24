'use client';

import { Package, MapPin, Calendar, AlertTriangle } from 'lucide-react';
import { StockEntryWithProduct } from '@/types/database';
import { getExpiryStatus, getExpiryLabel } from '@/lib/inventory-utils';
import { cn } from '@/lib/utils';

type StockCardProps = {
  entry: StockEntryWithProduct;
  onEdit?: (entry: StockEntryWithProduct) => void;
  onDelete?: (entry: StockEntryWithProduct) => void;
};

export function StockCard({ entry, onEdit, onDelete }: StockCardProps) {
  const { product } = entry;
  const expiryStatus = getExpiryStatus(entry.best_before_date, product.due_type);
  const expiryLabel = getExpiryLabel(entry.best_before_date, product.due_type);

  const statusStyles = {
    expired: 'border-l-red-500 bg-red-50',
    expiring: 'border-l-amber-500 bg-amber-50',
    fresh: 'border-l-green-500 bg-green-50',
    none: 'border-l-gray-300 bg-white',
  };

  const badgeStyles = {
    expired: 'bg-red-100 text-red-800',
    expiring: 'bg-amber-100 text-amber-800',
    fresh: 'bg-green-100 text-green-800',
    none: 'bg-gray-100 text-gray-600',
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 p-4 shadow-sm transition-shadow hover:shadow-md',
        statusStyles[expiryStatus]
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-semibold text-gray-900">{product.name}</h3>
        {entry.open && (
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
            Opened
          </span>
        )}
      </div>

      {/* Amount & Unit */}
      <div className="mb-3 flex items-center gap-2 text-lg font-medium">
        <Package className="h-4 w-4 text-gray-500" />
        <span>
          {entry.amount} {product.qu_stock?.name_plural ?? product.qu_stock?.name ?? 'units'}
        </span>
      </div>

      {/* Location */}
      {entry.location && (
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>{entry.location.name}</span>
        </div>
      )}

      {/* Product Group */}
      {product.product_group && (
        <div className="mb-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {product.product_group.name}
          </span>
        </div>
      )}

      {/* Expiry */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className={cn('rounded px-2 py-0.5 text-xs', badgeStyles[expiryStatus])}>
            {expiryLabel}
          </span>
        </div>

        {expiryStatus === 'expired' && product.due_type === 2 && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="mt-4 flex gap-2 border-t pt-3">
          {onEdit && (
            <button
              onClick={() => onEdit(entry)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(entry)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}