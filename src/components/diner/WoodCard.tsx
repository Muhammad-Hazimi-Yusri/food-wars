import { Pencil, Trash2 } from "lucide-react";
import type { InventoryItem } from "@/types/database";

type ExpiryStatus = "fresh" | "warning" | "urgent" | "expired";

function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return "fresh";
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "expired";
  if (daysUntil <= 2) return "urgent";
  if (daysUntil <= 7) return "warning";
  return "fresh";
}

const badgeStyles: Record<ExpiryStatus, string> = {
  fresh: "bg-green-600 text-white",
  warning: "bg-takumi text-megumi-dark",
  urgent: "bg-soma text-white animate-pulse",
  expired: "bg-kurokiba text-white line-through",
};

const badgeLabels: Record<ExpiryStatus, string> = {
  fresh: "Fresh",
  warning: "Use soon",
  urgent: "Expiring!",
  expired: "Expired",
};

type Props = {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (id: string) => void;
};

export function WoodCard({ item, onEdit, onDelete }: Props) {
  const status = getExpiryStatus(item.expiry_date);

  return (
    <div className="bg-[#DEB887] rounded-lg border border-black/10 shadow-md p-4 space-y-2">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-megumi-dark">{item.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${badgeStyles[status]}`}>
          {badgeLabels[status]}
        </span>
      </div>

      <p className="text-sm text-megumi-dark/70">
        {item.quantity} {item.unit} · {item.category}
      </p>

      {item.expiry_date && (
        <p className="text-xs text-megumi-dark/50">
          Expires: {new Date(item.expiry_date).toLocaleDateString()}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded hover:bg-black/10"
          >
            <Pencil className="w-4 h-4 text-megumi-dark/70" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded hover:bg-black/10"
          >
            <Trash2 className="w-4 h-4 text-kurokiba" />
          </button>
        )}
      </div>
    </div>
  );
}