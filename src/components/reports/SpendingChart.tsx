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

type BarItem = { label: string; total: number };

export function SpendingChart({ data, color = "#2563eb" }: { data: BarItem[]; color?: string }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          tickFormatter={(v) => `£${v.toFixed(0)}`}
        />
        <Tooltip formatter={(value: unknown) => [`£${(value as number).toFixed(2)}`, "Spend"]} />
        <Bar dataKey="total" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
