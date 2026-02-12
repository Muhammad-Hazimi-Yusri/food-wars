/**
 * Parse date shorthand inputs into YYYY-MM-DD strings.
 *
 * Supported formats:
 *   "x" or "never"       → "2999-12-31" (never expires)
 *   "+7" or "+7d"        → today + 7 days
 *   "+1m"                → today + 1 month
 *   "+1y"                → today + 1 year
 *   "0517" (4 digits)    → next occurrence of MM-DD (current or next year)
 *
 * Returns null if the input doesn't match any shorthand.
 */
export function parseDateShorthand(
  input: string,
  today: Date = new Date()
): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // "x" or "never" → never expires
  if (trimmed === "x" || trimmed === "never") {
    return "2999-12-31";
  }

  // "+N", "+Nd" → today + N days
  const daysMatch = trimmed.match(/^\+(\d+)d?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return formatDate(date);
  }

  // "+Nm" → today + N months
  const monthsMatch = trimmed.match(/^\+(\d+)m$/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const date = new Date(today);
    date.setMonth(date.getMonth() + months);
    return formatDate(date);
  }

  // "+Ny" → today + N years
  const yearsMatch = trimmed.match(/^\+(\d+)y$/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    const date = new Date(today);
    date.setFullYear(date.getFullYear() + years);
    return formatDate(date);
  }

  // "MMDD" (exactly 4 digits) → next occurrence of that date
  const mmddMatch = trimmed.match(/^(\d{2})(\d{2})$/);
  if (mmddMatch) {
    const month = parseInt(mmddMatch[1], 10);
    const day = parseInt(mmddMatch[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const year = today.getFullYear();
    let date = new Date(year, month - 1, day);

    // If the date is in the past, use next year
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    if (date < todayStart) {
      date = new Date(year + 1, month - 1, day);
    }

    return formatDate(date);
  }

  return null;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
