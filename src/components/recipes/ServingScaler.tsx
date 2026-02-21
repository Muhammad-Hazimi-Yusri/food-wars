"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  baseServings: number;
  desiredServings: number;
  onChange: (value: number) => void;
};

const STEP = 0.5;
const MIN = 0.25;
const QUICK_MULTIPLIERS = [0.5, 1, 2, 3] as const;

export function ServingScaler({ baseServings, desiredServings, onChange }: Props) {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= MIN) onChange(val);
  };

  const step = (delta: number) => {
    const next = Math.max(MIN, parseFloat((desiredServings + delta).toFixed(2)));
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700 shrink-0">Servings:</span>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => step(-STEP)}
          disabled={desiredServings <= MIN}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={MIN}
          step={STEP}
          value={desiredServings}
          onChange={handleInput}
          className="h-7 w-16 text-center px-1 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => step(STEP)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Quick-set multipliers */}
      <div className="flex items-center gap-1">
        {QUICK_MULTIPLIERS.map((mult) => {
          const target = parseFloat((baseServings * mult).toFixed(2));
          const active = desiredServings === target;
          return (
            <Button
              key={mult}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(target)}
            >
              ×{mult}
            </Button>
          );
        })}
      </div>

      {baseServings !== desiredServings && (
        <span className="text-xs text-muted-foreground">
          (base: {baseServings})
        </span>
      )}
    </div>
  );
}
