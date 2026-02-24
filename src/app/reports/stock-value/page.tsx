import { getStockValueByGroup } from "@/lib/analytics-actions";
import { SpendingChart } from "@/components/reports/SpendingChart";
import { Package } from "lucide-react";

export default async function StockValueReportPage() {
  const data = await getStockValueByGroup();

  const chartData = data.byGroup.map((r) => ({ label: r.groupName, total: r.value }));

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500 mb-1">Total inventory value</p>
        <p className="text-3xl font-bold text-gray-800">£{data.totalValue.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">Current in-stock items with prices</p>
      </div>

      {data.totalValue === 0 ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-center gap-3">
          <Package className="h-12 w-12 text-gray-200" />
          <div>
            <p className="font-medium text-gray-500">No stock value data yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add stock entries with prices to track inventory value.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Value by product group</h2>
              <SpendingChart data={chartData} color="#9333ea" />
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
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Batches</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Value</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">% of total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.byGroup.map((row) => (
                  <tr key={row.groupName} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{row.groupName}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{row.itemCount}</td>
                    <td className="px-4 py-2 text-right text-gray-700">£{row.value.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {data.totalValue > 0
                        ? `${Math.round((row.value / data.totalValue) * 100)}%`
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
