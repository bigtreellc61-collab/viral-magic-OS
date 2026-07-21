/**
 * Tests for the Blueprint Assembly Engine.
 *
 * Covers:
 *   - Section generation (all 16 sections created, correct keys/order)
 *   - Initiative creation (snapshots, no duplicates)
 *   - Roadmap assignment rules (quick win, effort/priority, prereq promotion)
 *   - Determinism (same input → same output)
 *   - Edge cases (no recs, no actions, single rec)
 *   - Summary metrics
 */
import { describe, it, expect } from "vitest";
import { assembleBlueprint, SECTION_DEFINITIONS } from "./blueprint-assembly-engine";

// ─── Fixtures ─────────────────────────────────────────────────────

// GeneratedSections shape from growth-assessment-engine
const baseGeneratedSections = {
  strengths: [
    { categoryLabel: "Strong brand recognition", currentPerformance: 8, whyStrength: "Long-established market presence.", howToProtect: "Invest in brand campaigns." },
    { categoryLabel: "Loyal customer base", currentPerformance: 7, whyStrength: "High NPS score.", howToProtect: "CRM and loyalty programmes." },
  ],
  vulnerabilities: [
    { categoryLabel: "Weak online presence", currentPerformance: 3, priorityScore: 85, whatItMeans: "Missing digital demand." },
    { categoryLabel: "No CRM system", currentPerformance: 2, priorityScore: 92, whatItMeans: "Data is siloed." },
  ],
  risks: [
    { categoryLabel: "Market saturation risk", impactScore: 70, description: "Competitors expanding." },
  ],
  quickWins: [
    { title: "Set up Google Analytics", effort: "low", impact: "high" },
    { title: "Create email list", effort: "low", impact: "medium" },
  ],
  strategicPriorities: [
    { priority: "Digital transformation" },
    { priority: "Customer retention" },
  ],
  growthOpportunities: [
    { title: "E-commerce expansion", impactScore: 80 },
  ],
  healthExplanation: "Overall the business is healthy with some operational gaps.",
};

const baseAssessment = {
  id: "assess-1",
  healthScore: "72",
  healthRating: "good",
  status: "approved",
  strengthSummary: null,
  systemStrengthSummary: null,
  vulnerabilitySummary: null,
  systemVulnerabilitySummary: null,
  riskSummary: null,
  systemRiskSummary: null,
  growthOpportunitySummary: null,
  systemGrowthOpportunitySummary: null,
  quickWinSummary: null,
  systemQuickWinSummary: null,
  strategicFocusSummary: null,
  systemStrategicFocusSummary: null,
  consultantNotes: null,
  generatedSections: baseGeneratedSections,
};

const basePlan = {
  id: "plan-1",
  status: "approved",
  executiveRecommendation: "Prioritise digital channels and CRM adoption for growth.",
  systemExecutiveRecommendation: null,
  overallPriorityScore: "85",
  businessImpactSummary: "Implementing these recommendations could yield 30% revenue uplift.",
  systemBusinessImpactSummary: null,
  dependencySummary: "CRM setup is a prerequisite for automation workflows.",
  systemDependencySummary: null,
  consultantNotes: null,
};

function makeRec(overrides: Record<string, any> = {}) {
  // NOTE: ...overrides last so caller controls all fields including id.
  // Pass a full id like { id: "rec-A" } — no auto-prefixing.
  return {
    id: "rec-1",
    planId: "plan-1",
    title: "Implement CRM System",
    domain: "Operations",
    priorityClassification: "Critical Priority",
    effort: "moderate",
    timeframe: "30_days",
    quickWinFlag: false,
    rank: 1,
    problemStatement: "Current processes are manual.",
    whyItMatters: "Automation will free up 10h/week.",
    suggestedOwner: "Operations Lead",
    businessImpactScore: "75",
    recommendedOutcome: null,
    successMetric: null,
    ...overrides,
  };
}

function makeDep(fromRecId: string, toRecId: string, overrides: Record<string, any> = {}) {
  return {
    id: `dep-${fromRecId}-${toRecId}`,
    planId: "plan-1",
    // In the engine: recommendationId = "the one that depends", dependsOnRecommendationId = "the prerequisite"
    // findPrereqIdsFor30Day: blocking dep where dep.recommendationId is in 30-day set → dep.dependsOnRecommendationId is prereq
    recommendationId: fromRecId,
    dependsOnRecommendationId: toRecId,
    dependencyType: overrides.dependencyType ?? "blocking",
    notes: overrides.notes ?? null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("assembleBlueprint", () => {
  const baseInput = {
    blueprint: { id: "bp-1", title: "Test Blueprint", consultantNotes: null },
    assessment: baseAssessment,
    plan: basePlan,
    recommendations: [makeRec()],
    actions: [],
    dependencies: [],
  };

  // ── Section generation ──────────────────────────────────────

  it("generates exactly 16 sections", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.sections).toHaveLength(16);
  });

  it("all 16 section definitions are present in output", () => {
    const result = assembleBlueprint(baseInput);
    const outputKeys = result.sections.map((s) => s.sectionKey);
    const expectedKeys = SECTION_DEFINITIONS.map((d) => d.key);
    expect(outputKeys).toEqual(expectedKeys);
  });

  it("sections are ordered correctly (sectionOrder 1–16)", () => {
    const result = assembleBlueprint(baseInput);
    const orders = result.sections.map((s) => s.sectionOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("each section has a non-empty title", () => {
    const result = assembleBlueprint(baseInput);
    result.sections.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(0);
    });
  });

  it("each section has a non-empty generatedContent", () => {
    const result = assembleBlueprint(baseInput);
    result.sections.forEach((s) => {
      expect(typeof s.generatedContent).toBe("string");
      expect(s.generatedContent.length).toBeGreaterThan(0);
    });
  });

  it("executive_summary section references health score", () => {
    const result = assembleBlueprint(baseInput);
    const exec = result.sections.find((s) => s.sectionKey === "executive_summary");
    expect(exec).toBeDefined();
    expect(exec!.generatedContent).toMatch(/72|good/i);
  });

  it("key_strengths section references assessment strength category labels", () => {
    const result = assembleBlueprint(baseInput);
    const s = result.sections.find((s) => s.sectionKey === "key_strengths");
    expect(s).toBeDefined();
    expect(s!.generatedContent).toMatch(/Strong brand recognition|Loyal customer base/i);
  });

  it("critical_vulnerabilities section references assessment vulnerability category labels", () => {
    const result = assembleBlueprint(baseInput);
    const s = result.sections.find((s) => s.sectionKey === "critical_vulnerabilities");
    expect(s).toBeDefined();
    expect(s!.generatedContent).toMatch(/Weak online presence|No CRM system/i);
  });

  it("strategic_priorities section has content", () => {
    const result = assembleBlueprint(baseInput);
    const s = result.sections.find((s) => s.sectionKey === "strategic_priorities");
    expect(s).toBeDefined();
    expect(s!.generatedContent.length).toBeGreaterThan(10);
  });

  it("success_metrics section is generated", () => {
    const result = assembleBlueprint(baseInput);
    const s = result.sections.find((s) => s.sectionKey === "success_metrics");
    expect(s).toBeDefined();
    expect(s!.generatedContent.length).toBeGreaterThan(0);
  });

  // ── Initiative creation ─────────────────────────────────────

  it("creates one initiative per recommendation (no duplicates)", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "rec-1", rank: 1 }), makeRec({ id: "rec-2", title: "Set up Email", rank: 2 })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives).toHaveLength(2);
    const ids = result.initiatives.map((i) => i.sourceRecommendationId);
    expect(new Set(ids).size).toBe(2);
  });

  it("initiative snapshots the title from the recommendation", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.initiatives[0].title).toBe("Implement CRM System");
  });

  it("initiative snapshots the domain", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.initiatives[0].domain).toBe("Operations");
  });

  it("initiative snapshots the priorityClassification", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.initiatives[0].priorityClassification).toBe("Critical Priority");
  });

  it("initiative snapshots the effortLevel", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.initiatives[0].effortLevel).toBe("moderate");
  });

  it("initiative has a sequenceOrder starting at 1", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.initiatives[0].sequenceOrder).toBe(1);
  });

  it("initiative has a valid roadmapPeriod", () => {
    const result = assembleBlueprint(baseInput);
    const valid = ["30_days", "60_days", "90_days", "longer_term"];
    expect(valid).toContain(result.initiatives[0].roadmapPeriod);
  });

  // ── Roadmap assignment rules ────────────────────────────────

  it("quickWinFlag → 30_days regardless of other fields", () => {
    const input = {
      ...baseInput,
      recommendations: [
        makeRec({ id: "1", quickWinFlag: true, priorityClassification: "Monitor", effort: "major_initiative", timeframe: "strategic_90_plus_days" }),
      ],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("immediate timeframe → 30_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: "immediate", priorityClassification: "Important" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("7_days timeframe → 30_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: "7_days", priorityClassification: "Important" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("30_days timeframe → 30_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", timeframe: "30_days", priorityClassification: "Important" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("critical priority + low effort → 30_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Critical Priority", effort: "low" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("critical priority + moderate effort → 30_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Critical Priority", effort: "moderate" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("30_days");
  });

  it("critical priority + high effort → 60_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Critical Priority", effort: "high" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("60_days");
  });

  it("critical priority + major_initiative effort → 60_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Critical Priority", effort: "major_initiative" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("60_days");
  });

  it("high priority + 60_90_days timeframe → 60_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: "60_90_days", priorityClassification: "High Priority", effort: "low" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("60_days");
  });

  it("important priority with null timeframe → 90_days", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Important", effort: "moderate" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("90_days");
  });

  it("strategic_90_plus_days timeframe → longer_term", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: "strategic_90_plus_days", priorityClassification: "Important" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("longer_term");
  });

  it("Monitor priority → longer_term by default", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: false, timeframe: null, priorityClassification: "Monitor" })],
    };
    const result = assembleBlueprint(input);
    expect(result.initiatives[0].roadmapPeriod).toBe("longer_term");
  });

  // ── Prerequisite promotion ──────────────────────────────────
  //
  // findPrereqIdsFor30Day logic:
  //   dep.recommendationId = the dep that needs something done first
  //   dep.dependsOnRecommendationId = the prerequisite
  //   When dep.recommendationId is in the provisional 30-day set,
  //   dep.dependsOnRecommendationId gets promoted to 30 days.

  it("promotes a prerequisite rec to 30_days when it would be longer_term but blocks a 30_days rec", () => {
    // recA (Monitor → longer_term by default) is a prereq FOR recB (Critical+low → 30_days)
    // Engine: dep.recommendationId = "bp-b" (the one that has the dependency)
    //         dep.dependsOnRecommendationId = "bp-a" (the prerequisite to promote)
    const recA = makeRec({ id: "bp-a", title: "Rec A (Monitor)", priorityClassification: "Monitor", effort: null, timeframe: null, quickWinFlag: false, rank: 1 });
    const recB = makeRec({ id: "bp-b", title: "Rec B (Critical)", priorityClassification: "Critical Priority", effort: "low", timeframe: null, quickWinFlag: false, rank: 2 });
    const input = {
      ...baseInput,
      recommendations: [recA, recB],
      // recB depends on recA → recA is the prereq
      dependencies: [makeDep("bp-b", "bp-a")],
    };
    const result = assembleBlueprint(input);
    const initA = result.initiatives.find((i) => i.sourceRecommendationId === "bp-a");
    const initB = result.initiatives.find((i) => i.sourceRecommendationId === "bp-b");
    expect(initB!.roadmapPeriod).toBe("30_days");
    expect(initA!.roadmapPeriod).toBe("30_days");
    expect(initA!.roadmapReason).toMatch(/prerequisite|required/i);
  });

  it("does not double-promote prereqs that are already 30_days on their own merits", () => {
    const recA = makeRec({ id: "bp-a", priorityClassification: "Critical Priority", effort: "low", timeframe: null, quickWinFlag: false, rank: 1 });
    const recB = makeRec({ id: "bp-b", priorityClassification: "Critical Priority", effort: "low", timeframe: null, quickWinFlag: false, rank: 2 });
    const input = {
      ...baseInput,
      recommendations: [recA, recB],
      dependencies: [makeDep("bp-b", "bp-a")], // recA is prereq for recB
    };
    const result = assembleBlueprint(input);
    const initA = result.initiatives.find((i) => i.sourceRecommendationId === "bp-a");
    // recA is already 30_days by Critical+low — should still be 30_days
    expect(initA!.roadmapPeriod).toBe("30_days");
  });

  // ── Determinism ─────────────────────────────────────────────

  it("produces identical output for identical input (deterministic)", () => {
    const result1 = assembleBlueprint(baseInput);
    const result2 = assembleBlueprint(baseInput);
    expect(result1.sections.map((s) => s.sectionKey)).toEqual(result2.sections.map((s) => s.sectionKey));
    expect(result1.initiatives.map((i) => i.roadmapPeriod)).toEqual(result2.initiatives.map((i) => i.roadmapPeriod));
    expect(result1.summary.sectionCount).toEqual(result2.summary.sectionCount);
    expect(result1.summary.initiativeCount).toEqual(result2.summary.initiativeCount);
  });

  // ── Summary metrics ─────────────────────────────────────────

  it("summary.sectionCount equals 16", () => {
    const result = assembleBlueprint(baseInput);
    expect(result.summary.sectionCount).toBe(16);
  });

  it("summary.initiativeCount equals recommendation count", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", rank: 1 }), makeRec({ id: "2", rank: 2 })],
    };
    const result = assembleBlueprint(input);
    expect(result.summary.initiativeCount).toBe(2);
  });

  it("summary.initiativesByPeriod values add up to initiativeCount", () => {
    const input = {
      ...baseInput,
      recommendations: [
        makeRec({ id: "1", quickWinFlag: true, rank: 1 }),
        makeRec({ id: "2", priorityClassification: "Monitor", timeframe: null, quickWinFlag: false, rank: 2 }),
      ],
    };
    const result = assembleBlueprint(input);
    const total = Object.values(result.summary.initiativesByPeriod).reduce((a, b) => a + b, 0);
    expect(total).toBe(result.summary.initiativeCount);
  });

  // ── Edge cases ──────────────────────────────────────────────

  it("works with no recommendations — sections still generated", () => {
    const input = { ...baseInput, recommendations: [], actions: [], dependencies: [] };
    const result = assembleBlueprint(input);
    expect(result.sections).toHaveLength(16);
    expect(result.initiatives).toHaveLength(0);
  });

  it("works with null generatedSections on assessment", () => {
    const input = {
      ...baseInput,
      assessment: { ...baseAssessment, generatedSections: null },
    };
    const result = assembleBlueprint(input);
    expect(result.sections).toHaveLength(16);
  });

  it("longer_term_roadmap section is generated even when no longer_term initiatives exist", () => {
    const input = {
      ...baseInput,
      recommendations: [makeRec({ id: "1", quickWinFlag: true, rank: 1 })],
    };
    const result = assembleBlueprint(input);
    const s = result.sections.find((s) => s.sectionKey === "longer_term_roadmap");
    expect(s).toBeDefined();
    expect(s!.generatedContent.length).toBeGreaterThan(0);
  });

  it("sourceReferences includes assessment and plan array references", () => {
    const result = assembleBlueprint(baseInput);
    const exec = result.sections.find((s) => s.sectionKey === "executive_summary");
    expect(exec!.sourceReferences).toMatchObject({
      assessment: ["assess-1"],
      plan: ["plan-1"],
    });
  });

  it("summary.errors is an array (empty on success)", () => {
    const result = assembleBlueprint(baseInput);
    expect(Array.isArray(result.summary.errors)).toBe(true);
  });
});
