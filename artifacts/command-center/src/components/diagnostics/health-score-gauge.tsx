import { getHealthRating, getHealthRatingLabel, HEALTH_RATING_COLORS } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const RATING_STROKE: Record<string, string> = {
  strong: "#10b981",
  stable: "#3b82f6",
  vulnerable: "#eab308",
  at_risk: "#f97316",
  critical: "#ef4444",
};

export function HealthScoreGauge({ score, size = 120, strokeWidth = 10, className }: Props) {
  const displayScore = score == null ? 0 : Math.round(Math.min(100, Math.max(0, score)));
  const rating = score == null ? "critical" : getHealthRating(displayScore);
  const ratingLabel = getHealthRatingLabel(rating);
  const ratingColor = HEALTH_RATING_COLORS[rating];
  const strokeColor = RATING_STROKE[rating];

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // We use 75% of the circle (270 degrees) as the arc
  const arcLength = circumference * 0.75;
  const gapLength = circumference * 0.25;
  // Progress along the arc
  const progress = score == null ? 0 : displayScore / 100;
  const dashOffset = arcLength * (1 - progress);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(135deg)" }}
        >
          {/* Background arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength * progress} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease-in-out" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: "none" }}>
          <span className={cn("text-2xl font-bold tabular-nums", score == null ? "text-slate-500" : ratingColor)}>
            {score == null ? "—" : displayScore}
          </span>
          <span className="text-xs text-slate-500">/100</span>
        </div>
      </div>
      <span className={cn("text-sm font-medium", ratingColor)}>{ratingLabel}</span>
    </div>
  );
}
