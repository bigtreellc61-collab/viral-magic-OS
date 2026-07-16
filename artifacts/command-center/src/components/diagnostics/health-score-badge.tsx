import {
  HEALTH_RATING_COLORS,
  HEALTH_RATING_BG,
  getHealthRating,
  getHealthRatingLabel,
} from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  score: number | null | undefined;
  showRating?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HealthScoreBadge({ score, showRating = true, size = "md", className }: Props) {
  if (score == null) return <span className="text-slate-500 text-sm">—</span>;
  const rating = getHealthRating(score);
  const colorText = HEALTH_RATING_COLORS[rating];
  const bgColor = HEALTH_RATING_BG[rating];

  const sizeClass = size === "sm"
    ? "text-xs px-2 py-0.5"
    : size === "lg"
    ? "text-base px-3 py-1"
    : "text-sm px-2.5 py-0.5";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        bgColor,
        colorText,
        sizeClass,
        className,
      )}
    >
      <span>{Math.round(score)}</span>
      {showRating && <span className="font-normal opacity-80">/ {getHealthRatingLabel(rating)}</span>}
    </span>
  );
}
