import { DIAGNOSTIC_STATUS_COLORS, getDiagnosticStatusLabel } from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

export function DiagnosticStatusBadge({ status, className }: Props) {
  const color = DIAGNOSTIC_STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const label = getDiagnosticStatusLabel(status);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
