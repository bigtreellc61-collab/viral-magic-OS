import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { HealthScoreGauge } from "@/components/diagnostics/health-score-gauge";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS,
  HEALTH_RATING_LABELS, HEALTH_RATING_BG,
  STRATEGIC_CLASSIFICATION_LABELS, STRATEGIC_CLASSIFICATION_COLORS,
  OPPORTUNITY_GROUP_LABELS,
  TIME_HORIZON_LABELS, TIME_HORIZON_COLORS,
  SEVERITY_COLORS, SEVERITY_LABELS,
} from "@/lib/growth-assessment-constants";
import {
  ChevronLeft, Edit2, Save, X, CheckCircle2, Send, RotateCcw,
  Archive, Printer, AlertTriangle, TrendingUp, Zap, Target,
  ShieldAlert, Star, BarChart3, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

// ─── Types (mirrors engine output) ──────────────────────────

interface AssessmentStrength {
  categoryKey: string; categoryLabel: string;
  currentPerformance: number; severity: string;
  whyStrength: string; howToProtect: string;
}
interface AssessmentVulnerability {
  categoryKey: string; categoryLabel: string;
  currentPerformance: number; priorityScore: number;
  severity: string; whatItMeans: string;
}
interface AssessmentRisk {
  categoryKey: string; categoryLabel: string;
  severity: string; priorityScore: number;
  whyItMatters: string; consequence: string; evidence: string | null;
}
interface AssessmentQuickWin {
  categoryKey: string; categoryLabel: string;
  action: string; reason: string; suggestedOwner: string;
  timeHorizon: string; expectedImprovement: string;
}
interface AssessmentStrategicPriority {
  categoryKey: string; categoryLabel: string;
  classification: string; why: string;
  currentPerformance: number; businessImpact: number; urgency: number;
  priorityScore: number; recommendedAction: string | null;
}
interface AssessmentGrowthOpportunity {
  opportunityTitle: string; categoryKey: string; categoryLabel: string;
  businessReason: string; suggestedDirection: string;
  priorityClassification: string; group: string;
}
interface GeneratedSections {
  strengths: AssessmentStrength[];
  vulnerabilities: AssessmentVulnerability[];
  risks: AssessmentRisk[];
  quickWins: AssessmentQuickWin[];
  strategicPriorities: AssessmentStrategicPriority[];
  growthOpportunities: AssessmentGrowthOpportunity[];
  healthExplanation: string;
}

interface GrowthAssessmentRecord {
  id: string;
  diagnosticId: string;
  diagnosticVersionId: string;
  clientId: string;
  projectId?: string | null;
  status: string;
  healthScore?: string | null;
  healthRating?: string | null;
  systemStrengthSummary?: string | null;
  systemVulnerabilitySummary?: string | null;
  systemRiskSummary?: string | null;
  systemGrowthOpportunitySummary?: string | null;
  systemQuickWinSummary?: string | null;
  systemStrategicFocusSummary?: string | null;
  strengthSummary?: string | null;
  vulnerabilitySummary?: string | null;
  riskSummary?: string | null;
  growthOpportunitySummary?: string | null;
  quickWinSummary?: string | null;
  strategicFocusSummary?: string | null;
  consultantNotes?: string | null;
  generatedSections?: GeneratedSections | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  clientName?: string | null;
  diagnosticName?: string | null;
  versionNumber?: number | null;
  projectName?: string | null;
}

// ─── Section tabs ────────────────────────────────────────────

type AssessmentTab =
  | "summary" | "strengths" | "risks" | "vulnerabilities"
  | "quick_wins" | "strategic" | "opportunities" | "notes" | "approval";

const TABS: { id: AssessmentTab; label: string; icon: any }[] = [
  { id: "summary", label: "Executive Summary", icon: BarChart3 },
  { id: "strengths", label: "Strengths", icon: Star },
  { id: "risks", label: "Primary Risks", icon: ShieldAlert },
  { id: "vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle },
  { id: "quick_wins", label: "Quick Wins", icon: Zap },
  { id: "strategic", label: "Strategic Priorities", icon: Target },
  { id: "opportunities", label: "Growth Opportunities", icon: TrendingUp },
  { id: "notes", label: "Consultant Notes", icon: Edit2 },
  { id: "approval", label: "Approval", icon: CheckCircle2 },
];

// ─── Editable text area ──────────────────────────────────────

function EditableSection({
  label, systemValue, value, editing, onChange,
}: {
  label: string; systemValue: string | null | undefined;
  value: string | null | undefined; editing: boolean;
  onChange: (v: string) => void;
}) {
  const display = value || systemValue || "";
  const isEdited = !!value && value !== systemValue;

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
          {isEdited && <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 rounded">Edited</span>}
        </div>
        <textarea
          value={display}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
        {systemValue && value && value !== systemValue && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-400">Show original system text</summary>
            <p className="mt-1 p-2 bg-slate-800/50 rounded text-slate-400 whitespace-pre-wrap">{systemValue}</p>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        {isEdited && <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 rounded">Edited</span>}
      </div>
      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{display || "—"}</p>
    </div>
  );
}

// ─── Main component props ────────────────────────────────────

interface GrowthAssessmentPageProps {
  assessmentId: string;
}

// ─── Main page ───────────────────────────────────────────────

export function GrowthAssessmentPage({ assessmentId }: GrowthAssessmentPageProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<AssessmentTab>("summary");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [assessment, setAssessment] = useState<GrowthAssessmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local edits
  const [localStrength, setLocalStrength] = useState("");
  const [localVulnerability, setLocalVulnerability] = useState("");
  const [localRisk, setLocalRisk] = useState("");
  const [localOpportunity, setLocalOpportunity] = useState("");
  const [localQuickWin, setLocalQuickWin] = useState("");
  const [localStrategic, setLocalStrategic] = useState("");
  const [localNotes, setLocalNotes] = useState("");

  // Load assessment on mount
  const [loaded, setLoaded] = useState(false);
  if (!loaded) {
    setLoaded(true);
    fetch(`/api/growth-assessments/${assessmentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setAssessment(data);
        setLocalStrength(data.strengthSummary ?? data.systemStrengthSummary ?? "");
        setLocalVulnerability(data.vulnerabilitySummary ?? data.systemVulnerabilitySummary ?? "");
        setLocalRisk(data.riskSummary ?? data.systemRiskSummary ?? "");
        setLocalOpportunity(data.growthOpportunitySummary ?? data.systemGrowthOpportunitySummary ?? "");
        setLocalQuickWin(data.quickWinSummary ?? data.systemQuickWinSummary ?? "");
        setLocalStrategic(data.strategicFocusSummary ?? data.systemStrategicFocusSummary ?? "");
        setLocalNotes(data.consultantNotes ?? "");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load assessment."); setLoading(false); });
  }

  const handleSave = async () => {
    if (!assessment) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/growth-assessments/${assessment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          strengthSummary: localStrength,
          vulnerabilitySummary: localVulnerability,
          riskSummary: localRisk,
          growthOpportunitySummary: localOpportunity,
          quickWinSummary: localQuickWin,
          strategicFocusSummary: localStrategic,
          consultantNotes: localNotes,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAssessment(data);
      setEditing(false);
      toast({ title: "Assessment saved" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!assessment) return;
    setActioning(true);
    try {
      const r = await fetch(`/api/growth-assessments/${assessment.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAssessment(data);
      const labels: Record<string, string> = {
        submit: "Submitted for Review",
        approve: "Assessment Approved",
        reopen: "Assessment Reopened",
        archive: "Assessment Archived",
        restore: "Assessment Restored",
      };
      toast({ title: labels[action] ?? "Done" });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="ml-3 text-slate-400">Loading assessment…</span>
      </div>
    );
  }
  if (error || !assessment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <p className="text-slate-400">{error ?? "Assessment not found."}</p>
        <button onClick={() => navigate("/diagnostics")} className="text-indigo-400 hover:text-indigo-300 text-sm">
          Back to Diagnostics
        </button>
      </div>
    );
  }

  const sections = assessment.generatedSections;
  const healthScore = assessment.healthScore ? Number(assessment.healthScore) : null;
  const healthRating = assessment.healthRating ?? "";
  const isApproved = assessment.status === "approved";
  const isArchived = !!assessment.archivedAt;

  const statusClass = ASSESSMENT_STATUS_COLORS[assessment.status] ?? "text-slate-400";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 print:hidden">
        <button
          onClick={() => navigate(`/diagnostics/${assessment.diagnosticId}`)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Diagnostic
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-slate-100">
              Business Growth Assessment
            </h1>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium", statusClass)}>
              {ASSESSMENT_STATUS_LABELS[assessment.status] ?? assessment.status}
            </span>
          </div>
          <div className="text-sm text-slate-400 space-x-2">
            <span>{assessment.diagnosticName}</span>
            {assessment.versionNumber != null && <span>· v{assessment.versionNumber}</span>}
            {assessment.clientName && <span>· {assessment.clientName}</span>}
            {assessment.projectName && <span>· {assessment.projectName}</span>}
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!isApproved && !isArchived && (
            editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Assessment
              </button>
            )
          )}
          {assessment.status === "draft" && !isArchived && (
            <button
              onClick={() => handleAction("submit")}
              disabled={actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          )}
          {assessment.status === "awaiting_review" && !isArchived && (
            <button
              onClick={() => handleAction("approve")}
              disabled={actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Assessment
            </button>
          )}
          {isApproved && !isArchived && (
            <button
              onClick={() => handleAction("reopen")}
              disabled={actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reopen
            </button>
          )}
          {!isArchived && (
            <button
              onClick={() => handleAction("archive")}
              disabled={actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-lg transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          )}
          {isArchived && (
            <button
              onClick={() => handleAction("restore")}
              disabled={actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
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

      {/* Tabs */}
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

      {/* ── Tab: Executive Summary ── */}
      {tab === "summary" && (
        <div className="space-y-6 print:space-y-4">
          {/* Health snapshot */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 print:border print:rounded-none">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <HealthScoreGauge score={healthScore} size={160} showScale={true} />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Business Health Score</div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold font-mono text-slate-100">{healthScore ?? "—"}</span>
                    <span className="text-slate-500 text-lg">/100</span>
                    {healthRating && (
                      <span className={cn("text-sm font-semibold px-2.5 py-1 rounded-md border", HEALTH_RATING_BG[healthRating])}>
                        {HEALTH_RATING_LABELS[healthRating] ?? healthRating}
                      </span>
                    )}
                  </div>
                </div>
                {sections?.healthExplanation && (
                  <p className="text-sm text-slate-300 leading-relaxed max-w-prose">{sections.healthExplanation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <Star className="w-4 h-4" /> Top Strengths
              </h3>
              <EditableSection
                label="Strength Summary" editing={editing}
                systemValue={assessment.systemStrengthSummary}
                value={localStrength}
                onChange={setLocalStrength}
              />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Primary Risks
              </h3>
              <EditableSection
                label="Risk Summary" editing={editing}
                systemValue={assessment.systemRiskSummary}
                value={localRisk}
                onChange={setLocalRisk}
              />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Vulnerabilities
              </h3>
              <EditableSection
                label="Vulnerability Summary" editing={editing}
                systemValue={assessment.systemVulnerabilitySummary}
                value={localVulnerability}
                onChange={setLocalVulnerability}
              />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <Target className="w-4 h-4" /> Strategic Focus
              </h3>
              <EditableSection
                label="Strategic Focus Summary" editing={editing}
                systemValue={assessment.systemStrategicFocusSummary}
                value={localStrategic}
                onChange={setLocalStrategic}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Strengths ── */}
      {tab === "strengths" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Strengths Summary" editing={editing}
              systemValue={assessment.systemStrengthSummary}
              value={localStrength}
              onChange={setLocalStrength}
            />
          </div>
          {sections?.strengths.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No clear strength areas identified. Focus on stabilising high-risk areas first.</p>
            </div>
          )}
          <div className="space-y-3">
            {sections?.strengths.map((s, i) => (
              <div key={s.categoryKey} className="bg-slate-800/50 border border-emerald-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-emerald-400 font-mono">#{i + 1}</span>
                  <div>
                    <div className="font-semibold text-slate-200">{s.categoryLabel}</div>
                    <div className="text-sm text-slate-500">Performance: {s.currentPerformance}/10</div>
                  </div>
                  <span className={cn("ml-auto text-xs px-2 py-0.5 rounded border", SEVERITY_COLORS[s.severity] ?? "")}>
                    {SEVERITY_LABELS[s.severity] ?? s.severity}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Why it's a Strength</div>
                  <p className="text-sm text-slate-300">{s.whyStrength}</p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">How to Protect It</div>
                  <p className="text-sm text-slate-300">{s.howToProtect}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Primary Risks ── */}
      {tab === "risks" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Risk Summary" editing={editing}
              systemValue={assessment.systemRiskSummary}
              value={localRisk}
              onChange={setLocalRisk}
            />
          </div>
          {sections?.risks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-emerald-400">No high or critical risk areas identified.</p>
            </div>
          )}
          <div className="space-y-3">
            {sections?.risks.map((r, i) => (
              <div key={r.categoryKey} className="bg-slate-800/50 border border-red-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-red-400 font-mono">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{r.categoryLabel}</div>
                    <div className="text-sm text-slate-500">Priority Score: {r.priorityScore.toFixed(0)}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", SEVERITY_COLORS[r.severity] ?? "")}>
                    {r.severity.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Why it Matters</div>
                  <p className="text-sm text-slate-300">{r.whyItMatters}</p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Likely Consequence</div>
                  <p className="text-sm text-slate-300">{r.consequence}</p>
                </div>
                {r.evidence && (
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Evidence</div>
                    <p className="text-sm text-slate-400 italic">"{r.evidence}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Vulnerabilities ── */}
      {tab === "vulnerabilities" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Vulnerability Summary" editing={editing}
              systemValue={assessment.systemVulnerabilitySummary}
              value={localVulnerability}
              onChange={setLocalVulnerability}
            />
          </div>
          {sections?.vulnerabilities.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No significant vulnerabilities identified at this time.</p>
            </div>
          )}
          <div className="space-y-3">
            {sections?.vulnerabilities.map((v, i) => (
              <div key={v.categoryKey} className="bg-slate-800/50 border border-yellow-500/20 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-bold text-yellow-400 font-mono">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{v.categoryLabel}</div>
                    <div className="text-sm text-slate-500">
                      Performance: {v.currentPerformance}/10 · Priority: {v.priorityScore.toFixed(0)}
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", SEVERITY_COLORS[v.severity] ?? "")}>
                    {SEVERITY_LABELS[v.severity] ?? v.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{v.whatItMeans}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Quick Wins ── */}
      {tab === "quick_wins" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Quick Win Summary" editing={editing}
              systemValue={assessment.systemQuickWinSummary}
              value={localQuickWin}
              onChange={setLocalQuickWin}
            />
          </div>
          {sections?.quickWins.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No quick-win opportunities identified. Focus on the highest-priority bottlenecks.</p>
            </div>
          )}
          <div className="space-y-3">
            {sections?.quickWins.map((w, i) => (
              <div key={w.categoryKey} className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-400 font-mono">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{w.categoryLabel}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", TIME_HORIZON_COLORS[w.timeHorizon] ?? "text-slate-400 border-slate-600")}>
                    {TIME_HORIZON_LABELS[w.timeHorizon] ?? w.timeHorizon}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Recommended Action</div>
                  <p className="text-sm text-slate-200 font-medium">{w.action}</p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Reason</div>
                  <p className="text-sm text-slate-300">{w.reason}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Owner: </span>
                    <span className="text-slate-300">{w.suggestedOwner}</span>
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase mb-1">Expected Improvement</div>
                  <p className="text-sm text-slate-400 italic">{w.expectedImprovement}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Strategic Priorities ── */}
      {tab === "strategic" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Strategic Focus Summary" editing={editing}
              systemValue={assessment.systemStrategicFocusSummary}
              value={localStrategic}
              onChange={setLocalStrategic}
            />
          </div>
          <div className="space-y-3">
            {sections?.strategicPriorities.map((p, i) => (
              <div key={p.categoryKey} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-base font-bold text-slate-400 font-mono">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{p.categoryLabel}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", STRATEGIC_CLASSIFICATION_COLORS[p.classification] ?? "")}>
                    {STRATEGIC_CLASSIFICATION_LABELS[p.classification] ?? p.classification}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">{p.why}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Performance</div>
                    <div className="text-slate-200">{p.currentPerformance}/10</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Impact</div>
                    <div className="text-slate-200">{p.businessImpact}/5</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Urgency</div>
                    <div className="text-slate-200">{p.urgency}/5</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Priority Score</div>
                    <div className="text-slate-200 font-mono">{p.priorityScore.toFixed(0)}</div>
                  </div>
                </div>
                {p.recommendedAction && (
                  <div className="mt-3 bg-slate-900/40 rounded-lg p-3">
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Recommended Action</div>
                    <p className="text-sm text-slate-300">{p.recommendedAction.replace(/^\[Score:.*?\]\n\n/, "")}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Growth Opportunities ── */}
      {tab === "opportunities" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <EditableSection
              label="Growth Opportunity Summary" editing={editing}
              systemValue={assessment.systemGrowthOpportunitySummary}
              value={localOpportunity}
              onChange={setLocalOpportunity}
            />
          </div>
          {sections?.growthOpportunities.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No high-impact growth opportunities identified. Focus on protecting existing strengths.</p>
            </div>
          )}
          {/* Group opportunities */}
          {Object.entries(OPPORTUNITY_GROUP_LABELS).map(([groupKey, groupLabel]) => {
            const ops = sections?.growthOpportunities.filter((o) => o.group === groupKey) ?? [];
            if (ops.length === 0) return null;
            return (
              <div key={groupKey} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {groupLabel}
                </h3>
                {ops.map((op) => (
                  <div key={op.categoryKey} className="border-t border-slate-700/50 pt-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-slate-200">{op.opportunityTitle}</div>
                      <span className="text-xs px-2 py-0.5 rounded border text-slate-400 border-slate-600 shrink-0">
                        {op.priorityClassification}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{op.businessReason}</p>
                    <div className="bg-slate-900/40 rounded-lg p-3">
                      <div className="text-xs font-medium text-slate-500 uppercase mb-1">Suggested Direction</div>
                      <p className="text-sm text-slate-300">{op.suggestedDirection}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Consultant Notes ── */}
      {tab === "notes" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Consultant Notes
          </h3>
          {editing ? (
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={10}
              placeholder="Add private consultant notes, context, or observations about this assessment…"
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          ) : (
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed min-h-24">
              {assessment.consultantNotes ?? <span className="text-slate-500 italic">No consultant notes added yet. Click Edit Assessment to add notes.</span>}
            </p>
          )}
        </div>
      )}

      {/* ── Tab: Approval ── */}
      {tab === "approval" && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">Assessment Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-500 mb-0.5">Current Status</div>
                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium", statusClass)}>
                  {ASSESSMENT_STATUS_LABELS[assessment.status] ?? assessment.status}
                </span>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Created</div>
                <div className="text-slate-200">{format(new Date(assessment.createdAt), "MMM d, yyyy")}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Last Updated</div>
                <div className="text-slate-200">{format(new Date(assessment.updatedAt), "MMM d, yyyy")}</div>
              </div>
              {assessment.reviewedAt && (
                <div>
                  <div className="text-slate-500 mb-0.5">Submitted</div>
                  <div className="text-slate-200">{format(new Date(assessment.reviewedAt), "MMM d, yyyy")}</div>
                </div>
              )}
              {assessment.approvedAt && (
                <div>
                  <div className="text-slate-500 mb-0.5">Approved</div>
                  <div className="text-emerald-300 font-medium">{format(new Date(assessment.approvedAt), "MMM d, yyyy")}</div>
                </div>
              )}
            </div>
          </div>

          {/* Approval actions */}
          {!isArchived && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Actions</h3>
              <div className="flex flex-wrap gap-3">
                {assessment.status === "draft" && (
                  <button
                    onClick={() => handleAction("submit")}
                    disabled={actioning}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Review
                  </button>
                )}
                {assessment.status === "awaiting_review" && (
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actioning}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Assessment
                  </button>
                )}
                {isApproved && (
                  <button
                    onClick={() => handleAction("reopen")}
                    disabled={actioning}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reopen Assessment
                  </button>
                )}
                <button
                  onClick={() => handleAction("archive")}
                  disabled={actioning}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-400 text-sm rounded-lg transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
              {isApproved && (
                <p className="text-xs text-slate-500">
                  Reopening this assessment will return it to Draft status and create an audit log entry.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Print-only footer */}
      <div className="hidden print:block text-xs text-slate-500 border-t border-slate-300 pt-4 mt-6">
        <p>Viral Magic OS — Business Growth Assessment · Generated {format(new Date(), "MMMM d, yyyy")}</p>
        <p>{assessment.clientName} · {assessment.diagnosticName} v{assessment.versionNumber}</p>
      </div>
    </div>
  );
}
