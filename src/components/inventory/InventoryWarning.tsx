import { AlertTriangle, Clock, XCircle } from "lucide-react";
import type { InventoryStats } from "@/lib/inventory-utils";

type Props = {
  stats: InventoryStats;
};

export function InventoryWarnings({ stats }: Props) {
  const { expired, urgent, warning } = stats.byStatus;
  
  // Don't render if no warnings
  if (expired === 0 && urgent === 0 && warning === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {expired > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-kurokiba/10 text-kurokiba text-sm">
          <XCircle className="w-4 h-4" />
          <span>{expired} expired</span>
        </div>
      )}
      {urgent > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-soma/10 text-soma text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{urgent} expiring soon</span>
        </div>
      )}
      {warning > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-takumi/10 text-takumi-dark text-sm">
          <Clock className="w-4 h-4" />
          <span>{warning} use this week</span>
        </div>
      )}
    </div>
  );
}