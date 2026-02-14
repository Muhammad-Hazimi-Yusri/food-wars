import { Utensils } from "lucide-react";
import type { ProductNutrition } from "@/types/database";

type NutritionLabelProps = {
  nutrition: ProductNutrition | null;
};

function Row({
  label,
  value,
  unit = "g",
  indent = false,
}: {
  label: string;
  value: number | null;
  unit?: string;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className={`py-1 ${indent ? "pl-4 text-gray-500" : "font-medium"}`}>
        {label}
      </td>
      <td className="py-1 text-right tabular-nums">
        {value != null ? `${value} ${unit}` : "\u2014"}
      </td>
    </tr>
  );
}

export function NutritionLabel({ nutrition }: NutritionLabelProps) {
  if (!nutrition) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
        <Utensils className="h-4 w-4" />
        <span>No nutrition data</span>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <h4 className="font-semibold mb-2">Nutrition Facts (per 100g)</h4>
      <table className="w-full">
        <tbody>
          <Row label="Energy" value={nutrition.energy_kj} unit="kJ" />
          <Row label="Energy" value={nutrition.energy_kcal} unit="kcal" />
          <Row label="Fat" value={nutrition.fat} />
          <Row label="of which saturates" value={nutrition.saturated_fat} indent />
          <Row label="Carbohydrate" value={nutrition.carbohydrates} />
          <Row label="of which sugars" value={nutrition.sugars} indent />
          <Row label="Fibre" value={nutrition.fibre} />
          <Row label="Protein" value={nutrition.protein} />
          <Row label="Salt" value={nutrition.salt} />
        </tbody>
      </table>
      {nutrition.data_source === "off" && (
        <p className="text-xs text-gray-400 mt-2">
          Source: Open Food Facts
        </p>
      )}
    </div>
  );
}
