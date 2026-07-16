import { useState } from "react";
import { useLocation } from "wouter";
import { useListDiagnostics, useGetDiagnosticMetrics } from "@workspace/api-client-react";
import { DiagnosticStatusBadge } from "@/components/diagnostics/diagnostic-status-badge";
import { HealthScoreBadge } from "@/components/diagnostics/health-score-badge";
import { SeverityBadge } from "@/components/diagnostics/severity-badge";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DIAGNOSTIC_TYPES, DIAGNOSTIC_STATUSES, DIAGNOSTIC_SORT_OPTIONS,
  getDiagnosticTypeLabel, liveCalcSeverity,
} from "@/lib/diagnostic-constants";
import {
  Stethoscope, Plus, Search, RefreshCw, Archive, AlertTriangle, CheckCircle2, Clock, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function DiagnosticsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useListDiagnostics({
    search: search || undefined,
    status: statusFilter || undefined,
    diagnosticType: typeFilter || undefined,
    sort,
    showArchived: showArchived ? "true" : "false",
    page,
    pageSize: PAGE_SIZE,
  } as any);

  const { data: metrics } = useGetDiagnosticMetrics();

  const diagnostics = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleFilter = (key: string, val: string) => {
    if (key === "status") { setStatusFilter(val); setPage(1); }
    if (key === "type") { setTypeFilter(val); setPage(1); }
    if (key === "sort") { setSort(val); setPage(1); }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-indigo-400" />
            Business Diagnostics
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Identify and resolve business bottlenecks</p>
        </div>
        <button
          onClick={() => navigate("/diagnostics/new")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Diagnostic
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: metrics?.total ?? 0, icon: FileText, color: "text-slate-300" },
          { label: "In Progress", value: metrics?.draftInProgress ?? 0, icon: Clock, color: "text-blue-400" },
          { label: "Awaiting Review", value: metrics?.awaitingReview ?? 0, icon: Clock, color: "text-yellow-400" },
          { label: "Completed", value: metrics?.completed ?? 0, icon: CheckCircle2, color: "text-green-400" },
          { label: "Approved", value: metrics?.approved ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Critical", value: metrics?.criticalBottlenecks ?? 0, icon: AlertTriangle, color: "text-red-400" },
          { label: "High", value: metrics?.highBottlenecks ?? 0, icon: AlertTriangle, color: "text-orange-400" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <m.icon className={cn("w-3.5 h-3.5", m.color)} />
              <span className="text-xs text-slate-400">{m.label}</span>
            </div>
            <span className={cn("text-xl font-bold tabular-nums", m.color)}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search diagnostics or clients..."
            value={search}
            onChange={handleSearch}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleFilter("status", e.target.value)}
          className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          {DIAGNOSTIC_STATUSES.filter((s) => s.value !== "archived").map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => handleFilter("type", e.target.value)}
          className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Types</option>
          {DIAGNOSTIC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => handleFilter("sort", e.target.value)}
          className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          {DIAGNOSTIC_SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={() => { setShowArchived(!showArchived); setPage(1); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors",
            showArchived
              ? "bg-orange-500/20 border-orange-500/30 text-orange-300"
              : "bg-slate-800 border-slate-700/50 text-slate-400 hover:text-slate-200",
          )}
        >
          <Archive className="w-4 h-4" />
          {showArchived ? "Archived" : "Show Archived"}
        </button>
        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700/50 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Health</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Version</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Updated</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading diagnostics…
                  </td>
                </tr>
              ) : diagnostics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Stethoscope className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>No diagnostics found.</p>
                    <button
                      onClick={() => navigate("/diagnostics/new")}
                      className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm"
                    >
                      Create the first diagnostic →
                    </button>
                  </td>
                </tr>
              ) : (
                diagnostics.map((d: any) => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/diagnostics/${d.id}`)}
                    className="border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-200">{d.diagnosticName}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{d.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{getDiagnosticTypeLabel(d.diagnosticType)}</td>
                    <td className="px-4 py-3">
                      <DiagnosticStatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthScoreBadge score={d.overallHealthScore ? Number(d.overallHealthScore) : null} showRating={false} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums text-center">
                      {d.currentVersionNumber > 0 ? `v${d.currentVersionNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {format(new Date(d.updatedAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-700/50">
            <DataPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
