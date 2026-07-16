import { getHealthRating, getHealthRatingLabel, HEALTH_RATING_COLORS, HEALTH_RATING_BG } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showScale?: boolean;
}

const RATING_STROKE: Record<string, string> = {
  strong:    "#10b981",
  stable:    "#3b82f6",
  vulnerable:"#eab308",
  at_risk:   "#f97316",
  critical:  "#ef4444",
};

const SCALE_LABELS = [
  { rating: "strong",    label: "Strong",     range: "85–100", color: "text-emerald-400" },
  { rating: "stable",    label: "Stable",     range: "70–84",  color: "text-blue-400" },
  { rating: "vulnerable",label: "Vulnerable", range: "55–69",  color: "text-yellow-400" },
  { rating: "at_risk",   label: "At Risk",    range: "40–54",  color: "text-orange-400" },
  { rating: "critical",  label: "Critical",   range: "0–39",   color: "text-red-400" },
];

export function HealthScoreGauge({ score, size = 140, strokeWidth = 12, className, showScale = true }: Props) {
  const displayScore = score == null ? 0 : Math.round(Math.min(100, Math.max(0, score)));
  const rating = score == null ? "critical" : getHealthRating(displayScore);
  const ratingLabel = getHealthRatingLabel(rating);
  const ratingColor = HEALTH_RATING_COLORS[rating];
  const ratingBg = HEALTH_RATING_BG[rating];
  const strokeColor = RATING_STROKE[rating];

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const gapLength = circumference * 0.25;
  const progress = score == null ? 0 : displayScore / 100;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Gauge */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(135deg)" }}
          aria-label={`Business Health Score: ${score == null ? "Not scored" : `${displayScore} out of 100, ${ratingLabel}`}`}
          role="img"
        >
          {/* Track */}
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
          {/* Progress */}
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
            style={{ transition: "stroke-dasharray 0.6s ease-in-out, stroke 0.4s ease" }}
          />
        </svg>
        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums leading-none", size >= 140 ? "text-3xl" : "text-2xl", score == null ? "text-slate-500" : ratingColor)}>
            {score == null ? "—" : displayScore}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">/100</span>
        </div>
      </div>

      {/* Rating badge */}
      <div className={cn("inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold", ratingBg, ratingColor)}>
        {score == null ? "Not Scored" : ratingLabel}
      </div>

      {/* Rating scale */}
      {showScale && (
        <div className="w-full space-y-1 mt-1">
          {SCALE_LABELS.map((s) => (
            <div
              key={s.rating}
              className={cn(
                "flex items-center justify-between px-2 py-0.5 rounded text-[10px] transition-colors",
                rating === s.rating ? "bg-slate-700/60" : "opacity-50",
              )}
            >
              <span className={cn("font-semibold", s.color)}>{s.label}</span>
              <span className="text-slate-500 font-mono">{s.range}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
