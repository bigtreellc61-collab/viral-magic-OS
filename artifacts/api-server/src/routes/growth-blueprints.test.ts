/**
 * Integration tests for the Growth Blueprint lifecycle.
 *
 * Tests use a mocked @workspace/db so no live database is required.
 * Each test exercises a specific lifecycle transition and verifies:
 *   - the correct HTTP status code
 *   - the blueprint status in the response body (where applicable)
 *   - rejection of invalid transitions with 409
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ─── Mock @workspace/db before any routes import it ──────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  growthBlueprintsTable: {},
  growthBlueprintSectionsTable: {},
  growthBlueprintInitiativesTable: {},
  clientsTable: {},
  projectsTable: {},
  growthAssessmentsTable: {},
  solutionRecommendationPlansTable: {},
  solutionRecommendationsTable: {},
  solutionRecommendationActionsTable: {},
  solutionRecommendationDependenciesTable: {},
  activityRecordsTable: {},
  usersTable: {},
  pool: { query: vi.fn() },
}));

// ─── Mock auth middleware ─────────────────────────────────────────────────────

vi.mock("../middlewares/authMiddleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-id" };
    next();
  },
}));

// ─── Mock activity logger ─────────────────────────────────────────────────────

vi.mock("../lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import router under test ─────────────────────────────────────────────────

import growthBlueprintsRouter from "./growth-blueprints";

// ─── Test app ─────────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(growthBlueprintsRouter);
  return app;
}

// ─── Blueprint fixture ────────────────────────────────────────────────────────

const baseBlueprint = {
  id: "bp-1",
  title: "Test Blueprint",
  status: "draft",
  version: 1,
  consultantNotes: null,
  clientId: "client-1",
  projectId: null,
  growthAssessmentId: "assessment-1",
  solutionRecommendationPlanId: "plan-1",
  approvedBy: null,
  approvedAt: null,
  archivedAt: null,
  createdBy: "test-user-id",
  updatedBy: "test-user-id",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const approvedPlan = {
  id: "plan-1",
  status: "approved",
  clientId: "client-1",
  projectId: null,
  growthAssessmentId: "assessment-1",
  executiveRecommendation: "Focus on growth.",
  overallPriorityScore: "85",
};

// ─── Helper: chain fluent mock ────────────────────────────────────────────────

function chainSelect(rows: any[]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

function chainUpdate(rows: any[]) {
  const chain: any = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

function chainInsert(rows: any[]) {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

// ─── Tests: POST /growth-blueprints (create) ─────────────────────────────────

describe("POST /growth-blueprints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 — creates a blueprint from an approved plan", async () => {
    // Plan lookup
    mockDb.select.mockReturnValueOnce(chainSelect([approvedPlan]));
    // Existing active blueprint check (none)
    mockDb.select.mockReturnValueOnce(chainSelect([]));
    // Insert
    mockDb.insert.mockReturnValueOnce(chainInsert([baseBlueprint]));

    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ solutionRecommendationPlanId: "plan-1", title: "Test Blueprint" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("bp-1");
    expect(res.body.status).toBe("draft");
  });

  it("400 — rejects when solutionRecommendationPlanId is missing", async () => {
    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ title: "Test" });
    expect(res.status).toBe(400);
  });

  it("400 — rejects when title is missing", async () => {
    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ solutionRecommendationPlanId: "plan-1" });
    expect(res.status).toBe(400);
  });

  it("404 — rejects when plan not found", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]));

    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ solutionRecommendationPlanId: "missing-plan", title: "Test" });
    expect(res.status).toBe(404);
  });

  it("400 — rejects when plan is not approved", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...approvedPlan, status: "draft" }]));

    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ solutionRecommendationPlanId: "plan-1", title: "Test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("approved");
  });

  it("409 — rejects when an active blueprint already exists for the plan", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([approvedPlan]));
    mockDb.select.mockReturnValueOnce(chainSelect([{ id: "existing-bp", status: "in_progress" }]));

    const res = await supertest(makeApp())
      .post("/growth-blueprints")
      .send({ solutionRecommendationPlanId: "plan-1", title: "Test" });
    expect(res.status).toBe(409);
    expect(res.body.blueprintId).toBe("existing-bp");
  });
});

// ─── Tests: PATCH /growth-blueprints/:id ─────────────────────────────────────

describe("PATCH /growth-blueprints/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — updates consultant notes on a draft blueprint", async () => {
    const updated = { ...baseBlueprint, consultantNotes: "New notes." };
    mockDb.select.mockReturnValueOnce(chainSelect([baseBlueprint]));
    mockDb.update.mockReturnValueOnce(chainUpdate([updated]));

    const res = await supertest(makeApp())
      .patch("/growth-blueprints/bp-1")
      .send({ consultantNotes: "New notes." });

    expect(res.status).toBe(200);
    expect(res.body.consultantNotes).toBe("New notes.");
  });

  it("409 — rejects edit on an archived blueprint", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, archivedAt: new Date().toISOString() }]),
    );

    const res = await supertest(makeApp())
      .patch("/growth-blueprints/bp-1")
      .send({ consultantNotes: "Nope" });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("archived");
  });

  it("409 — rejects edit on an approved blueprint", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "approved" }]),
    );

    const res = await supertest(makeApp())
      .patch("/growth-blueprints/bp-1")
      .send({ consultantNotes: "Nope" });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("approved");
  });

  it("404 — returns 404 for missing blueprint", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]));
    const res = await supertest(makeApp()).patch("/growth-blueprints/missing").send({});
    expect(res.status).toBe(404);
  });
});

// ─── Tests: POST /growth-blueprints/:id/start ────────────────────────────────

describe("POST /growth-blueprints/:id/start", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — transitions draft → in_progress", async () => {
    const inProgress = { ...baseBlueprint, status: "in_progress" };
    mockDb.select.mockReturnValueOnce(chainSelect([baseBlueprint]));
    mockDb.update.mockReturnValueOnce(chainUpdate([inProgress]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/start");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it("409 — rejects transition from wrong status", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "in_progress" }]),
    );

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/start");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("in_progress");
  });

  it("404 — returns 404 for missing blueprint", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]));
    const res = await supertest(makeApp()).post("/growth-blueprints/missing/start");
    expect(res.status).toBe(404);
  });
});

// ─── Tests: POST /growth-blueprints/:id/ready ────────────────────────────────
// The route requires: generationStatus === "complete", exec section present,
// strategic_priorities section present, at least one initiative.

const generatedInProgressBlueprint = {
  ...baseBlueprint,
  status: "in_progress",
  generationStatus: "complete",
};

const execSection = { sectionKey: "executive_summary", generationStatus: "complete" };
const strategicSection = { sectionKey: "strategic_priorities", generationStatus: "complete" };
const mockInitiative = { id: "init-1" };

describe("POST /growth-blueprints/:id/ready", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — transitions in_progress → ready_for_review when all validations pass", async () => {
    const ready = { ...generatedInProgressBlueprint, status: "ready_for_review" };
    // 1. Select blueprint
    mockDb.select.mockReturnValueOnce(chainSelect([generatedInProgressBlueprint]));
    // 2. Select exec section
    mockDb.select.mockReturnValueOnce(chainSelect([execSection]));
    // 3. Select strategic_priorities section
    mockDb.select.mockReturnValueOnce(chainSelect([strategicSection]));
    // 4. Select at least one initiative
    mockDb.select.mockReturnValueOnce(chainSelect([mockInitiative]));
    // 5. transitionBlueprint: select blueprint again
    mockDb.select.mockReturnValueOnce(chainSelect([generatedInProgressBlueprint]));
    // 6. transitionBlueprint: update
    mockDb.update.mockReturnValueOnce(chainUpdate([ready]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready_for_review");
  });

  it("400 — rejects when blueprint has not been generated", async () => {
    // Blueprint without generationStatus: "complete"
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "in_progress", generationStatus: null }]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/ready");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("generated");
  });

  it("409 — rejects transition from draft (must go through in_progress first)", async () => {
    // transitionBlueprint selects the blueprint and rejects wrong status
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "draft", generationStatus: "complete" }]));
    // exec section mock
    mockDb.select.mockReturnValueOnce(chainSelect([execSection]));
    // strategic section mock
    mockDb.select.mockReturnValueOnce(chainSelect([strategicSection]));
    // initiative mock
    mockDb.select.mockReturnValueOnce(chainSelect([mockInitiative]));
    // transitionBlueprint selects again → same blueprint
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "draft" }]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/ready");
    expect(res.status).toBe(409);
  });
});

// ─── Tests: POST /growth-blueprints/:id/approve ──────────────────────────────
// Approve does: select blueprint → update blueprint → update sections (lock) →
// (optionally) update previous version when previousVersionId is set

function chainUpdateNoReturn() {
  return {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe("POST /growth-blueprints/:id/approve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — transitions ready_for_review → approved", async () => {
    const approved = { ...baseBlueprint, status: "approved", approvedAt: new Date().toISOString(), previousVersionId: null };
    // 1. Select blueprint
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "ready_for_review", previousVersionId: null }]),
    );
    // 2. Update blueprint to approved
    mockDb.update.mockReturnValueOnce(chainUpdate([approved]));
    // 3. Update sections to locked (no returning needed)
    mockDb.update.mockReturnValueOnce(chainUpdateNoReturn());

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/approve");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });

  it("409 — rejects approval from in_progress (must submit first)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "in_progress" }]),
    );

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/approve");
    expect(res.status).toBe(409);
  });

  it("409 — rejects approval from draft", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([baseBlueprint])); // draft

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/approve");
    expect(res.status).toBe(409);
  });
});

// ─── Tests: POST /growth-blueprints/:id/archive ──────────────────────────────

describe("POST /growth-blueprints/:id/archive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — archives a draft blueprint", async () => {
    const archived = { ...baseBlueprint, status: "archived", isCurrent: false, archivedAt: new Date().toISOString() };
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, archivedAt: null }]));
    mockDb.update.mockReturnValueOnce(chainUpdate([archived]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/archive");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("archived");
  });

  it("200 — archives an approved blueprint", async () => {
    const archived = { ...baseBlueprint, status: "archived", isCurrent: false, archivedAt: new Date().toISOString() };
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "approved", archivedAt: null }]));
    mockDb.update.mockReturnValueOnce(chainUpdate([archived]));

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/archive");
    expect(res.status).toBe(200);
  });

  it("409 — rejects archiving an already archived blueprint", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "archived", archivedAt: new Date().toISOString() }]),
    );

    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/archive");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already archived");
  });

  it("404 — returns 404 for missing blueprint", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]));
    const res = await supertest(makeApp()).post("/growth-blueprints/missing/archive");
    expect(res.status).toBe(404);
  });
});

// ─── Tests: full lifecycle happy path ────────────────────────────────────────

describe("Full lifecycle: draft → in_progress → ready_for_review → approved → archived", () => {
  beforeEach(() => vi.clearAllMocks());

  it("correctly progresses through all states without errors", async () => {
    const app = makeApp();

    // draft → in_progress
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, archivedAt: null }]));
    mockDb.update.mockReturnValueOnce(chainUpdate([{ ...baseBlueprint, status: "in_progress" }]));
    const start = await supertest(app).post("/growth-blueprints/bp-1/start");
    expect(start.status).toBe(200);

    // in_progress → ready_for_review
    // Route: select blueprint, select exec section, select strategic section, select initiative, transitionBlueprint select, update
    const ipBlueprint = { ...baseBlueprint, status: "in_progress", generationStatus: "complete", archivedAt: null };
    mockDb.select.mockReturnValueOnce(chainSelect([ipBlueprint]));
    mockDb.select.mockReturnValueOnce(chainSelect([execSection]));
    mockDb.select.mockReturnValueOnce(chainSelect([strategicSection]));
    mockDb.select.mockReturnValueOnce(chainSelect([mockInitiative]));
    mockDb.select.mockReturnValueOnce(chainSelect([ipBlueprint]));
    mockDb.update.mockReturnValueOnce(chainUpdate([{ ...ipBlueprint, status: "ready_for_review" }]));
    const ready = await supertest(app).post("/growth-blueprints/bp-1/ready");
    expect(ready.status).toBe(200);

    // ready_for_review → approved
    // Route: select blueprint, update blueprint, update sections
    const rfr = { ...baseBlueprint, status: "ready_for_review", previousVersionId: null, archivedAt: null };
    const approved = { ...baseBlueprint, status: "approved", approvedAt: new Date().toISOString(), previousVersionId: null };
    mockDb.select.mockReturnValueOnce(chainSelect([rfr]));
    mockDb.update.mockReturnValueOnce(chainUpdate([approved]));
    mockDb.update.mockReturnValueOnce(chainUpdateNoReturn());
    const approve = await supertest(app).post("/growth-blueprints/bp-1/approve");
    expect(approve.status).toBe(200);

    // approved → archived
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "approved", archivedAt: null }]));
    mockDb.update.mockReturnValueOnce(chainUpdate([{ ...baseBlueprint, status: "archived", archivedAt: new Date().toISOString() }]));
    const archive = await supertest(app).post("/growth-blueprints/bp-1/archive");
    expect(archive.status).toBe(200);
  });
});

// ─── Tests: invalid transition rejections ────────────────────────────────────

describe("Invalid lifecycle transitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cannot skip draft → ready_for_review without generation (returns 400)", async () => {
    // Blueprint is draft, generationStatus is null → 400 (not generated)
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "draft", generationStatus: null, archivedAt: null }]));
    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/ready");
    expect(res.status).toBe(400);
  });

  it("cannot skip draft → approved", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, archivedAt: null }])); // draft
    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/approve");
    expect(res.status).toBe(409);
  });

  it("cannot restart an in_progress blueprint (start expects draft)", async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([{ ...baseBlueprint, status: "in_progress", archivedAt: null }]));
    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/start");
    expect(res.status).toBe(409);
  });

  it("cannot approve an archived blueprint", async () => {
    mockDb.select.mockReturnValueOnce(
      chainSelect([{ ...baseBlueprint, status: "archived", archivedAt: new Date().toISOString() }]),
    );
    const res = await supertest(makeApp()).post("/growth-blueprints/bp-1/approve");
    expect(res.status).toBe(409);
  });
});
