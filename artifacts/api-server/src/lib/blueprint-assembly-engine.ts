/**
 * Phase 2B — Growth Blueprint Assembly Engine
 * Deterministic, rule-based. No external AI.
 *
 * Transforms an approved assessment + recommendation plan into a structured
 * Growth Blueprint with 16 sections and per-recommendation roadmap initiatives.
 *
 * NEVER creates unsupported facts. Organises, ranks, groups, and assembles
 * narrative text from existing source data only.
 */

import type { GeneratedSections } from "./growth-assessment-engine";
import type {
  SolutionRecommendationPlan,
  SolutionRecommendation,
  SolutionRecommendationAction,
  SolutionRecommendationDependency,
} from "@workspace/db";

// ─── Section keys (fixed order) ──────────────────────────────────

export const SECTION_DEFINITIONS = [
  { key: "executive_summary",        title: "Executive Summary",            order: 1 },
  { key: "current_business_state",   title: "Current Business State",       order: 2 },
  { key: "key_strengths",            title: "Key Strengths",                order: 3 },
  { key: "critical_vulnerabilities", title: "Critical Vulnerabilities",     order: 4 },
  { key: "primary_risks",            title: "Primary Risks",                order: 5 },
  { key: "immediate_quick_wins",     title: "Immediate Quick Wins",         order: 6 },
  { key: "strategic_priorities",     title: "Strategic Priorities",         order: 7 },
  { key: "action_plan_30_days",      title: "30-Day Action Plan",           order: 8 },
  { key: "action_plan_60_days",      title: "60-Day Action Plan",           order: 9 },
  { key: "action_plan_90_days",      title: "90-Day Action Plan",           order: 10 },
  { key: "longer_term_roadmap",      title: "Longer-Term Roadmap",          order: 11 },
  { key: "business_impact",          title: "Business Impact",              order: 12 },
  { key: "success_metrics",          title: "Success Metrics and KPIs",     order: 13 },
  { key: "dependencies_constraints", title: "Dependencies and Constraints", order: 14 },
  { key: "consultant_guidance",      title: "Consultant Guidance",          order: 15 },
  { key: "executive_decision_summary", title: "Executive Decision Summary", order: 16 },
] as const;

export type SectionKey = typeof SECTION_DEFINITIONS[number]["key"];

// ─── Roadmap period ───────────────────────────────────────────────

export type RoadmapPeriod = "30_days" | "60_days" | "90_days" | "longer_term";

// ─── Input types ─────────────────────────────────────────────────

export interface AssemblyInput {
  blueprint: {
    id: string;
    title: string;
    consultantNotes: string | null;
  };
  assessment: {
    id: string;
    healthScore: string | number | null;
    healthRating: string | null;
    status: string;
    // Admin overrides (fallback to system fields)
    strengthSummary: string | null;
    systemStrengthSummary: string | null;
    vulnerabilitySummary: string | null;
    systemVulnerabilitySummary: string | null;
    riskSummary: string | null;
    systemRiskSummary: string | null;
    growthOpportunitySummary: string | null;
    systemGrowthOpportunitySummary: string | null;
    quickWinSummary: string | null;
    systemQuickWinSummary: string | null;
    strategicFocusSummary: string | null;
    systemStrategicFocusSummary: string | null;
    consultantNotes: string | null;
    generatedSections: unknown; // GeneratedSections JSONB
  };
  plan: {
    id: string;
    status: string;
    overallPriorityScore: string | number | null;
    executiveRecommendation: string | null;
    systemExecutiveRecommendation: string | null;
    businessImpactSummary: string | null;
    systemBusinessImpactSummary: string | null;
    dependencySummary: string | null;
    systemDependencySummary: string | null;
    consultantNotes: string | null;
  };
  recommendations: SolutionRecommendation[];
  actions: SolutionRecommendationAction[];
  dependencies: SolutionRecommendationDependency[];
}

// ─── Output types ─────────────────────────────────────────────────

export interface AssembledSection {
  sectionKey: SectionKey;
  title: string;
  sectionOrder: number;
  generatedContent: string;
  sourceReferences: Record<string, string[]>;
}

export interface AssembledInitiative {
  sourceRecommendationId: string;
  title: string;
  summary: string | null;
  domain: string;
  priorityClassification: string;
  effortLevel: string | null;
  roadmapPeriod: RoadmapPeriod;
  roadmapReason: string;
  sequenceOrder: number;
  ownerPlaceholder: string | null;
  targetPeriodLabel: string | null;
  expectedBusinessImpact: string | null;
}

export interface AssemblyResult {
  sections: AssembledSection[];
  initiatives: AssembledInitiative[];
  summary: {
    sectionCount: number;
    initiativeCount: number;
    initiativesByPeriod: Record<RoadmapPeriod, number>;
    errors: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function eff(v: string | null | undefined): string {
  return v ?? "";
}

function pickText(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return "";
}

function parseGeneratedSections(raw: unknown): GeneratedSections | null {
  if (!raw || typeof raw !== "object") return null;
  const gs = raw as Record<string, unknown>;
  if (!Array.isArray(gs.strengths)) return null;
  return gs as unknown as GeneratedSections;
}

// ─── Roadmap assignment rules ─────────────────────────────────────
//
// Priority classification bands (from recommendation engine):
//   "Critical Priority" | "High Priority" | "Important" |
//   "Planned Improvement" | "Monitor"
//
// Effort: "low" | "moderate" | "high" | "major_initiative"
//
// Timeframe: "immediate" | "7_days" | "30_days" |
//             "60_90_days" | "strategic_90_plus_days"

function assignRoadmapPeriod(
  rec: SolutionRecommendation,
  prereqIds: Set<string>,
): { period: RoadmapPeriod; reason: string } {
  const cls = rec.priorityClassification ?? "";
  const effort = rec.effort ?? "";
  const timeframe = rec.timeframe ?? "";

  // ── 30 days ────────────────────────────────────────────────
  if (rec.quickWinFlag) {
    return { period: "30_days", reason: "quick win — achievable within 30 days with meaningful impact" };
  }
  if (timeframe === "immediate" || timeframe === "7_days" || timeframe === "30_days") {
    return { period: "30_days", reason: `timeframe is ${timeframe.replace("_", " ")}` };
  }
  if (cls === "Critical Priority" && (effort === "low" || effort === "moderate")) {
    return { period: "30_days", reason: "critical priority and lower effort — address first" };
  }
  if (prereqIds.has(rec.id)) {
    // This recommendation is a prerequisite (blocking dependency) for a 30-day item.
    // Promote it to 30 days so it can be completed first.
    return { period: "30_days", reason: "required prerequisite for other 30-day initiatives" };
  }

  // ── Longer term ────────────────────────────────────────────
  if (timeframe === "strategic_90_plus_days") {
    return { period: "longer_term", reason: "strategic timeframe — 90+ days" };
  }
  if (cls === "Monitor") {
    return { period: "longer_term", reason: "monitor-level priority — optimise after foundational work" };
  }

  // ── 60 days ────────────────────────────────────────────────
  if (cls === "Critical Priority" && effort === "high") {
    return { period: "60_days", reason: "critical priority but high effort — begin after 30-day foundations" };
  }
  if (cls === "Critical Priority" && effort === "major_initiative") {
    return { period: "60_days", reason: "critical priority but major initiative — phased start at 60 days" };
  }
  if (cls === "High Priority" && (effort === "low" || effort === "moderate")) {
    return { period: "60_days", reason: "high priority with lower effort — operational improvement" };
  }
  if ((cls === "High Priority" || cls === "Important") && timeframe === "60_90_days") {
    return { period: "60_days", reason: "high priority with 60–90 day timeframe" };
  }

  // ── 90 days ────────────────────────────────────────────────
  if (cls === "High Priority" && (effort === "high" || effort === "major_initiative")) {
    return { period: "90_days", reason: "high priority but significant effort — system-building initiative" };
  }
  if (cls === "Important") {
    return { period: "90_days", reason: "important priority — structured 90-day implementation" };
  }
  if (cls === "Planned Improvement" && (effort === "low" || effort === "moderate")) {
    return { period: "90_days", reason: "planned improvement with manageable effort" };
  }

  // ── Default ────────────────────────────────────────────────
  return { period: "longer_term", reason: "lower urgency or high complexity — strategic expansion after foundational work" };
}

// ─── Identify which recommendations are blocking prerequisites ────
//
// A recommendation is a prerequisite (prereq) for a 30-day item if:
// - It appears as a `blocking` dependency for any recommendation that
//   would otherwise be assigned to 30 days.
//
// We do a preliminary pass to find the 30-day set, then collect their
// blocking dependents.

function findPrereqIdsFor30Day(
  recs: SolutionRecommendation[],
  deps: SolutionRecommendationDependency[],
): Set<string> {
  // Preliminary 30-day set (without prereq promotion)
  const provisional30 = new Set<string>();
  for (const rec of recs) {
    const cls = rec.priorityClassification ?? "";
    const effort = rec.effort ?? "";
    const timeframe = rec.timeframe ?? "";
    if (
      rec.quickWinFlag ||
      timeframe === "immediate" || timeframe === "7_days" || timeframe === "30_days" ||
      (cls === "Critical Priority" && (effort === "low" || effort === "moderate"))
    ) {
      provisional30.add(rec.id);
    }
  }

  // Collect blocking dependencies of 30-day items
  const prereqIds = new Set<string>();
  for (const dep of deps) {
    if (dep.dependencyType === "blocking" && provisional30.has(dep.recommendationId)) {
      prereqIds.add(dep.dependsOnRecommendationId);
    }
  }
  return prereqIds;
}

// ─── Section content builders ─────────────────────────────────────

function buildExecutiveSummary(input: AssemblyInput, initiatives: AssembledInitiative[], gs: GeneratedSections | null): string {
  const score = input.assessment.healthScore ? Number(input.assessment.healthScore).toFixed(0) : "N/A";
  const rating = (input.assessment.healthRating ?? "unknown").replace("_", " ").toUpperCase();
  const planExec = pickText(input.plan.executiveRecommendation, input.plan.systemExecutiveRecommendation);
  const initCount = initiatives.length;
  const day30 = initiatives.filter((i) => i.roadmapPeriod === "30_days").length;

  const strengths = gs?.strengths?.slice(0, 3).map((s) => s.categoryLabel).join(", ") ?? "see strengths section";
  const vulns = gs?.vulnerabilities?.slice(0, 2).map((v) => v.categoryLabel).join(", ") ?? "see vulnerabilities section";

  let text = `Business Health Rating: ${rating} — Score: ${score}/100\n\n`;
  text += `This Growth Blueprint presents a structured strategic improvement plan assembled from the completed Business Growth Assessment and approved Solution Recommendation Plan.\n\n`;

  if (strengths) {
    text += `Core Strengths: ${strengths}.\n\n`;
  }
  if (vulns) {
    text += `Priority Vulnerabilities Requiring Action: ${vulns}.\n\n`;
  }

  text += `Blueprint Summary: ${initCount} prioritised initiative${initCount !== 1 ? "s" : ""} have been sequenced across the roadmap, with ${day30} targeted within the first 30 days.\n\n`;

  if (planExec) {
    text += `Strategic Direction: ${planExec}`;
  }

  return text.trim();
}

function buildCurrentBusinessState(input: AssemblyInput, gs: GeneratedSections | null): string {
  const score = input.assessment.healthScore ? Number(input.assessment.healthScore).toFixed(0) : "N/A";
  const rating = (input.assessment.healthRating ?? "unknown").replace(/_/g, " ");
  const healthExp = gs?.healthExplanation ?? "";

  const strongDomains = gs?.strengths?.map((s) => `${s.categoryLabel} (${s.currentPerformance}/10)`).join(", ") ?? "";
  const weakDomains = gs?.vulnerabilities?.map((v) => `${v.categoryLabel} (${v.currentPerformance}/10)`).join(", ") ?? "";

  let text = `Business Health Score: ${score}/100 — Health Rating: ${rating}\n\n`;
  if (healthExp) text += `${healthExp}\n\n`;
  if (strongDomains) text += `Strongest Areas: ${strongDomains}.\n\n`;
  if (weakDomains) text += `Areas Requiring Improvement: ${weakDomains}.\n\n`;

  const vulnSummary = pickText(input.assessment.vulnerabilitySummary, input.assessment.systemVulnerabilitySummary);
  if (vulnSummary) text += `Primary Constraints: ${vulnSummary}`;

  return text.trim();
}

function buildKeyStrengths(input: AssemblyInput, gs: GeneratedSections | null): string {
  const summary = pickText(input.assessment.strengthSummary, input.assessment.systemStrengthSummary);
  const items = gs?.strengths ?? [];

  if (items.length === 0 && !summary) {
    return "No clear strength areas were identified in this assessment. Focus on stabilising the highest-risk areas first.";
  }

  let text = summary ? `${summary}\n\n` : "";
  text += "Strength Areas:\n\n";
  for (const s of items) {
    text += `• ${s.categoryLabel} (Score: ${s.currentPerformance}/10)\n`;
    if (s.whyStrength) text += `  ${s.whyStrength}\n`;
    if (s.howToProtect) text += `  How to protect: ${s.howToProtect}\n`;
    text += "\n";
  }
  return text.trim();
}

function buildCriticalVulnerabilities(input: AssemblyInput, gs: GeneratedSections | null): string {
  const summary = pickText(input.assessment.vulnerabilitySummary, input.assessment.systemVulnerabilitySummary);
  const items = gs?.vulnerabilities ?? [];

  if (items.length === 0 && !summary) {
    return "No significant vulnerabilities were identified at this time.";
  }

  let text = summary ? `${summary}\n\n` : "";
  text += "Vulnerability Areas:\n\n";
  for (const v of items) {
    text += `• ${v.categoryLabel} (Score: ${v.currentPerformance}/10, Priority Score: ${v.priorityScore?.toFixed(0) ?? "N/A"})\n`;
    if (v.whatItMeans) text += `  ${v.whatItMeans}\n`;
    text += "\n";
  }
  return text.trim();
}

function buildPrimaryRisks(input: AssemblyInput, gs: GeneratedSections | null, deps: SolutionRecommendationDependency[]): string {
  const summary = pickText(input.assessment.riskSummary, input.assessment.systemRiskSummary);
  const items = gs?.risks ?? [];
  const unresolvedDeps = deps.filter((d) => d.dependencyType === "blocking");

  let text = summary ? `${summary}\n\n` : "";
  if (items.length > 0) {
    text += "Assessment Risks:\n\n";
    for (const r of items) {
      text += `• ${r.categoryLabel} — Severity: ${(r.severity ?? "").toUpperCase()}\n`;
      if (r.whyItMatters) text += `  ${r.whyItMatters}\n`;
      if (r.consequence) text += `  Consequence: ${r.consequence}\n`;
      text += "\n";
    }
  }

  if (unresolvedDeps.length > 0) {
    text += `Recommendation Dependencies (${unresolvedDeps.length} blocking relationship${unresolvedDeps.length !== 1 ? "s" : ""} identified — must be sequenced correctly to avoid delivery risk).\n`;
  }

  return text.trim() || "No high or critical risk areas were identified in this assessment.";
}

function buildImmediateQuickWins(input: AssemblyInput, gs: GeneratedSections | null, initiatives: AssembledInitiative[]): string {
  const summary = pickText(input.assessment.quickWinSummary, input.assessment.systemQuickWinSummary);
  const assessmentWins = gs?.quickWins ?? [];
  const initiativeWins = initiatives.filter(
    (i) => i.roadmapPeriod === "30_days" && i.roadmapReason.includes("quick win"),
  );

  let text = summary ? `${summary}\n\n` : "";

  if (assessmentWins.length > 0) {
    text += "Assessment Quick Wins:\n\n";
    for (const w of assessmentWins) {
      text += `• ${w.categoryLabel} — ${w.action}\n`;
      text += `  Time horizon: ${w.timeHorizon.replace(/_/g, " ")} | Owner: ${w.suggestedOwner}\n`;
      text += `  ${w.reason}\n\n`;
    }
  }

  if (initiativeWins.length > 0 && initiativeWins.some((i) => !assessmentWins.find((w) => w.categoryLabel === i.domain))) {
    text += "Roadmap Quick Win Initiatives:\n\n";
    for (const i of initiativeWins) {
      text += `• ${i.title} (${i.domain})\n`;
      if (i.ownerPlaceholder) text += `  Owner: ${i.ownerPlaceholder}\n`;
      text += "\n";
    }
  }

  return text.trim() || "No clear quick-win opportunities were identified. Available capacity should be focused on the highest-priority bottlenecks.";
}

function buildStrategicPriorities(input: AssemblyInput, gs: GeneratedSections | null, recs: SolutionRecommendation[]): string {
  const summary = pickText(input.assessment.strategicFocusSummary, input.assessment.systemStrategicFocusSummary);
  const asmPriorities = gs?.strategicPriorities ?? [];

  let text = summary ? `${summary}\n\n` : "";

  if (recs.length > 0) {
    text += "Approved Strategic Initiatives (ranked by priority):\n\n";
    for (const r of recs) {
      const score = r.priorityScore ? Number(r.priorityScore).toFixed(0) : "N/A";
      text += `${r.rank}. ${r.title}\n`;
      text += `   Domain: ${r.domain} | Classification: ${r.priorityClassification} | Priority Score: ${score}\n`;
      if (r.problemStatement) text += `   ${r.problemStatement}\n`;
      text += "\n";
    }
  }

  if (asmPriorities.length > 0 && recs.length === 0) {
    text += "Assessment Strategic Priorities:\n\n";
    for (const p of asmPriorities) {
      text += `• ${p.categoryLabel} — ${p.classification.replace(/_/g, " ")}\n`;
      text += `  ${p.why}\n\n`;
    }
  }

  return text.trim();
}

function buildActionPlan(
  period: "30_days" | "60_days" | "90_days",
  initiatives: AssembledInitiative[],
  recs: SolutionRecommendation[],
  actions: SolutionRecommendationAction[],
  deps: SolutionRecommendationDependency[],
): string {
  const periodLabel = period === "30_days" ? "30-Day" : period === "60_days" ? "60-Day" : "90-Day";
  const filtered = initiatives.filter((i) => i.roadmapPeriod === period);

  if (filtered.length === 0) {
    return `No initiatives are currently assigned to the ${periodLabel} action plan.`;
  }

  let text = `${periodLabel} Action Plan — ${filtered.length} Initiative${filtered.length !== 1 ? "s" : ""}\n\n`;

  for (const init of filtered) {
    const rec = recs.find((r) => r.id === init.sourceRecommendationId);
    text += `${init.sequenceOrder}. ${init.title}\n`;
    text += `   Domain: ${init.domain} | Priority: ${init.priorityClassification}`;
    if (init.effortLevel) text += ` | Effort: ${init.effortLevel.replace(/_/g, " ")}`;
    text += "\n";
    if (init.ownerPlaceholder) text += `   Owner: ${init.ownerPlaceholder}\n`;
    if (init.targetPeriodLabel) text += `   Target: ${init.targetPeriodLabel}\n`;
    text += `   Rationale: ${init.roadmapReason}\n`;

    if (rec?.recommendedOutcome) {
      text += `   Outcome: ${rec.recommendedOutcome}\n`;
    }

    // Actions for this period
    const recActions = actions
      .filter((a) => a.recommendationId === init.sourceRecommendationId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (recActions.length > 0) {
      text += "   Actions:\n";
      for (const a of recActions) {
        text += `     - ${a.title}`;
        if (a.suggestedOwner) text += ` (${a.suggestedOwner})`;
        text += "\n";
        if (a.successMetric) text += `       Success metric: ${a.successMetric}\n`;
      }
    }

    // Dependencies
    const recDeps = deps.filter((d) => d.recommendationId === init.sourceRecommendationId && d.dependencyType === "blocking");
    if (recDeps.length > 0) {
      text += `   Dependencies: ${recDeps.length} blocking prerequisite${recDeps.length !== 1 ? "s" : ""} must be completed first\n`;
    }

    if (rec?.successMetric) text += `   Success Metric: ${rec.successMetric}\n`;
    text += "\n";
  }

  return text.trim();
}

function buildLongerTermRoadmap(initiatives: AssembledInitiative[], recs: SolutionRecommendation[]): string {
  const filtered = initiatives.filter((i) => i.roadmapPeriod === "longer_term");

  if (filtered.length === 0) {
    return "No initiatives are currently deferred to the longer-term roadmap. All approved recommendations have been assigned to the 30–90 day plans.";
  }

  let text = `Longer-Term Roadmap — ${filtered.length} Strategic Initiative${filtered.length !== 1 ? "s" : ""}\n\n`;
  text += "These initiatives are deferred due to high complexity, lower urgency, or dependency on foundational 30–90 day work being completed first.\n\n";

  for (const init of filtered) {
    const rec = recs.find((r) => r.id === init.sourceRecommendationId);
    text += `• ${init.title} (${init.domain})\n`;
    text += `  Priority: ${init.priorityClassification}`;
    if (init.effortLevel) text += ` | Effort: ${init.effortLevel.replace(/_/g, " ")}`;
    text += "\n";
    text += `  Rationale for deferral: ${init.roadmapReason}\n`;
    if (rec?.recommendedOutcome) text += `  Outcome: ${rec.recommendedOutcome}\n`;
    text += "\n";
  }

  return text.trim();
}

function buildBusinessImpact(input: AssemblyInput, recs: SolutionRecommendation[]): string {
  const summary = pickText(input.plan.businessImpactSummary, input.plan.systemBusinessImpactSummary);

  let text = summary ? `${summary}\n\n` : "";
  text += "Impact by Initiative:\n\n";
  text += "NOTE: All impact assessments are qualitative based on assessment data. No revenue projections are guaranteed.\n\n";

  const sorted = [...recs].sort((a, b) => Number(b.businessImpactScore ?? 0) - Number(a.businessImpactScore ?? 0));
  for (const r of sorted) {
    const impactScore = r.businessImpactScore ? Number(r.businessImpactScore).toFixed(0) : "N/A";
    text += `• ${r.title} — Business Impact Score: ${impactScore}/100\n`;
    if (r.whyItMatters) text += `  ${r.whyItMatters}\n`;
    if (r.recommendedOutcome) text += `  Expected outcome: ${r.recommendedOutcome}\n`;
    text += "\n";
  }

  return text.trim();
}

function buildSuccessMetrics(recs: SolutionRecommendation[], actions: SolutionRecommendationAction[]): string {
  let text = "Success Metrics and KPIs — sourced from approved initiatives\n\n";

  for (const r of recs) {
    const recActions = actions.filter((a) => a.recommendationId === r.id && a.successMetric);
    text += `${r.rank}. ${r.title}\n`;
    if (r.successMetric) text += `   Primary: ${r.successMetric}\n`;
    for (const a of recActions) {
      if (a.successMetric && a.successMetric !== r.successMetric) {
        text += `   - ${a.title}: ${a.successMetric}\n`;
      }
    }
    text += "\n";
  }

  return text.trim() || "No success metrics recorded. Add metrics to recommendation records to populate this section.";
}

function buildDependenciesConstraints(
  input: AssemblyInput,
  recs: SolutionRecommendation[],
  deps: SolutionRecommendationDependency[],
): string {
  const summary = pickText(input.plan.dependencySummary, input.plan.systemDependencySummary);

  let text = summary ? `${summary}\n\n` : "";

  if (deps.length === 0) {
    text += "No blocking dependencies were identified between initiatives.";
    return text.trim();
  }

  const recMap = new Map(recs.map((r) => [r.id, r]));

  const blocking = deps.filter((d) => d.dependencyType === "blocking");
  const recommended = deps.filter((d) => d.dependencyType === "recommended");

  if (blocking.length > 0) {
    text += `Blocking Dependencies (${blocking.length}) — must be completed in sequence:\n\n`;
    for (const d of blocking) {
      const from = recMap.get(d.recommendationId)?.title ?? d.recommendationId;
      const to = recMap.get(d.dependsOnRecommendationId)?.title ?? d.dependsOnRecommendationId;
      text += `• "${from}" depends on "${to}" being completed first\n`;
      if (d.notes) text += `  ${d.notes}\n`;
      text += "\n";
    }
  }

  if (recommended.length > 0) {
    text += `Recommended Dependencies (${recommended.length}) — sequencing advised but not blocking:\n\n`;
    for (const d of recommended) {
      const from = recMap.get(d.recommendationId)?.title ?? d.recommendationId;
      const to = recMap.get(d.dependsOnRecommendationId)?.title ?? d.dependsOnRecommendationId;
      text += `• "${from}" is recommended to follow "${to}"\n`;
    }
  }

  return text.trim();
}

function buildConsultantGuidance(input: AssemblyInput): string {
  const planNotes = eff(input.plan.consultantNotes);
  const bpNotes = eff(input.blueprint.consultantNotes);
  const assessmentNotes = eff(input.assessment.consultantNotes);

  let text = "This section is reserved for consultant-authored guidance and context.\n\n";

  if (planNotes) {
    text += `Recommendation Plan Notes:\n${planNotes}\n\n`;
  }
  if (assessmentNotes) {
    text += `Assessment Notes:\n${assessmentNotes}\n\n`;
  }
  if (bpNotes) {
    text += `Blueprint Notes:\n${bpNotes}\n\n`;
  }

  if (!planNotes && !bpNotes && !assessmentNotes) {
    text += "No consultant notes have been added. Edit this section to add guidance for the client engagement.";
  }

  return text.trim();
}

function buildExecutiveDecisionSummary(
  recs: SolutionRecommendation[],
  deps: SolutionRecommendationDependency[],
): string {
  const critical = recs.filter((r) => r.priorityClassification === "Critical Priority");
  const high = recs.filter((r) => r.priorityClassification === "High Priority");
  const blocking = deps.filter((d) => d.dependencyType === "blocking");

  let text = "Decisions leadership must approve, assign, fund, or prioritise:\n\n";

  if (critical.length > 0) {
    text += "CRITICAL — Immediate leadership action required:\n\n";
    for (const r of critical) {
      text += `• ${r.title} (${r.domain})\n`;
      if (r.problemStatement) text += `  Problem: ${r.problemStatement}\n`;
      if (r.suggestedOwner) text += `  Assign to: ${r.suggestedOwner}\n`;
      text += "\n";
    }
  }

  if (high.length > 0) {
    text += "HIGH PRIORITY — Approve and assign within 30–60 days:\n\n";
    for (const r of high) {
      text += `• ${r.title} (${r.domain})\n`;
      if (r.suggestedOwner) text += `  Assign to: ${r.suggestedOwner}\n`;
      text += "\n";
    }
  }

  if (blocking.length > 0) {
    text += `SEQUENCING — ${blocking.length} blocking dependency relationship${blocking.length !== 1 ? "s" : ""} require sequencing decisions. Review the Dependencies section before assigning owners or start dates.\n\n`;
  }

  if (critical.length === 0 && high.length === 0) {
    text += "No critical or high-priority decisions are outstanding. All initiatives are at Important or lower priority — proceed with 90-day plan implementation.\n";
  }

  return text.trim();
}

// ─── Main assembly function ───────────────────────────────────────

export function assembleBlueprint(input: AssemblyInput): AssemblyResult {
  const errors: string[] = [];
  const gs = parseGeneratedSections(input.assessment.generatedSections);
  const recs = [...input.recommendations].sort((a, b) => a.rank - b.rank);

  // ── Assign roadmap periods ─────────────────────────────────
  const prereqIds = findPrereqIdsFor30Day(recs, input.dependencies);

  const initiatives: AssembledInitiative[] = recs.map((rec, idx) => {
    const { period, reason } = assignRoadmapPeriod(rec, prereqIds);
    return {
      sourceRecommendationId: rec.id,
      title: rec.title,
      summary: rec.problemStatement ?? null,
      domain: rec.domain,
      priorityClassification: rec.priorityClassification,
      effortLevel: rec.effort ?? null,
      roadmapPeriod: period,
      roadmapReason: reason,
      sequenceOrder: idx + 1,
      ownerPlaceholder: rec.suggestedOwner ?? null,
      targetPeriodLabel: null,
      expectedBusinessImpact: rec.whyItMatters ?? null,
    };
  });

  // ── Build sections ─────────────────────────────────────────
  const sections: AssembledSection[] = [];

  const sectionBuilders: Record<SectionKey, () => string> = {
    executive_summary:        () => buildExecutiveSummary(input, initiatives, gs),
    current_business_state:   () => buildCurrentBusinessState(input, gs),
    key_strengths:            () => buildKeyStrengths(input, gs),
    critical_vulnerabilities: () => buildCriticalVulnerabilities(input, gs),
    primary_risks:            () => buildPrimaryRisks(input, gs, input.dependencies),
    immediate_quick_wins:     () => buildImmediateQuickWins(input, gs, initiatives),
    strategic_priorities:     () => buildStrategicPriorities(input, gs, recs),
    action_plan_30_days:      () => buildActionPlan("30_days", initiatives, recs, input.actions, input.dependencies),
    action_plan_60_days:      () => buildActionPlan("60_days", initiatives, recs, input.actions, input.dependencies),
    action_plan_90_days:      () => buildActionPlan("90_days", initiatives, recs, input.actions, input.dependencies),
    longer_term_roadmap:      () => buildLongerTermRoadmap(initiatives, recs),
    business_impact:          () => buildBusinessImpact(input, recs),
    success_metrics:          () => buildSuccessMetrics(recs, input.actions),
    dependencies_constraints: () => buildDependenciesConstraints(input, recs, input.dependencies),
    consultant_guidance:      () => buildConsultantGuidance(input),
    executive_decision_summary: () => buildExecutiveDecisionSummary(recs, input.dependencies),
  };

  for (const def of SECTION_DEFINITIONS) {
    try {
      const builder = sectionBuilders[def.key as SectionKey];
      const content = builder();
      sections.push({
        sectionKey: def.key as SectionKey,
        title: def.title,
        sectionOrder: def.order,
        generatedContent: content,
        sourceReferences: {
          assessment: [input.assessment.id],
          plan: [input.plan.id],
        },
      });
    } catch (err) {
      errors.push(`Section ${def.key} failed: ${String(err)}`);
      sections.push({
        sectionKey: def.key as SectionKey,
        title: def.title,
        sectionOrder: def.order,
        generatedContent: `[Generation error: ${String(err)}]`,
        sourceReferences: {},
      });
    }
  }

  const initiativesByPeriod: Record<RoadmapPeriod, number> = {
    "30_days": 0,
    "60_days": 0,
    "90_days": 0,
    "longer_term": 0,
  };
  for (const init of initiatives) {
    initiativesByPeriod[init.roadmapPeriod]++;
  }

  return {
    sections,
    initiatives,
    summary: {
      sectionCount: sections.length,
      initiativeCount: initiatives.length,
      initiativesByPeriod,
      errors,
    },
  };
}
