import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetDiagnostic,
  useGetDiagnosticVersion,
  useListDiagnosticVersions,
  useSaveDiagnosticDraft,
  useCompleteDiagnostic,
  useUpdateDiagnosticSummary,
  useApproveDiagnosticVersion,
  useArchiveDiagnostic,
  useRestoreDiagnostic,
  useDeleteDiagnostic,
  useUpdateScoreResolution,
  useUpdateRecommendation,
  useApproveRecommendation,
  useCreateDiagnosticVersion,
} from "@workspace/api-client-react";
import { DiagnosticStatusBadge } from "@/components/diagnostics/diagnostic-status-badge";
import { HealthScoreBadge } from "@/components/diagnostics/health-score-badge";
import { HealthScoreGauge } from "@/components/diagnostics/health-score-gauge";
import { SeverityBadge } from "@/components/diagnostics/severity-badge";
import { CategoryScoreCard, type CategoryScoreData } from "@/components/diagnostics/category-score-card";
import { BottleneckCard } from "@/components/diagnostics/bottleneck-card";
import { VersionHistoryTable } from "@/components/diagnostics/version-history-table";
import {
  ArchiveDiagnosticDialog,
  DeleteDiagnosticDialog,
  CompleteDiagnosticDialog,
} from "@/components/diagnostics/diagnostic-confirm-dialogs";
import {
  getDiagnosticTypeLabel,
  DIAGNOSTIC_RESTORE_STATUSES,
} from "@/lib/diagnostic-constants";
import {
  ChevronLeft, Archive, RotateCcw, Trash2, CheckCircle2, Plus,
  RefreshCw, GitBranch, AlertTriangle, ClipboardList, BarChart3, FileText, History,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Tab = "overview" | "scores" | "bottlenecks" | "versions";

export default function DiagnosticDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [viewingVersionNum, setViewingVersionNum] = useState<number | null>(null);

  // Confirm dialogs
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Editing states
  const [editingScores, setEditingScores] = useState(false);
  const [localScores, setLocalScores] = useState<CategoryScoreData[]>([]);
  // Explicit version ID to use for save-draft — set when a new version is created
  const [activeEditVersionId, setActiveEditVersionId] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState("in_progress");

  const { data: diagnostic, refetch: refetchDiag, isLoading } = useGetDiagnostic(id!);
  const { data: versions, refetch: refetchVersions } = useListDiagnosticVersions(id!);
  const activeVersionNum = viewingVersionNum ?? diagnostic?.currentVersionNumber ?? null;
  const { data: versionData, refetch: refetchVersion } = useGetDiagnosticVersion(
    id!, activeVersionNum ?? 1,
    { query: { enabled: !!id && activeVersionNum != null && activeVersionNum > 0 } } as any,
  );

  const versionDataAny = versionData as any;
  const version = versionDataAny?.version as any;
  const scorePairs: any[] = versionDataAny?.scores ?? [];
  const scores = scorePairs.map((p: any) => p.score);

  const saveDraftMut = useSaveDiagnosticDraft();
  const completeMut = useCompleteDiagnostic();
  const summaryMut = useUpdateDiagnosticSummary();
  const approveMut = useApproveDiagnosticVersion();
  const archiveMut = useArchiveDiagnostic();
  const restoreMut = useRestoreDiagnostic();
  const deleteMut = useDeleteDiagnostic();
  const resolutionMut = useUpdateScoreResolution();
  const recEditMut = useUpdateRecommendation();
  const recApproveMut = useApproveRecommendation();
  const newVersionMut = useCreateDiagnosticVersion();

  const isArchived = !!diagnostic?.archivedAt;
  const isDraft = diagnostic?.status === "draft" || diagnostic?.status === "in_progress";
  const isCompleted = diagnostic?.status === "completed" || diagnostic?.status === "awaiting_review" || diagnostic?.status === "approved";
  const versionsList = versions ?? [];

  const handleSaveDraft = async () => {
    // Use activeEditVersionId when set (after new-version creation) to target the correct version
    const targetVersionId = activeEditVersionId ?? version?.id;
    await saveDraftMut.mutateAsync({
      diagnosticId: id!,
      data: { versionId: targetVersionId, scores: localScores as any },
    });
    refetchDiag();
    refetchVersion();
    setEditingScores(false);
    setActiveEditVersionId(null);
  };

  const handleComplete = async () => {
    await completeMut.mutateAsync({
      diagnosticId: id!,
      data: { versionId: version?.id ?? undefined },
    });
    setCompleteOpen(false);
    refetchDiag();
    refetchVersion();
    setTab("overview");
  };

  const handleApproveAction = async (action: string) => {
    await approveMut.mutateAsync({
      diagnosticId: id!,
      versionNumber: activeVersionNum!,
      data: { action },
    });
    refetchDiag();
  };

  const handleArchive = async () => {
    await archiveMut.mutateAsync({ diagnosticId: id! });
    setArchiveOpen(false);
    navigate("/diagnostics");
  };

  const handleRestore = async () => {
    await restoreMut.mutateAsync({ diagnosticId: id!, data: { status: restoreStatus } });
    refetchDiag();
  };

  const handleDelete = async () => {
    await deleteMut.mutateAsync({ diagnosticId: id! });
    setDeleteOpen(false);
    navigate("/diagnostics");
  };

  const handleResolutionChange = async (scoreId: string, status: string) => {
    await resolutionMut.mutateAsync({ scoreId, data: { resolutionStatus: status } });
    refetchVersion();
  };

  const handleRecSave = async (recId: string, text: string) => {
    await recEditMut.mutateAsync({ recId, data: { administratorFinalRecommendation: text } });
    refetchVersion();
  };

  const handleRecApprove = async (recId: string, action: string) => {
    await recApproveMut.mutateAsync({ recId, data: { action } });
    refetchVersion();
  };

  const handleNewVersion = async () => {
    const newVer = await newVersionMut.mutateAsync({ diagnosticId: id!, data: { copyScores: true } });
    // Bind the upcoming save-draft to the newly created version ID (not the stale fetched version)
    setActiveEditVersionId((newVer as any).id);
    // Initialize localScores from current scores (server copies them) before setting edit mode
    setLocalScores(scores.map((s: any) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      categoryDescription: s.categoryDescription,
      displayOrder: s.displayOrder,
      currentPerformance: s.currentPerformance != null ? Number(s.currentPerformance) : null,
      businessImpact: s.businessImpact != null ? Number(s.businessImpact) : null,
      urgency: s.urgency != null ? Number(s.urgency) : null,
      evidence: s.evidence,
      observations: s.observations,
      notes: s.notes,
      recommendedAction: s.recommendedAction,
    })));
    setEditingScores(true);
    setTab("scores");
    refetchDiag();
    refetchVersions();
  };

  const startEditing = () => {
    setLocalScores(scores.map((s: any) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      categoryDescription: s.categoryDescription,
      displayOrder: s.displayOrder,
      currentPerformance: s.currentPerformance != null ? Number(s.currentPerformance) : null,
      businessImpact: s.businessImpact != null ? Number(s.businessImpact) : null,
      urgency: s.urgency != null ? Number(s.urgency) : null,
      evidence: s.evidence,
      observations: s.observations,
      notes: s.notes,
      recommendedAction: s.recommendedAction,
    })));
    setEditingScores(true);
  };

  const cancelEditing = () => {
    setEditingScores(false);
    setLocalScores([]);
    setActiveEditVersionId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">Diagnostic not found.</p>
        <button onClick={() => navigate("/diagnostics")} className="text-indigo-400 hover:text-indigo-300">
          ← Back to Diagnostics
        </button>
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "scores", label: "Category Scores", icon: ClipboardList },
    { id: "bottlenecks", label: "Bottlenecks", icon: AlertTriangle },
    { id: "versions", label: "Versions", icon: History },
  ];

  const criticalAndHighScores = scores.filter((s: any) =>
    (s.severity === "critical" || s.severity === "high") && s.resolutionStatus === "unresolved",
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={() => navigate("/diagnostics")} className="text-slate-400 hover:text-slate-200 transition-colors mt-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-100">{diagnostic.diagnosticName}</h1>
            <DiagnosticStatusBadge status={diagnostic.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>{diagnostic.clientName ?? "Unknown client"}</span>
            {diagnostic.projectName && <span>· {diagnostic.projectName}</span>}
            <span>· {getDiagnosticTypeLabel(diagnostic.diagnosticType)}</span>
            <span>· Updated {format(new Date(diagnostic.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {!isArchived && isDraft && activeVersionNum != null && (
            <button
              onClick={() => setCompleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-300 text-sm rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete
            </button>
          )}
          {!isArchived && isCompleted && diagnostic.status !== "approved" && (
            <>
              {diagnostic.status !== "awaiting_review" && (
                <button
                  onClick={() => handleApproveAction("mark_awaiting_review")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/30 text-yellow-300 text-sm rounded-lg transition-colors"
                >
                  Submit for Review
                </button>
              )}
              {activeVersionNum != null && (
                <button
                  onClick={() => handleApproveAction("approve")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-sm rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
              )}
            </>
          )}
          {!isArchived && isCompleted && (
            <button
              onClick={handleNewVersion}
              disabled={newVersionMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Version
            </button>
          )}
          {!isArchived ? (
            <button
              onClick={() => setArchiveOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-lg transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          ) : (
            <>
              <select
                value={restoreStatus}
                onChange={(e) => setRestoreStatus(e.target.value)}
                className="bg-slate-700 border border-slate-600/50 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none"
              >
                {DIAGNOSTIC_RESTORE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={handleRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restore
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-sm rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.id
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200",
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.id === "bottlenecks" && criticalAndHighScores.length > 0 && (
              <span className="ml-1 bg-red-500/30 text-red-300 text-xs px-1.5 rounded-full">
                {criticalAndHighScores.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health gauge */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 flex flex-col items-center gap-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Overall Business Health</h3>
            <HealthScoreGauge
              score={diagnostic.overallHealthScore ? Number(diagnostic.overallHealthScore) : null}
              size={160}
            />
            {diagnostic.overallPriorityScore && (
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-0.5">Avg Priority Score</div>
                <div className="text-lg font-mono font-semibold text-slate-200">
                  {Number(diagnostic.overallPriorityScore).toFixed(1)}
                  <span className="text-slate-500 text-sm">/250</span>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Diagnostic Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-slate-500 mb-0.5">Client</div><div className="text-slate-200">{diagnostic.clientName ?? "—"}</div></div>
                <div><div className="text-slate-500 mb-0.5">Type</div><div className="text-slate-200">{getDiagnosticTypeLabel(diagnostic.diagnosticType)}</div></div>
                <div><div className="text-slate-500 mb-0.5">Version</div><div className="text-slate-200">{diagnostic.currentVersionNumber > 0 ? `v${diagnostic.currentVersionNumber}` : "No versions"}</div></div>
                <div><div className="text-slate-500 mb-0.5">Status</div><DiagnosticStatusBadge status={diagnostic.status} /></div>
                <div><div className="text-slate-500 mb-0.5">Started</div><div className="text-slate-200">{diagnostic.startedAt ? format(new Date(diagnostic.startedAt), "MMM d, yyyy") : "—"}</div></div>
                <div><div className="text-slate-500 mb-0.5">Completed</div><div className="text-slate-200">{diagnostic.completedAt ? format(new Date(diagnostic.completedAt), "MMM d, yyyy") : "—"}</div></div>
              </div>
              {diagnostic.summaryNotes && (
                <div>
                  <div className="text-slate-500 text-sm mb-1">Notes</div>
                  <p className="text-sm text-slate-300">{diagnostic.summaryNotes}</p>
                </div>
              )}
            </div>

            {/* Executive summary */}
            {version && (version.executiveSummary || version.recommendedFirstAction) && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Executive Summary</h3>
                {version.executiveSummary && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Summary</div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{version.executiveSummary}</p>
                  </div>
                )}
                {version.recommendedFirstAction && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Recommended First Action</div>
                    <p className="text-sm text-slate-300">{version.recommendedFirstAction}</p>
                  </div>
                )}
                {version.recommendedSoftwareOpportunity && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Software Opportunity</div>
                    <p className="text-sm text-slate-300">{version.recommendedSoftwareOpportunity}</p>
                  </div>
                )}
              </div>
            )}

            {/* Top bottlenecks summary */}
            {scores.filter((s: any) => s.severity === "critical" || s.severity === "high").length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Priority Bottlenecks
                </h3>
                <div className="space-y-2">
                  {scores
                    .filter((s: any) => s.severity === "critical" || s.severity === "high")
                    .sort((a: any, b: any) => Number(b.priorityScore) - Number(a.priorityScore))
                    .slice(0, 5)
                    .map((s: any) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <SeverityBadge severity={s.severity} />
                        <span className="text-sm text-slate-200">{s.categoryLabel}</span>
                        <span className="ml-auto text-xs text-slate-500 tabular-nums">
                          {Number(s.priorityScore).toFixed(1)}
                        </span>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => setTab("bottlenecks")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all bottlenecks →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Category Scores */}
      {tab === "scores" && (
        <div className="space-y-4">
          {/* Version selector */}
          {versionsList.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Viewing version:</span>
              <select
                value={activeVersionNum ?? ""}
                onChange={(e) => setViewingVersionNum(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700/50 rounded px-2 py-1 text-sm text-slate-300 focus:outline-none"
              >
                {versionsList.map((v: any) => (
                  <option key={v.id} value={v.versionNumber}>v{v.versionNumber} ({v.status})</option>
                ))}
              </select>
            </div>
          )}

          {/* Edit controls */}
          {!isArchived && activeVersionNum === diagnostic.currentVersionNumber && (
            <div className="flex items-center gap-2">
              {!editingScores ? (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-sm rounded-lg transition-colors"
                >
                  Edit Scores
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveDraft}
                    disabled={saveDraftMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
                  >
                    {saveDraftMut.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {scores.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No scores recorded for this version.</p>
            </div>
          ) : editingScores ? (
            <div className="space-y-3">
              {localScores.map((s, i) => (
                <CategoryScoreCard
                  key={s.categoryKey}
                  data={s}
                  onChange={(updated) => {
                    const newScores = [...localScores];
                    newScores[i] = updated;
                    setLocalScores(newScores);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {scores.map((s: any) => (
                <CategoryScoreCard
                  key={s.categoryKey}
                  readonly
                  data={{
                    categoryKey: s.categoryKey,
                    categoryLabel: s.categoryLabel,
                    categoryDescription: s.categoryDescription,
                    displayOrder: s.displayOrder,
                    currentPerformance: s.currentPerformance != null ? Number(s.currentPerformance) : null,
                    businessImpact: s.businessImpact != null ? Number(s.businessImpact) : null,
                    urgency: s.urgency != null ? Number(s.urgency) : null,
                    evidence: s.evidence,
                    observations: s.observations,
                    notes: s.notes,
                    recommendedAction: s.recommendedAction,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Bottlenecks */}
      {tab === "bottlenecks" && (
        <div className="space-y-4">
          {scorePairs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No bottleneck data. Complete a scoring session first.</p>
            </div>
          ) : (
            scorePairs
              .sort((a: any, b: any) => Number(b.score.priorityScore ?? 0) - Number(a.score.priorityScore ?? 0))
              .map((pair: any) => (
                <BottleneckCard
                  key={pair.score.id}
                  scoreId={pair.score.id}
                  categoryLabel={pair.score.categoryLabel}
                  categoryKey={pair.score.categoryKey}
                  categoryDescription={pair.score.categoryDescription}
                  currentPerformance={pair.score.currentPerformance != null ? Number(pair.score.currentPerformance) : null}
                  businessImpact={pair.score.businessImpact != null ? Number(pair.score.businessImpact) : null}
                  urgency={pair.score.urgency != null ? Number(pair.score.urgency) : null}
                  priorityScore={pair.score.priorityScore != null ? Number(pair.score.priorityScore) : null}
                  severity={pair.score.severity}
                  evidence={pair.score.evidence}
                  observations={pair.score.observations}
                  resolutionStatus={pair.score.resolutionStatus}
                  recommendation={pair.recommendation}
                  onResolutionChange={handleResolutionChange}
                  onRecommendationSave={handleRecSave}
                  onRecommendationApprove={handleRecApprove}
                />
              ))
          )}
        </div>
      )}

      {/* Tab: Versions */}
      {tab === "versions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Version History</h3>
            {!isArchived && isCompleted && (
              <button
                onClick={handleNewVersion}
                disabled={newVersionMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-sm rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Version
              </button>
            )}
          </div>
          <VersionHistoryTable
            versions={versionsList as any}
            currentVersionNumber={diagnostic.currentVersionNumber}
            diagnosticId={id!}
            onSelect={(vn) => { setViewingVersionNum(vn); setTab("scores"); }}
            onCompare={(v1, v2) => navigate(`/diagnostics/${id}/compare?v1=${v1}&v2=${v2}`)}
          />
        </div>
      )}

      {/* Dialogs */}
      <ArchiveDiagnosticDialog
        open={archiveOpen}
        diagnosticName={diagnostic.diagnosticName}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />
      <DeleteDiagnosticDialog
        open={deleteOpen}
        diagnosticName={diagnostic.diagnosticName}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <CompleteDiagnosticDialog
        open={completeOpen}
        diagnosticName={diagnostic.diagnosticName}
        onConfirm={handleComplete}
        onCancel={() => setCompleteOpen(false)}
      />
    </div>
  );
}
