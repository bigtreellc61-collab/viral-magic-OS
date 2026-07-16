import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useCreateDiagnostic,
  useListClients,
  useGetDefaultTemplateCategories,
  useSaveDiagnosticDraft,
  useCompleteDiagnostic,
  useUpdateDiagnosticSummary,
} from "@workspace/api-client-react";
import { CategoryScoreCard, type CategoryScoreData } from "@/components/diagnostics/category-score-card";
import { HealthScoreGauge } from "@/components/diagnostics/health-score-gauge";
import { SeverityBadge } from "@/components/diagnostics/severity-badge";
import {
  DIAGNOSTIC_TYPES,
  liveCalcHealthScore,
  liveCalcPriorityScore,
  liveCalcSeverity,
  getHealthRatingLabel,
  getHealthRating,
  HEALTH_RATING_COLORS,
} from "@/lib/diagnostic-constants";
import {
  Stethoscope, ChevronLeft, ChevronRight, Check, AlertTriangle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;
const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Score Categories" },
  { id: 3, label: "Summary" },
  { id: 4, label: "Complete" },
];

export default function DiagnosticCreatePage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [diagnosticName, setDiagnosticName] = useState("");
  const [diagnosticType, setDiagnosticType] = useState("business_bottleneck_assessment");
  const [summaryNotes, setSummaryNotes] = useState("");

  // Step 2
  const [scores, setScores] = useState<CategoryScoreData[]>([]);
  const [createdDiagnosticId, setCreatedDiagnosticId] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);

  // Step 3 – summary fields
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [recommendedFirstAction, setRecommendedFirstAction] = useState("");
  const [recommendedSoftwareOpportunity, setRecommendedSoftwareOpportunity] = useState("");

  const { data: clientsData } = useListClients({ pageSize: "100" } as any);
  const clients = clientsData?.clients ?? [];

  const { data: templateData } = useGetDefaultTemplateCategories();
  const templateCategories = (templateData as any)?.categories ?? [];

  const createMut = useCreateDiagnostic();
  const saveDraftMut = useSaveDiagnosticDraft();
  const completeMut = useCompleteDiagnostic();
  const summaryMut = useUpdateDiagnosticSummary();

  // Initialize scores from template categories
  useEffect(() => {
    if (templateCategories.length > 0 && scores.length === 0) {
      setScores(templateCategories.map((c: any) => ({
        categoryKey: c.categoryKey,
        categoryLabel: c.categoryLabel,
        categoryDescription: c.categoryDescription,
        displayOrder: c.displayOrder,
        currentPerformance: null,
        businessImpact: null,
        urgency: null,
        evidence: null,
        observations: null,
        notes: null,
        recommendedAction: null,
      })));
    }
  }, [templateCategories]);

  // Live health score preview
  const scoredCategories = scores.filter((s) =>
    s.currentPerformance != null && s.businessImpact != null && s.urgency != null,
  );
  const liveHealthScore = scoredCategories.length > 0
    ? liveCalcHealthScore(scoredCategories.map((s) => ({
        cp: s.currentPerformance!,
        bi: s.businessImpact!,
      })))
    : null;
  const liveRating = liveHealthScore != null ? getHealthRating(liveHealthScore) : null;
  const unscoredCount = scores.filter((s) =>
    s.currentPerformance == null || s.businessImpact == null || s.urgency == null,
  ).length;

  // Top bottlenecks preview
  const topBottlenecks = scores
    .filter((s) => s.currentPerformance != null && s.businessImpact != null && s.urgency != null)
    .map((s) => {
      const ps = liveCalcPriorityScore(s.currentPerformance!, s.businessImpact!, s.urgency!);
      return { ...s, ps, sev: liveCalcSeverity(ps) };
    })
    .sort((a, b) => b.ps - a.ps)
    .slice(0, 5);

  const handleStep1Next = async () => {
    setError(null);
    if (!clientId) { setError("Please select a client."); return; }
    if (!diagnosticName.trim()) { setError("Please enter a diagnostic name."); return; }
    if (!diagnosticType) { setError("Please select a type."); return; }

    try {
      const result = await createMut.mutateAsync({
        data: { clientId, projectId: projectId || undefined, diagnosticName, diagnosticType, summaryNotes },
      });
      setCreatedDiagnosticId(result.id);
      setStep(2);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to create diagnostic.");
    }
  };

  const handleSaveDraft = async () => {
    if (!createdDiagnosticId) return;
    setError(null);
    try {
      const result = await saveDraftMut.mutateAsync({
        diagnosticId: createdDiagnosticId,
        data: { versionId: currentVersionId, scores: scores as any },
      });
      const r = result as any;
      if (r.versionId) setCurrentVersionId(r.versionId);
      if (r.versionNumber) setCurrentVersionNumber(r.versionNumber);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to save draft.");
    }
  };

  const handleStep2Next = async () => {
    await handleSaveDraft();
    setStep(3);
  };

  const handleStep3Next = async () => {
    // Persist executive summary fields to the current draft version
    if (createdDiagnosticId && currentVersionNumber != null) {
      const hasAnySummary = executiveSummary.trim() || recommendedFirstAction.trim() || recommendedSoftwareOpportunity.trim();
      if (hasAnySummary) {
        try {
          await summaryMut.mutateAsync({
            diagnosticId: createdDiagnosticId,
            versionNumber: currentVersionNumber,
            data: {
              executiveSummary: executiveSummary.trim() || undefined,
              recommendedFirstAction: recommendedFirstAction.trim() || undefined,
              recommendedSoftwareOpportunity: recommendedSoftwareOpportunity.trim() || undefined,
            } as any,
          });
        } catch {
          // Non-fatal: still advance to step 4
        }
      }
    }
    setStep(4);
  };

  const handleComplete = async () => {
    if (!createdDiagnosticId) return;
    setError(null);
    try {
      // Save draft first
      const draftResult = await saveDraftMut.mutateAsync({
        diagnosticId: createdDiagnosticId,
        data: { versionId: currentVersionId, scores: scores as any },
      });
      const draftR = draftResult as any;
      const finalVersionId = draftR.versionId ?? currentVersionId;
      const finalVersionNumber = draftR.versionNumber ?? currentVersionNumber;

      // Persist summary fields
      if (finalVersionNumber != null) {
        const hasAnySummary = executiveSummary.trim() || recommendedFirstAction.trim() || recommendedSoftwareOpportunity.trim();
        if (hasAnySummary) {
          await summaryMut.mutateAsync({
            diagnosticId: createdDiagnosticId,
            versionNumber: finalVersionNumber,
            data: {
              executiveSummary: executiveSummary.trim() || undefined,
              recommendedFirstAction: recommendedFirstAction.trim() || undefined,
              recommendedSoftwareOpportunity: recommendedSoftwareOpportunity.trim() || undefined,
            } as any,
          });
        }
      }

      // Complete
      await completeMut.mutateAsync({
        diagnosticId: createdDiagnosticId,
        data: { versionId: finalVersionId ?? undefined },
      });
      navigate(`/diagnostics/${createdDiagnosticId}`);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to complete diagnostic.");
    }
  };

  const isSubmitting = createMut.isPending || saveDraftMut.isPending || completeMut.isPending;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/diagnostics")} className="text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-indigo-400" />
            New Business Diagnostic
          </h1>
          <p className="text-slate-400 text-sm">Identify growth opportunities and bottlenecks</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              step === s.id
                ? "bg-indigo-600/30 text-indigo-300"
                : s.id < step
                ? "text-emerald-400"
                : "text-slate-500",
            )}>
              {s.id < step ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 flex items-center justify-center text-xs">{s.id}</span>}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-600 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-200">Diagnostic Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Client *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select client...</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Diagnostic Name *</label>
              <input
                type="text"
                value={diagnosticName}
                onChange={(e) => setDiagnosticName(e.target.value)}
                placeholder="e.g. Q3 2025 Business Growth Assessment"
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Diagnostic Type *</label>
              <select
                value={diagnosticType}
                onChange={(e) => setDiagnosticType(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {DIAGNOSTIC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Pre-diagnosis Notes</label>
              <textarea
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                placeholder="Initial context or notes before starting..."
                rows={3}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleStep1Next}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Continue to Scoring
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Score categories */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Live preview bar */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-wrap items-center gap-6">
            <HealthScoreGauge score={liveHealthScore} size={80} strokeWidth={8} />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Live Health Score Preview</span>
                {liveRating && (
                  <span className={cn("text-sm font-semibold", HEALTH_RATING_COLORS[liveRating])}>
                    — {getHealthRatingLabel(liveRating)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{scoredCategories.length}/{scores.length} categories scored</span>
                {unscoredCount > 0 && (
                  <span className="text-yellow-400">{unscoredCount} remaining</span>
                )}
              </div>
              {/* Top bottlenecks preview */}
              {topBottlenecks.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {topBottlenecks.slice(0, 3).map((b) => (
                    <span key={b.categoryKey} className="flex items-center gap-1 text-xs text-slate-400">
                      <SeverityBadge severity={b.sev} />
                      {b.categoryLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 text-slate-300 text-xs rounded-lg transition-colors"
            >
              {saveDraftMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              Save Draft
            </button>
          </div>

          {/* Category cards */}
          <div className="space-y-3">
            {scores.map((s, i) => (
              <CategoryScoreCard
                key={s.categoryKey}
                data={s}
                onChange={(updated) => {
                  const newScores = [...scores];
                  newScores[i] = updated;
                  setScores(newScores);
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleStep2Next}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Save & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Executive summary */}
      {step === 3 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-200">Executive Summary</h2>
          <p className="text-sm text-slate-400">
            Add your high-level summary, top recommendation, and any software opportunity. These will appear in the final diagnostic report.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Executive Summary</label>
              <textarea
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="Overall assessment of the business situation..."
                rows={5}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Recommended First Action</label>
              <textarea
                value={recommendedFirstAction}
                onChange={(e) => setRecommendedFirstAction(e.target.value)}
                placeholder="The single most important next step..."
                rows={3}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Recommended Software Opportunity</label>
              <textarea
                value={recommendedSoftwareOpportunity}
                onChange={(e) => setRecommendedSoftwareOpportunity(e.target.value)}
                placeholder="Technology or software that could help..."
                rows={3}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleStep3Next}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Review & Complete
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review and complete */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-200">Review & Complete</h2>

            {/* Score summary */}
            <div className="flex flex-col sm:flex-row gap-6 items-center bg-slate-700/30 rounded-xl p-5">
              <HealthScoreGauge score={liveHealthScore} size={120} />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Diagnostic Name</div>
                  <div className="text-slate-200 font-medium">{diagnosticName}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-slate-500">Scored</div><div className="text-slate-200">{scoredCategories.length}/{scores.length} categories</div></div>
                  <div><div className="text-slate-500">Unscored</div><div className="text-slate-200">{unscoredCount}</div></div>
                </div>
                {unscoredCount > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {unscoredCount} categories unscored — completing will fail. Go back to score them.
                  </div>
                )}
              </div>
            </div>

            {/* Top bottlenecks */}
            {topBottlenecks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Top Priority Bottlenecks</h3>
                <div className="space-y-2">
                  {topBottlenecks.map((b) => (
                    <div key={b.categoryKey} className="flex items-center gap-3 p-2.5 bg-slate-700/30 rounded-lg">
                      <SeverityBadge severity={b.sev} />
                      <span className="text-sm text-slate-200">{b.categoryLabel}</span>
                      <span className="ml-auto text-xs text-slate-500 tabular-nums">Priority: {b.ps.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary preview */}
            {(executiveSummary || recommendedFirstAction) && (
              <div className="space-y-3 border-t border-slate-700/50 pt-4">
                {executiveSummary && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Executive Summary</div>
                    <p className="text-sm text-slate-300">{executiveSummary}</p>
                  </div>
                )}
                {recommendedFirstAction && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Recommended First Action</div>
                    <p className="text-sm text-slate-300">{recommendedFirstAction}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { if (createdDiagnosticId) navigate(`/diagnostics/${createdDiagnosticId}`); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
              >
                Save as Draft
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting || unscoredCount > 0}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {completeMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Complete Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
