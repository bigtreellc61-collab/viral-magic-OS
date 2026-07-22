/**
 * Shared Blueprint data model for all export builders.
 *
 * `fetchBlueprintForExport` fetches everything a report needs in one place
 * so the PDF, DOCX, and PPTX builders all consume the same typed structure.
 */

import { asc, eq } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  growthBlueprintSectionsTable,
  growthBlueprintInitiativesTable,
  clientsTable,
  projectsTable,
  growthAssessmentsTable,
  solutionRecommendationPlansTable,
} from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────

export interface BlueprintSection {
  id: string;
  sectionKey: string;
  title: string;
  sectionOrder: number;
  /** Resolved display content: consultantContent if set, else generatedContent */
  content: string;
  hasOverride: boolean;
}

export interface BlueprintInitiative {
  id: string;
  title: string;
  domain: string;
  priorityClassification: string;
  effortLevel: string | null;
  roadmapPeriod: string;
  roadmapReason: string | null;
  ownerPlaceholder: string | null;
  expectedBusinessImpact: string | null;
  consultantGuidance: string | null;
  sequenceOrder: number;
  isQuickWin: boolean;
}

export interface BlueprintExportModel {
  id: string;
  title: string;
  status: string;
  version: number;
  revisionNumber: number;
  versionLabel: string;
  generationStatus: string | null;
  generatedAt: Date | null;
  approvedAt: Date | null;
  archivedAt: Date | null;
  consultantNotes: string | null;

  clientId: string;
  clientName: string;
  projectName: string | null;

  assessmentHealthScore: number | null;
  assessmentHealthRating: string | null;

  planStatus: string | null;

  growthAssessmentId: string;
  solutionRecommendationPlanId: string;

  sections: BlueprintSection[];
  /** All initiatives, pre-sorted by sequenceOrder */
  initiatives: BlueprintInitiative[];
  /** Initiatives grouped by roadmap period */
  byPeriod: {
    "30_days": BlueprintInitiative[];
    "60_days": BlueprintInitiative[];
    "90_days": BlueprintInitiative[];
    longer_term: BlueprintInitiative[];
  };
}

// ─── Section key groupings matching the presentation layer ────────

export const SECTION_GROUPS = {
  executive: ["executive_summary", "immediate_quick_wins"],
  health: ["current_business_state", "key_strengths", "critical_vulnerabilities", "primary_risks"],
  strategic: ["strategic_priorities"],
  roadmap: ["action_plan_30_days", "action_plan_60_days", "action_plan_90_days", "longer_term_roadmap"],
  impact: ["business_impact"],
  kpis: ["success_metrics"],
  dependencies: ["dependencies_constraints"],
  consultant: ["consultant_guidance"],
  decisions: ["executive_decision_summary"],
} as const;

// ─── Fetch ────────────────────────────────────────────────────────

export async function fetchBlueprintForExport(
  id: string,
): Promise<BlueprintExportModel | null> {
  const [row] = await db
    .select({
      id: growthBlueprintsTable.id,
      title: growthBlueprintsTable.title,
      status: growthBlueprintsTable.status,
      version: growthBlueprintsTable.version,
      revisionNumber: growthBlueprintsTable.revisionNumber,
      generationStatus: growthBlueprintsTable.generationStatus,
      generatedAt: growthBlueprintsTable.generatedAt,
      approvedAt: growthBlueprintsTable.approvedAt,
      archivedAt: growthBlueprintsTable.archivedAt,
      consultantNotes: growthBlueprintsTable.consultantNotes,
      clientId: growthBlueprintsTable.clientId,
      growthAssessmentId: growthBlueprintsTable.growthAssessmentId,
      solutionRecommendationPlanId:
        growthBlueprintsTable.solutionRecommendationPlanId,
      clientName: clientsTable.companyName,
      projectName: projectsTable.projectName,
    })
    .from(growthBlueprintsTable)
    .leftJoin(clientsTable, eq(growthBlueprintsTable.clientId, clientsTable.id))
    .leftJoin(
      projectsTable,
      eq(growthBlueprintsTable.projectId, projectsTable.id),
    )
    .where(eq(growthBlueprintsTable.id, id))
    .limit(1);

  if (!row) return null;

  const [assessment] = await db
    .select({
      healthScore: growthAssessmentsTable.healthScore,
      healthRating: growthAssessmentsTable.healthRating,
    })
    .from(growthAssessmentsTable)
    .where(eq(growthAssessmentsTable.id, row.growthAssessmentId))
    .limit(1);

  const [plan] = await db
    .select({ status: solutionRecommendationPlansTable.status })
    .from(solutionRecommendationPlansTable)
    .where(
      eq(
        solutionRecommendationPlansTable.id,
        row.solutionRecommendationPlanId,
      ),
    )
    .limit(1);

  const rawSections = await db
    .select()
    .from(growthBlueprintSectionsTable)
    .where(eq(growthBlueprintSectionsTable.blueprintId, id))
    .orderBy(asc(growthBlueprintSectionsTable.sectionOrder));

  const rawInitiatives = await db
    .select()
    .from(growthBlueprintInitiativesTable)
    .where(eq(growthBlueprintInitiativesTable.blueprintId, id))
    .orderBy(asc(growthBlueprintInitiativesTable.sequenceOrder));

  const sections: BlueprintSection[] = rawSections.map((s) => ({
    id: s.id,
    sectionKey: s.sectionKey,
    title: s.title,
    sectionOrder: s.sectionOrder,
    content:
      (s.consultantContent?.trim() || s.generatedContent?.trim() || ""),
    hasOverride: Boolean(s.consultantContent?.trim()),
  }));

  const initiatives: BlueprintInitiative[] = rawInitiatives.map((i) => ({
    id: i.id,
    title: i.title,
    domain: i.domain,
    priorityClassification: i.priorityClassification,
    effortLevel: i.effortLevel ?? null,
    roadmapPeriod: i.roadmapPeriod,
    roadmapReason: i.roadmapReason ?? null,
    ownerPlaceholder: i.ownerPlaceholder ?? null,
    expectedBusinessImpact: i.expectedBusinessImpact ?? null,
    consultantGuidance: i.consultantGuidance ?? null,
    sequenceOrder: i.sequenceOrder,
    isQuickWin: Boolean(
      i.roadmapReason?.toLowerCase().includes("quick win"),
    ),
  }));

  const byPeriod = {
    "30_days": initiatives.filter((i) => i.roadmapPeriod === "30_days"),
    "60_days": initiatives.filter((i) => i.roadmapPeriod === "60_days"),
    "90_days": initiatives.filter((i) => i.roadmapPeriod === "90_days"),
    longer_term: initiatives.filter((i) => i.roadmapPeriod === "longer_term"),
  };

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    version: row.version,
    revisionNumber: row.revisionNumber,
    versionLabel: `Version ${row.version}.${row.revisionNumber}`,
    generationStatus: row.generationStatus,
    generatedAt: row.generatedAt,
    approvedAt: row.approvedAt,
    archivedAt: row.archivedAt,
    consultantNotes: row.consultantNotes,
    clientId: row.clientId,
    clientName: row.clientName ?? "Unknown Client",
    projectName: row.projectName ?? null,
    assessmentHealthScore: assessment?.healthScore
      ? Number(assessment.healthScore)
      : null,
    assessmentHealthRating: assessment?.healthRating ?? null,
    planStatus: plan?.status ?? null,
    growthAssessmentId: row.growthAssessmentId,
    solutionRecommendationPlanId: row.solutionRecommendationPlanId,
    sections,
    initiatives,
    byPeriod,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

export function getSectionsByKeys(
  sections: BlueprintSection[],
  keys: readonly string[],
): BlueprintSection[] {
  return sections.filter((s) => keys.includes(s.sectionKey));
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}
