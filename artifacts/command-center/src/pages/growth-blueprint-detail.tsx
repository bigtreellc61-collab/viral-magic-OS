import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
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
  useGenerateGrowthBlueprint,
  useRegenerateGrowthBlueprint,
  useReviseGrowthBlueprint,
  useListGrowthBlueprintSections,
  useUpdateGrowthBlueprintSection,
  useResetGrowthBlueprintSection,
  useListGrowthBlueprintInitiatives,
  useUpdateGrowthBlueprintInitiative,
  useListGrowthBlueprintVersions,
  getListGrowthBlueprintSectionsQueryKey,
  getListGrowthBlueprintInitiativesQueryKey,
  getListGrowthBlueprintVersionsQueryKey,
  getGetGrowthBlueprintQueryKey,
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
  RefreshCw,
  GitBranch,
  Zap,
  MapPin,
  TrendingUp,
  Key,
  Link2,
  History,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
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

const GENERATION_STATUS_COLORS: Record<string, string> = {
  complete: "text-emerald-400",
  failed: "text-red-400",
  pending: "text-amber-400",
};

const PERIOD_LABELS: Record<string, string> = {
  "30_days": "30 Days",
  "60_days": "60 Days",
  "90_days": "90 Days",
  "longer_term": "Longer Term",
};

const PERIOD_COLORS: Record<string, string> = {
  "30_days": "text-rose-300 bg-rose-900/20 border-rose-700/40",
  "60_days": "text-amber-300 bg-amber-900/20 border-amber-700/40",
  "90_days": "text-blue-300 bg-blue-900/20 border-blue-700/40",
  "longer_term": "text-slate-300 bg-slate-800/40 border-slate-600/40",
};

const PRIORITY_COLORS: Record<string, string> = {
  "Critical Priority": "text-red-400 bg-red-900/20 border-red-700/30",
  "High Priority": "text-orange-400 bg-orange-900/20 border-orange-700/30",
  "Important": "text-amber-400 bg-amber-900/20 border-amber-700/30",
  "Planned Improvement": "text-blue-400 bg-blue-900/20 border-blue-700/30",
  "Monitor": "text-slate-400 bg-slate-800/30 border-slate-600/30",
};

// ─── Tab types ────────────────────────────────────────────────────

type Tab =
  | "executive"
  | "business_state"
  | "strategic"
  | "roadmap"
  | "impact"
  | "kpis"
  | "dependencies"
  | "consultant"
  | "approval"
  | "versions";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "executive", label: "Executive", icon: FileText },
  { id: "business_state", label: "Business State", icon: LayoutDashboard },
  { id: "strategic", label: "Strategic Priorities", icon: Target },
  { id: "roadmap", label: "30/60/90 Roadmap", icon: MapPin },
  { id: "impact", label: "Business Impact", icon: TrendingUp },
  { id: "kpis", label: "KPIs", icon: BarChart3 },
  { id: "dependencies", label: "Dependencies", icon: Link2 },
  { id: "consultant", label: "Consultant Guidance", icon: Key },
  { id: "approval", label: "Approval", icon: ShieldCheck },
  { id: "versions", label: "Version History", icon: History },
];

// ─── Section key → tab mapping ───────────────────────────────────

const SECTION_TAB_MAP: Record<string, Tab> = {
  executive_summary: "executive",
  current_business_state: "business_state",
  key_strengths: "business_state",
  critical_vulnerabilities: "business_state",
  primary_risks: "business_state",
  immediate_quick_wins: "executive",
  strategic_priorities: "strategic",
  action_plan_30_days: "roadmap",
  action_plan_60_days: "roadmap",
  action_plan_90_days: "roadmap",
  longer_term_roadmap: "roadmap",
  business_impact: "impact",
  success_metrics: "kpis",
  dependencies_constraints: "dependencies",
  consultant_guidance: "consultant",
  executive_decision_summary: "executive",
};

// ─── Sub-components ───────────────────────────────────────────────

function SectionCard({
  section,
  blueprintId,
  isReadOnly,
}: {
  section: {
    id: string;
    sectionKey: string;
    title: string;
    generatedContent?: string | null;
    consultantContent?: string | null;
    finalContent?: string | null;
    hasOverride?: boolean;
    generationStatus?: string;
  };
  blueprintId: string;
  isReadOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSection = useUpdateGrowthBlueprintSection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintSectionsQueryKey(blueprintId) });
        setEditing(false);
        toast({ title: "Section saved" });
      },
      onError: (err: any) => toast({ title: "Save failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const resetSection = useResetGrowthBlueprintSection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintSectionsQueryKey(blueprintId) });
        toast({ title: "Override cleared" });
      },
      onError: (err: any) => toast({ title: "Reset failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const displayContent = section.finalContent ?? section.generatedContent ?? "";
  const previewLength = 300;
  const isLong = displayContent.length > previewLength;

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">{section.title}</h3>
          {section.hasOverride && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-300">
              Edited
            </span>
          )}
          {section.generationStatus === "complete" && !section.hasOverride && (
            <span className="text-xs text-slate-500">Generated</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isReadOnly && section.hasOverride && (
            <button
              onClick={() => resetSection.mutate({ id: blueprintId, sectionId: section.id })}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-300 transition-colors"
              title="Revert to generated content"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          {!isReadOnly && !editing && (
            <button
              onClick={() => { setDraft(section.consultantContent ?? section.generatedContent ?? ""); setEditing(true); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full bg-slate-900/80 border border-slate-600 rounded-md p-3 text-sm text-slate-200 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[160px] font-mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => updateSection.mutate({ id: blueprintId, sectionId: section.id, data: { consultantContent: draft } })}
              disabled={updateSection.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {updateSection.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
            {isLong && !expanded ? displayContent.slice(0, previewLength) + "…" : displayContent}
          </pre>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InitiativeCard({
  initiative,
  blueprintId,
  isReadOnly,
}: {
  initiative: {
    id: string;
    title: string;
    domain: string;
    priorityClassification: string;
    effortLevel?: string | null;
    roadmapPeriod: string;
    roadmapReason?: string | null;
    ownerPlaceholder?: string | null;
    targetPeriodLabel?: string | null;
    consultantGuidance?: string | null;
    overrideRoadmapPeriod?: boolean;
    sequenceOrder: number;
    expectedBusinessImpact?: string | null;
  };
  blueprintId: string;
  isReadOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(initiative.ownerPlaceholder ?? "");
  const [editingGuidance, setEditingGuidance] = useState(false);
  const [guidanceDraft, setGuidanceDraft] = useState(initiative.consultantGuidance ?? "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateInitiative = useUpdateGrowthBlueprintInitiative({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintInitiativesQueryKey(blueprintId) });
        setEditingOwner(false);
        setEditingGuidance(false);
        toast({ title: "Initiative updated" });
      },
      onError: (err: any) => toast({ title: "Update failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const priorityColor = PRIORITY_COLORS[initiative.priorityClassification] ?? PRIORITY_COLORS["Monitor"];
  const periodColor = PERIOD_COLORS[initiative.roadmapPeriod] ?? PERIOD_COLORS["longer_term"];

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-xs text-slate-500 font-mono w-5 shrink-0 mt-0.5">{initiative.sequenceOrder}.</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 leading-snug">{initiative.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{initiative.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-xs px-1.5 py-0.5 rounded border", priorityColor)}>
            {initiative.priorityClassification}
          </span>
          <span className={cn("text-xs px-1.5 py-0.5 rounded border", periodColor)}>
            {PERIOD_LABELS[initiative.roadmapPeriod] ?? initiative.roadmapPeriod}
            {initiative.overrideRoadmapPeriod && " ✎"}
          </span>
        </div>
      </div>

      {initiative.roadmapReason && (
        <p className="text-xs text-slate-500 pl-7 italic">{initiative.roadmapReason}</p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="pl-7 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded && (
        <div className="pl-7 space-y-3 pt-1">
          {initiative.expectedBusinessImpact && (
            <p className="text-xs text-slate-400 leading-relaxed">{initiative.expectedBusinessImpact}</p>
          )}

          {/* Owner */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</span>
            {editingOwner ? (
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 bg-slate-900/80 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  placeholder="e.g. Sales Lead"
                />
                <button
                  onClick={() => updateInitiative.mutate({ id: blueprintId, initiativeId: initiative.id, data: { ownerPlaceholder: ownerDraft } })}
                  disabled={updateInitiative.isPending}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button onClick={() => setEditingOwner(false)} className="text-xs text-slate-400 hover:text-slate-200">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-300">{initiative.ownerPlaceholder || "Not assigned"}</p>
                {!isReadOnly && (
                  <button onClick={() => { setOwnerDraft(initiative.ownerPlaceholder ?? ""); setEditingOwner(true); }} className="text-xs text-slate-500 hover:text-slate-300">
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Consultant guidance */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Consultant Guidance</span>
            {editingGuidance ? (
              <div className="space-y-2">
                <textarea
                  className="w-full bg-slate-900/80 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={guidanceDraft}
                  onChange={(e) => setGuidanceDraft(e.target.value)}
                  placeholder="Add guidance specific to this initiative…"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateInitiative.mutate({ id: blueprintId, initiativeId: initiative.id, data: { consultantGuidance: guidanceDraft } })}
                    disabled={updateInitiative.isPending}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingGuidance(false)} className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-xs text-slate-400 flex-1">{initiative.consultantGuidance || "No guidance added"}</p>
                {!isReadOnly && (
                  <button onClick={() => { setGuidanceDraft(initiative.consultantGuidance ?? ""); setEditingGuidance(true); }} className="text-xs text-slate-500 hover:text-slate-300 shrink-0">
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function GrowthBlueprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("executive");
  const [confirmAction, setConfirmAction] = useState<
    "start" | "ready" | "approve" | "archive" | "generate" | "regenerate" | "revise" | null
  >(null);

  const { data: blueprint, isLoading, error } = useGetGrowthBlueprint(id!);
  const { data: sectionsData } = useListGrowthBlueprintSections(id!);
  const { data: initiativesData } = useListGrowthBlueprintInitiatives(id!);
  const { data: versionsData } = useListGrowthBlueprintVersions(id!);

  const sections = (sectionsData as any)?.data ?? [];
  const initiatives = (initiativesData as any)?.data ?? [];
  const versions = (versionsData as any)?.data ?? [];

  const isReadOnly = blueprint?.status === "approved" || blueprint?.status === "archived" || !!blueprint?.archivedAt;
  const canGenerate = blueprint?.status === "draft" || blueprint?.status === "in_progress";
  const canRegenerate = canGenerate && blueprint?.generationStatus === "complete";
  const canRevise = blueprint?.status === "approved";

  // ── Mutations ─────────────────────────────────────────────────

  function makeOnSuccess(msg: string) {
    return () => {
      queryClient.invalidateQueries({ queryKey: getGetGrowthBlueprintQueryKey(id!) });
      queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintSectionsQueryKey(id!) });
      queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintInitiativesQueryKey(id!) });
      toast({ title: msg });
    };
  }
  function makeOnError(label: string) {
    return (err: any) => toast({ title: `${label} failed`, description: err?.data?.error ?? "An error occurred.", variant: "destructive" });
  }

  const updateBp = useUpdateGrowthBlueprint({ mutation: { onSuccess: makeOnSuccess("Blueprint saved"), onError: makeOnError("Save") } });
  const startBp = useStartGrowthBlueprint({ mutation: { onSuccess: makeOnSuccess("Blueprint started"), onError: makeOnError("Start") } });
  const readyBp = useReadyGrowthBlueprint({ mutation: { onSuccess: makeOnSuccess("Submitted for review"), onError: makeOnError("Submit") } });
  const approveBp = useApproveGrowthBlueprint({ mutation: { onSuccess: makeOnSuccess("Blueprint approved"), onError: makeOnError("Approve") } });
  const archiveBp = useArchiveGrowthBlueprint({ mutation: { onSuccess: makeOnSuccess("Blueprint archived"), onError: makeOnError("Archive") } });

  const generateBp = useGenerateGrowthBlueprint({
    mutation: {
      onSuccess: (data: any) => {
        makeOnSuccess(`Blueprint generated — ${data?.summary?.initiativeCount ?? 0} initiative(s)`)();
        queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintVersionsQueryKey(id!) });
      },
      onError: makeOnError("Generate"),
    },
  });

  const regenerateBp = useRegenerateGrowthBlueprint({
    mutation: {
      onSuccess: (data: any) => makeOnSuccess(`Regenerated — ${data?.summary?.preservedOverrides ?? 0} override(s) preserved`)(),
      onError: makeOnError("Regenerate"),
    },
  });

  const reviseBp = useReviseGrowthBlueprint({
    mutation: {
      onSuccess: (data: any) => {
        toast({ title: "Revision created" });
        if (data?.id) navigate(`/growth-blueprints/${data.id}`);
      },
      onError: makeOnError("Revision"),
    },
  });

  const isActionPending =
    startBp.isPending || readyBp.isPending || approveBp.isPending || archiveBp.isPending ||
    generateBp.isPending || regenerateBp.isPending || reviseBp.isPending;

  const handleConfirm = useCallback(() => {
    if (!id) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "start") startBp.mutate({ id });
    if (action === "ready") readyBp.mutate({ id });
    if (action === "approve") approveBp.mutate({ id });
    if (action === "archive") archiveBp.mutate({ id });
    if (action === "generate") generateBp.mutate({ id });
    if (action === "regenerate") regenerateBp.mutate({ id });
    if (action === "revise") reviseBp.mutate({ id, data: {} });
  }, [confirmAction, id]);

  // ── Sections filtered by tab ──────────────────────────────────

  const sectionsByTab = useCallback(
    (tab: Tab) => sections.filter((s: any) => SECTION_TAB_MAP[s.sectionKey] === tab),
    [sections],
  );

  const initiativesByPeriod = useCallback(
    (period: string) => initiatives.filter((i: any) => i.roadmapPeriod === period),
    [initiatives],
  );

  // ── Loading / error states ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error || !blueprint) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{(error as any)?.data?.error ?? "Blueprint not found."}</p>
        <button onClick={() => navigate("/")} className="mt-3 text-sm text-slate-400 hover:text-slate-200">
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const notGenerated = blueprint.generationStatus !== "complete";

  // ── Header ────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-100">{blueprint.title}</h1>
            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", STATUS_COLORS[blueprint.status])}>
              {STATUS_LABELS[blueprint.status]}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {(blueprint as any).versionLabel ?? `v${blueprint.version}.${(blueprint as any).revisionNumber ?? 0}`}
            </span>
            {blueprint.generationStatus && (
              <span className={cn("text-xs", GENERATION_STATUS_COLORS[blueprint.generationStatus])}>
                {blueprint.generationStatus === "complete" ? "✓ Generated" : blueprint.generationStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {blueprint.clientName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {blueprint.clientName}
              </span>
            )}
            {blueprint.projectName && (
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" /> {blueprint.projectName}
              </span>
            )}
            <span>Updated {format(new Date(blueprint.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canGenerate && !canRegenerate && (
            <button
              onClick={() => setConfirmAction("generate")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate Blueprint
            </button>
          )}
          {canRegenerate && (
            <button
              onClick={() => setConfirmAction("regenerate")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md border border-slate-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
          {canRevise && (
            <button
              onClick={() => setConfirmAction("revise")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md border border-slate-600 transition-colors disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Create Revision
            </button>
          )}
          {blueprint.status === "draft" && (
            <button
              onClick={() => setConfirmAction("start")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          )}
          {blueprint.status === "in_progress" && (
            <button
              onClick={() => setConfirmAction("ready")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </button>
          )}
          {blueprint.status === "ready_for_review" && (
            <button
              onClick={() => setConfirmAction("approve")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
          )}
          {!blueprint.archivedAt && blueprint.status !== "archived" && (
            <button
              onClick={() => setConfirmAction("archive")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
          {isActionPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700/50">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Not generated notice ──────────────────────────────── */}
      {notGenerated && activeTab !== "approval" && activeTab !== "versions" && (
        <div className="bg-violet-900/20 border border-violet-700/40 rounded-lg p-4 flex items-center gap-3">
          <Zap className="h-4 w-4 text-violet-400 shrink-0" />
          <p className="text-sm text-violet-300">
            This blueprint has not been generated yet.
            {canGenerate
              ? ' Click "Generate Blueprint" above to assemble sections and initiatives from source data.'
              : " Move the blueprint to Draft or In Progress status to generate content."}
          </p>
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────── */}

      {/* Executive tab — Executive Summary, Quick Wins, Decision Summary */}
      {activeTab === "executive" && (
        <div className="space-y-4">
          {sectionsByTab("executive").length === 0 ? (
            <p className="text-sm text-slate-500">No executive sections generated yet.</p>
          ) : (
            sectionsByTab("executive").map((s: any) => (
              <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
            ))
          )}
        </div>
      )}

      {/* Business State tab — State, Strengths, Vulnerabilities, Risks */}
      {activeTab === "business_state" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Health Score</p>
              <p className="text-2xl font-bold text-slate-100">
                {blueprint.assessmentHealthScore ? Number(blueprint.assessmentHealthScore).toFixed(0) : "—"}
                <span className="text-sm font-normal text-slate-500">/100</span>
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Health Rating</p>
              <p className="text-sm font-semibold text-slate-200 capitalize">
                {blueprint.assessmentHealthRating?.replace(/_/g, " ") ?? "—"}
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Initiatives</p>
              <p className="text-2xl font-bold text-slate-100">{initiatives.length}</p>
            </div>
          </div>
          {sectionsByTab("business_state").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* Strategic Priorities tab */}
      {activeTab === "strategic" && (
        <div className="space-y-4">
          {sectionsByTab("strategic").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* Roadmap tab — 30/60/90 + Longer Term */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          {/* Period summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(PERIOD_LABELS).map(([period, label]) => {
              const count = initiativesByPeriod(period).length;
              return (
                <div key={period} className={cn("rounded-lg p-3 border text-center", PERIOD_COLORS[period])}>
                  <p className="text-xs opacity-70 mb-0.5">{label}</p>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs opacity-60">initiative{count !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>

          {/* Sections */}
          {sectionsByTab("roadmap").map((s: any) => (
            <div key={s.id} className="space-y-3">
              <SectionCard section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              {/* Initiatives for this period */}
              {(() => {
                const periodMap: Record<string, string> = {
                  action_plan_30_days: "30_days",
                  action_plan_60_days: "60_days",
                  action_plan_90_days: "90_days",
                  longer_term_roadmap: "longer_term",
                };
                const period = periodMap[s.sectionKey];
                if (!period) return null;
                const periodInits = initiativesByPeriod(period);
                if (periodInits.length === 0) return null;
                return (
                  <div className="space-y-2 pl-2 border-l-2 border-slate-700/40">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide px-2">
                      {periodInits.length} Initiative{periodInits.length !== 1 ? "s" : ""}
                    </p>
                    {periodInits.map((init: any) => (
                      <InitiativeCard key={init.id} initiative={init} blueprintId={id!} isReadOnly={isReadOnly} />
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Business Impact tab */}
      {activeTab === "impact" && (
        <div className="space-y-4">
          {sectionsByTab("impact").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* KPIs tab */}
      {activeTab === "kpis" && (
        <div className="space-y-4">
          {sectionsByTab("kpis").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* Dependencies tab */}
      {activeTab === "dependencies" && (
        <div className="space-y-4">
          {sectionsByTab("dependencies").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* Consultant Guidance tab */}
      {activeTab === "consultant" && (
        <div className="space-y-4">
          {sectionsByTab("consultant").map((s: any) => (
            <SectionCard key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
          ))}

          {/* Consultant notes on blueprint itself */}
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Blueprint-Level Notes</h3>
            <EditableNotesInline
              value={blueprint.consultantNotes}
              onSave={(val) => updateBp.mutate({ id: id!, data: { consultantNotes: val } })}
              disabled={isReadOnly || updateBp.isPending}
            />
          </div>
        </div>
      )}

      {/* Approval tab */}
      {activeTab === "approval" && (
        <div className="space-y-4">
          {/* Lifecycle pipeline */}
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Lifecycle Status</h3>
            <div className="flex flex-wrap items-center gap-2">
              {["draft", "in_progress", "ready_for_review", "approved"].map((s, i, arr) => {
                const statuses = ["draft", "in_progress", "ready_for_review", "approved", "archived"];
                const currentIdx = statuses.indexOf(blueprint.status);
                const thisIdx = statuses.indexOf(s);
                const isCurrent = s === blueprint.status;
                const isPast = thisIdx < currentIdx;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded border font-medium",
                        isCurrent ? STATUS_COLORS[s] : isPast ? "text-slate-500 bg-slate-800/30 border-slate-700/30 line-through" : "text-slate-600 bg-slate-800/20 border-slate-700/20",
                      )}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                    {i < arr.length - 1 && <span className="text-slate-600 text-xs">→</span>}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">Version: </span>
                <span className="text-slate-200">{(blueprint as any).versionLabel ?? `v${blueprint.version}`}</span>
              </div>
              <div>
                <span className="text-slate-500">Generation: </span>
                <span className={GENERATION_STATUS_COLORS[blueprint.generationStatus ?? ""] ?? "text-slate-400"}>
                  {blueprint.generationStatus ?? "Not generated"}
                </span>
              </div>
              {blueprint.generatedAt && (
                <div>
                  <span className="text-slate-500">Generated: </span>
                  <span className="text-slate-300">{format(new Date(blueprint.generatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
              {blueprint.approvedAt && (
                <div>
                  <span className="text-slate-500">Approved: </span>
                  <span className="text-slate-300">{format(new Date(blueprint.approvedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
              {(blueprint as any).supersededAt && (
                <div>
                  <span className="text-slate-500">Superseded: </span>
                  <span className="text-slate-300">{format(new Date((blueprint as any).supersededAt), "MMM d, yyyy")}</span>
                </div>
              )}
              {blueprint.sourceAssessmentStatus && (
                <div>
                  <span className="text-slate-500">Assessment status at generation: </span>
                  <span className="text-slate-300">{blueprint.sourceAssessmentStatus}</span>
                </div>
              )}
              {blueprint.sourcePlanStatus && (
                <div>
                  <span className="text-slate-500">Plan status at generation: </span>
                  <span className="text-slate-300">{blueprint.sourcePlanStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Source links */}
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Source Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/growth-assessments/${blueprint.growthAssessmentId}`)}
                className="flex items-center gap-2 p-2 bg-slate-700/30 border border-slate-600/40 rounded hover:border-slate-500/60 transition-colors text-left"
              >
                <BarChart3 className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Growth Assessment</p>
                  <p className="text-xs text-slate-500">
                    {blueprint.assessmentHealthRating ? `${blueprint.assessmentHealthRating.replace(/_/g, " ")} — ${blueprint.assessmentHealthScore ? Number(blueprint.assessmentHealthScore).toFixed(0) : "?"}/100` : "View →"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => navigate(`/solution-recommendations/${blueprint.solutionRecommendationPlanId}`)}
                className="flex items-center gap-2 p-2 bg-slate-700/30 border border-slate-600/40 rounded hover:border-slate-500/60 transition-colors text-left"
              >
                <Target className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Solution Recommendation Plan</p>
                  <p className="text-xs text-slate-500">{blueprint.planStatus ?? "View →"}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History tab */}
      {activeTab === "versions" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">All versions of this blueprint linked to the same Solution Recommendation Plan.</p>
          {versions.length === 0 ? (
            <p className="text-sm text-slate-500">No version history available.</p>
          ) : (
            versions.map((v: any) => (
              <div
                key={v.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors",
                  v.id === id
                    ? "bg-slate-700/50 border-slate-600/60"
                    : "bg-slate-800/30 border-slate-700/40 hover:border-slate-600/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{v.versionLabel ?? `v${v.version}.${v.revisionNumber}`}</span>
                      {v.id === id && <span className="text-xs text-blue-400">(current view)</span>}
                      {v.isCurrent && <span className="text-xs text-emerald-400">● current</span>}
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", STATUS_COLORS[v.status])}>
                        {STATUS_LABELS[v.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        {format(new Date(v.updatedAt), "MMM d, yyyy")}
                      </span>
                      {v.approvedAt && (
                        <span className="text-xs text-emerald-500">
                          Approved {format(new Date(v.approvedAt), "MMM d")}
                        </span>
                      )}
                      {v.supersededAt && (
                        <span className="text-xs text-slate-500 line-through">
                          Superseded {format(new Date(v.supersededAt), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {v.id !== id && (
                  <button
                    onClick={() => navigate(`/growth-blueprints/${v.id}`)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View →
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Confirm dialog ─────────────────────────────────────── */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              {confirmAction === "start" && "Start Blueprint?"}
              {confirmAction === "ready" && "Submit for Review?"}
              {confirmAction === "approve" && "Approve Blueprint?"}
              {confirmAction === "archive" && "Archive Blueprint?"}
              {confirmAction === "generate" && "Generate Blueprint?"}
              {confirmAction === "regenerate" && "Regenerate Blueprint?"}
              {confirmAction === "revise" && "Create Revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmAction === "start" && "This will move the blueprint to In Progress."}
              {confirmAction === "ready" && "This will submit the blueprint for approval review."}
              {confirmAction === "approve" && "This will approve the blueprint. All sections will be locked. Create a revision to make further changes."}
              {confirmAction === "archive" && "This will archive the blueprint. Archived blueprints cannot be edited."}
              {confirmAction === "generate" && "This will assemble all 16 sections and roadmap initiatives from the assessment and recommendation data."}
              {confirmAction === "regenerate" && "This will re-run the assembly engine. Your consultant overrides on sections and initiatives will be preserved."}
              {confirmAction === "revise" && "This will create a new draft linked to this approved blueprint. The approved version will remain unchanged until the revision is approved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                confirmAction === "archive" ? "bg-slate-600 hover:bg-slate-500" :
                confirmAction === "generate" || confirmAction === "regenerate" ? "bg-violet-600 hover:bg-violet-500" :
                "bg-blue-600 hover:bg-blue-500",
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

// ─── Inline notes editor ──────────────────────────────────────────

function EditableNotesInline({
  value,
  onSave,
  disabled,
}: {
  value: string | null | undefined;
  onSave: (val: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full bg-slate-900/80 border border-slate-600 rounded-md p-3 text-sm text-slate-200 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[120px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add consultant notes…"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { onSave(draft); setEditing(false); }}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400 whitespace-pre-wrap">{value || "No notes added."}</p>
      {!disabled && (
        <button
          onClick={() => { setDraft(value ?? ""); setEditing(true); }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <Edit2 className="h-3 w-3" /> Edit
        </button>
      )}
    </div>
  );
}

export default GrowthBlueprintDetailPage;
