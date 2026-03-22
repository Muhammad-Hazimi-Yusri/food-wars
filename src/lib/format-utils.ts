export function formatAmount(value: number): string {
  if (value === 0) return "0";
  if (!Number.isFinite(value)) return value.toString();
  return Number(value.toPrecision(3)).toString();
}

export function formatPercentage(value: number): string {
  return `${formatAmount(value)}%`;
}
