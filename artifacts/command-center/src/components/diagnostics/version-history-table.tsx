import { HealthScoreBadge } from "./health-score-badge";
import { DiagnosticStatusBadge } from "./diagnostic-status-badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Version {
  id: string;
  versionNumber: number;
  status: string;
  overallHealthScore?: number | null;
  overallPriorityScore?: number | null;
  createdAt: string;
  completedAt?: string | null;
  approvedAt?: string | null;
}

interface Props {
  versions: Version[];
  currentVersionNumber?: number;
  diagnosticId: string;
  onSelect?: (vn: number) => void;
  onCompare?: (v1: number, v2: number) => void;
}

export function VersionHistoryTable({ versions, currentVersionNumber, diagnosticId, onSelect, onCompare }: Props) {
  if (versions.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-6">No versions yet.</p>;
  }

  const completedVersions = versions.filter((v) => v.status !== "draft");

  return (
    <div className="space-y-2">
      {versions.map((v) => {
        const isCurrent = v.versionNumber === currentVersionNumber;
        return (
          <div
            key={v.id}
            className={cn(
              "flex flex-wrap items-center gap-3 p-3 rounded-lg border",
              isCurrent
                ? "border-indigo-500/40 bg-indigo-500/10"
                : "border-slate-700/50 bg-slate-800/50",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-semibold text-slate-200">v{v.versionNumber}</span>
              {isCurrent && (
                <span className="text-xs bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded px-1.5 py-0.5">
                  Current
                </span>
              )}
            </div>
            <DiagnosticStatusBadge status={v.status} />
            <HealthScoreBadge score={v.overallHealthScore ? Number(v.overallHealthScore) : null} size="sm" />
            <div className="text-xs text-slate-500 flex-1">
              Created {format(new Date(v.createdAt), "MMM d, yyyy")}
              {v.completedAt && <> · Completed {format(new Date(v.completedAt), "MMM d, yyyy")}</>}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => onSelect?.(v.versionNumber)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View
              </button>
              {completedVersions.length >= 2 && v.status !== "draft" && (
                <button
                  onClick={() => {
                    const other = completedVersions.find((c) => c.id !== v.id);
                    if (other) onCompare?.(other.versionNumber, v.versionNumber);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Compare
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
