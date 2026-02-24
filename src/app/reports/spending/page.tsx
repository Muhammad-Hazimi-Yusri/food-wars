import { getHouseholdSpending } from "@/lib/analytics-actions";
import { SpendingChart } from "@/components/reports/SpendingChart";
import { ShoppingBag } from "lucide-react";

export default async function SpendingReportPage() {
  // Default: all time. Pass `days` to getHouseholdSpending for date filtering.
  const data = await getHouseholdSpending();

  const groupChartData = data.byGroup.map((r) => ({ label: r.groupName, total: r.total }));
  const storeChartData = data.byStore.map((r) => ({ label: r.storeName, total: r.total }));

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500 mb-1">Total spend recorded</p>
        <p className="text-3xl font-bold text-blue-600">£{data.totalSpend.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">From purchase log (all time)</p>
      </div>

      {data.totalSpend === 0 ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-center gap-3">
          <ShoppingBag className="h-12 w-12 text-gray-200" />
          <div>
            <p className="font-medium text-gray-500">No spending data yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add stock with prices to track spending.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* By product group */}
          {groupChartData.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Spend by product group</h2>
              <SpendingChart data={groupChartData} color="#2563eb" />
            </div>
          )}

          {/* By store */}
          {storeChartData.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Spend by store</h2>
              <SpendingChart data={storeChartData} color="#16a34a" />
            </div>
          )}

          {/* Breakdown table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-800">By product group</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Group</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Total spend</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">% of total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.byGroup.map((row) => (
                  <tr key={row.groupName} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{row.groupName}</td>
                    <td className="px-4 py-2 text-right text-gray-700">£{row.total.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {data.totalSpend > 0
                        ? `${Math.round((row.total / data.totalSpend) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
