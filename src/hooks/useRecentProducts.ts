import { useState, useCallback } from "react";

const STORAGE_KEY = "food-wars-recent-products";
const DEFAULT_LIMIT = 5;

function loadRecent(limit: number): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.slice(0, limit);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Hook to track recently used product IDs in localStorage.
 * Returns the most recent IDs (newest first) and a function to record usage.
 */
export function useRecentProducts(limit: number = DEFAULT_LIMIT) {
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecent(limit));

  const addRecent = useCallback(
    (productId: string) => {
      setRecentIds((prev) => {
        // Remove if already present, then prepend
        const updated = [productId, ...prev.filter((id) => id !== productId)].slice(
          0,
          limit
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
        return updated;
      });
    },
    [limit]
  );

  return { recentIds, addRecent };
}
