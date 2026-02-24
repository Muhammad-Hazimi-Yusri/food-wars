import { getHouseholdWaste } from "@/lib/analytics-actions";
import { WasteChart } from "@/components/reports/WasteChart";
import { Trash2 } from "lucide-react";

export default async function WasteReportPage() {
  const data = await getHouseholdWaste();

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500 mb-1">Total items spoiled</p>
          <p className="text-3xl font-bold text-red-600">{data.totalItems}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500 mb-1">Estimated value wasted</p>
          <p className="text-3xl font-bold text-gray-800">
            £{data.totalValueWasted.toFixed(2)}
          </p>
          {data.totalValueWasted === 0 && data.totalItems > 0 && (
            <p className="text-xs text-gray-400 mt-1">No prices recorded</p>
          )}
        </div>
      </div>

      {data.totalItems === 0 ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-center gap-3">
          <Trash2 className="h-12 w-12 text-gray-200" />
          <div>
            <p className="font-medium text-gray-500">No waste recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Items marked as spoiled will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Weekly chart */}
          {data.byWeek.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Spoiled items per week</h2>
              <WasteChart data={data.byWeek} />
            </div>
          )}

          {/* By product group */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-800">By product group</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Group</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Items spoiled</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Value wasted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.byGroup.map((row) => (
                  <tr key={row.groupName} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{row.groupName}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{row.count}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {row.value > 0 ? `£${row.value.toFixed(2)}` : "—"}
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
