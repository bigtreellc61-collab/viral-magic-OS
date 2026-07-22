/**
 * Executive One-Page Summary model.
 *
 * Builds a deterministic, AI-free CEO snapshot from an existing
 * BlueprintExportModel. Consumed by the PDF, DOCX, and PPTX builders.
 */

import type { BlueprintExportModel } from "./blueprint-model";

// ─── Types ────────────────────────────────────────────────────────

export interface ExecutiveSummary {
  client: string;
  project: string | null;
  blueprintVersion: string;
  /** Date the blueprint was generated (formatted). */
  assessmentDate: string;
  /** Date the report was prepared (today, formatted). */
  preparedDate: string;
  healthScore: number | null;
  healthRating: string | null;
  /** Traffic-light indicator derived from score and/or rating. */
  healthIndicator: "green" | "yellow" | "red" | null;
  /** Up to 3 revenue risk items extracted from primary_risks section. */
  topRevenueRisks: string[];
  /** Up to 3 growth opportunities from key_strengths / strategic_priorities. */
  topGrowthOpportunities: string[];
  /** Up to 5 quick-win titles from the 30-day period. */
  quickWins: string[];
  roadmapSummary: Record<"30_days" | "60_days" | "90_days" | "longer_term", number>;
  /** First paragraph of the business_impact section. */
  expectedBusinessImpact: string;
  /** Template-driven recommendation based on healthRating — no AI. */
  executiveRecommendation: string;
  /** Up to 3 next steps from executive_decision_summary or 30-day initiatives. */
  recommendedNextSteps: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────

function deriveIndicator(
  score: number | null,
  rating: string | null,
): "green" | "yellow" | "red" | null {
  if (score !== null) {
    if (score >= 75) return "green";
    if (score >= 55) return "yellow";
    return "red";
  }
  if (!rating) return null;
  if (rating === "strong" || rating === "stable") return "green";
  if (rating === "vulnerable") return "yellow";
  return "red";
}

/** Extract up to `max` items from section text — prefers bullet lines. */
export function extractItems(text: string, max: number): string[] {
  if (!text.trim()) return [];
  const bulletLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•]|^\d+[.)]\s/.test(l))
    .map((l) => l.replace(/^[-*•]\s*|^\d+[.)]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
  if (bulletLines.length > 0) return bulletLines;
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

// ─── Deterministic recommendation templates ───────────────────────

const RECOMMENDATION_TEMPLATES: Record<string, string> = {
  strong:
    "This business demonstrates strong foundational health with significant growth potential. We recommend accelerating the identified strategic opportunities to capture market advantage and drive sustained revenue expansion.",
  stable:
    "This business is operating from a stable base with clear opportunities to strengthen performance. We recommend a focused implementation of the identified priorities to drive measurable, sustainable revenue growth.",
  vulnerable:
    "This business shows signs of vulnerability that require prompt attention. We recommend immediate action on the identified critical priorities to stabilize operations and restore growth momentum within 90 days.",
  at_risk:
    "This business faces significant risks that demand urgent executive action. We recommend activating the high-priority initiatives immediately and establishing weekly accountability checkpoints to track measurable progress.",
  critical:
    "This business is at a critical juncture requiring decisive intervention. We recommend an emergency response focused exclusively on the most critical priorities to stabilize performance within 30 days.",
};

const DEFAULT_RECOMMENDATION =
  "Based on the growth assessment findings, we recommend executing the identified strategic plan with focused leadership attention and accountability structures to achieve the projected business outcomes.";

// ─── Main builder ─────────────────────────────────────────────────

export function buildExecutiveSummary(
  blueprint: BlueprintExportModel,
  preparedDate: string,
): ExecutiveSummary {
  const sectionContent = (key: string): string =>
    blueprint.sections.find((s) => s.sectionKey === key)?.content ?? "";

  const indicator = deriveIndicator(
    blueprint.assessmentHealthScore,
    blueprint.assessmentHealthRating,
  );

  // Top revenue risks — primary_risks bullets first, then Critical initiatives
  const risksText = sectionContent("primary_risks");
  let topRevenueRisks = extractItems(risksText, 3);
  if (topRevenueRisks.length === 0) {
    topRevenueRisks = blueprint.initiatives
      .filter((i) => i.priorityClassification === "Critical Priority")
      .slice(0, 3)
      .map((i) => i.title);
  }

  // Top growth opportunities — key_strengths, then strategic_priorities, then High/Important
  const strengthsText = sectionContent("key_strengths");
  let topGrowthOpportunities = extractItems(strengthsText, 3);
  if (topGrowthOpportunities.length === 0) {
    topGrowthOpportunities = extractItems(sectionContent("strategic_priorities"), 3);
  }
  if (topGrowthOpportunities.length === 0) {
    topGrowthOpportunities = blueprint.initiatives
      .filter(
        (i) =>
          i.priorityClassification === "High Priority" ||
          i.priorityClassification === "Important",
      )
      .slice(0, 3)
      .map((i) => i.title);
  }

  // 30-day quick wins
  const thirtyDayQuickWins = blueprint.byPeriod["30_days"]
    .filter((i) => i.isQuickWin)
    .slice(0, 5)
    .map((i) => i.title);
  const quickWins =
    thirtyDayQuickWins.length > 0
      ? thirtyDayQuickWins
      : blueprint.byPeriod["30_days"].slice(0, 3).map((i) => i.title);

  // Roadmap counts
  const roadmapSummary = {
    "30_days": blueprint.byPeriod["30_days"].length,
    "60_days": blueprint.byPeriod["60_days"].length,
    "90_days": blueprint.byPeriod["90_days"].length,
    longer_term: blueprint.byPeriod.longer_term.length,
  };

  // Expected business impact — first paragraph only
  const impactText = sectionContent("business_impact");
  const expectedBusinessImpact =
    impactText.split(/\n{2,}/)[0]?.replace(/\n/g, " ").trim() ?? "";

  // Executive recommendation — deterministic template
  const rating = blueprint.assessmentHealthRating ?? "";
  const executiveRecommendation =
    RECOMMENDATION_TEMPLATES[rating] ?? DEFAULT_RECOMMENDATION;

  // Recommended next steps — decisions section bullets, else top 30-day
  const decisionsText = sectionContent("executive_decision_summary");
  let recommendedNextSteps = extractItems(decisionsText, 3);
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps = blueprint.byPeriod["30_days"]
      .slice(0, 3)
      .map((i) => i.title);
  }

  return {
    client: blueprint.clientName,
    project: blueprint.projectName,
    blueprintVersion: blueprint.versionLabel,
    assessmentDate: blueprint.generatedAt
      ? new Date(blueprint.generatedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    preparedDate,
    healthScore: blueprint.assessmentHealthScore,
    healthRating: blueprint.assessmentHealthRating,
    healthIndicator: indicator,
    topRevenueRisks,
    topGrowthOpportunities,
    quickWins,
    roadmapSummary,
    expectedBusinessImpact,
    executiveRecommendation,
    recommendedNextSteps,
  };
}
