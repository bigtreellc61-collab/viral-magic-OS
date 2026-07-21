import { useState, useCallback, useEffect, useRef } from "react";
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
  ShieldCheck,
  Loader2,
  Edit2,
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
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Printer,
  Activity,
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

// ─── Lifecycle config ────────────────────────────────────────────

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

const PERIOD_SUMMARY_COLORS: Record<string, string> = {
  "30_days": "text-rose-300 bg-rose-900/20 border-rose-700/40",
  "60_days": "text-amber-300 bg-amber-900/20 border-amber-700/40",
  "90_days": "text-blue-300 bg-blue-900/20 border-blue-700/40",
  "longer_term": "text-slate-300 bg-slate-800/40 border-slate-600/40",
};

const PERIOD_HEADER_COLORS: Record<string, string> = {
  "30_days": "border-rose-700/40 bg-rose-950/30 text-rose-300",
  "60_days": "border-amber-700/40 bg-amber-950/30 text-amber-300",
  "90_days": "border-blue-700/40 bg-blue-950/30 text-blue-300",
  "longer_term": "border-slate-700/40 bg-slate-800/50 text-slate-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  "Critical Priority": "text-red-400 bg-red-900/20 border-red-700/30",
  "High Priority": "text-orange-400 bg-orange-900/20 border-orange-700/30",
  "Important": "text-amber-400 bg-amber-900/20 border-amber-700/30",
  "Planned Improvement": "text-blue-400 bg-blue-900/20 border-blue-700/30",
  "Monitor": "text-slate-400 bg-slate-800/30 border-slate-600/30",
};

// Priority → roadmap card left-border color
const PRIORITY_BORDER_L: Record<string, string> = {
  "Critical Priority": "border-l-red-500",
  "High Priority": "border-l-orange-500",
  "Important": "border-l-amber-500",
  "Planned Improvement": "border-l-blue-500",
  "Monitor": "border-l-slate-600",
};

// Section key → narrative section key for roadmap period
const PERIOD_SECTION_KEY: Record<string, string> = {
  "30_days": "action_plan_30_days",
  "60_days": "action_plan_60_days",
  "90_days": "action_plan_90_days",
  "longer_term": "longer_term_roadmap",
};

// ─── Health score color helper ───────────────────────────────────

function healthScoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

// ─── Jump nav config ─────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "exec",         num: "01", label: "Executive Summary" },
  { id: "health",       num: "02", label: "Business Health" },
  { id: "strategic",    num: "03", label: "Strategic Priorities" },
  { id: "roadmap",      num: "04", label: "30/60/90 Roadmap" },
  { id: "impact",       num: "05", label: "Business Impact" },
  { id: "kpis",         num: "06", label: "KPIs & Metrics" },
  { id: "dependencies", num: "07", label: "Dependencies" },
  { id: "consultant",   num: "08", label: "Consultant Guidance" },
  { id: "decisions",    num: "09", label: "Executive Decisions" },
  { id: "versions",     num: "10", label: "Version History" },
];

// ─── Section type ────────────────────────────────────────────────

type AnySection = {
  id: string;
  sectionKey: string;
  title: string;
  generatedContent?: string | null;
  consultantContent?: string | null;
  finalContent?: string | null;
  hasOverride?: boolean;
  generationStatus?: string;
};

// ─── SectionBlock ────────────────────────────────────────────────

function SectionBlock({
  section,
  blueprintId,
  isReadOnly,
  isExec = false,
}: {
  section: AnySection;
  blueprintId: string;
  isReadOnly: boolean;
  isExec?: boolean;
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
      onError: (err: any) =>
        toast({ title: "Save failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const resetSection = useResetGrowthBlueprintSection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGrowthBlueprintSectionsQueryKey(blueprintId) });
        toast({ title: "Override cleared" });
      },
      onError: (err: any) =>
        toast({ title: "Reset failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const displayContent = section.finalContent ?? section.generatedContent ?? "";
  const previewLength = isExec ? 700 : 450;
  const isLong = displayContent.length > previewLength;

  return (
    <div className="group/section relative bp-section-block">
      {/* Subsection heading + controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-none">
            {section.title}
          </h3>
          {section.hasOverride && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-400">
              Edited
            </span>
          )}
        </div>
        <div className="bp-edit-controls flex items-center gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity">
          {!isReadOnly && section.hasOverride && (
            <button
              onClick={() => resetSection.mutate({ id: blueprintId, sectionId: section.id })}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-300 transition-colors"
              title="Revert to generated content"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          {!isReadOnly && !editing && (
            <button
              onClick={() => {
                setDraft(section.consultantContent ?? section.generatedContent ?? "");
                setEditing(true);
              }}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-200 transition-colors"
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
            className="w-full bg-slate-950/80 border border-slate-700 rounded-md p-3 text-sm text-slate-200 resize-y focus:outline-none focus:ring-1 focus:ring-violet-600/50 min-h-[180px] font-sans leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() =>
                updateSection.mutate({
                  id: blueprintId,
                  sectionId: section.id,
                  data: { consultantContent: draft },
                })
              }
              disabled={updateSection.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {updateSection.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : displayContent ? (
        <div className="border-l border-slate-800 pl-4">
          <p
            className={cn(
              "whitespace-pre-wrap leading-relaxed text-slate-300",
              isExec ? "text-[15px]" : "text-sm",
            )}
          >
            {isLong && !expanded ? displayContent.slice(0, previewLength) + "…" : displayContent}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-700 italic pl-4">No content generated yet.</p>
      )}
    </div>
  );
}

// ─── RoadmapCard ─────────────────────────────────────────────────

type InitiativeData = {
  id: string;
  title: string;
  domain: string;
  priorityClassification: string;
  effortLevel?: string | null;
  roadmapPeriod: string;
  roadmapReason?: string | null;
  ownerPlaceholder?: string | null;
  consultantGuidance?: string | null;
  overrideRoadmapPeriod?: boolean;
  sequenceOrder: number;
  expectedBusinessImpact?: string | null;
};

function RoadmapCard({
  initiative,
  blueprintId,
  isReadOnly,
}: {
  initiative: InitiativeData;
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
        queryClient.invalidateQueries({
          queryKey: getListGrowthBlueprintInitiativesQueryKey(blueprintId),
        });
        setEditingOwner(false);
        setEditingGuidance(false);
        toast({ title: "Initiative updated" });
      },
      onError: (err: any) =>
        toast({ title: "Update failed", description: err?.data?.error ?? "Error", variant: "destructive" }),
    },
  });

  const borderColor = PRIORITY_BORDER_L[initiative.priorityClassification] ?? "border-l-slate-600";
  const priorityColor =
    PRIORITY_COLORS[initiative.priorityClassification] ?? PRIORITY_COLORS["Monitor"];
  const isQuickWin = initiative.roadmapReason?.toLowerCase().includes("quick win");

  return (
    <div
      className={cn(
        "bg-slate-900/60 border border-slate-800/70 border-l-[3px] rounded-lg p-3.5 space-y-2",
        borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-100 leading-snug">
            {initiative.title}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{initiative.domain}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {isQuickWin && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-700/30 whitespace-nowrap">
              ⚡ Quick Win
            </span>
          )}
          {initiative.overrideRoadmapPeriod && (
            <span className="text-[9px] text-slate-600" title="Period manually overridden">
              ✎
            </span>
          )}
        </div>
      </div>

      {/* Priority + effort */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", priorityColor)}>
          {initiative.priorityClassification}
        </span>
        {initiative.effortLevel && (
          <span className="text-[10px] text-slate-700 capitalize">
            {initiative.effortLevel.replace(/_/g, " ")} effort
          </span>
        )}
      </div>

      {/* Owner row + expand toggle */}
      {!expanded ? (
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-slate-600">
            Owner:{" "}
            <span className={initiative.ownerPlaceholder ? "text-slate-400" : "text-slate-700"}>
              {initiative.ownerPlaceholder || "Unassigned"}
            </span>
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-slate-700 hover:text-slate-400 transition-colors"
          >
            Details ↓
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-1 border-t border-slate-800/50">
          {/* Expected impact */}
          {initiative.expectedBusinessImpact && (
            <div>
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-1">
                Expected Impact
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {initiative.expectedBusinessImpact}
              </p>
            </div>
          )}

          {/* Rationale */}
          {initiative.roadmapReason && !isQuickWin && (
            <p className="text-[10px] text-slate-600 italic leading-relaxed">
              {initiative.roadmapReason}
            </p>
          )}

          {/* Owner */}
          <div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Owner
            </p>
            {editingOwner ? (
              <div className="flex gap-1.5 items-center">
                <input
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-600/40"
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  placeholder="e.g. Sales Lead"
                  autoFocus
                />
                <button
                  onClick={() =>
                    updateInitiative.mutate({
                      id: blueprintId,
                      initiativeId: initiative.id,
                      data: { ownerPlaceholder: ownerDraft },
                    })
                  }
                  disabled={updateInitiative.isPending}
                  className="text-[10px] px-2 py-1 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingOwner(false)}
                  className="text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[11px]", initiative.ownerPlaceholder ? "text-slate-400" : "text-slate-700")}>
                  {initiative.ownerPlaceholder || "Not assigned"}
                </span>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      setOwnerDraft(initiative.ownerPlaceholder ?? "");
                      setEditingOwner(true);
                    }}
                    className="text-slate-700 hover:text-slate-400 transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Consultant guidance */}
          <div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Consultant Guidance
            </p>
            {editingGuidance ? (
              <div className="space-y-1.5">
                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 resize-y min-h-[70px] focus:outline-none focus:ring-1 focus:ring-violet-600/40"
                  value={guidanceDraft}
                  onChange={(e) => setGuidanceDraft(e.target.value)}
                  placeholder="Add implementation guidance…"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() =>
                      updateInitiative.mutate({
                        id: blueprintId,
                        initiativeId: initiative.id,
                        data: { consultantGuidance: guidanceDraft },
                      })
                    }
                    disabled={updateInitiative.isPending}
                    className="text-[10px] px-2 py-1 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingGuidance(false)}
                    className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <p className={cn("text-[11px] flex-1 leading-relaxed", initiative.consultantGuidance ? "text-slate-500" : "text-slate-700 italic")}>
                  {initiative.consultantGuidance || "No guidance added."}
                </p>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      setGuidanceDraft(initiative.consultantGuidance ?? "");
                      setEditingGuidance(true);
                    }}
                    className="text-slate-700 hover:text-slate-400 shrink-0 transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-slate-700 hover:text-slate-500 transition-colors pt-1"
          >
            Collapse ↑
          </button>
        </div>
      )}
    </div>
  );
}

// ─── RoadmapColumn ───────────────────────────────────────────────

function RoadmapColumn({
  period,
  initiatives,
  narrativeSection,
  blueprintId,
  isReadOnly,
}: {
  period: string;
  initiatives: InitiativeData[];
  narrativeSection?: AnySection;
  blueprintId: string;
  isReadOnly: boolean;
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const headerColor = PERIOD_HEADER_COLORS[period] ?? PERIOD_HEADER_COLORS["longer_term"];
  const label = PERIOD_LABELS[period];
  const narrativeContent =
    narrativeSection?.finalContent ?? narrativeSection?.generatedContent ?? "";

  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      {/* Column header */}
      <div
        className={cn(
          "border rounded-lg px-3 py-2.5 flex items-center justify-between shrink-0",
          headerColor,
        )}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-mono opacity-60 tabular-nums">
          {initiatives.length}
        </span>
      </div>

      {/* Narrative context toggle */}
      {narrativeContent && (
        <div className="text-[11px] text-slate-700">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex items-center gap-1 hover:text-slate-500 transition-colors w-full text-left"
          >
            {contextOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span className="font-medium">Context</span>
          </button>
          {contextOpen && (
            <p className="mt-2 text-[11px] text-slate-600 leading-relaxed border-l border-slate-800 pl-2">
              {narrativeContent.slice(0, 300)}
              {narrativeContent.length > 300 && "…"}
            </p>
          )}
        </div>
      )}

      {/* Initiative cards */}
      {initiatives.length > 0 ? (
        initiatives.map((init) => (
          <RoadmapCard
            key={init.id}
            initiative={init}
            blueprintId={blueprintId}
            isReadOnly={isReadOnly}
          />
        ))
      ) : (
        <div className="border border-slate-800/40 border-dashed rounded-lg p-4 text-center">
          <p className="text-[10px] text-slate-700">No initiatives</p>
        </div>
      )}
    </div>
  );
}

// ─── EditableNotesInline ─────────────────────────────────────────

function EditableNotesInline({
  value,
  onSave,
  disabled,
  placeholder = "Add notes…",
}: {
  value: string | null | undefined;
  onSave: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full bg-slate-950/80 border border-slate-700 rounded-md p-3 text-sm text-slate-200 resize-y focus:outline-none focus:ring-1 focus:ring-violet-600/40 min-h-[120px] leading-relaxed"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
        {value || <span className="text-slate-700 italic">No notes added.</span>}
      </p>
      {!disabled && (
        <button
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
          className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-300 transition-colors"
        >
          <Edit2 className="h-3 w-3" />
          Edit
        </button>
      )}
    </div>
  );
}

// ─── JumpNav ─────────────────────────────────────────────────────

function JumpNav({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="bp-jump-nav space-y-0.5" aria-label="Blueprint sections">
      {NAV_SECTIONS.map(({ id, num, label }) => {
        const isActive = activeSection === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={isActive ? "location" : undefined}
            style={isActive ? { borderLeftColor: "hsl(258 90% 66%)" } : undefined}
            className={cn(
              "w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-r-md transition-all border-l-2",
              isActive
                ? "bg-violet-950/40 text-slate-200"
                : "border-l-transparent text-slate-600 hover:text-slate-300 hover:border-l-slate-700",
            )}
          >
            <span className="text-[9px] font-mono text-slate-700 w-4 shrink-0 tabular-nums">
              {num}
            </span>
            <span className="text-[11px] font-medium leading-snug">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── BlueprintSidebar ────────────────────────────────────────────

function BlueprintSidebar({
  blueprint,
  initiatives,
}: {
  blueprint: any;
  initiatives: any[];
}) {
  const score = blueprint?.assessmentHealthScore
    ? Number(blueprint.assessmentHealthScore)
    : null;
  const scoreColor = healthScoreColor(score);
  const byPeriod = (period: string) =>
    initiatives.filter((i: any) => i.roadmapPeriod === period).length;
  const versionLabel =
    (blueprint as any)?.versionLabel ??
    `v${blueprint?.version ?? 1}.${(blueprint as any)?.revisionNumber ?? 0}`;

  return (
    <aside className="bp-sidebar space-y-3" aria-label="Blueprint summary">
      {/* Health score */}
      <div className="border border-slate-800 rounded-lg p-4 space-y-1.5 bg-slate-900/40">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
          Health Score
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-4xl font-bold tabular-nums leading-none", scoreColor)}>
            {score !== null ? score.toFixed(0) : "—"}
          </span>
          <span className="text-sm text-slate-600">/100</span>
        </div>
        {blueprint?.assessmentHealthRating && (
          <p className="text-[11px] text-slate-500 capitalize">
            {blueprint.assessmentHealthRating.replace(/_/g, " ")}
          </p>
        )}
      </div>

      {/* Blueprint status */}
      <div className="border border-slate-800 rounded-lg p-4 space-y-2.5 bg-slate-900/40">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
          Blueprint
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Status</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                STATUS_COLORS[blueprint?.status ?? "draft"],
              )}
            >
              {STATUS_LABELS[blueprint?.status ?? "draft"]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Version</span>
            <span className="text-[11px] text-slate-300 font-mono">{versionLabel}</span>
          </div>
          {(blueprint as any)?.isCurrent !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Current</span>
              <span className={(blueprint as any).isCurrent ? "text-[10px] text-emerald-400" : "text-[10px] text-slate-600"}>
                {(blueprint as any).isCurrent ? "● Yes" : "No"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Initiative breakdown */}
      <div className="border border-slate-800 rounded-lg p-4 space-y-2.5 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
            Initiatives
          </p>
          <span className="text-sm font-bold text-slate-300 tabular-nums">
            {initiatives.length}
          </span>
        </div>
        <div className="space-y-1.5 pt-1 border-t border-slate-800/50">
          {Object.entries(PERIOD_LABELS).map(([period, label]) => {
            const count = byPeriod(period);
            return (
              <div key={period} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    count > 0 ? "text-slate-300" : "text-slate-700",
                  )}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quick wins + critical counts */}
        {initiatives.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-800/50">
            {(() => {
              const qw = initiatives.filter((i: any) =>
                i.roadmapReason?.toLowerCase().includes("quick win"),
              ).length;
              const crit = initiatives.filter(
                (i: any) => i.priorityClassification === "Critical Priority",
              ).length;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">⚡ Quick Wins</span>
                    <span className={cn("text-[11px] font-semibold tabular-nums", qw > 0 ? "text-amber-400" : "text-slate-700")}>
                      {qw}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Critical Priority</span>
                    <span className={cn("text-[11px] font-semibold tabular-nums", crit > 0 ? "text-red-400" : "text-slate-700")}>
                      {crit}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="border border-slate-800 rounded-lg p-4 space-y-2 bg-slate-900/40">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-1">
          Details
        </p>
        {blueprint?.clientName && (
          <div className="flex items-start gap-1.5">
            <Building2 className="h-3 w-3 text-slate-700 shrink-0 mt-0.5" />
            <span className="text-[11px] text-slate-400 leading-snug">{blueprint.clientName}</span>
          </div>
        )}
        {blueprint?.projectName && (
          <div className="flex items-start gap-1.5">
            <FolderOpen className="h-3 w-3 text-slate-700 shrink-0 mt-0.5" />
            <span className="text-[11px] text-slate-400 leading-snug">{blueprint.projectName}</span>
          </div>
        )}
        {blueprint?.updatedAt && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-slate-700 shrink-0" />
            <span className="text-[11px] text-slate-500">
              Updated {format(new Date(blueprint.updatedAt), "MMM d, yyyy")}
            </span>
          </div>
        )}
        {blueprint?.generatedAt && (
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-slate-700 shrink-0" />
            <span className="text-[11px] text-slate-500">
              Generated {format(new Date(blueprint.generatedAt), "MMM d, yyyy")}
            </span>
          </div>
        )}
        {blueprint?.approvedAt && (
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-700 shrink-0" />
            <span className="text-[11px] text-emerald-600">
              Approved {format(new Date(blueprint.approvedAt), "MMM d, yyyy")}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Section heading ─────────────────────────────────────────────

function SectionHeading({
  num,
  title,
  headingId,
}: {
  num: string;
  title: string;
  headingId: string;
}) {
  return (
    <div className="pb-5 mb-8 border-b border-slate-800">
      <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest mb-2">{num}</p>
      <h2 id={headingId} className="text-xl font-bold text-slate-50 tracking-tight">
        {title}
      </h2>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────

export function GrowthBlueprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState("exec");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | "start"
    | "ready"
    | "approve"
    | "archive"
    | "generate"
    | "regenerate"
    | "revise"
    | null
  >(null);

  // Section anchor refs for IntersectionObserver
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // ── Data hooks ────────────────────────────────────────────────
  const { data: blueprint, isLoading, error } = useGetGrowthBlueprint(id!);
  const { data: sectionsData } = useListGrowthBlueprintSections(id!);
  const { data: initiativesData } = useListGrowthBlueprintInitiatives(id!);
  const { data: versionsData } = useListGrowthBlueprintVersions(id!);

  const sections: AnySection[] = (sectionsData as any)?.data ?? [];
  const initiatives: InitiativeData[] = (initiativesData as any)?.data ?? [];
  const versions: any[] = (versionsData as any)?.data ?? [];

  const isReadOnly =
    blueprint?.status === "approved" ||
    blueprint?.status === "archived" ||
    !!blueprint?.archivedAt;
  const canGenerate =
    blueprint?.status === "draft" || blueprint?.status === "in_progress";
  const canRegenerate = canGenerate && blueprint?.generationStatus === "complete";
  const canRevise = blueprint?.status === "approved";
  const notGenerated = blueprint?.generationStatus !== "complete";

  // ── IntersectionObserver scroll-spy ──────────────────────────
  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // pick the topmost visible section
          const topMost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveSection(topMost.target.id);
        }
      },
      {
        root: mainEl,
        threshold: 0.12,
        rootMargin: "-64px 0px -55% 0px",
      },
    );

    // Small delay so refs are populated after data renders
    const timer = setTimeout(() => {
      Object.values(sectionRefs.current).forEach((el) => {
        if (el) observer.observe(el);
      });
    }, 150);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [sections.length, initiatives.length]);

  // ── Mutations ─────────────────────────────────────────────────

  function makeOnSuccess(msg: string) {
    return () => {
      queryClient.invalidateQueries({ queryKey: getGetGrowthBlueprintQueryKey(id!) });
      queryClient.invalidateQueries({
        queryKey: getListGrowthBlueprintSectionsQueryKey(id!),
      });
      queryClient.invalidateQueries({
        queryKey: getListGrowthBlueprintInitiativesQueryKey(id!),
      });
      toast({ title: msg });
    };
  }
  function makeOnError(label: string) {
    return (err: any) =>
      toast({
        title: `${label} failed`,
        description: err?.data?.error ?? "An error occurred.",
        variant: "destructive",
      });
  }

  const updateBp = useUpdateGrowthBlueprint({
    mutation: { onSuccess: makeOnSuccess("Blueprint saved"), onError: makeOnError("Save") },
  });
  const startBp = useStartGrowthBlueprint({
    mutation: { onSuccess: makeOnSuccess("Blueprint started"), onError: makeOnError("Start") },
  });
  const readyBp = useReadyGrowthBlueprint({
    mutation: {
      onSuccess: makeOnSuccess("Submitted for review"),
      onError: makeOnError("Submit"),
    },
  });
  const approveBp = useApproveGrowthBlueprint({
    mutation: {
      onSuccess: makeOnSuccess("Blueprint approved"),
      onError: makeOnError("Approve"),
    },
  });
  const archiveBp = useArchiveGrowthBlueprint({
    mutation: {
      onSuccess: makeOnSuccess("Blueprint archived"),
      onError: makeOnError("Archive"),
    },
  });

  const generateBp = useGenerateGrowthBlueprint({
    mutation: {
      onSuccess: (data: any) => {
        makeOnSuccess(
          `Blueprint generated — ${data?.summary?.initiativeCount ?? 0} initiative(s)`,
        )();
        queryClient.invalidateQueries({
          queryKey: getListGrowthBlueprintVersionsQueryKey(id!),
        });
      },
      onError: makeOnError("Generate"),
    },
  });

  const regenerateBp = useRegenerateGrowthBlueprint({
    mutation: {
      onSuccess: (data: any) =>
        makeOnSuccess(
          `Regenerated — ${data?.summary?.preservedOverrides ?? 0} override(s) preserved`,
        )(),
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
    startBp.isPending ||
    readyBp.isPending ||
    approveBp.isPending ||
    archiveBp.isPending ||
    generateBp.isPending ||
    regenerateBp.isPending ||
    reviseBp.isPending;

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

  // ── Section helpers ───────────────────────────────────────────

  const sectionsByKey = useCallback(
    (...keys: string[]): AnySection[] =>
      sections.filter((s) => keys.includes(s.sectionKey)),
    [sections],
  );

  const initiativesByPeriod = useCallback(
    (period: string): InitiativeData[] =>
      initiatives.filter((i) => i.roadmapPeriod === period),
    [initiatives],
  );

  const scrollToSection = useCallback(
    (navId: string) => {
      const el = sectionRefs.current[navId];
      if (!el) return;
      const mainEl = document.querySelector("main");
      if (mainEl) {
        const mainRect = mainEl.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - mainRect.top + mainEl.scrollTop - 24;
        mainEl.scrollTo({ top: offset, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveSection(navId);
      setMobileNavOpen(false);
    },
    [],
  );

  // ── Loading / error ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    );
  }
  if (error || !blueprint) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">
          {(error as any)?.data?.error ?? "Blueprint not found."}
        </p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const score = blueprint.assessmentHealthScore
    ? Number(blueprint.assessmentHealthScore)
    : null;
  const scoreColor = healthScoreColor(score);
  const versionLabel =
    (blueprint as any).versionLabel ??
    `v${blueprint.version}.${(blueprint as any).revisionNumber ?? 0}`;

  // Derived executive snapshot counts (from already-loaded initiatives data)
  const quickWinCount = initiatives.filter((i) =>
    i.roadmapReason?.toLowerCase().includes("quick win"),
  ).length;
  const criticalCount = initiatives.filter(
    (i) => i.priorityClassification === "Critical Priority",
  ).length;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">

      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors print:hidden"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* ── Executive Header ───────────────────────────────────── */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden bp-print-header">

        {/* Title + meta + score */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-800/60">
          <div className="flex items-start justify-between gap-6">
            {/* Left */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-50 tracking-tight leading-snug">
                  {blueprint.title}
                </h1>
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded border",
                    STATUS_COLORS[blueprint.status],
                  )}
                >
                  {STATUS_LABELS[blueprint.status]}
                </span>
                <span className="text-xs font-mono text-slate-600">{versionLabel}</span>
                {(blueprint as any).isCurrent && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 px-1.5 py-0.5 rounded">
                    ● Current
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap text-xs">
                {blueprint.clientName && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="h-3.5 w-3.5 text-slate-600" />
                    {blueprint.clientName}
                  </span>
                )}
                {blueprint.projectName && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <FolderOpen className="h-3.5 w-3.5 text-slate-600" />
                    {blueprint.projectName}
                  </span>
                )}
                {blueprint.generatedAt && (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Activity className="h-3.5 w-3.5 text-slate-700" />
                    Generated {format(new Date(blueprint.generatedAt), "MMM d, yyyy")}
                  </span>
                )}
                {blueprint.approvedAt && (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Approved {format(new Date(blueprint.approvedAt), "MMM d, yyyy")}
                  </span>
                )}
                {blueprint.generationStatus && (
                  <span
                    className={cn(
                      GENERATION_STATUS_COLORS[blueprint.generationStatus] ?? "text-slate-500",
                    )}
                  >
                    {blueprint.generationStatus === "complete"
                      ? "✓ Generated"
                      : blueprint.generationStatus}
                  </span>
                )}
              </div>

              {/* Executive snapshot stats — visible once initiatives are loaded */}
              {initiatives.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap text-xs pt-0.5">
                  <span className="text-slate-500">
                    <span className="font-semibold text-slate-300 tabular-nums">{initiatives.length}</span>{" "}
                    {initiatives.length === 1 ? "initiative" : "initiatives"}
                  </span>
                  {quickWinCount > 0 && (
                    <span className="text-amber-400">
                      ⚡{" "}
                      <span className="font-semibold tabular-nums">{quickWinCount}</span>{" "}
                      {quickWinCount === 1 ? "quick win" : "quick wins"}
                    </span>
                  )}
                  {criticalCount > 0 && (
                    <span className="text-red-400">
                      <span className="font-semibold tabular-nums">{criticalCount}</span>{" "}
                      critical {criticalCount === 1 ? "priority" : "priorities"}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: health score */}
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest mb-2">
                Health Score
              </p>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className={cn("text-5xl font-bold tabular-nums leading-none", scoreColor)}>
                  {score !== null ? score.toFixed(0) : "—"}
                </span>
                <span className="text-sm text-slate-600">/100</span>
              </div>
              {blueprint.assessmentHealthRating && (
                <p className="text-[11px] text-slate-500 capitalize mt-1">
                  {blueprint.assessmentHealthRating.replace(/_/g, " ")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="bp-actions px-6 py-3 flex items-center gap-2 flex-wrap print:hidden">
          {/* Generate / Regenerate / Revise */}
          {canGenerate && !canRegenerate && (
            <button
              onClick={() => setConfirmAction("generate")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-600 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate Blueprint
            </button>
          )}
          {canRegenerate && (
            <button
              onClick={() => setConfirmAction("regenerate")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
          {canRevise && (
            <button
              onClick={() => setConfirmAction("revise")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Create Revision
            </button>
          )}

          <div className="h-4 w-px bg-slate-700/50 mx-0.5" />

          {/* Lifecycle */}
          {blueprint.status === "draft" && (
            <button
              onClick={() => setConfirmAction("start")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-blue-900/50 hover:bg-blue-800/60 text-blue-200 border border-blue-700/40 rounded-md transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          )}
          {blueprint.status === "in_progress" && (
            <button
              onClick={() => setConfirmAction("ready")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-amber-900/50 hover:bg-amber-800/60 text-amber-200 border border-amber-700/40 rounded-md transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </button>
          )}
          {blueprint.status === "ready_for_review" && (
            <button
              onClick={() => setConfirmAction("approve")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/40 rounded-md transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
          )}

          <div className="h-4 w-px bg-slate-700/50 mx-0.5" />

          {!blueprint.archivedAt && blueprint.status !== "archived" && (
            <button
              onClick={() => setConfirmAction("archive")}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 rounded-md transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>

          {isActionPending && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500 ml-1" />
          )}
        </div>
      </div>

      {/* Not generated notice */}
      {notGenerated && (
        <div className="border border-violet-800/30 bg-violet-950/20 rounded-lg p-4 flex items-center gap-3 print:hidden">
          <Zap className="h-4 w-4 text-violet-400 shrink-0" />
          <p className="text-sm text-slate-300">
            This blueprint has not been generated yet.{" "}
            {canGenerate
              ? 'Click "Generate Blueprint" above to assemble all 16 sections and roadmap initiatives from source data.'
              : "Move the blueprint to Draft or In Progress status to generate content."}
          </p>
        </div>
      )}

      {/* Mobile section jump */}
      <div className="lg:hidden print:hidden">
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-800 rounded-lg text-sm text-slate-400 bg-slate-900/40"
          aria-expanded={mobileNavOpen}
        >
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-700">
              {NAV_SECTIONS.find((s) => s.id === activeSection)?.num}
            </span>
            {NAV_SECTIONS.find((s) => s.id === activeSection)?.label ?? "Navigate to section"}
          </span>
          {mobileNavOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {mobileNavOpen && (
          <div className="mt-1 border border-slate-800 rounded-lg bg-slate-900/90 p-2 space-y-0.5">
            {NAV_SECTIONS.map(({ id: navId, num, label }) => (
              <button
                key={navId}
                onClick={() => scrollToSection(navId)}
                className={cn(
                  "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] transition-colors",
                  activeSection === navId
                    ? "bg-violet-950/40 text-slate-200"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <span className="text-[10px] font-mono text-slate-700 w-4 tabular-nums">{num}</span>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Three-column layout ────────────────────────────────── */}
      <div className="flex gap-7">

        {/* Left: Jump nav */}
        <div className="hidden lg:block w-[188px] shrink-0 print:hidden">
          <div className="sticky top-4">
            <JumpNav activeSection={activeSection} onNavigate={scrollToSection} />
          </div>
        </div>

        {/* Center: Document */}
        <div className="flex-1 min-w-0 space-y-20">

          {/* S01 — Executive Summary */}
          <section
            id="exec"
            ref={(el) => { sectionRefs.current["exec"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-exec"
          >
            <SectionHeading num="01" title="Executive Summary" headingId="s-exec" />
            {sectionsByKey("executive_summary", "immediate_quick_wins").length === 0 ? (
              <p className="text-sm text-slate-700 italic">Generate the blueprint to see the executive summary.</p>
            ) : (
              <div className="space-y-10">
                {sectionsByKey("executive_summary").map((s) => (
                  <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} isExec />
                ))}
                {sectionsByKey("immediate_quick_wins").map((s) => (
                  <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
                ))}
              </div>
            )}
          </section>

          {/* S02 — Business Health */}
          <section
            id="health"
            ref={(el) => { sectionRefs.current["health"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-health"
          >
            <SectionHeading num="02" title="Business Health Snapshot" headingId="s-health" />

            {/* Score metric cards */}
            <div className="grid grid-cols-3 gap-3 mb-10">
              <div className="border border-slate-800 rounded-lg p-5 text-center bg-slate-900/40">
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-2">
                  Health Score
                </p>
                <div className={cn("text-4xl font-bold tabular-nums leading-none", scoreColor)}>
                  {score !== null ? score.toFixed(0) : "—"}
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">/100</p>
              </div>
              <div className="border border-slate-800 rounded-lg p-5 text-center bg-slate-900/40">
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-2">
                  Rating
                </p>
                <p className="text-sm font-semibold text-slate-200 capitalize leading-snug">
                  {blueprint.assessmentHealthRating?.replace(/_/g, " ") ?? "—"}
                </p>
                <p className="text-[11px] text-slate-600 mt-1.5">business health</p>
              </div>
              <div className="border border-slate-800 rounded-lg p-5 text-center bg-slate-900/40">
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-2">
                  Initiatives
                </p>
                <div className="text-4xl font-bold text-slate-100 tabular-nums leading-none">
                  {initiatives.length}
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">in roadmap</p>
              </div>
            </div>

            <div className="space-y-10">
              {sectionsByKey(
                "current_business_state",
                "key_strengths",
                "critical_vulnerabilities",
                "primary_risks",
              ).map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>
          </section>

          {/* S03 — Strategic Priorities */}
          <section
            id="strategic"
            ref={(el) => { sectionRefs.current["strategic"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-strategic"
          >
            <SectionHeading num="03" title="Strategic Priorities" headingId="s-strategic" />
            <div className="space-y-10">
              {sectionsByKey("strategic_priorities").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>
            {sectionsByKey("strategic_priorities").length === 0 && (
              <p className="text-sm text-slate-700 italic">Generate the blueprint to populate this section.</p>
            )}
          </section>

          {/* S04 — 30/60/90 Roadmap */}
          <section
            id="roadmap"
            ref={(el) => { sectionRefs.current["roadmap"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-roadmap"
          >
            <SectionHeading num="04" title="30 / 60 / 90 Day Roadmap" headingId="s-roadmap" />

            {/* Period summary row */}
            <div className="grid grid-cols-4 gap-3 mb-8">
              {(["30_days", "60_days", "90_days", "longer_term"] as const).map((period) => {
                const count = initiativesByPeriod(period).length;
                return (
                  <div
                    key={period}
                    className={cn("border rounded-lg p-3 text-center", PERIOD_SUMMARY_COLORS[period])}
                  >
                    <p className="text-[9px] font-mono uppercase tracking-widest opacity-60 mb-1">
                      {PERIOD_LABELS[period]}
                    </p>
                    <p className="text-2xl font-bold tabular-nums leading-none">{count}</p>
                    <p className="text-[9px] opacity-50 mt-1">
                      {count === 1 ? "initiative" : "initiatives"}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Kanban grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(["30_days", "60_days", "90_days", "longer_term"] as const).map((period) => (
                <RoadmapColumn
                  key={period}
                  period={period}
                  initiatives={initiativesByPeriod(period)}
                  narrativeSection={sectionsByKey(PERIOD_SECTION_KEY[period])[0]}
                  blueprintId={id!}
                  isReadOnly={isReadOnly}
                />
              ))}
            </div>
          </section>

          {/* S05 — Business Impact */}
          <section
            id="impact"
            ref={(el) => { sectionRefs.current["impact"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-impact"
          >
            <SectionHeading num="05" title="Business Impact" headingId="s-impact" />
            <div className="space-y-10">
              {sectionsByKey("business_impact").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>
            {sectionsByKey("business_impact").length === 0 && (
              <p className="text-sm text-slate-700 italic">Generate the blueprint to populate this section.</p>
            )}
          </section>

          {/* S06 — KPIs */}
          <section
            id="kpis"
            ref={(el) => { sectionRefs.current["kpis"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-kpis"
          >
            <SectionHeading num="06" title="KPIs & Success Metrics" headingId="s-kpis" />
            <div className="space-y-10">
              {sectionsByKey("success_metrics").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>
            {sectionsByKey("success_metrics").length === 0 && (
              <p className="text-sm text-slate-700 italic">Generate the blueprint to populate this section.</p>
            )}
          </section>

          {/* S07 — Dependencies */}
          <section
            id="dependencies"
            ref={(el) => { sectionRefs.current["dependencies"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-deps"
          >
            <SectionHeading num="07" title="Dependencies" headingId="s-deps" />
            <div className="space-y-10">
              {sectionsByKey("dependencies_constraints").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>
            {sectionsByKey("dependencies_constraints").length === 0 && (
              <p className="text-sm text-slate-700 italic">Generate the blueprint to populate this section.</p>
            )}
          </section>

          {/* S08 — Consultant Guidance */}
          <section
            id="consultant"
            ref={(el) => { sectionRefs.current["consultant"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-consultant"
          >
            <SectionHeading num="08" title="Consultant Guidance" headingId="s-consultant" />
            <div className="space-y-10">
              {sectionsByKey("consultant_guidance").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}

              {/* Blueprint-level notes */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Blueprint-Level Notes
                </h3>
                <div className="border-l border-slate-800 pl-4">
                  <EditableNotesInline
                    value={blueprint.consultantNotes}
                    onSave={(val) => updateBp.mutate({ id: id!, data: { consultantNotes: val } })}
                    disabled={isReadOnly || updateBp.isPending}
                    placeholder="Add overarching consultant notes for this blueprint…"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* S09 — Executive Decisions */}
          <section
            id="decisions"
            ref={(el) => { sectionRefs.current["decisions"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-decisions"
          >
            <SectionHeading num="09" title="Executive Decisions Required" headingId="s-decisions" />

            {/* Lifecycle panel */}
            <div className="border border-slate-800 rounded-lg p-5 mb-8 bg-slate-900/30 space-y-4">
              <div>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
                  Lifecycle Status
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {["draft", "in_progress", "ready_for_review", "approved"].map((s, i, arr) => {
                    const statuses = [
                      "draft",
                      "in_progress",
                      "ready_for_review",
                      "approved",
                      "archived",
                    ];
                    const currentIdx = statuses.indexOf(blueprint.status);
                    const thisIdx = statuses.indexOf(s);
                    const isCurrent = s === blueprint.status;
                    const isPast = thisIdx < currentIdx;
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded border font-medium",
                            isCurrent
                              ? STATUS_COLORS[s]
                              : isPast
                              ? "text-slate-600 bg-transparent border-slate-800 line-through"
                              : "text-slate-700 bg-transparent border-slate-800/50",
                          )}
                        >
                          {STATUS_LABELS[s]}
                        </span>
                        {i < arr.length - 1 && (
                          <span className="text-slate-700 text-xs">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs pt-3 border-t border-slate-800/50">
                <div className="flex gap-2">
                  <span className="text-slate-600">Version</span>
                  <span className="text-slate-300 font-mono">{versionLabel}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-600">Generation</span>
                  <span
                    className={
                      GENERATION_STATUS_COLORS[blueprint.generationStatus ?? ""] ??
                      "text-slate-500"
                    }
                  >
                    {blueprint.generationStatus ?? "Not generated"}
                  </span>
                </div>
                {blueprint.generatedAt && (
                  <div className="flex gap-2">
                    <span className="text-slate-600">Generated</span>
                    <span className="text-slate-400">
                      {format(new Date(blueprint.generatedAt), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
                {blueprint.approvedAt && (
                  <div className="flex gap-2">
                    <span className="text-slate-600">Approved</span>
                    <span className="text-slate-400">
                      {format(new Date(blueprint.approvedAt), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
                {blueprint.sourceAssessmentStatus && (
                  <div className="flex gap-2">
                    <span className="text-slate-600">Assessment at generation</span>
                    <span className="text-slate-400">{blueprint.sourceAssessmentStatus}</span>
                  </div>
                )}
                {blueprint.sourcePlanStatus && (
                  <div className="flex gap-2">
                    <span className="text-slate-600">Plan at generation</span>
                    <span className="text-slate-400">{blueprint.sourcePlanStatus}</span>
                  </div>
                )}
              </div>
            </div>

            {/* executive_decision_summary section content */}
            <div className="space-y-8 mb-8">
              {sectionsByKey("executive_decision_summary").map((s) => (
                <SectionBlock key={s.id} section={s} blueprintId={id!} isReadOnly={isReadOnly} />
              ))}
            </div>

            {/* Source links */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/growth-assessments/${blueprint.growthAssessmentId}`)}
                className="flex items-center gap-2.5 p-3.5 border border-slate-800 rounded-lg hover:border-slate-700 bg-slate-900/30 transition-colors text-left"
              >
                <BarChart3 className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Source Assessment</p>
                  <p className="text-[11px] text-slate-600">
                    {blueprint.assessmentHealthRating
                      ? `${blueprint.assessmentHealthRating.replace(/_/g, " ")} — ${score?.toFixed(0) ?? "?"}/100`
                      : "View →"}
                  </p>
                </div>
              </button>
              <button
                onClick={() =>
                  navigate(
                    `/solution-recommendations/${blueprint.solutionRecommendationPlanId}`,
                  )
                }
                className="flex items-center gap-2.5 p-3.5 border border-slate-800 rounded-lg hover:border-slate-700 bg-slate-900/30 transition-colors text-left"
              >
                <Target className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Recommendation Plan</p>
                  <p className="text-[11px] text-slate-600">{blueprint.planStatus ?? "View →"}</p>
                </div>
              </button>
            </div>
          </section>

          {/* S10 — Version History */}
          <section
            id="versions"
            ref={(el) => { sectionRefs.current["versions"] = el; }}
            className="bp-section scroll-mt-4"
            aria-labelledby="s-versions"
          >
            <SectionHeading num="10" title="Version History" headingId="s-versions" />

            {versions.length === 0 ? (
              <p className="text-sm text-slate-700 italic">No version history available.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v: any) => (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors",
                      v.id === id
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-900/30 border-slate-800 hover:border-slate-700",
                    )}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">
                          {v.versionLabel ?? `v${v.version}.${v.revisionNumber}`}
                        </span>
                        {v.id === id && (
                          <span className="text-[10px] text-slate-500">(viewing)</span>
                        )}
                        {v.isCurrent && (
                          <span className="text-[10px] text-emerald-400">● current</span>
                        )}
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border",
                            STATUS_COLORS[v.status],
                          )}
                        >
                          {STATUS_LABELS[v.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-600">
                          <Clock className="inline h-3 w-3 mr-0.5" />
                          {format(new Date(v.updatedAt), "MMM d, yyyy")}
                        </span>
                        {v.approvedAt && (
                          <span className="text-emerald-600">
                            Approved {format(new Date(v.approvedAt), "MMM d, yyyy")}
                          </span>
                        )}
                        {v.supersededAt && (
                          <span className="text-slate-600 line-through">
                            Superseded {format(new Date(v.supersededAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    {v.id !== id && (
                      <button
                        onClick={() => navigate(`/growth-blueprints/${v.id}`)}
                        className="shrink-0 text-xs text-slate-500 hover:text-slate-200 transition-colors border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-md"
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canRevise && (
              <div className="mt-4">
                <button
                  onClick={() => setConfirmAction("revise")}
                  disabled={isActionPending}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Create New Revision
                </button>
              </div>
            )}
          </section>

          {/* Bottom breathing room */}
          <div className="h-20" />
        </div>

        {/* Right: Sticky sidebar */}
        <div className="hidden xl:block w-[212px] shrink-0 print:hidden">
          <div className="sticky top-4">
            <BlueprintSidebar blueprint={blueprint} initiatives={initiatives} />
          </div>
        </div>
      </div>

      {/* ── Confirm dialog ─────────────────────────────────────── */}
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
              {confirmAction === "generate" && "Generate Blueprint?"}
              {confirmAction === "regenerate" && "Regenerate Blueprint?"}
              {confirmAction === "revise" && "Create Revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmAction === "start" &&
                "This will move the blueprint to In Progress."}
              {confirmAction === "ready" &&
                "This will submit the blueprint for approval review."}
              {confirmAction === "approve" &&
                "This will approve the blueprint. All sections will be locked. Create a revision to make further changes."}
              {confirmAction === "archive" &&
                "This will archive the blueprint. Archived blueprints cannot be edited."}
              {confirmAction === "generate" &&
                "This will assemble all 16 sections and roadmap initiatives from the assessment and recommendation data."}
              {confirmAction === "regenerate" &&
                "This will re-run the assembly engine. Your consultant overrides on sections and initiatives will be preserved."}
              {confirmAction === "revise" &&
                "This will create a new draft linked to this approved blueprint. The approved version will remain unchanged until the revision is approved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                confirmAction === "archive"
                  ? "bg-slate-600 hover:bg-slate-500"
                  : confirmAction === "generate" || confirmAction === "regenerate"
                  ? "bg-violet-700 hover:bg-violet-600"
                  : "bg-blue-700 hover:bg-blue-600",
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
