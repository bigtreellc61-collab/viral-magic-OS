import { SEVERITY_COLORS, getSeverityLabel } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  severity: string | null | undefined;
  className?: string;
}

export function SeverityBadge({ severity, className }: Props) {
  if (!severity) return null;
  const color = SEVERITY_COLORS[severity] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border uppercase tracking-wide",
        color,
        className,
      )}
    >
      {getSeverityLabel(severity)}
    </span>
  );
}
