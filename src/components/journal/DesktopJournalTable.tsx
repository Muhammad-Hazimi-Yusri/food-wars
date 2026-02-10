"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogWithRelations, StockTransactionType } from "@/types/database";
import { undoTransaction } from "@/lib/stock-actions";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  consume: "Consumed",
  spoiled: "Spoiled",
  "product-opened": "Opened",
  "transfer-from": "Transferred",
  "inventory-correction": "Corrected",
  purchase: "Purchased",
};

const TYPE_COLORS: Record<string, string> = {
  consume: "bg-blue-100 text-blue-700",
  spoiled: "bg-red-100 text-red-700",
  "product-opened": "bg-amber-100 text-amber-700",
  "transfer-from": "bg-purple-100 text-purple-700",
  "inventory-correction": "bg-teal-100 text-teal-700",
  purchase: "bg-green-100 text-green-700",
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatAmount(amount: number, unit?: { name: string; name_plural: string | null } | null): string {
  const unitName = amount === 1 ? (unit?.name ?? "") : (unit?.name_plural ?? unit?.name ?? "");
  return `${amount}${unitName ? ` ${unitName}` : ""}`;
}

type DesktopJournalTableProps = {
  logs: StockLogWithRelations[];
};

export function DesktopJournalTable({ logs }: DesktopJournalTableProps) {
  const router = useRouter();
  const [undoing, setUndoing] = useState<string | null>(null);

  const handleUndo = async (log: StockLogWithRelations) => {
    if (!log.correlation_id) return;
    setUndoing(log.id);
    try {
      const result = await undoTransaction(
        log.correlation_id,
        log.transaction_type as StockTransactionType
      );
      if (result.success) {
        toast("Transaction undone");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to undo");
      }
    } finally {
      setUndoing(null);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-gray-500">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-600">
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Qty</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium w-[60px]"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const typeLabel = TYPE_LABELS[log.transaction_type] ?? log.transaction_type;
            const typeColor = TYPE_COLORS[log.transaction_type] ?? "bg-gray-100 text-gray-700";
            const canUndo = !log.undone && !!log.correlation_id;

            return (
              <tr
                key={log.id}
                className={`border-b last:border-b-0 hover:bg-gray-50 ${
                  log.undone ? "opacity-50" : ""
                }`}
              >
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatTimestamp(log.created_at)}
                </td>
                <td className={`px-4 py-3 font-medium ${log.undone ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {log.product?.name ?? "Unknown"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                    {typeLabel}
                  </span>
                  {log.undone && (
                    <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      Undone
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${log.undone ? "line-through text-gray-400" : ""}`}>
                  {formatAmount(log.amount, log.product?.qu_stock)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.location?.name ?? "\u2014"}
                </td>
                <td className="px-4 py-3">
                  {canUndo && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-megumi"
                      onClick={() => handleUndo(log)}
                      disabled={undoing === log.id}
                    >
                      {undoing === log.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
