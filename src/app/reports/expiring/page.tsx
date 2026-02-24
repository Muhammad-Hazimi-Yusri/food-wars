import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/reports/PrintButton";
import { Clock } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  expired: "bg-red-100 text-red-700",
  due_soon: "bg-amber-100 text-amber-700",
  fresh: "bg-green-100 text-green-700",
};

function expiryStatus(bestBeforeDate: string | null): { label: string; style: string } {
  if (!bestBeforeDate || bestBeforeDate === "2999-12-31") {
    return { label: "No expiry", style: "bg-gray-100 text-gray-500" };
  }
  const now = new Date();
  const due = new Date(bestBeforeDate);
  const diffDays = Math.ceil((due.getTime() - now.setHours(0,0,0,0)) / 86400000);

  if (diffDays < 0)   return { label: `${Math.abs(diffDays)}d overdue`, style: STATUS_BADGE.expired };
  if (diffDays === 0) return { label: "Due today",                       style: STATUS_BADGE.expired };
  if (diffDays <= 7)  return { label: `Due in ${diffDays}d`,             style: STATUS_BADGE.due_soon };
  return { label: `${diffDays}d`,                                         style: STATUS_BADGE.fresh };
}

export default async function ExpiringReportPage() {
  const supabase = await createClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);
  const inSevenDays = cutoff.toISOString().split("T")[0];

  const { data } = await supabase
    .from("stock_entries")
    .select(`
      id,
      amount,
      best_before_date,
      location:locations(name),
      product:products(
        name,
        qu_stock:quantity_units!qu_id_stock(name, name_plural)
      )
    `)
    .gt("amount", 0)
    .lte("best_before_date", inSevenDays)
    .neq("best_before_date", "2999-12-31")
    .order("best_before_date", { ascending: true })
    .limit(500);

  const entries = data ?? [];
  const printDate = new Date().toLocaleDateString();

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="print-hide flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Items with best-before date within the next 7 days (or already overdue)
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only title */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Expiring Soon</h1>
        <p className="text-sm text-gray-500">As of {printDate}</p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-center gap-3 print-hide">
          <Clock className="h-12 w-12 text-gray-200" />
          <div>
            <p className="font-medium text-gray-500">Nothing expiring soon</p>
            <p className="text-sm text-gray-400 mt-1">
              Items due within 7 days will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Product</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Location</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Due date</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => {
                const product = entry.product as unknown as {
                  name: string;
                  qu_stock: { name: string; name_plural: string | null } | null;
                } | null;
                const location = entry.location as unknown as { name: string } | null;
                const unitName = product?.qu_stock?.name ?? "unit";
                const unitNamePlural = product?.qu_stock?.name_plural ?? `${unitName}s`;
                const status = expiryStatus(entry.best_before_date);

                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {product?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {entry.amount} {entry.amount === 1 ? unitName : unitNamePlural}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{location?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {entry.best_before_date
                        ? new Date(entry.best_before_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${status.style}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Print footer watermark */}
      <div className="print-footer hidden print:block" data-date={printDate} />
    </div>
  );
}
