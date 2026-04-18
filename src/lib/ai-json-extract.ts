/**
 * Shared JSON-extraction strategies for parsing LLM responses that may be
 * surrounded by prose, wrapped in markdown code fences, or truncated.
 *
 * Used by both `ai-parse-items.ts` (receipt/stock natural-language parsing)
 * and `ai-parse-import.ts` (pasted structured JSON import).
 */

/**
 * Find the index of the matching closing bracket for the bracket at `start`.
 * Handles nested brackets and string literals.
 */
export function findMatchingBracket(str: string, start: number): number {
  const open = str[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return i;
  }
  return -1;
}

/** Try to extract an items array from a parsed JSON value. */
function extractFromParsed(parsed: unknown): unknown[] | null {
  if (Array.isArray((parsed as Record<string, unknown>)?.items))
    return (parsed as Record<string, unknown>).items as unknown[];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value) && value.length > 0) return value;
    }
  }
  return null;
}

/**
 * Extract an array of raw items from an AI response string.
 * Tries multiple strategies to handle different model output formats.
 */
export function extractRawItems(response: string): unknown[] {
  // Strategy 1: Parse as JSON directly
  try {
    const parsed = JSON.parse(response);
    const items = extractFromParsed(parsed);
    if (items) return items;
  } catch {
    // Not valid JSON — try other strategies
  }

  // Strategy 2: Extract JSON from markdown code fences
  const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const inner = JSON.parse(fenceMatch[1]);
      const items = extractFromParsed(inner);
      if (items) return items;
    } catch {
      // fall through
    }
  }

  // Strategy 3: Find first { or [ and try to parse from there
  const jsonStart = response.search(/[{[]/);
  if (jsonStart >= 0) {
    try {
      const inner = JSON.parse(response.slice(jsonStart));
      const items = extractFromParsed(inner);
      if (items) return items;
    } catch {
      // fall through
    }
  }

  // Strategy 4: Bracket-match to extract JSON even with trailing text
  // Handles: "Here are items: {...} Hope this helps!" and stray {braces} before JSON
  for (const startChar of ["{", "["]) {
    let searchFrom = 0;
    while (searchFrom < response.length) {
      const startIdx = response.indexOf(startChar, searchFrom);
      if (startIdx < 0) break;

      const endIdx = findMatchingBracket(response, startIdx);
      if (endIdx > startIdx) {
        try {
          const candidate = response.slice(startIdx, endIdx + 1);
          const parsed = JSON.parse(candidate);
          const items = extractFromParsed(parsed);
          if (items) return items;
        } catch {
          // Not valid JSON at this position, try next
        }
      }
      searchFrom = startIdx + 1;
    }
  }

  return [];
}
