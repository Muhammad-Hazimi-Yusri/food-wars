export const TYPE_LABELS: Record<string, string> = {
  consume: "Consumed",
  spoiled: "Spoiled",
  "product-opened": "Opened",
  "transfer-from": "Transferred",
  "inventory-correction": "Corrected",
  purchase: "Purchased",
};

export const TYPE_COLORS: Record<string, string> = {
  consume: "bg-blue-100 text-blue-700",
  spoiled: "bg-red-100 text-red-700",
  "product-opened": "bg-amber-100 text-amber-700",
  "transfer-from": "bg-purple-100 text-purple-700",
  "inventory-correction": "bg-teal-100 text-teal-700",
  purchase: "bg-green-100 text-green-700",
};

export function formatTimestamp(iso: string): string {
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

export function formatAmount(
  amount: number,
  unit?: { name: string; name_plural: string | null } | null
): string {
  const unitName =
    amount === 1 ? (unit?.name ?? "") : (unit?.name_plural ?? unit?.name ?? "");
  return `${amount}${unitName ? ` ${unitName}` : ""}`;
}
