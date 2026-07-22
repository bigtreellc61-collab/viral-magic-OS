/**
 * Integration tests for Growth Blueprint export routes.
 *
 * Covers:
 *  - Permission checks (approved-only validation)
 *  - Format validation
 *  - Not-found handling
 *  - Generation status guard
 *  - Missing sections guard
 *  - Successful export response (mocked builders)
 *  - Branding configuration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ─── Mock @workspace/db ──────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
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
  activityRecordsTable: {},
  usersTable: {},
  pool: { query: vi.fn() },
}));

// ─── Mock auth middleware ─────────────────────────────────────────

vi.mock("../middlewares/authMiddleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-id" };
    next();
  },
}));

// ─── Hoist mocks that are referenced in vi.mock factories ─────────

const mockFetch = vi.hoisted(() => vi.fn());
const mockBuildPdf = vi.hoisted(() => vi.fn().mockResolvedValue(Buffer.from("PDF_CONTENT")));
const mockBuildDocx = vi.hoisted(() => vi.fn().mockResolvedValue(Buffer.from("DOCX_CONTENT")));
const mockBuildPptx = vi.hoisted(() => vi.fn().mockResolvedValue(Buffer.from("PPTX_CONTENT")));

// ─── Mock report builders ─────────────────────────────────────────
// Avoids actually running pdfmake / docx / pptxgenjs in unit tests.

vi.mock("../lib/report-builder/pdf-builder", () => ({
  buildPdf: mockBuildPdf,
}));
vi.mock("../lib/report-builder/docx-builder", () => ({
  buildDocx: mockBuildDocx,
}));
vi.mock("../lib/report-builder/pptx-builder", () => ({
  buildPptx: mockBuildPptx,
}));

// ─── Mock blueprint model fetch ───────────────────────────────────

vi.mock("../lib/report-builder/blueprint-model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/report-builder/blueprint-model")>();
  return {
    ...actual,
    fetchBlueprintForExport: mockFetch,
  };
});

// ─── Import router under test ─────────────────────────────────────

import blueprintExportsRouter from "./blueprint-exports";

// ─── Test app ─────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(blueprintExportsRouter);
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────

const approvedBlueprintRow = {
  id: "bp-1",
  title: "Q3 Growth Blueprint",
  status: "approved",
  generationStatus: "complete",
};

const archivedBlueprintRow = {
  id: "bp-2",
  title: "Archived Blueprint",
  status: "archived",
  generationStatus: "complete",
};

const fullBlueprintModel = {
  id: "bp-1",
  title: "Q3 Growth Blueprint",
  status: "approved",
  version: 1,
  revisionNumber: 0,
  versionLabel: "Version 1.0",
  generationStatus: "complete",
  generatedAt: new Date("2026-01-15"),
  approvedAt: new Date("2026-01-20"),
  archivedAt: null,
  consultantNotes: "Key growth lever: pricing strategy.",
  clientId: "client-1",
  clientName: "Acme Corp",
  projectName: "Q3 Growth Initiative",
  assessmentHealthScore: 74,
  assessmentHealthRating: "fair",
  planStatus: "approved",
  growthAssessmentId: "assessment-1",
  solutionRecommendationPlanId: "plan-1",
  sections: [
    { id: "s1", sectionKey: "executive_summary", title: "Executive Summary", sectionOrder: 0, content: "Strong Q3 position.", hasOverride: false },
    { id: "s2", sectionKey: "current_business_state", title: "Current State", sectionOrder: 1, content: "Revenue growing 12% YoY.", hasOverride: false },
  ],
  initiatives: [
    { id: "i1", title: "Expand Pricing Tiers", domain: "Revenue", priorityClassification: "Critical Priority", effortLevel: "medium", roadmapPeriod: "30_days", roadmapReason: "Quick Win — fast to implement", ownerPlaceholder: "CMO", expectedBusinessImpact: "+15% ARPU", consultantGuidance: null, sequenceOrder: 1, isQuickWin: true },
  ],
  byPeriod: {
    "30_days": [],
    "60_days": [],
    "90_days": [],
    longer_term: [],
  },
};

// ─── Tests ────────────────────────────────────────────────────────

describe("Blueprint Export Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(fullBlueprintModel);
  });

  // ── Permission checks ──────────────────────────────────────────

  describe("Export permission validation", () => {
    it("returns 403 for a draft blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [{ id: "bp-draft", title: "Draft", status: "draft", generationStatus: "complete" }] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-draft/export/pdf");
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/approved or archived/i);
    });

    it("returns 403 for an in_progress blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [{ id: "bp-ip", title: "WIP", status: "in_progress", generationStatus: "complete" }] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-ip/export/docx");
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/in_progress/);
    });

    it("returns 403 for a ready_for_review blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [{ id: "bp-rfr", title: "RFR", status: "ready_for_review", generationStatus: "complete" }] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-rfr/export/pptx");
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/ready_for_review/);
    });

    it("allows export of an approved blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });

    it("allows export of an archived blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [archivedBlueprintRow] }) }),
      });
      mockFetch.mockResolvedValue({ ...fullBlueprintModel, id: "bp-2", status: "archived" });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-2/export/docx");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("wordprocessingml");
    });
  });

  // ── Format validation ──────────────────────────────────────────

  describe("Format validation", () => {
    it("returns 400 for an unsupported format", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/xlsx");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unsupported/i);
    });

    it("serves pdf with correct Content-Type", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain(".pdf");
    });

    it("serves docx with correct Content-Type", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/docx");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("wordprocessingml");
      expect(res.headers["content-disposition"]).toContain(".docx");
    });

    it("serves pptx with correct Content-Type", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pptx");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("presentationml");
      expect(res.headers["content-disposition"]).toContain(".pptx");
    });
  });

  // ── Not found ─────────────────────────────────────────────────

  describe("Not found handling", () => {
    it("returns 404 for a missing blueprint", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/nonexistent/export/pdf");
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // ── Generation status guard ────────────────────────────────────

  describe("Generation status guard", () => {
    it("returns 400 when blueprint has not been generated", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [{ ...approvedBlueprintRow, generationStatus: null }],
          }),
        }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not been generated/i);
    });

    it("returns 400 when generation failed", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [{ ...approvedBlueprintRow, generationStatus: "failed" }],
          }),
        }),
      });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not been generated/i);
    });
  });

  // ── Missing sections guard ─────────────────────────────────────

  describe("Missing sections guard", () => {
    it("returns 400 when blueprint has no sections", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
      mockFetch.mockResolvedValue({ ...fullBlueprintModel, sections: [] });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no sections/i);
    });
  });

  // ── Response headers ───────────────────────────────────────────

  describe("Response headers", () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [approvedBlueprintRow] }) }),
      });
    });

    it("sets Cache-Control: no-store on export responses", async () => {
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.headers["cache-control"]).toContain("no-store");
    });

    it("sets Content-Length header", async () => {
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.headers["content-length"]).toBeDefined();
    });

    it("sanitizes blueprint title in filename", async () => {
      mockFetch.mockResolvedValue({ ...fullBlueprintModel, title: "My Blueprint (Final)! v2" });
      const res = await supertest(makeApp()).get("/growth-blueprints/bp-1/export/pdf");
      expect(res.headers["content-disposition"]).not.toMatch(/[()!]/);
    });
  });

  // ── Branding config ────────────────────────────────────────────

  describe("Branding configuration", () => {
    it("uses defaultBranding (not hardcoded strings)", async () => {
      // Branding module should export a defaultBranding object with companyName
      const branding = await import("../lib/branding");
      expect(branding.defaultBranding).toBeDefined();
      expect(typeof branding.defaultBranding.companyName).toBe("string");
      expect(typeof branding.defaultBranding.reportFooter).toBe("string");
      expect(typeof branding.defaultBranding.preparedBy).toBe("string");
      expect(typeof branding.defaultBranding.primaryColor).toBe("string");
    });

    it("branding.primaryColor is a hex color", async () => {
      const { defaultBranding } = await import("../lib/branding");
      expect(defaultBranding.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
