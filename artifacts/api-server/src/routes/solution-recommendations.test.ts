/**
 * Integration tests for the solution-recommendation plan lifecycle.
 *
 * Tests use a mocked @workspace/db so no live database is required.
 * Each test exercises a specific lifecycle transition and verifies:
 *   - the correct HTTP status code
 *   - the plan status in the response body (where applicable)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ─── Mock @workspace/db before any routes import it ──────────────────────────
// vi.mock is hoisted by vitest so this runs before the import block below.
// vi.hoisted() is also hoisted, making mockDb available inside vi.mock factories.

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  // Tables are used only as query-builder arguments; empty objects suffice.
  solutionRecommendationPlansTable: {},
  solutionRecommendationsTable: {},
  solutionRecommendationActionsTable: {},
  solutionRecommendationDependenciesTable: {},
  activityRecordsTable: {},
  growthAssessmentsTable: {},
  diagnosticScoresTable: {},
  diagnosticsTable: {},
  clientsTable: {},
  projectsTable: {},
  usersTable: {},
  rolesTable: {},
  pool: { query: vi.fn() },
}));

// ─── Mock auth middleware so tests don't need a real session ──────────────────
vi.mock("../middlewares/authMiddleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    (req as any).user = { id: "test-user-id" };
    next();
  },
}));

// ─── Mock activity logger (hits DB; not under test here) ─────────────────────
vi.mock("../lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock recommendation engine (pure function; not under test here) ──────────
vi.mock("../lib/solution-recommendation-engine", () => ({
  generateRecommendationPlan: vi.fn(() => ({
    recommendations: [
      {
        sourceCategoryKey: "marketing",
        sourceAssessmentData: {},
        rank: 1,
        title: "Improve Marketing",
        domain: "marketing",
        problemStatement: "Low reach",
        whyItMatters: "Revenue depends on it",
        recommendedOutcome: "2x leads",
        priorityScore: 85,
        priorityClassification: "critical",
        severityScore: 80,
        businessImpactScore: 90,
        urgencyScore: 85,
        performanceGapScore: 70,
        quickWinBonus: 5,
        dependencyBonus: 0,
        effortPenalty: 0,
        quickWinFlag: false,
        effort: "medium",
        confidence: 80,
        timeframe: "30-60 days",
        suggestedOwner: "Marketing Lead",
        successMetric: "Lead volume doubles in 60 days",
        dependencyNotes: null,
        scoringExplanation: {},
        dependencyRules: [],
        actions: [
          {
            title: "Run campaign",
            description: "A/B test ads",
            timeHorizon: "30 days",
            suggestedOwner: "Marketing Lead",
            expectedOutcome: "More leads",
            successMetric: "2x leads",
            sortOrder: 1,
          },
        ],
      },
    ],
    overallPriorityScore: 85,
    executiveRecommendation: "Focus on marketing",
    businessImpactSummary: { summary: "High impact" },
    dependencySummary: "None",
    engineVersion: "1.0.0",
  })),
}));

// ─── Mock diagnostics calc ────────────────────────────────────────────────────
vi.mock("../lib/diagnostics-calc", () => ({
  getHealthRating: vi.fn(() => "fair"),
}));

// ─── Import the router AFTER all mocks are set up ────────────────────────────
import solutionRecommendationsRouter from "./solution-recommendations";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a chainable Drizzle-like proxy that resolves to `result` at any
 * point in the method chain (e.g., .from().where().limit() or .set().where().returning()).
 */
function makeChain(result: unknown): any {
  const p = Promise.resolve(result);
  return new Proxy(p as any, {
    get(target: any, prop: string) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return target[prop].bind(target);
      }
      return (..._args: unknown[]) => makeChain(result);
    },
  });
}

/** Builds a minimal Express app with the router mounted under /api */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", solutionRecommendationsRouter);
  return app;
}

const app = buildApp();

/** A plan fixture in a given status */
function makePlan(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-001",
    growthAssessmentId: "assessment-001",
    diagnosticId: "diag-001",
    diagnosticVersionId: "diagv-001",
    clientId: "client-001",
    projectId: "project-001",
    status,
    overallPriorityScore: "85",
    systemExecutiveRecommendation: "Focus on marketing",
    executiveRecommendation: "Focus on marketing",
    systemBusinessImpactSummary: "{}",
    businessImpactSummary: "{}",
    systemDependencySummary: "None",
    dependencySummary: "None",
    consultantNotes: null,
    recommendationEngineVersion: "1.0.0",
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    reopenedBy: null,
    reopenedAt: null,
    archivedAt: null,
    createdBy: "test-user-id",
    updatedBy: "test-user-id",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** A recommendation fixture with a successMetric (required for approval) */
function makeRec(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-001",
    planId: "plan-001",
    title: "Improve Marketing",
    successMetric: "Lead volume doubles in 60 days",
    priorityScore: "85",
    ...overrides,
  };
}

// ─── Reset mocks before each test ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT (/api/solution-recommendations/:id/submit)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/:id/submit", () => {
  it("transitions a draft plan to awaiting_review (200)", async () => {
    const plan = makePlan("draft");
    const updated = makePlan("awaiting_review", { reviewedBy: "test-user-id", reviewedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(200);

    expect(res.body.status).toBe("awaiting_review");
  });

  it("transitions a reopened plan to awaiting_review (200)", async () => {
    const plan = makePlan("reopened");
    const updated = makePlan("awaiting_review");

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(200);

    expect(res.body.status).toBe("awaiting_review");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .post("/api/solution-recommendations/missing-id/submit")
      .expect(404);
  });

  it("returns 409 when submitting an already-submitted (awaiting_review) plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(409);

    expect(res.body.error).toMatch(/Only Draft or Reopened/i);
  });

  it("returns 409 when submitting an approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(409);
  });

  it("returns 409 when submitting a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(409);
  });

  it("returns 409 when submitting an archived plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE (/api/solution-recommendations/:id/approve)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/:id/approve", () => {
  it("transitions an awaiting_review plan to approved (200)", async () => {
    const plan = makePlan("awaiting_review");
    const recs = [makeRec()];
    const updated = makePlan("approved", { approvedBy: "test-user-id", approvedAt: new Date().toISOString() });

    // select is called twice: once for the plan, once for recs
    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain(recs));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(200);

    expect(res.body.status).toBe("approved");
    expect(res.body.approvedBy).toBe("test-user-id");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .post("/api/solution-recommendations/missing/approve")
      .expect(404);
  });

  it("returns 409 when approving a draft plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("draft")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);

    expect(res.body.error).toMatch(/Only plans awaiting review/i);
  });

  it("returns 409 when approving an already-approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);
  });

  it("returns 409 when approving a reopened plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("reopened")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);
  });

  it("returns 409 when approving a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);
  });

  it("returns 409 when approving an archived plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);
  });

  it("returns 400 when the plan has no recommendations", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([makePlan("awaiting_review")]))
      .mockReturnValueOnce(makeChain([])); // no recs

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(400);

    expect(res.body.error).toMatch(/at least one recommendation/i);
  });

  it("returns 400 when a recommendation is missing a success metric", async () => {
    const planWithRec = makePlan("awaiting_review");
    const recWithoutMetric = makeRec({ successMetric: null });

    mockDb.select
      .mockReturnValueOnce(makeChain([planWithRec]))
      .mockReturnValueOnce(makeChain([recWithoutMetric]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(400);

    expect(res.body.error).toMatch(/missing a success metric/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REOPEN (/api/solution-recommendations/:id/reopen)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/:id/reopen", () => {
  it("transitions an awaiting_review plan to reopened (200)", async () => {
    const plan = makePlan("awaiting_review");
    const updated = makePlan("reopened", { reopenedBy: "test-user-id", reopenedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(200);

    expect(res.body.status).toBe("reopened");
  });

  it("transitions an approved plan to reopened (200)", async () => {
    const plan = makePlan("approved");
    const updated = makePlan("reopened", { reopenedBy: "test-user-id" });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(200);

    expect(res.body.status).toBe("reopened");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .post("/api/solution-recommendations/missing/reopen")
      .expect(404);
  });

  it("returns 409 when reopening a draft plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("draft")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(409);

    expect(res.body.error).toMatch(/awaiting_review or approved/i);
  });

  it("returns 409 when reopening an already-reopened plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("reopened")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(409);
  });

  it("returns 409 when reopening a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(409);
  });

  it("returns 409 when reopening an archived plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/reopen")
      .expect(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGENERATE (/api/solution-recommendations/:id/regenerate)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/:id/regenerate", () => {
  /** Sets up mocks for a successful regeneration (3 select calls + transaction). */
  function setupSuccessfulRegeneration(planStatus: "draft" | "reopened") {
    const plan = makePlan(planStatus);
    const assessment = {
      id: "assessment-001",
      status: "approved",
      diagnosticId: "diag-001",
      diagnosticVersionId: "diagv-001",
      clientId: "client-001",
      projectId: "project-001",
      healthScore: "75",
      healthRating: "fair",
      generatedSections: null,
    };
    const scoreRows = [
      {
        categoryKey: "marketing",
        categoryLabel: "Marketing",
        currentPerformance: "50",
        businessImpact: "3",
        urgency: "3",
        performanceGap: "50",
        priorityScore: "85",
        severity: "critical",
        evidence: null,
        observations: null,
        recommendedAction: null,
        diagnosticVersionId: "diagv-001",
      },
    ];
    const newPlan = makePlan("draft", { id: "plan-002" });

    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))        // load current plan
      .mockReturnValueOnce(makeChain([assessment]))  // load assessment
      .mockReturnValueOnce(makeChain(scoreRows));    // load score rows

    // Transaction: supersede old plan + insert new plan + recs + actions
    mockDb.transaction.mockImplementation(async (cb: (tx: any) => unknown) => {
      const tx = {
        update: vi.fn().mockReturnValue(makeChain([{ ...plan, status: "superseded" }])),
        insert: vi.fn().mockReturnValue(makeChain([newPlan])),
        select: vi.fn().mockReturnValue(makeChain([])),
      };
      return cb(tx);
    });

    return { newPlan };
  }

  it("supersedes a draft plan and returns a new draft plan (201)", async () => {
    const { newPlan } = setupSuccessfulRegeneration("draft");

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(201);

    expect(res.body.generated).toBe(true);
    expect(res.body.plan).toBeDefined();
  });

  it("supersedes a reopened plan and returns a new draft plan (201)", async () => {
    setupSuccessfulRegeneration("reopened");

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(201);

    expect(res.body.generated).toBe(true);
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .post("/api/solution-recommendations/missing/regenerate")
      .expect(404);
  });

  it("returns 409 when regenerating an awaiting_review plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(409);

    expect(res.body.error).toMatch(/Only Draft or Reopened/i);
  });

  it("returns 409 when regenerating an approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(409);
  });

  it("returns 409 when regenerating a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(409);
  });

  it("returns 409 when regenerating an archived plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(409);
  });

  it("returns 400 when the source assessment is not approved", async () => {
    const plan = makePlan("draft");
    const pendingAssessment = { id: "assessment-001", status: "pending", diagnosticVersionId: "diagv-001" };

    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([pendingAssessment]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/regenerate")
      .expect(400);

    expect(res.body.error).toMatch(/no longer approved/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE (/api/solution-recommendations/:id/archive)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/:id/archive", () => {
  it("archives a draft plan (200)", async () => {
    const plan = makePlan("draft");
    const updated = makePlan("archived", { archivedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/archive")
      .expect(200);

    expect(res.body.status).toBe("archived");
  });

  it("archives an awaiting_review plan (200)", async () => {
    const plan = makePlan("awaiting_review");
    const updated = makePlan("archived", { archivedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/archive")
      .expect(200);

    expect(res.body.status).toBe("archived");
  });

  it("archives an approved plan (200)", async () => {
    const plan = makePlan("approved");
    const updated = makePlan("archived", { archivedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/archive")
      .expect(200);

    expect(res.body.status).toBe("archived");
  });

  it("archives a reopened plan (200)", async () => {
    const plan = makePlan("reopened");
    const updated = makePlan("archived", { archivedAt: new Date().toISOString() });

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/archive")
      .expect(200);

    expect(res.body.status).toBe("archived");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .post("/api/solution-recommendations/missing/archive")
      .expect(404);
  });

  it("returns 409 when the plan is already archived", async () => {
    const alreadyArchived = makePlan("archived", { archivedAt: new Date().toISOString() });
    mockDb.select.mockReturnValue(makeChain([alreadyArchived]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/archive")
      .expect(409);

    expect(res.body.error).toMatch(/already archived/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE (/api/solution-recommendations/generate)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/solution-recommendations/generate", () => {
  /** Minimal approved assessment fixture */
  const approvedAssessment = {
    id: "assessment-001",
    status: "approved",
    diagnosticId: "diag-001",
    diagnosticVersionId: "diagv-001",
    clientId: "client-001",
    projectId: "project-001",
    healthScore: "75",
    healthRating: "fair",
    generatedSections: null,
  };

  /** One diagnostic score row so the engine has data to work with */
  const scoreRows = [
    {
      categoryKey: "marketing",
      categoryLabel: "Marketing",
      currentPerformance: "50",
      businessImpact: "3",
      urgency: "3",
      performanceGap: "50",
      priorityScore: "85",
      severity: "critical",
      evidence: null,
      observations: null,
      recommendedAction: null,
      diagnosticVersionId: "diagv-001",
    },
  ];

  /** The new plan returned from the transaction */
  const newPlan = makePlan("draft", { id: "plan-new" });

  /**
   * Sets up the three sequential select calls for a successful generate:
   *   1. Load assessment
   *   2. Check for existing active plan (returns empty — no conflict)
   *   3. Load diagnostic scores
   * Then sets up the transaction mock to return newPlan.
   */
  function setupSuccessfulGeneration() {
    mockDb.select
      .mockReturnValueOnce(makeChain([approvedAssessment]))  // 1: load assessment
      .mockReturnValueOnce(makeChain([]))                    // 2: no existing plan
      .mockReturnValueOnce(makeChain(scoreRows));            // 3: score rows

    mockDb.transaction.mockImplementation(async (cb: (tx: any) => unknown) => {
      const tx = {
        insert: vi.fn().mockReturnValue(makeChain([newPlan])),
        update: vi.fn().mockReturnValue(makeChain([newPlan])),
        select: vi.fn().mockReturnValue(makeChain([])),
      };
      return cb(tx);
    });
  }

  it("creates a draft plan and returns 201 on the happy path", async () => {
    setupSuccessfulGeneration();

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(201);

    expect(res.body.generated).toBe(true);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.status).toBe("draft");
  });

  it("returns 400 when growthAssessmentId is missing from the request body", async () => {
    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({})
      .expect(400);

    expect(res.body.error).toMatch(/growthAssessmentId is required/i);
  });

  it("returns 404 when the growth assessment does not exist", async () => {
    mockDb.select.mockReturnValueOnce(makeChain([])); // assessment not found

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "nonexistent-id" })
      .expect(404);

    expect(res.body.error).toMatch(/growth assessment not found/i);
  });

  it("returns 400 when the assessment is not yet approved (status: pending)", async () => {
    const pendingAssessment = { ...approvedAssessment, status: "pending" };

    mockDb.select.mockReturnValueOnce(makeChain([pendingAssessment])); // assessment found

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(400);

    expect(res.body.error).toMatch(/approved Growth Assessments/i);
    expect(res.body.error).toMatch(/pending/i);
  });

  it("returns 400 when the assessment is in draft status (not approved)", async () => {
    const draftAssessment = { ...approvedAssessment, status: "draft" };

    mockDb.select.mockReturnValueOnce(makeChain([draftAssessment]));

    await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(400);
  });

  it("returns 409 when an active (non-archived) plan already exists for the assessment", async () => {
    const existingActivePlan = makePlan("awaiting_review");

    mockDb.select
      .mockReturnValueOnce(makeChain([approvedAssessment]))  // 1: load assessment
      .mockReturnValueOnce(makeChain([existingActivePlan])); // 2: existing plan found

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(409);

    expect(res.body.error).toMatch(/active plan already exists/i);
    expect(res.body.planId).toBe(existingActivePlan.id);
  });

  it("includes the existing plan's status in the 409 error message", async () => {
    const existingDraftPlan = makePlan("draft");

    mockDb.select
      .mockReturnValueOnce(makeChain([approvedAssessment]))
      .mockReturnValueOnce(makeChain([existingDraftPlan]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(409);

    expect(res.body.error).toMatch(/draft/i);
  });

  it("returns 400 when no diagnostic scores are found for the assessment version", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([approvedAssessment]))  // 1: load assessment
      .mockReturnValueOnce(makeChain([]))                    // 2: no existing plan
      .mockReturnValueOnce(makeChain([]));                   // 3: no score rows

    const res = await supertest(app)
      .post("/api/solution-recommendations/generate")
      .send({ growthAssessmentId: "assessment-001" })
      .expect(400);

    expect(res.body.error).toMatch(/no diagnostic scores found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solution-recommendations/:id  (edit plan content)
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/solution-recommendations/:id", () => {
  it("returns 200 with updated field when editing a draft plan", async () => {
    const plan = makePlan("draft");
    const updated = { ...plan, executiveRecommendation: "Updated exec rec" };

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "Updated exec rec" })
      .expect(200);

    expect(res.body.executiveRecommendation).toBe("Updated exec rec");
  });

  it("returns 200 with updated field when editing a reopened plan", async () => {
    const plan = makePlan("reopened");
    const updated = { ...plan, consultantNotes: "My notes" };

    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ consultantNotes: "My notes" })
      .expect(200);

    expect(res.body.consultantNotes).toBe("My notes");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .patch("/api/solution-recommendations/missing-id")
      .send({ executiveRecommendation: "anything" })
      .expect(404);
  });

  it("returns 409 when editing an approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/approved/i);
  });

  it("returns 409 when editing an awaiting_review plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/awaiting_review/i);
  });

  it("returns 409 when editing a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/superseded/i);
  });

  it("returns 409 when editing an archived plan (status=archived)", async () => {
    // Status guard fires first — status "archived" is not in [draft, reopened]
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/archived/i);
  });

  it("returns 409 when editing a plan with archivedAt set even if status is draft", async () => {
    // archivedAt guard (belt-and-suspenders) — plan rows can have archivedAt set
    // on supersede even when regeneration sets status="superseded". This tests
    // the explicit archivedAt check that follows the status check.
    const plan = makePlan("draft", { archivedAt: new Date().toISOString() });
    mockDb.select.mockReturnValue(makeChain([plan]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/archived/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solution-recommendations/:id/recommendations/:recId
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/solution-recommendations/:id/recommendations/:recId", () => {
  it("returns 200 with the updated recommendation when the plan is a draft", async () => {
    const plan = makePlan("draft");
    const rec = makeRec();
    const updatedRec = { ...rec, adminNotes: "Looks good" };

    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([rec]));
    mockDb.update.mockReturnValue(makeChain([updatedRec]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Looks good" })
      .expect(200);

    expect(res.body.adminNotes).toBe("Looks good");
  });

  it("returns 200 with the updated recommendation when the plan is reopened", async () => {
    const plan = makePlan("reopened");
    const rec = makeRec();
    const updatedRec = { ...rec, adminNotes: "Reopened notes" };

    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([rec]));
    mockDb.update.mockReturnValue(makeChain([updatedRec]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Reopened notes" })
      .expect(200);

    expect(res.body.adminNotes).toBe("Reopened notes");
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .patch("/api/solution-recommendations/missing/recommendations/rec-001")
      .send({ adminNotes: "anything" })
      .expect(404);
  });

  it("returns 404 when the recommendation does not belong to the plan", async () => {
    const plan = makePlan("draft");

    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([])); // rec not found

    await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/wrong-rec")
      .send({ adminNotes: "anything" })
      .expect(404);
  });

  it("returns 409 when editing a recommendation on an approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/approved/i);
  });

  it("returns 409 when editing a recommendation on an awaiting_review plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/awaiting_review/i);
  });

  it("returns 409 when editing a recommendation on a superseded plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("superseded")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/superseded/i);
  });

  it("returns 409 when editing a recommendation on an archived plan (status=archived)", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("archived")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/archived/i);
  });

  it("returns 409 when plan has archivedAt set even if status would otherwise be editable", async () => {
    const plan = makePlan("draft", { archivedAt: new Date().toISOString() });
    mockDb.select.mockReturnValue(makeChain([plan]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/archived/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FULL LIFECYCLE (sequential: draft → submit → approve → reopen → archive)
// ─────────────────────────────────────────────────────────────────────────────

describe("Full recommendation lifecycle (sequential transitions)", () => {
  it("completes the lifecycle: draft → awaiting_review → approved → reopened → archived", async () => {
    // Step 1: submit a draft plan → awaiting_review
    {
      mockDb.select.mockReturnValue(makeChain([makePlan("draft")]));
      mockDb.update.mockReturnValue(makeChain([makePlan("awaiting_review")]));

      const res = await supertest(app)
        .post("/api/solution-recommendations/plan-001/submit")
        .expect(200);
      expect(res.body.status).toBe("awaiting_review");
    }

    // Step 2: approve the awaiting_review plan → approved
    {
      mockDb.select
        .mockReturnValueOnce(makeChain([makePlan("awaiting_review")]))
        .mockReturnValueOnce(makeChain([makeRec()]));
      mockDb.update.mockReturnValue(makeChain([makePlan("approved")]));

      const res = await supertest(app)
        .post("/api/solution-recommendations/plan-001/approve")
        .expect(200);
      expect(res.body.status).toBe("approved");
    }

    // Step 3: reopen the approved plan → reopened
    {
      mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));
      mockDb.update.mockReturnValue(makeChain([makePlan("reopened")]));

      const res = await supertest(app)
        .post("/api/solution-recommendations/plan-001/reopen")
        .expect(200);
      expect(res.body.status).toBe("reopened");
    }

    // Step 4: archive the reopened plan → archived
    {
      mockDb.select.mockReturnValue(makeChain([makePlan("reopened")]));
      mockDb.update.mockReturnValue(makeChain([makePlan("archived", { archivedAt: new Date().toISOString() })]));

      const res = await supertest(app)
        .post("/api/solution-recommendations/plan-001/archive")
        .expect(200);
      expect(res.body.status).toBe("archived");
    }
  });

  it("blocks double-submit (409 after first submit)", async () => {
    // First submit: success
    mockDb.select.mockReturnValue(makeChain([makePlan("draft")]));
    mockDb.update.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(200);

    // Second submit: rejected
    mockDb.select.mockReturnValue(makeChain([makePlan("awaiting_review")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/submit")
      .expect(409);

    expect(res.body.error).toBeDefined();
  });

  it("blocks double-approve (409 after first approve)", async () => {
    // First approve: success
    mockDb.select
      .mockReturnValueOnce(makeChain([makePlan("awaiting_review")]))
      .mockReturnValueOnce(makeChain([makeRec()]));
    mockDb.update.mockReturnValue(makeChain([makePlan("approved")]));

    await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(200);

    // Second approve: rejected
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    const res = await supertest(app)
      .post("/api/solution-recommendations/plan-001/approve")
      .expect(409);

    expect(res.body.error).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solution-recommendations/:id  (plan-level field edits)
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/solution-recommendations/:id", () => {
  it("allows editing a draft plan (200 with updated content)", async () => {
    const plan = makePlan("draft");
    const updated = makePlan("draft", { executiveRecommendation: "Updated recommendation" });
    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "Updated recommendation" })
      .expect(200);

    expect(res.body.status).toBe("draft");
  });

  it("allows editing a reopened plan (200 with updated content)", async () => {
    const plan = makePlan("reopened");
    const updated = makePlan("reopened", { executiveRecommendation: "Revised recommendation" });
    mockDb.select.mockReturnValue(makeChain([plan]));
    mockDb.update.mockReturnValue(makeChain([updated]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "Revised recommendation" })
      .expect(200);

    expect(res.body.status).toBe("reopened");
  });

  it("returns 409 when editing an approved plan", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "Should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/approved/i);
  });

  it("returns 409 when editing an archived plan", async () => {
    mockDb.select.mockReturnValue(
      makeChain([makePlan("archived", { archivedAt: new Date().toISOString() })]),
    );

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "Should be blocked" })
      .expect(409);

    expect(res.body.error).toBeDefined();
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .patch("/api/solution-recommendations/plan-001")
      .send({ executiveRecommendation: "No such plan" })
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solution-recommendations/:id/recommendations/:recId
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/solution-recommendations/:id/recommendations/:recId", () => {
  it("allows editing a recommendation on a draft plan (200)", async () => {
    const plan = makePlan("draft");
    const rec = makeRec({ adminNotes: null });
    const updatedRec = makeRec({ adminNotes: "Prioritise this quarter" });
    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([rec]));
    mockDb.update.mockReturnValue(makeChain([updatedRec]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Prioritise this quarter" })
      .expect(200);

    expect(res.body.adminNotes).toBe("Prioritise this quarter");
  });

  it("allows editing a recommendation on a reopened plan (200)", async () => {
    const plan = makePlan("reopened");
    const rec = makeRec();
    const updatedRec = makeRec({ adminNotes: "Deprioritised" });
    mockDb.select
      .mockReturnValueOnce(makeChain([plan]))
      .mockReturnValueOnce(makeChain([rec]));
    mockDb.update.mockReturnValue(makeChain([updatedRec]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Deprioritised" })
      .expect(200);

    expect(res.body.adminNotes).toBe("Deprioritised");
  });

  it("returns 409 when the parent plan is approved", async () => {
    mockDb.select.mockReturnValue(makeChain([makePlan("approved")]));

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Should be blocked" })
      .expect(409);

    expect(res.body.error).toMatch(/approved/i);
  });

  it("returns 409 when the parent plan is archived", async () => {
    mockDb.select.mockReturnValue(
      makeChain([makePlan("archived", { archivedAt: new Date().toISOString() })]),
    );

    const res = await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "Should be blocked" })
      .expect(409);

    expect(res.body.error).toBeDefined();
  });

  it("returns 404 when the plan does not exist", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-001")
      .send({ adminNotes: "No such plan" })
      .expect(404);
  });

  it("returns 404 when the recommendation does not belong to the plan", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([makePlan("draft")]))
      .mockReturnValueOnce(makeChain([])); // rec not found

    await supertest(app)
      .patch("/api/solution-recommendations/plan-001/recommendations/rec-999")
      .send({ adminNotes: "Wrong plan" })
      .expect(404);
  });
});
