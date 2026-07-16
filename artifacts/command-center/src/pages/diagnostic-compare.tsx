import { useParams, useLocation, useSearch } from "wouter";
import { useCompareDiagnosticVersions, useGetDiagnostic } from "@workspace/api-client-react";
import { HealthScoreBadge } from "@/components/diagnostics/health-score-badge";
import { SeverityBadge } from "@/components/diagnostics/severity-badge";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DiagnosticComparePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const v1 = parseInt(params.get("v1") ?? "1", 10);
  const v2 = parseInt(params.get("v2") ?? "2", 10);

  const { data: diagnostic } = useGetDiagnostic(id!);
  const { data: comparison, isLoading } = useCompareDiagnosticVersions(id!, { v1, v2 });

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "improved") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (trend === "declined") return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/diagnostics/${id}`)}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {diagnostic?.diagnosticName ?? "Diagnostic"} — Version Comparison
          </h1>
          <p className="text-slate-400 text-sm">v{v1} vs v{v2}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : !comparison ? (
        <div className="text-center py-12 text-slate-500">No comparison data available.</div>
      ) : (
        <div className="space-y-6">
          {/* Version summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-center space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Version {v1} (Baseline)</div>
              <HealthScoreBadge
                score={comparison.versionA?.overallHealthScore != null ? Number(comparison.versionA.overallHealthScore) : null}
                size="lg"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-center space-y-2 flex flex-col items-center justify-center">
              <div className="text-xs text-slate-500">Health Score Change</div>
              {comparison.healthScoreDelta != null ? (
                <div className={cn(
                  "text-2xl font-bold tabular-nums",
                  comparison.healthScoreDelta > 0 ? "text-emerald-400" : comparison.healthScoreDelta < 0 ? "text-red-400" : "text-slate-400",
                )}>
                  {comparison.healthScoreDelta > 0 ? "+" : ""}{comparison.healthScoreDelta}
                </div>
              ) : (
                <div className="text-slate-500">—</div>
              )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-center space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Version {v2} (Current)</div>
              <HealthScoreBadge
                score={comparison.versionB?.overallHealthScore != null ? Number(comparison.versionB.overallHealthScore) : null}
                size="lg"
              />
            </div>
          </div>

          {/* Category comparison table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-300">Category-by-Category Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Category</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">v{v1} Score</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">v{v1} Severity</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">Change</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">v{v2} Score</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase text-center">v{v2} Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.categoryComparisons.map((c: any) => (
                    <tr key={c.categoryKey} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                      <td className="px-4 py-3 text-slate-200 font-medium">{c.categoryLabel}</td>
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">
                        {c.v1?.currentPerformance != null ? Number(c.v1.currentPerformance).toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.v1?.severity ? <SeverityBadge severity={c.v1.severity} /> : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendIcon trend={c.trend} />
                          {c.performanceDelta != null && (
                            <span className={cn(
                              "text-xs font-mono tabular-nums",
                              c.performanceDelta > 0 ? "text-emerald-400" : c.performanceDelta < 0 ? "text-red-400" : "text-slate-500",
                            )}>
                              {c.performanceDelta > 0 ? "+" : ""}{c.performanceDelta}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">
                        {c.v2?.currentPerformance != null ? Number(c.v2.currentPerformance).toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.v2?.severity ? <SeverityBadge severity={c.v2.severity} /> : <span className="text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              {
                label: "Improved",
                count: comparison.categoryComparisons.filter((c: any) => c.trend === "improved").length,
                color: "text-emerald-400",
              },
              {
                label: "Declined",
                count: comparison.categoryComparisons.filter((c: any) => c.trend === "declined").length,
                color: "text-red-400",
              },
              {
                label: "Unchanged",
                count: comparison.categoryComparisons.filter((c: any) => c.trend === "unchanged").length,
                color: "text-slate-400",
              },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                <div className={cn("text-2xl font-bold", s.color)}>{s.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
