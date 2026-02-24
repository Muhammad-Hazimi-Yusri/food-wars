"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WasteByWeek } from "@/lib/analytics-actions";

export function WasteChart({ data }: { data: WasteByWeek[] }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value: unknown) => [`${value as number}`, "Items spoiled"]}
        />
        <Bar dataKey="count" fill="#dc2626" radius={[3, 3, 0, 0]} name="Items spoiled" />
      </BarChart>
    </ResponsiveContainer>
  );
}
