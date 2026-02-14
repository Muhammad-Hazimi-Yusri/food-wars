const GRADE_COLORS: Record<string, string> = {
  a: "bg-[#038141]",
  b: "bg-[#85BB2F]",
  c: "bg-[#FECB02] text-gray-900",
  d: "bg-[#EE8100]",
  e: "bg-[#E63E11]",
};

type NutriScoreBadgeProps = {
  grade: string | null;
};

export function NutriScoreBadge({ grade }: NutriScoreBadgeProps) {
  if (!grade) return null;

  const lower = grade.toLowerCase();
  const color = GRADE_COLORS[lower];
  if (!color) return null;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white ${color}`}
      title={`Nutri-Score ${grade.toUpperCase()}`}
    >
      Nutri-Score {grade.toUpperCase()}
    </span>
  );
}
