import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useGetGrowthBlueprint,
  useUpdateGrowthBlueprint,
  useStartGrowthBlueprint,
  useReadyGrowthBlueprint,
  useApproveGrowthBlueprint,
  useArchiveGrowthBlueprint,
} from "@workspace/api-client-react";
import {
  ChevronLeft,
  Save,
  FileText,
  ShieldCheck,
  Loader2,
  Edit2,
  LayoutDashboard,
  Building2,
  FolderOpen,
  BarChart3,
  Target,
  Archive,
  CheckCircle2,
  Send,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// ─── Lifecycle config ─────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  approved: "Approved",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-300 bg-slate-700/50 border-slate-600/50",
  in_progress: "text-blue-300 bg-blue-900/30 border-blue-700/50",
  ready_for_review: "text-amber-300 bg-amber-900/30 border-amber-700/50",
  approved: "text-emerald-300 bg-emerald-900/30 border-emerald-700/50",
  archived: "text-slate-400 bg-slate-800/50 border-slate-700/30",
};

// ─── Tab types ────────────────────────────────────────────────────

type Tab = "overview" | "approval";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "approval", label: "Approval", icon: ShieldCheck },
];

// ─── Editable notes section ───────────────────────────────────────

function EditableNotes({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (val: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {!disabled && !editing && (
          <button
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full min-h-[120px] bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 resize-y focus:outline-none focus:ring-1 focus:ring-slate-500"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}…`}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-300 whitespace-pre-wrap">
          {value?.trim() ? value : <span className="text-slate-500 italic">None recorded.</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────

export function GrowthBlueprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [confirmAction, setConfirmAction] = useState<
    "start" | "ready" | "approve" | "archive" | null
  >(null);

  const { data: blueprint, isLoading, error } = useGetGrowthBlueprint(id!);

  const { mutate: updateBlueprint, isPending: isSaving } = useUpdateGrowthBlueprint({
    mutation: {
      onSuccess: () => toast({ title: "Blueprint saved." }),
      onError: () => toast({ title: "Save failed.", variant: "destructive" }),
    },
  });

  const { mutate: startBlueprint, isPending: isStarting } = useStartGrowthBlueprint({
    mutation: {
      onSuccess: () => toast({ title: "Blueprint moved to In Progress." }),
      onError: (err: any) =>
        toast({ title: err?.data?.error ?? "Action failed.", variant: "destructive" }),
    },
  });

  const { mutate: readyBlueprint, isPending: isReadying } = useReadyGrowthBlueprint({
    mutation: {
      onSuccess: () => toast({ title: "Blueprint submitted for review." }),
      onError: (err: any) =>
        toast({ title: err?.data?.error ?? "Action failed.", variant: "destructive" }),
    },
  });

  const { mutate: approveBlueprint, isPending: isApproving } = useApproveGrowthBlueprint({
    mutation: {
      onSuccess: () => toast({ title: "Blueprint approved." }),
      onError: (err: any) =>
        toast({ title: err?.data?.error ?? "Action failed.", variant: "destructive" }),
    },
  });

  const { mutate: archiveBlueprint, isPending: isArchiving } = useArchiveGrowthBlueprint({
    mutation: {
      onSuccess: () => toast({ title: "Blueprint archived." }),
      onError: (err: any) =>
        toast({ title: err?.data?.error ?? "Action failed.", variant: "destructive" }),
    },
  });

  const isBusy = isSaving || isStarting || isReadying || isApproving || isArchiving;
  const isEditable =
    blueprint?.status !== "approved" && blueprint?.status !== "archived";

  function handleSaveNotes(consultantNotes: string) {
    updateBlueprint({ id: id!, data: { consultantNotes } });
  }

  function handleConfirm() {
    if (!confirmAction) return;
    const handlers: Record<typeof confirmAction, () => void> = {
      start: () => startBlueprint({ id: id! }),
      ready: () => readyBlueprint({ id: id! }),
      approve: () => approveBlueprint({ id: id! }),
      archive: () => archiveBlueprint({ id: id! }),
    };
    handlers[confirmAction]?.();
    setConfirmAction(null);
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blueprint) {
    return (
      <div className="p-8 text-center text-slate-400">
        Blueprint not found.{" "}
        <button className="underline" onClick={() => navigate("/")}>
          Go home
        </button>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[blueprint.status] ?? blueprint.status;
  const statusColor = STATUS_COLORS[blueprint.status] ?? STATUS_COLORS.draft;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/")}
            className="mt-0.5 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-slate-100">{blueprint.title}</h1>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium",
                  statusColor,
                )}
              >
                {statusLabel}
              </span>
              <span className="text-xs text-slate-500">v{blueprint.version}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created {format(new Date(blueprint.createdAt), "MMM d, yyyy")} · Updated{" "}
              {format(new Date(blueprint.updatedAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {blueprint.status === "draft" && (
            <button
              disabled={isBusy}
              onClick={() => setConfirmAction("start")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              Start
            </button>
          )}
          {blueprint.status === "in_progress" && (
            <button
              disabled={isBusy}
              onClick={() => setConfirmAction("ready")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              Submit for Review
            </button>
          )}
          {blueprint.status === "ready_for_review" && (
            <button
              disabled={isBusy}
              onClick={() => setConfirmAction("approve")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </button>
          )}
          {blueprint.status !== "archived" && (
            <button
              disabled={isBusy}
              onClick={() => setConfirmAction("archive")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Archive className="h-3 w-3" />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="border-b border-slate-700/50">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Blueprint tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                  active
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Overview tab ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: connection cards */}
          <div className="lg:col-span-1 space-y-4">
            {/* Client */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                Client
              </div>
              {blueprint.clientName ? (
                <button
                  onClick={() => navigate(`/clients/${blueprint.clientId}`)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors text-left"
                >
                  {blueprint.clientName}
                </button>
              ) : (
                <span className="text-sm text-slate-500 italic">No client linked</span>
              )}
            </div>

            {/* Project */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FolderOpen className="h-3.5 w-3.5" />
                Project
              </div>
              {blueprint.projectName ? (
                <button
                  onClick={() => navigate(`/projects/${blueprint.projectId}`)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors text-left"
                >
                  {blueprint.projectName}
                </button>
              ) : (
                <span className="text-sm text-slate-500 italic">No project linked</span>
              )}
            </div>

            {/* Growth Assessment */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <BarChart3 className="h-3.5 w-3.5" />
                Growth Assessment
              </div>
              <button
                onClick={() => navigate(`/growth-assessments/${blueprint.growthAssessmentId}`)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors text-left"
              >
                View Assessment
              </button>
              {blueprint.assessmentHealthScore != null && (
                <div className="text-xs text-slate-400">
                  Health score:{" "}
                  <span className="text-slate-200 font-medium">
                    {Number(blueprint.assessmentHealthScore).toFixed(1)}
                  </span>{" "}
                  <span className="capitalize text-slate-400">
                    ({blueprint.assessmentHealthRating ?? "—"})
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-500 capitalize">
                Status: {blueprint.assessmentStatus ?? "—"}
              </div>
            </div>

            {/* Recommendation Plan */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Target className="h-3.5 w-3.5" />
                Recommendation Plan
              </div>
              <button
                onClick={() =>
                  navigate(`/solution-recommendations/${blueprint.solutionRecommendationPlanId}`)
                }
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors text-left"
              >
                View Plan
              </button>
              {blueprint.planOverallPriorityScore != null && (
                <div className="text-xs text-slate-400">
                  Priority score:{" "}
                  <span className="text-slate-200 font-medium">
                    {Number(blueprint.planOverallPriorityScore).toFixed(1)}
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-500 capitalize">
                Status: {blueprint.planStatus ?? "—"}
              </div>
            </div>
          </div>

          {/* Right: notes + metadata */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata strip */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium",
                      statusColor,
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Version</p>
                  <p className="text-sm text-slate-200 font-medium">v{blueprint.version}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-sm text-slate-200">
                    {format(new Date(blueprint.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Updated</p>
                  <p className="text-sm text-slate-200">
                    {format(new Date(blueprint.updatedAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>

            {/* Consultant notes */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                Consultant Notes
              </div>
              <EditableNotes
                label="Consultant Notes"
                value={blueprint.consultantNotes}
                onSave={handleSaveNotes}
                disabled={!isEditable || isBusy}
              />
            </div>

            {/* Phase placeholder notice */}
            <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500">
                Blueprint generation, section editors, and roadmap views will be available in
                Phase 2B.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval tab ─────────────────────────────────────────── */}
      {activeTab === "approval" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-slate-200">Lifecycle State</h2>

            {/* Visual pipeline */}
            <div className="flex items-center gap-1 flex-wrap">
              {(["draft", "in_progress", "ready_for_review", "approved"] as const).map(
                (s, i, arr) => {
                  const isActive = blueprint.status === s;
                  const isPast =
                    arr.indexOf(blueprint.status as any) > i;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border",
                          isActive
                            ? STATUS_COLORS[s]
                            : isPast
                              ? "text-slate-500 bg-slate-800/30 border-slate-700/30 line-through"
                              : "text-slate-600 bg-slate-800/20 border-slate-700/20",
                        )}
                      >
                        {STATUS_LABELS[s]}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-slate-600 text-xs">→</span>
                      )}
                    </div>
                  );
                },
              )}
            </div>

            {blueprint.status === "archived" && (
              <div className="text-sm text-slate-400 italic">This blueprint has been archived.</div>
            )}

            {/* Approval record */}
            {blueprint.approvedAt && (
              <div className="pt-3 border-t border-slate-700/40">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Approval Record
                </p>
                <p className="text-sm text-slate-300">
                  Approved on{" "}
                  <span className="text-slate-200 font-medium">
                    {format(new Date(blueprint.approvedAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm dialog ───────────────────────────────────────── */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent className="bg-slate-900 border border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              {confirmAction === "start" && "Start Blueprint?"}
              {confirmAction === "ready" && "Submit for Review?"}
              {confirmAction === "approve" && "Approve Blueprint?"}
              {confirmAction === "archive" && "Archive Blueprint?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmAction === "start" &&
                "This will move the blueprint to In Progress. You can continue editing."}
              {confirmAction === "ready" &&
                "This will submit the blueprint for approval review."}
              {confirmAction === "approve" &&
                "This will mark the blueprint as approved. You will not be able to edit it without reopening."}
              {confirmAction === "archive" &&
                "This will archive the blueprint. Archived blueprints cannot be edited."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                confirmAction === "archive"
                  ? "bg-slate-600 hover:bg-slate-500"
                  : "bg-blue-600 hover:bg-blue-500",
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default GrowthBlueprintDetailPage;
