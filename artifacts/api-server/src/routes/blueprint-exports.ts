/**
 * Export routes for Growth Blueprint deliverables.
 *
 * GET /api/growth-blueprints/:id/export/:format
 *
 * Supported formats: pdf | docx | pptx
 *
 * Permission rules (per spec):
 *  - approved   → exportable ✓
 *  - archived   → exportable ✓
 *  - all others → 403
 *
 * Additionally, generationStatus must be "complete" — a blueprint that has
 * never been generated cannot be exported meaningfully.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  clientsTable,
  projectsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";
import { defaultBranding } from "../lib/branding";
import { fetchBlueprintForExport } from "../lib/report-builder/blueprint-model";
import { buildPdf } from "../lib/report-builder/pdf-builder";
import { buildDocx } from "../lib/report-builder/docx-builder";
import { buildPptx } from "../lib/report-builder/pptx-builder";

const router: IRouter = Router();

// ─── Allowed statuses ─────────────────────────────────────────────

const EXPORTABLE_STATUSES = new Set(["approved", "archived"]);

// ─── Format config ────────────────────────────────────────────────

type ExportFormat = "pdf" | "docx" | "pptx";

const FORMAT_CONFIG: Record<
  ExportFormat,
  { contentType: string; extension: string }
> = {
  pdf: { contentType: "application/pdf", extension: "pdf" },
  docx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  },
  pptx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  },
};

// ─── Helper: sanitize filename ────────────────────────────────────

function safeFilename(title: string, ext: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) +
    "." +
    ext
  );
}

// ─── GET /api/growth-blueprints/:id/export/:format ────────────────

router.get(
  "/growth-blueprints/:id/export/:format",
  requireAuth,
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const fmt = String(req.params.format).toLowerCase();

      // Validate format
      if (!Object.keys(FORMAT_CONFIG).includes(fmt)) {
        return void res.status(400).json({
          error: `Unsupported export format "${fmt}". Supported: pdf, docx, pptx.`,
        });
      }
      const format = fmt as ExportFormat;

      // Quick permission check (status only — avoids heavy fetch on rejection)
      const [statusRow] = await db
        .select({
          id: growthBlueprintsTable.id,
          status: growthBlueprintsTable.status,
          generationStatus: growthBlueprintsTable.generationStatus,
          title: growthBlueprintsTable.title,
        })
        .from(growthBlueprintsTable)
        .where(eq(growthBlueprintsTable.id, id))
        .limit(1);

      if (!statusRow) {
        return void res.status(404).json({ error: "Growth Blueprint not found." });
      }

      if (!EXPORTABLE_STATUSES.has(statusRow.status)) {
        return void res.status(403).json({
          error: `Only approved or archived blueprints can be exported. Current status: ${statusRow.status}.`,
        });
      }

      if (statusRow.generationStatus !== "complete") {
        return void res.status(400).json({
          error:
            "This blueprint has not been generated yet. Generate the blueprint before exporting.",
        });
      }

      // Full data fetch
      const blueprint = await fetchBlueprintForExport(id);
      if (!blueprint) {
        return void res.status(404).json({ error: "Growth Blueprint not found." });
      }

      if (blueprint.sections.length === 0) {
        return void res.status(400).json({
          error:
            "This blueprint has no sections. Regenerate it before exporting.",
        });
      }

      const branding = defaultBranding;
      const { contentType, extension } = FORMAT_CONFIG[format];
      const filename = safeFilename(blueprint.title, extension);

      // Generate
      let buffer: Buffer;
      if (format === "pdf") {
        buffer = await buildPdf(blueprint, branding);
      } else if (format === "docx") {
        buffer = await buildDocx(blueprint, branding);
      } else {
        buffer = await buildPptx(blueprint, branding);
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "no-store");
      res.end(buffer);
    } catch (err) {
      logger.error({ err }, "Blueprint export failed");
      res.status(500).json({
        error:
          "Export failed. Please try again. If the problem persists, contact support.",
      });
    }
  },
);

export default router;
