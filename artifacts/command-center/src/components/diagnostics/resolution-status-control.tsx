import { RESOLUTION_STATUS_COLORS, RESOLUTION_STATUSES, getResolutionStatusLabel } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  scoreId: string;
  currentStatus: string;
  onChange?: (scoreId: string, status: string) => void;
  disabled?: boolean;
}

export function ResolutionStatusControl({ scoreId, currentStatus, onChange, disabled }: Props) {
  const color = RESOLUTION_STATUS_COLORS[currentStatus] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 shrink-0">Resolution:</span>
      <select
        value={currentStatus}
        disabled={disabled}
        onChange={(e) => onChange?.(scoreId, e.target.value)}
        className={cn(
          "text-xs border rounded px-2 py-1 bg-slate-700/50 focus:outline-none focus:border-indigo-500 cursor-pointer",
          color,
        )}
      >
        {RESOLUTION_STATUSES.map((s) => (
          <option key={s.value} value={s.value} className="bg-slate-800 text-slate-200">
            {s.label}
          </option>
        ))}
      </select>
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", color)}>
        {getResolutionStatusLabel(currentStatus)}
      </span>
    </div>
  );
}
