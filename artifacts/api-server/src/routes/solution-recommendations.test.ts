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
