/**
 * PDF builder using pdfmake.
 *
 * Generates a professionally formatted PDF report for a Growth Blueprint.
 * Uses only the 14 standard PDF fonts (Helvetica family) — no external font
 * files are needed.
 */

import type { BrandingConfig } from "../branding";
import type { BlueprintExportModel } from "./blueprint-model";
import { getSectionsByKeys, formatDate, SECTION_GROUPS } from "./blueprint-model";

// pdfmake is externalized in esbuild — loaded at runtime from node_modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake");

const FONTS = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

// ─── Color palette (greyscale + accent) ──────────────────────────

const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  border: "#cbd5e1",
  bg: "#f8fafc",
  accent: "#4c1d95",
  white: "#ffffff",
};

// ─── Helpers ─────────────────────────────────────────────────────

function hline(marginTop = 12, marginBottom = 12): object {
  return {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 0.5,
        lineColor: C.border,
      },
    ],
    margin: [0, marginTop, 0, marginBottom],
  };
}

function chapterHeading(num: string, title: string): object[] {
  return [
    {
      text: num,
      font: "Helvetica",
      fontSize: 8,
      color: C.muted,
      characterSpacing: 2,
      margin: [0, 0, 0, 4],
    },
    {
      text: title,
      font: "Helvetica",
      bold: true,
      fontSize: 16,
      color: C.ink,
      margin: [0, 0, 0, 6],
    },
    hline(0, 16),
  ];
}

function subsectionHeading(title: string): object {
  return {
    text: title.toUpperCase(),
    font: "Helvetica",
    bold: true,
    fontSize: 7,
    color: C.muted,
    characterSpacing: 1.5,
    margin: [0, 12, 0, 4],
  };
}

function bodyText(text: string, margin: number[] = [0, 0, 0, 0]): object {
  if (!text.trim()) {
    return {
      text: "No content generated for this section.",
      font: "Helvetica",
      italics: true,
      fontSize: 10,
      color: C.muted,
      margin,
    };
  }
  // Split on double newlines to create paragraphs
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    stack: paras.map((p, i) => ({
      text: p.replace(/\n/g, " "),
      font: "Helvetica",
      fontSize: 10,
      color: C.body,
      lineHeight: 1.5,
      margin: [0, 0, 0, i < paras.length - 1 ? 8 : 0],
    })),
    margin,
  };
}

function initiativeTable(
  initiatives: BlueprintExportModel["initiatives"],
  branding: BrandingConfig,
): object {
  if (initiatives.length === 0) {
    return {
      text: "No initiatives for this period.",
      font: "Helvetica",
      italics: true,
      fontSize: 10,
      color: C.muted,
      margin: [0, 4, 0, 12],
    };
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", 80, 70, 70],
      body: [
        [
          { text: "Initiative", bold: true, fontSize: 9, fillColor: C.ink, color: C.white },
          { text: "Priority", bold: true, fontSize: 9, fillColor: C.ink, color: C.white },
          { text: "Effort", bold: true, fontSize: 9, fillColor: C.ink, color: C.white },
          { text: "Owner", bold: true, fontSize: 9, fillColor: C.ink, color: C.white },
        ],
        ...initiatives.map((ini, idx) => [
          {
            stack: [
              { text: ini.title, fontSize: 9, bold: true, color: C.ink },
              { text: ini.domain, fontSize: 8, color: C.muted, margin: [0, 2, 0, 0] },
              ...(ini.isQuickWin
                ? [{ text: "⚡ Quick Win", fontSize: 7, color: branding.accentColor, margin: [0, 2, 0, 0] }]
                : []),
            ],
          },
          { text: ini.priorityClassification, fontSize: 8, color: C.body },
          { text: ini.effortLevel?.replace(/_/g, " ") ?? "—", fontSize: 8, color: C.body },
          { text: ini.ownerPlaceholder ?? "—", fontSize: 8, color: C.body },
        ].map((cell) => ({ ...cell, fillColor: idx % 2 === 0 ? C.bg : C.white }))),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => C.border,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    margin: [0, 4, 0, 16],
  };
}

// ─── Main export ─────────────────────────────────────────────────

export async function buildPdf(
  blueprint: BlueprintExportModel,
  branding: BrandingConfig,
): Promise<Buffer> {
  const printer = new PdfPrinter(FONTS);

  const sec = (keys: readonly string[]) =>
    getSectionsByKeys(blueprint.sections, keys);

  const now = new Date();
  const preparedDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── Document definition ───────────────────────────────────────

  const docDefinition: object = {
    pageSize: "A4",
    pageMargins: [56, 60, 56, 60],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
      color: C.body,
    },

    // ── Header (pages 2+) ─────────────────────────────────────
    header: (currentPage: number) => {
      if (currentPage === 1) return {};
      return {
        columns: [
          {
            text: blueprint.title,
            fontSize: 8,
            color: C.muted,
            margin: [56, 20, 0, 0],
          },
          {
            text: branding.companyName,
            fontSize: 8,
            color: C.muted,
            alignment: "right",
            margin: [0, 20, 56, 0],
          },
        ],
      };
    },

    // ── Footer ────────────────────────────────────────────────
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: branding.reportFooter,
          fontSize: 8,
          color: C.muted,
          margin: [56, 0, 0, 0],
        },
        {
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          color: C.muted,
          alignment: "right",
          margin: [0, 0, 56, 0],
        },
      ],
      margin: [0, 12, 0, 0],
    }),

    content: [
      // ─────────────────────────────────────────────────────────
      // PAGE 1 — COVER
      // ─────────────────────────────────────────────────────────
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: -60,
            w: 595,
            h: 220,
            color: C.ink,
          },
        ],
        margin: [-56, -60, -56, 0],
      },
      {
        text: branding.logoPlaceholder,
        font: "Helvetica",
        fontSize: 10,
        color: "#94a3b8",
        margin: [0, -180, 0, 0],
      },
      {
        text: blueprint.title,
        font: "Helvetica",
        bold: true,
        fontSize: 28,
        color: C.white,
        margin: [0, 24, 0, 8],
      },
      {
        text: "Growth Blueprint",
        font: "Helvetica",
        fontSize: 13,
        color: "#94a3b8",
        margin: [0, 0, 0, 60],
      },

      // Cover meta grid
      {
        columns: [
          {
            stack: [
              { text: "CLIENT", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: blueprint.clientName, fontSize: 12, bold: true, color: C.ink, margin: [0, 0, 0, 16] },
              { text: "PROJECT", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: blueprint.projectName ?? "—", fontSize: 11, color: C.ink, margin: [0, 0, 0, 16] },
              { text: "VERSION", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: blueprint.versionLabel, fontSize: 11, color: C.ink },
            ],
          },
          {
            stack: [
              { text: "STATUS", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: blueprint.status.replace(/_/g, " ").toUpperCase(), fontSize: 11, color: C.ink, margin: [0, 0, 0, 16] },
              { text: "PREPARED BY", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: branding.preparedBy, fontSize: 11, color: C.ink, margin: [0, 0, 0, 16] },
              { text: "PREPARED DATE", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 2] },
              { text: preparedDate, fontSize: 11, color: C.ink },
            ],
          },
        ],
        columnGap: 40,
        margin: [0, 0, 0, 32],
      },

      // Health score on cover
      ...(blueprint.assessmentHealthScore !== null
        ? [
            hline(0, 16),
            {
              columns: [
                {
                  stack: [
                    { text: "OVERALL HEALTH SCORE", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
                    { text: `${blueprint.assessmentHealthScore.toFixed(0)} / 100`, fontSize: 24, bold: true, color: C.ink },
                    { text: (blueprint.assessmentHealthRating ?? "").replace(/_/g, " "), fontSize: 10, color: C.muted, margin: [0, 4, 0, 0] },
                  ],
                },
                {
                  stack: [
                    { text: "INITIATIVES", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
                    { text: String(blueprint.initiatives.length), fontSize: 24, bold: true, color: C.ink },
                    { text: "in roadmap", fontSize: 10, color: C.muted, margin: [0, 4, 0, 0] },
                  ],
                },
                {
                  stack: [
                    { text: "QUICK WINS", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
                    { text: String(blueprint.initiatives.filter((i) => i.isQuickWin).length), fontSize: 24, bold: true, color: C.ink },
                    { text: "identified", fontSize: 10, color: C.muted, margin: [0, 4, 0, 0] },
                  ],
                },
              ],
              columnGap: 40,
            },
          ]
        : []),

      // Page break after cover
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // PAGE 2 — TABLE OF CONTENTS
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("", "Table of Contents"),
      ...([
        ["01", "Executive Summary"],
        ["02", "Business Health Snapshot"],
        ["03", "Strategic Priorities"],
        ["04", "30 / 60 / 90 Day Roadmap"],
        ["05", "Business Impact"],
        ["06", "KPIs & Success Metrics"],
        ["07", "Dependencies & Constraints"],
        ["08", "Consultant Guidance"],
        ["09", "Executive Decisions Required"],
        ["A", "Appendix — Reference Information"],
      ] as [string, string][]).map(([num, title]) => ({
        columns: [
          { text: `${num}  ${title}`, fontSize: 11, color: C.ink },
          { text: "·".repeat(60), fontSize: 10, color: C.border, width: 180, alignment: "right" },
        ],
        margin: [0, 0, 0, 10],
      })),

      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S01 — EXECUTIVE SUMMARY
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("01", "Executive Summary"),
      ...sec(SECTION_GROUPS.executive).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S02 — BUSINESS HEALTH
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("02", "Business Health Snapshot"),
      // Health score card
      ...(blueprint.assessmentHealthScore !== null
        ? [
            {
              table: {
                widths: [120, "*"],
                body: [
                  [
                    {
                      stack: [
                        { text: "HEALTH SCORE", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
                        { text: `${blueprint.assessmentHealthScore.toFixed(0)}/100`, fontSize: 22, bold: true, color: C.ink },
                        { text: (blueprint.assessmentHealthRating ?? "").replace(/_/g, " "), fontSize: 9, color: C.muted, margin: [0, 4, 0, 0] },
                      ],
                      fillColor: C.bg,
                    },
                    {
                      stack: [
                        { text: "ROADMAP INITIATIVES", fontSize: 7, color: C.muted, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
                        { text: String(blueprint.initiatives.length), fontSize: 22, bold: true, color: C.ink },
                      ],
                      fillColor: C.bg,
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 14, paddingBottom: () => 14, paddingLeft: () => 14 },
              margin: [0, 0, 0, 20],
            },
          ]
        : []),
      ...sec(SECTION_GROUPS.health).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S03 — STRATEGIC PRIORITIES
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("03", "Strategic Priorities"),
      ...sec(SECTION_GROUPS.strategic).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S04 — 30/60/90 ROADMAP
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("04", "30 / 60 / 90 Day Roadmap"),
      ...sec(SECTION_GROUPS.roadmap).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 8]),
      ]).flat(),
      subsectionHeading("30-Day Initiatives"),
      initiativeTable(blueprint.byPeriod["30_days"], branding),
      subsectionHeading("60-Day Initiatives"),
      initiativeTable(blueprint.byPeriod["60_days"], branding),
      subsectionHeading("90-Day Initiatives"),
      initiativeTable(blueprint.byPeriod["90_days"], branding),
      subsectionHeading("Longer-Term Initiatives"),
      initiativeTable(blueprint.byPeriod.longer_term, branding),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S05 — BUSINESS IMPACT
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("05", "Business Impact"),
      ...sec(SECTION_GROUPS.impact).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S06 — KPIs & SUCCESS METRICS
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("06", "KPIs & Success Metrics"),
      ...sec(SECTION_GROUPS.kpis).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S07 — DEPENDENCIES
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("07", "Dependencies & Constraints"),
      ...sec(SECTION_GROUPS.dependencies).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S08 — CONSULTANT GUIDANCE
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("08", "Consultant Guidance"),
      ...sec(SECTION_GROUPS.consultant).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      ...(blueprint.consultantNotes?.trim()
        ? [
            subsectionHeading("Blueprint-Level Notes"),
            bodyText(blueprint.consultantNotes, [0, 0, 0, 12]),
          ]
        : []),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // S09 — EXECUTIVE DECISIONS
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("09", "Executive Decisions Required"),
      ...sec(SECTION_GROUPS.decisions).map((s) => [
        subsectionHeading(s.title),
        bodyText(s.content, [0, 0, 0, 12]),
      ]).flat(),
      { text: "", pageBreak: "after" },

      // ─────────────────────────────────────────────────────────
      // APPENDIX
      // ─────────────────────────────────────────────────────────
      ...chapterHeading("A", "Appendix — Reference Information"),
      {
        table: {
          widths: [140, "*"],
          body: [
            [{ text: "Blueprint Version", bold: true, fontSize: 9 }, { text: blueprint.versionLabel, fontSize: 9 }],
            [{ text: "Status", bold: true, fontSize: 9 }, { text: blueprint.status.replace(/_/g, " "), fontSize: 9 }],
            [{ text: "Client", bold: true, fontSize: 9 }, { text: blueprint.clientName, fontSize: 9 }],
            [{ text: "Project", bold: true, fontSize: 9 }, { text: blueprint.projectName ?? "—", fontSize: 9 }],
            [{ text: "Assessment ID", bold: true, fontSize: 9 }, { text: blueprint.growthAssessmentId, fontSize: 9, color: C.muted }],
            [{ text: "Recommendation Plan ID", bold: true, fontSize: 9 }, { text: blueprint.solutionRecommendationPlanId, fontSize: 9, color: C.muted }],
            [{ text: "Generated Date", bold: true, fontSize: 9 }, { text: formatDate(blueprint.generatedAt), fontSize: 9 }],
            [{ text: "Approved Date", bold: true, fontSize: 9 }, { text: formatDate(blueprint.approvedAt), fontSize: 9 }],
            [{ text: "Prepared Date", bold: true, fontSize: 9 }, { text: preparedDate, fontSize: 9 }],
            [{ text: "Prepared By", bold: true, fontSize: 9 }, { text: branding.preparedBy, fontSize: 9 }],
          ].map(([label, value], i) => [
            { ...(label as object), fillColor: i % 2 === 0 ? C.bg : C.white },
            { ...(value as object), fillColor: i % 2 === 0 ? C.bg : C.white },
          ]),
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => C.border,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 24],
      },
    ],
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
