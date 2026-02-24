"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PurchaseRow } from "@/lib/analytics-actions";

// Palette for up to 6 distinct stores
const STORE_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#dc2626", // red-600
  "#9333ea", // purple-600
  "#ea580c", // orange-600
  "#0891b2", // cyan-600
];

type Props = {
  rows: PurchaseRow[];
  unitName: string;
};

export function PriceHistoryChart({ rows, unitName }: Props) {
  // Need at least 2 data points to draw a meaningful line
  if (rows.length < 2) return null;

  // Collect unique store labels (null → "Unknown")
  const storeSet = new Set<string>();
  for (const r of rows) storeSet.add(r.storeName ?? "Unknown");
  const stores = Array.from(storeSet);

  // Build chart data: one entry per date (ascending), one key per store
  // Reverse rows so they are oldest-first for the chart
  const ascending = [...rows].reverse();

  type ChartPoint = { date: string; [key: string]: string | number | null | undefined };
  const points: ChartPoint[] = ascending
    .filter((r) => r.price != null)
    .map((r) => ({
      date: new Date(r.purchasedAt).toLocaleDateString(),
      [r.storeName ?? "Unknown"]: r.price!,
    }));

  // Merge entries that share the same date
  const merged: ChartPoint[] = [];
  for (const pt of points) {
    const existing = merged.find((m) => m.date === pt.date);
    if (existing) {
      Object.assign(existing, pt);
    } else {
      merged.push({ ...pt });
    }
  }

  if (merged.length < 2) return null;

  return (
    <div>
      <h4 className="font-medium mb-3 text-sm">Price over time</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            tickFormatter={(v) => `£${v.toFixed(2)}`}
          />
          <Tooltip
            formatter={(value: unknown) =>
              `£${(value as number).toFixed(2)} / ${unitName}`
            }
          />
          {stores.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {stores.map((store, i) => (
            <Line
              key={store}
              type="monotone"
              dataKey={store}
              stroke={STORE_COLORS[i % STORE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
