import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  PLAN_STATUS_LABELS,
  PLAN_STATUS_COLORS,
  PRIORITY_CLASSIFICATION_LABELS,
  PRIORITY_CLASSIFICATION_COLORS,
  EFFORT_LABELS,
  EFFORT_COLORS,
  TIMEFRAME_LABELS,
  TIMEFRAME_COLORS,
  ACTION_HORIZON_LABELS,
  ACTION_HORIZON_COLORS,
  COMPLETION_STATUS_LABELS,
  DOMAIN_LABELS,
} from "@/lib/solution-recommendation-constants";
import {
  useGetSolutionRecommendationPlan,
  useUpdateSolutionRecommendationPlan,
  useUpdateSolutionRecommendation,
  useSubmitSolutionRecommendationPlan,
  useApproveSolutionRecommendationPlan,
  useReopenSolutionRecommendationPlan,
  useArchiveSolutionRecommendationPlan,
  useRegenerateSolutionRecommendationPlan,
  useGetSolutionRecommendationPlanActivity,
} from "@workspace/api-client-react";
import type {
  SolutionRecommendationPlanDetail,
  SolutionRecommendationRecord,
  SolutionRecommendationActionRecord,
} from "@workspace/api-client-react";
import {
  ChevronLeft,
  Printer,
  Save,
  X,
  CheckCircle2,
  Send,
  RotateCcw,
  Archive,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Edit2,
  Star,
  Zap,
  Target,
  BarChart3,
  GitBranch,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  User,
  Award,
  TrendingUp,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// ─── Tab types ────────────────────────────────────────────────

type PlanTab =
  | "executive"
  | "recommendations"
  | "actions"
  | "impact"
  | "dependencies"
  | "notes"
  | "approval";

const TABS: { id: PlanTab; label: string; icon: React.ElementType }[] = [
  { id: "executive", label: "Executive Recommendation", icon: BarChart3 },
  { id: "recommendations", label: "Priority Recommendations", icon: Star },
  { id: "actions", label: "Action Plan", icon: Target },
  { id: "impact", label: "Business Impact", icon: TrendingUp },
  { id: "dependencies", label: "Dependencies", icon: GitBranch },
  { id: "notes", label: "Consultant Notes", icon: FileText },
  { id: "approval", label: "Approval", icon: ShieldCheck },
];

// ─── Helper: small badge ──────────────────────────────────────

function Chip({
  label,
  colorClass,
}: {
  label: string;
  colorClass?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium",
        colorClass ?? "text-slate-300 bg-slate-700/50 border-slate-600/50",
      )}
    >
      {label}
    </span>
  );
}

// ─── Editable text area ───────────────────────────────────────

function EditableSection({
  label,
  systemValue,
  value,
  editing,
  onChange,
  rows = 4,
}: {
  label: string;
  systemValue?: string | null;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const isEdited = !!value && !!systemValue && value !== systemValue;

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {label}
          </label>
          {isEdited && (
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 rounded">
              Edited
            </span>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
        {systemValue && value && value !== systemValue && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-400">
              Show original system text
            </summary>
            <p className="mt-1 p-2 bg-slate-800/50 rounded text-slate-400 whitespace-pre-wrap">
              {systemValue}
            </p>
          </details>
        )}
      </div>
    );
  }

  const display = value || systemValue || "";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        {isEdited && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 rounded">
            Edited
          </span>
        )}
      </div>
      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
        {display || "—"}
      </p>
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────

function RecommendationCard({
  rec,
  expanded,
  onToggle,
  editing,
  adminNotes,
  onAdminNotesChange,
  onSaveAdminNotes,
  savingNotes,
}: {
  rec: SolutionRecommendationRecord;
  expanded: boolean;
  onToggle: () => void;
  editing: boolean;
  adminNotes: string;
  onAdminNotesChange: (v: string) => void;
  onSaveAdminNotes: () => void;
  savingNotes: boolean;
}) {
  const priorityColor =
    PRIORITY_CLASSIFICATION_COLORS[rec.priorityClassification] ??
    "text-slate-300 bg-slate-700/50 border-slate-600/50";
  const effortColor = rec.effort
    ? (EFFORT_COLORS[rec.effort] ?? "text-slate-300 bg-slate-700/50 border-slate-600/50")
    : "";
  const timeframeColor = rec.timeframe
    ? (TIMEFRAME_COLORS[rec.timeframe] ?? "text-slate-300 bg-slate-700/50 border-slate-600/50")
    : "";

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden print:border print:rounded-none print:mb-4">
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-indigo-300 text-sm font-bold">#{rec.rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-100">{rec.title}</h3>
            {rec.quickWinFlag && (
              <Chip
                label="⚡ Quick Win"
                colorClass="text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label={
                PRIORITY_CLASSIFICATION_LABELS[rec.priorityClassification] ??
                rec.priorityClassification
              }
              colorClass={priorityColor}
            />
            {rec.domain && (
              <span className="text-xs text-slate-500">
                {DOMAIN_LABELS[rec.domain] ?? rec.domain}
              </span>
            )}
            {rec.effort && (
              <Chip
                label={EFFORT_LABELS[rec.effort] ?? rec.effort}
                colorClass={effortColor}
              />
            )}
            {rec.timeframe && (
              <Chip
                label={TIMEFRAME_LABELS[rec.timeframe] ?? rec.timeframe}
                colorClass={timeframeColor}
              />
            )}
            <span className="text-xs text-slate-500 font-mono">
              Score: {Number(rec.priorityScore).toFixed(0)}/100
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-500">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/30 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rec.problemStatement && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  Problem Statement
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {rec.problemStatement}
                </p>
              </div>
            )}
            {rec.whyItMatters && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  Why It Matters
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {rec.whyItMatters}
                </p>
              </div>
            )}
            {rec.recommendedOutcome && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  Recommended Outcome
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {rec.recommendedOutcome}
                </p>
              </div>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-4 py-3 border-t border-b border-slate-700/30">
            {rec.suggestedOwner && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">{rec.suggestedOwner}</span>
              </div>
            )}
            {rec.confidence && (
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">
                  {Number(rec.confidence).toFixed(0)}% confidence
                </span>
              </div>
            )}
            {rec.successMetric && (
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">{rec.successMetric}</span>
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Business Impact", value: rec.businessImpactScore },
              { label: "Urgency", value: rec.urgencyScore },
              { label: "Severity", value: rec.severityScore },
              { label: "Perf. Gap", value: rec.performanceGapScore },
            ].map(({ label, value }) =>
              value ? (
                <div
                  key={label}
                  className="bg-slate-900/40 rounded-lg p-2.5 text-center"
                >
                  <div className="text-lg font-mono font-bold text-slate-100">
                    {Number(value).toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ) : null,
            )}
          </div>

          {/* Dependency notes */}
          {rec.dependencyNotes && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                Dependencies
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                {rec.dependencyNotes}
              </p>
            </div>
          )}

          {/* Scoring explanation (hidden in print) */}
          {rec.scoringExplanation && (
            <details className="text-xs text-slate-500 print:hidden">
              <summary className="cursor-pointer hover:text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Scoring explanation
              </summary>
              <pre className="mt-2 p-3 bg-slate-900/50 rounded-lg text-slate-400 overflow-x-auto text-xs whitespace-pre-wrap">
                {JSON.stringify(rec.scoringExplanation, null, 2)}
              </pre>
            </details>
          )}

          {/* Admin notes */}
          <div className="border-t border-slate-700/30 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Administrator Notes
              </span>
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={adminNotes}
                  onChange={(e) => onAdminNotesChange(e.target.value)}
                  rows={3}
                  placeholder="Add notes for this recommendation…"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <button
                  onClick={onSaveAdminNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                >
                  {savingNotes ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Save Notes
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 whitespace-pre-wrap">
                {adminNotes || (
                  <span className="italic text-slate-600">No administrator notes.</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action step card ─────────────────────────────────────────

function ActionCard({ action }: { action: SolutionRecommendationActionRecord }) {
  const horizonColor =
    ACTION_HORIZON_COLORS[action.timeHorizon] ??
    "text-slate-300 bg-slate-700/50 border-slate-600/50";
  const isComplete = action.completionStatus === "completed";

  return (
    <div
      className={cn(
        "bg-slate-800/40 border rounded-lg p-3 space-y-1.5",
        isComplete
          ? "border-emerald-700/30 opacity-70"
          : "border-slate-700/40",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0",
            isComplete
              ? "bg-emerald-500 border-emerald-500"
              : "border-slate-600",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span
              className={cn(
                "text-sm font-medium",
                isComplete ? "line-through text-slate-500" : "text-slate-200",
              )}
            >
              {action.title}
            </span>
            <Chip
              label={
                ACTION_HORIZON_LABELS[action.timeHorizon] ?? action.timeHorizon
              }
              colorClass={horizonColor}
            />
          </div>
          {action.description && (
            <p className="text-xs text-slate-400 leading-relaxed">
              {action.description}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
            {action.suggestedOwner && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {action.suggestedOwner}
              </span>
            )}
            {action.successMetric && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {action.successMetric}
              </span>
            )}
            {action.completionStatus !== "not_started" && (
              <span>
                {COMPLETION_STATUS_LABELS[action.completionStatus] ??
                  action.completionStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation dialog ──────────────────────────────────────

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  warning,
  confirmLabel,
  confirmClass,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  warning?: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-100">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            {description}
          </AlertDialogDescription>
          {warning && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">{warning}</p>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={
              confirmClass ??
              "bg-indigo-600 hover:bg-indigo-500 text-white"
            }
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function SolutionRecommendationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<PlanTab>("executive");
  const [editing, setEditing] = useState(false);

  // Local edits for plan-level fields
  const [localExecRec, setLocalExecRec] = useState("");
  const [localImpact, setLocalImpact] = useState("");
  const [localDeps, setLocalDeps] = useState("");
  const [localNotes, setLocalNotes] = useState("");

  // Per-recommendation admin notes
  const [recNotesMap, setRecNotesMap] = useState<Record<string, string>>({});
  const [savingRecNotes, setSavingRecNotes] = useState<Record<string, boolean>>({});

  // Expanded cards
  const [expandedRecs, setExpandedRecs] = useState<Record<string, boolean>>({});

  // Confirm dialogs
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Hooks (all unconditional, `as any` needed because generated UseQueryOptions requires queryKey)
  const { data: plan, refetch, isLoading, error } = useGetSolutionRecommendationPlan(id!, {
    query: { enabled: !!id } as any,
  });

  const { data: activityData } = useGetSolutionRecommendationPlanActivity(id!, undefined, {
    query: { enabled: !!id && tab === "approval" } as any,
  });

  const updateMut = useUpdateSolutionRecommendationPlan();
  const updateRecMut = useUpdateSolutionRecommendation();
  const submitMut = useSubmitSolutionRecommendationPlan();
  const approveMut = useApproveSolutionRecommendationPlan();
  const reopenMut = useReopenSolutionRecommendationPlan();
  const archiveMut = useArchiveSolutionRecommendationPlan();
  const regenerateMut = useRegenerateSolutionRecommendationPlan();

  // Sync local state from loaded plan
  useEffect(() => {
    if (!plan) return;
    setLocalExecRec(plan.executiveRecommendation ?? plan.systemExecutiveRecommendation ?? "");
    setLocalImpact(plan.businessImpactSummary ?? plan.systemBusinessImpactSummary ?? "");
    setLocalDeps(plan.dependencySummary ?? plan.systemDependencySummary ?? "");
    setLocalNotes(plan.consultantNotes ?? "");

    // Initialize per-rec admin notes
    const notesInit: Record<string, string> = {};
    for (const rec of plan.recommendations ?? []) {
      notesInit[rec.id] = rec.adminNotes ?? "";
    }
    setRecNotesMap(notesInit);
  }, [plan]);

  const typedPlan = plan as SolutionRecommendationPlanDetail | undefined;

  const isEditable =
    typedPlan?.status === "draft" || typedPlan?.status === "reopened";
  const isReadOnly =
    typedPlan?.status === "approved" || typedPlan?.status === "archived";

  // ── Handlers ──────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!id) return;
    try {
      await updateMut.mutateAsync({
        id,
        data: {
          executiveRecommendation: localExecRec || null,
          businessImpactSummary: localImpact || null,
          dependencySummary: localDeps || null,
          consultantNotes: localNotes || null,
        },
      });
      await refetch();
      setEditing(false);
      toast({ title: "Plan saved" });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { data?: { error?: string } })?.data?.error ?? "Failed to save";
      toast({ title: "Failed to save", description: msg, variant: "destructive" });
    }
  }, [id, localExecRec, localImpact, localDeps, localNotes, updateMut, refetch, toast]);

  const handleCancelEdit = useCallback(() => {
    if (!typedPlan) return;
    setLocalExecRec(typedPlan.executiveRecommendation ?? typedPlan.systemExecutiveRecommendation ?? "");
    setLocalImpact(typedPlan.businessImpactSummary ?? typedPlan.systemBusinessImpactSummary ?? "");
    setLocalDeps(typedPlan.dependencySummary ?? typedPlan.systemDependencySummary ?? "");
    setLocalNotes(typedPlan.consultantNotes ?? "");
    setEditing(false);
  }, [typedPlan]);

  const handleSaveRecNotes = useCallback(
    async (recId: string) => {
      if (!id) return;
      setSavingRecNotes((prev) => ({ ...prev, [recId]: true }));
      try {
        await updateRecMut.mutateAsync({
          id,
          recId,
          data: { adminNotes: recNotesMap[recId] ?? null },
        });
        await refetch();
        toast({ title: "Notes saved" });
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : (e as { data?: { error?: string } })?.data?.error ?? "Failed to save notes";
        toast({ title: "Failed to save notes", description: msg, variant: "destructive" });
      } finally {
        setSavingRecNotes((prev) => ({ ...prev, [recId]: false }));
      }
    },
    [id, recNotesMap, updateRecMut, refetch, toast],
  );

  const handleSubmit = useCallback(async () => {
    if (!id) return;
    try {
      await submitMut.mutateAsync({ id });
      await refetch();
      toast({ title: "Submitted for Review" });
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: string } })?.data?.error ?? "Failed to submit";
      toast({ title: "Submit failed", description: msg, variant: "destructive" });
    }
  }, [id, submitMut, refetch, toast]);

  const handleApprove = useCallback(async () => {
    if (!id) return;
    try {
      await approveMut.mutateAsync({ id });
      await refetch();
      toast({ title: "Plan Approved" });
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: string } })?.data?.error ?? "Failed to approve";
      toast({ title: "Approval failed", description: msg, variant: "destructive" });
    }
  }, [id, approveMut, refetch, toast]);

  const handleReopen = useCallback(async () => {
    if (!id) return;
    setReopenOpen(false);
    try {
      await reopenMut.mutateAsync({ id });
      await refetch();
      toast({ title: "Plan Reopened" });
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: string } })?.data?.error ?? "Failed to reopen";
      toast({ title: "Reopen failed", description: msg, variant: "destructive" });
    }
  }, [id, reopenMut, refetch, toast]);

  const handleArchive = useCallback(async () => {
    if (!id) return;
    setArchiveOpen(false);
    try {
      await archiveMut.mutateAsync({ id });
      await refetch();
      toast({ title: "Plan Archived" });
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: string } })?.data?.error ?? "Failed to archive";
      toast({ title: "Archive failed", description: msg, variant: "destructive" });
    }
  }, [id, archiveMut, refetch, toast]);

  const handleRegenerate = useCallback(async () => {
    if (!id) return;
    setRegenerateOpen(false);
    try {
      await regenerateMut.mutateAsync({ id });
      await refetch();
      toast({ title: "Plan Regenerated", description: "Recommendations have been recalculated." });
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: string } })?.data?.error ?? "Failed to regenerate";
      toast({ title: "Regeneration failed", description: msg, variant: "destructive" });
    }
  }, [id, regenerateMut, refetch, toast]);

  const toggleRec = useCallback((recId: string) => {
    setExpandedRecs((prev) => ({ ...prev, [recId]: !prev[recId] }));
  }, []);

  // ── Render: loading ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="ml-3 text-slate-400">Loading plan…</span>
      </div>
    );
  }

  if (error || !typedPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <p className="text-slate-400">
          {error ? "Failed to load recommendation plan." : "Plan not found."}
        </p>
        <button
          onClick={() => navigate("/growth-assessments")}
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  const recs = typedPlan.recommendations ?? [];
  const deps = typedPlan.dependencies ?? [];
  const activity = activityData?.data ?? [];

  const criticalOrHigh = recs.filter(
    (r) =>
      r.priorityClassification === "critical_priority" ||
      r.priorityClassification === "high_priority",
  );
  const quickWins = recs.filter((r) => r.quickWinFlag);

  const statusColor = PLAN_STATUS_COLORS[typedPlan.status] ?? "";
  const isMutating =
    updateMut.isPending ||
    submitMut.isPending ||
    approveMut.isPending ||
    reopenMut.isPending ||
    archiveMut.isPending ||
    regenerateMut.isPending;

  // Group actions by time horizon
  const allActions = recs.flatMap((r) =>
    (r.actions ?? []).map((a) => ({ ...a, recTitle: r.title, recRank: r.rank })),
  );
  const horizonOrder = ["immediate", "7_days", "30_days", "60_90_days"];
  const actionsByHorizon: Record<
    string,
    (SolutionRecommendationActionRecord & { recTitle: string; recRank: number })[]
  > = {};
  for (const a of allActions) {
    if (!actionsByHorizon[a.timeHorizon]) actionsByHorizon[a.timeHorizon] = [];
    actionsByHorizon[a.timeHorizon].push(a);
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4 print:hidden">
        <button
          onClick={() => navigate(`/growth-assessments/${typedPlan.growthAssessmentId}`)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Growth Assessment
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-slate-100">
              Solution Recommendation Plan
            </h1>
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium",
                statusColor,
              )}
            >
              {PLAN_STATUS_LABELS[typedPlan.status] ?? typedPlan.status}
            </span>
          </div>
          <div className="text-sm text-slate-400 space-x-2">
            {typedPlan.clientName && <span>{typedPlan.clientName}</span>}
            {typedPlan.projectName && (
              <span>· {typedPlan.projectName}</span>
            )}
            {typedPlan.diagnosticName && (
              <span>· {typedPlan.diagnosticName}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isEditable && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit Plan
            </button>
          )}
          {isEditable && editing && (
            <>
              <button
                onClick={handleSave}
                disabled={updateMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {updateMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
          {typedPlan.status === "draft" && (
            <button
              onClick={handleSubmit}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          )}
          {typedPlan.status === "awaiting_review" && (
            <button
              onClick={handleApprove}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Plan
            </button>
          )}
          {(typedPlan.status === "approved" ||
            typedPlan.status === "awaiting_review") && (
            <button
              onClick={() => setReopenOpen(true)}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reopen
            </button>
          )}
          {isEditable && (
            <button
              onClick={() => setRegenerateOpen(true)}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          )}
          {typedPlan.status !== "archived" && (
            <button
              onClick={() => setArchiveOpen(true)}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-lg transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* ── Print header (hidden on screen) ──────────────── */}
      <div className="hidden print:block space-y-1 pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">
          Solution Recommendation Plan
        </h1>
        <div className="flex gap-4 text-sm text-slate-600">
          {typedPlan.clientName && <span>{typedPlan.clientName}</span>}
          {typedPlan.projectName && <span>· {typedPlan.projectName}</span>}
          <span>· {format(new Date(typedPlan.createdAt), "MMMM d, yyyy")}</span>
          <span>· Status: {PLAN_STATUS_LABELS[typedPlan.status] ?? typedPlan.status}</span>
        </div>
      </div>

      {/* ── Summary bar ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3 print:gap-2">
        {[
          {
            label: "Overall Priority",
            value: typedPlan.overallPriorityScore
              ? `${Number(typedPlan.overallPriorityScore).toFixed(0)}/100`
              : "—",
          },
          {
            label: "Recommendations",
            value: recs.length,
          },
          {
            label: "Critical / High",
            value: criticalOrHigh.length,
          },
          {
            label: "Quick Wins",
            value: quickWins.length,
          },
          {
            label: "Engine Version",
            value: typedPlan.recommendationEngineVersion ?? "—",
          },
          {
            label: "Last Updated",
            value: format(new Date(typedPlan.updatedAt), "MMM d, yyyy"),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center"
          >
            <div className="text-lg font-mono font-bold text-slate-100">
              {value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-700/50 overflow-x-auto print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            role="tab"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px shrink-0",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              tab === t.id
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200",
            )}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          Tab: Executive Recommendation
      ══════════════════════════════════════════════════════ */}
      {(tab === "executive" || true /* always print */) && (
        <div
          className={cn(
            "space-y-5",
            tab !== "executive" && "hidden print:block",
          )}
        >
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 print:border print:rounded-none">
            <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Executive Recommendation
            </h2>
            <EditableSection
              label="Executive Recommendation"
              systemValue={typedPlan.systemExecutiveRecommendation}
              value={localExecRec}
              editing={editing && isEditable}
              onChange={setLocalExecRec}
              rows={8}
            />
          </div>

          {/* Key metrics */}
          {recs.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                At a Glance
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {criticalOrHigh.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-red-300">
                      {criticalOrHigh.length}
                    </div>
                    <div className="text-xs text-red-400">Critical or High Priority</div>
                  </div>
                )}
                {quickWins.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-300">
                      {quickWins.length}
                    </div>
                    <div className="text-xs text-emerald-400">Quick Wins Available</div>
                  </div>
                )}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-indigo-300">
                    {recs.length}
                  </div>
                  <div className="text-xs text-indigo-400">Total Recommendations</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Priority Recommendations
      ══════════════════════════════════════════════════════ */}
      {(tab === "recommendations" || true) && (
        <div
          className={cn(
            "space-y-4",
            tab !== "recommendations" && "hidden print:block",
          )}
        >
          {tab === "recommendations" && (
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Star className="w-5 h-5 text-indigo-400" />
                Priority Recommendations
              </h2>
              {recs.length > 0 && (
                <button
                  onClick={() => {
                    const allExpanded = recs.every((r) => expandedRecs[r.id]);
                    const newVal = !allExpanded;
                    const next: Record<string, boolean> = {};
                    recs.forEach((r) => (next[r.id] = newVal));
                    setExpandedRecs(next);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {recs.every((r) => expandedRecs[r.id])
                    ? "Collapse all"
                    : "Expand all"}
                </button>
              )}
            </div>
          )}

          {recs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No recommendations generated yet.
            </div>
          ) : (
            recs.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                expanded={!!expandedRecs[rec.id]}
                onToggle={() => toggleRec(rec.id)}
                editing={editing && isEditable}
                adminNotes={recNotesMap[rec.id] ?? ""}
                onAdminNotesChange={(v) =>
                  setRecNotesMap((prev) => ({ ...prev, [rec.id]: v }))
                }
                onSaveAdminNotes={() => handleSaveRecNotes(rec.id)}
                savingNotes={!!savingRecNotes[rec.id]}
              />
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Action Plan
      ══════════════════════════════════════════════════════ */}
      {(tab === "actions" || true) && (
        <div
          className={cn(
            "space-y-6",
            tab !== "actions" && "hidden print:block",
          )}
        >
          {tab === "actions" && (
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              Action Plan
            </h2>
          )}
          {allActions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No action steps defined yet.
            </div>
          ) : (
            horizonOrder
              .filter((h) => (actionsByHorizon[h] ?? []).length > 0)
              .map((horizon) => (
                <div key={horizon} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    {ACTION_HORIZON_LABELS[horizon] ?? horizon}
                    <span className="text-slate-600 font-normal">
                      ({actionsByHorizon[horizon].length})
                    </span>
                  </h3>
                  <div className="space-y-2 pl-4 border-l-2 border-slate-700/50">
                    {actionsByHorizon[horizon].map((a) => (
                      <div key={a.id}>
                        <div className="text-xs text-slate-600 mb-1">
                          #{a.recRank} {a.recTitle}
                        </div>
                        <ActionCard action={a} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Business Impact
      ══════════════════════════════════════════════════════ */}
      {(tab === "impact" || true) && (
        <div
          className={cn(
            "space-y-5",
            tab !== "impact" && "hidden print:block",
          )}
        >
          {tab === "impact" && (
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Business Impact Summary
            </h2>
          )}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 print:border print:rounded-none">
            <EditableSection
              label="Business Impact Summary"
              systemValue={typedPlan.systemBusinessImpactSummary}
              value={localImpact}
              editing={editing && isEditable}
              onChange={setLocalImpact}
              rows={8}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Dependencies
      ══════════════════════════════════════════════════════ */}
      {(tab === "dependencies" || true) && (
        <div
          className={cn(
            "space-y-5",
            tab !== "dependencies" && "hidden print:block",
          )}
        >
          {tab === "dependencies" && (
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              Dependencies &amp; Sequencing
            </h2>
          )}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 print:border print:rounded-none space-y-4">
            <EditableSection
              label="Dependency Summary"
              systemValue={typedPlan.systemDependencySummary}
              value={localDeps}
              editing={editing && isEditable}
              onChange={setLocalDeps}
              rows={6}
            />
          </div>

          {deps.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Dependency Relationships
              </h3>
              <div className="space-y-2">
                {deps.map((dep) => {
                  const fromRec = recs.find((r) => r.id === dep.recommendationId);
                  const toRec = recs.find(
                    (r) => r.id === dep.dependsOnRecommendationId,
                  );
                  return (
                    <div
                      key={dep.id}
                      className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg"
                    >
                      <GitBranch className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-300">
                        <span className="font-medium text-slate-200">
                          {fromRec?.title ?? dep.recommendationId}
                        </span>{" "}
                        <span className="text-slate-500">depends on</span>{" "}
                        <span className="font-medium text-slate-200">
                          {toRec?.title ?? dep.dependsOnRecommendationId}
                        </span>
                        {dep.notes && (
                          <p className="text-xs text-slate-500 mt-1">{dep.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Consultant Notes
      ══════════════════════════════════════════════════════ */}
      {(tab === "notes" || true) && (
        <div
          className={cn(
            "space-y-5",
            tab !== "notes" && "hidden print:block",
          )}
        >
          {tab === "notes" && (
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Consultant Notes
            </h2>
          )}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 print:border print:rounded-none">
            <EditableSection
              label="Consultant Notes"
              value={localNotes}
              editing={editing && isEditable}
              onChange={setLocalNotes}
              rows={10}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Tab: Approval
      ══════════════════════════════════════════════════════ */}
      {tab === "approval" && (
        <div className="space-y-5 print:hidden">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Approval
          </h2>

          {/* Approval status card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  Status
                </span>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium",
                    statusColor,
                  )}
                >
                  {PLAN_STATUS_LABELS[typedPlan.status] ?? typedPlan.status}
                </span>
              </div>
              {typedPlan.reviewedAt && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    Reviewed At
                  </span>
                  <span className="text-sm text-slate-300">
                    {format(new Date(typedPlan.reviewedAt), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
              )}
              {typedPlan.reviewedBy && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    Reviewed By
                  </span>
                  <span className="text-sm text-slate-300">{typedPlan.reviewedBy}</span>
                </div>
              )}
              {typedPlan.approvedAt && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    Approved At
                  </span>
                  <span className="text-sm text-emerald-300">
                    {format(new Date(typedPlan.approvedAt), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
              )}
              {typedPlan.approvedBy && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    Approved By
                  </span>
                  <span className="text-sm text-slate-300">{typedPlan.approvedBy}</span>
                </div>
              )}
              {typedPlan.archivedAt && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    Archived At
                  </span>
                  <span className="text-sm text-slate-400">
                    {format(new Date(typedPlan.archivedAt), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
              )}
            </div>

            {/* Approval validation hints */}
            {isEditable && (
              <div className="border-t border-slate-700/30 pt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Approval Checklist
                </p>
                {[
                  {
                    ok: recs.length >= 1,
                    label: "At least one recommendation",
                  },
                  {
                    ok: !!(localExecRec || typedPlan.systemExecutiveRecommendation),
                    label: "Executive Recommendation present",
                  },
                  {
                    ok: recs.every((r) => !!r.successMetric),
                    label: "Success metric on every recommendation",
                  },
                ].map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <span className={ok ? "text-slate-300" : "text-amber-300"}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          {activity.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Activity Log
              </h3>
              <div className="space-y-2">
                {activity.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-slate-700/20 last:border-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300">
                        {(entry as { description?: string }).description ??
                          (entry as { action?: string }).action ??
                          JSON.stringify(entry)}
                      </p>
                      <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                        {(entry as { userName?: string }).userName && (
                          <span>
                            {(entry as { userName?: string }).userName}
                          </span>
                        )}
                        {(entry as { createdAt?: string }).createdAt && (
                          <span>
                            {format(
                              new Date(
                                (entry as { createdAt?: string }).createdAt!,
                              ),
                              "MMM d, yyyy HH:mm",
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation dialogs ──────────────────────────── */}
      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Regenerate Recommendation Plan?"
        description="The engine will recalculate all recommendations based on the current assessment data."
        warning="Regenerating may replace unapproved system-generated recommendations. Administrator edits to text fields will be preserved, but recommendation ordering and scores will be recalculated."
        confirmLabel="Regenerate"
        confirmClass="bg-amber-600 hover:bg-amber-500 text-white"
        onConfirm={handleRegenerate}
        loading={regenerateMut.isPending}
      />
      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen Plan for Editing?"
        description="This will move the plan back to draft status so changes can be made. A new approval will be required before the plan can be used."
        confirmLabel="Reopen"
        onConfirm={handleReopen}
        loading={reopenMut.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive This Plan?"
        description="The plan will be archived and become read-only. It will remain accessible for audit history but cannot be edited."
        confirmLabel="Archive"
        confirmClass="bg-slate-600 hover:bg-slate-500 text-white"
        onConfirm={handleArchive}
        loading={archiveMut.isPending}
      />
    </div>
  );
}
