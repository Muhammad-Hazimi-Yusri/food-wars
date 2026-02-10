"use client";

import { useMemo } from "react";
import { StockLogWithRelations } from "@/types/database";
import { TYPE_LABELS, TYPE_COLORS, formatAmount } from "./journal-constants";

type SummaryRow = {
  key: string;
  productName: string;
  transactionType: string;
  totalAmount: number;
  count: number;
  unitName: string | undefined;
  unitNamePlural: string | null | undefined;
};

type JournalSummaryProps = {
  logs: StockLogWithRelations[];
};

export function JournalSummary({ logs }: JournalSummaryProps) {
  const rows = useMemo(() => {
    const map = new Map<string, SummaryRow>();

    for (const log of logs) {
      if (log.undone) continue;

      const key = `${log.product_id}::${log.transaction_type}`;
      const existing = map.get(key);

      if (existing) {
        existing.totalAmount += log.amount;
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          productName: log.product?.name ?? "Unknown",
          transactionType: log.transaction_type,
          totalAmount: log.amount,
          count: 1,
          unitName: log.product?.qu_stock?.name,
          unitNamePlural: log.product?.qu_stock?.name_plural,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const nameCompare = a.productName.localeCompare(b.productName);
      if (nameCompare !== 0) return nameCompare;
      return a.transactionType.localeCompare(b.transactionType);
    });
  }, [logs]);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-gray-500">
        No transactions to summarize.
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Total Qty</th>
              <th className="px-4 py-3 font-medium text-right">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const typeLabel = TYPE_LABELS[row.transactionType] ?? row.transactionType;
              const typeColor = TYPE_COLORS[row.transactionType] ?? "bg-gray-100 text-gray-700";
              const unit = row.unitName
                ? { name: row.unitName, name_plural: row.unitNamePlural ?? null }
                : null;

              return (
                <tr key={row.key} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.productName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatAmount(row.totalAmount, unit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {row.count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        {rows.map((row) => {
          const typeLabel = TYPE_LABELS[row.transactionType] ?? row.transactionType;
          const typeColor = TYPE_COLORS[row.transactionType] ?? "bg-gray-100 text-gray-700";
          const unit = row.unitName
            ? { name: row.unitName, name_plural: row.unitNamePlural ?? null }
            : null;

          return (
            <div key={row.key} className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {row.productName}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${typeColor}`}>
                    {typeLabel}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums">
                    {formatAmount(row.totalAmount, unit)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.count} {row.count === 1 ? "transaction" : "transactions"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
