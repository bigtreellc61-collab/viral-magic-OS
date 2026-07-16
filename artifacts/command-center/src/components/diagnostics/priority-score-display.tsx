import { SEVERITY_BAR_COLORS, SEVERITY_COLORS, liveCalcSeverity } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  priorityScore: number | null | undefined;
  severity?: string | null;
  showBar?: boolean;
  className?: string;
}

export function PriorityScoreDisplay({ priorityScore, severity, showBar = true, className }: Props) {
  if (priorityScore == null) return <span className="text-slate-500 text-sm">—</span>;
  const ps = Number(priorityScore);
  const sev = severity ?? liveCalcSeverity(ps);
  const barColor = SEVERITY_BAR_COLORS[sev] ?? "bg-gray-500";
  const pct = Math.min(100, (ps / 250) * 100);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-200">{ps.toFixed(1)}</span>
        <span className="text-xs text-slate-500">/250</span>
      </div>
      {showBar && (
        <div className="h-1.5 w-full rounded-full bg-slate-700/50">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
