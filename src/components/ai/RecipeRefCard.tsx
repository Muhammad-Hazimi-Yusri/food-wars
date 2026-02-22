"use client";

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import type { RecipeRef } from "@/types/ai";

export function RecipeRefCard({ recipeRef }: { recipeRef: RecipeRef }) {
  return (
    <Link
      href={`/recipes/${recipeRef.recipe_id}`}
      className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        {recipeRef.can_make ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className="font-medium truncate">{recipeRef.recipe_name}</span>
        {!recipeRef.can_make && recipeRef.missing_count > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            missing {recipeRef.missing_count}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">View →</span>
    </Link>
  );
}
