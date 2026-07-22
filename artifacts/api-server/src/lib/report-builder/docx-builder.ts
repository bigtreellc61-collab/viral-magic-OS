/**
 * Word (DOCX) builder using the `docx` npm package.
 *
 * Generates a professionally formatted .docx file preserving section
 * hierarchy, headings, roadmap table, consultant notes, and page breaks.
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
} from "docx";

import type { BrandingConfig } from "../branding";
import type { BlueprintExportModel, BlueprintInitiative } from "./blueprint-model";
import { getSectionsByKeys, formatDate, SECTION_GROUPS } from "./blueprint-model";
import { buildExecutiveSummary } from "./executive-summary-model";

// ─── Helpers ─────────────────────────────────────────────────────

const BODY_COLOR = "334155";
const MUTED_COLOR = "64748b";
const HEADING_COLOR = "0f172a";
const ACCENT_COLOR = "4c1d95";

function paraStyle(
  text: string,
  opts: {
    bold?: boolean;
    color?: string;
    size?: number; // half-points
    spacing?: { before?: number; after?: number };
    italics?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color ?? BODY_COLOR,
        size: opts.size ?? 20,
        italics: opts.italics,
        font: "Calibri",
      }),
    ],
    alignment: opts.alignment,
    spacing: opts.spacing,
  });
}

function sectionBodyParagraphs(content: string, label?: string): Paragraph[] {
  const paras: Paragraph[] = [];
  if (label) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: label.toUpperCase(),
            color: MUTED_COLOR,
            size: 14,
            bold: true,
            characterSpacing: 40,
            font: "Calibri",
          }),
        ],
        spacing: { before: 280, after: 60 },
      }),
    );
  }
  if (!content.trim()) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "No content generated for this section.",
            italics: true,
            color: MUTED_COLOR,
            size: 18,
            font: "Calibri",
          }),
        ],
        spacing: { after: 160 },
      }),
    );
    return paras;
  }
  const parts = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: part.replace(/\n/g, " "), color: BODY_COLOR, size: 20, font: "Calibri" }),
        ],
        spacing: { after: 160 },
      }),
    );
  }
  return paras;
}

function chapterHeading(num: string, title: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: num ? `${num}  ` : "", color: MUTED_COLOR, size: 18, font: "Calibri" }),
        new TextRun({ text: title, bold: true, color: HEADING_COLOR, size: 32, font: "Calibri" }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 120 },
      pageBreakBefore: true,
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      },
    }),
  ];
}

function roadmapTable(initiatives: BlueprintInitiative[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Initiative", bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: HEADING_COLOR },
        width: { size: 55, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: HEADING_COLOR },
        width: { size: 20, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Effort", bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: HEADING_COLOR },
        width: { size: 12, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Owner", bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: HEADING_COLOR },
        width: { size: 13, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  if (initiatives.length === 0) {
    return new Table({
      rows: [
        headerRow,
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "No initiatives for this period.", italics: true, color: MUTED_COLOR, size: 18, font: "Calibri" })] })],
              columnSpan: 4,
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }

  const dataRows = initiatives.map((ini, idx) =>
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: ini.title, bold: true, color: HEADING_COLOR, size: 18, font: "Calibri" })] }),
            new Paragraph({ children: [new TextRun({ text: ini.domain, color: MUTED_COLOR, size: 16, font: "Calibri" })] }),
            ...(ini.isQuickWin ? [new Paragraph({ children: [new TextRun({ text: "⚡ Quick Win", color: ACCENT_COLOR, size: 14, bold: true, font: "Calibri" })] })] : []),
          ],
          shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? "F8FAFC" : "FFFFFF" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ini.priorityClassification, color: BODY_COLOR, size: 16, font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? "F8FAFC" : "FFFFFF" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ini.effortLevel?.replace(/_/g, " ") ?? "—", color: BODY_COLOR, size: 16, font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? "F8FAFC" : "FFFFFF" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ini.ownerPlaceholder ?? "—", color: BODY_COLOR, size: 16, font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? "F8FAFC" : "FFFFFF" },
        }),
      ],
    }),
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─── Main export ─────────────────────────────────────────────────

export async function buildDocx(
  blueprint: BlueprintExportModel,
  branding: BrandingConfig,
): Promise<Buffer> {
  const sec = (keys: readonly string[]) =>
    getSectionsByKeys(blueprint.sections, keys);

  const preparedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const execSummary = buildExecutiveSummary(blueprint, preparedDate);

  const doc = new Document({
    title: blueprint.title,
    subject: "Growth Blueprint",
    creator: branding.preparedBy,
    description: `Growth Blueprint for ${blueprint.clientName}`,

    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 20, color: BODY_COLOR },
        },
      ],
    },

    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
          },
        },

        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: blueprint.title, color: MUTED_COLOR, size: 16, font: "Calibri" }),
                  new TextRun({ text: "    —    ", color: MUTED_COLOR, size: 16, font: "Calibri" }),
                  new TextRun({ text: branding.companyName, color: MUTED_COLOR, size: 16, font: "Calibri" }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" } },
                spacing: { after: 80 },
              }),
            ],
          }),
        },

        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: branding.reportFooter + "    ", color: MUTED_COLOR, size: 16, font: "Calibri" }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MUTED_COLOR, size: 16, font: "Calibri" }),
                  new TextRun({ text: " / ", color: MUTED_COLOR, size: 16, font: "Calibri" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED_COLOR, size: 16, font: "Calibri" }),
                ],
                alignment: AlignmentType.RIGHT,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" } },
              }),
            ],
          }),
        },

        children: [
          // ── Cover Page ──────────────────────────────────────
          new Paragraph({
            children: [new TextRun({ text: branding.logoPlaceholder, color: MUTED_COLOR, size: 20, font: "Calibri" })],
            spacing: { after: 1200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: blueprint.title, bold: true, color: HEADING_COLOR, size: 52, font: "Calibri" })],
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Growth Blueprint", color: MUTED_COLOR, size: 28, font: "Calibri" })],
            spacing: { after: 800 },
          }),
          paraStyle(`Client: ${blueprint.clientName}`, { bold: true, color: HEADING_COLOR, size: 22, spacing: { after: 120 } }),
          paraStyle(`Project: ${blueprint.projectName ?? "—"}`, { color: BODY_COLOR, spacing: { after: 120 } }),
          paraStyle(`Version: ${blueprint.versionLabel}`, { color: BODY_COLOR, spacing: { after: 120 } }),
          paraStyle(`Status: ${blueprint.status.replace(/_/g, " ")}`, { color: BODY_COLOR, spacing: { after: 120 } }),
          paraStyle(`Prepared by: ${branding.preparedBy}`, { color: BODY_COLOR, spacing: { after: 120 } }),
          paraStyle(`Prepared date: ${preparedDate}`, { color: BODY_COLOR, spacing: { after: 800 } }),
          ...(blueprint.assessmentHealthScore !== null
            ? [paraStyle(
                `Health Score: ${blueprint.assessmentHealthScore.toFixed(0)} / 100  —  ${(blueprint.assessmentHealthRating ?? "").replace(/_/g, " ")}`,
                { bold: true, color: HEADING_COLOR, size: 22, spacing: { after: 160 } },
              )]
            : []),
          new Paragraph({ children: [new PageBreak()] }),

          // ── EX: Executive One-Page Summary ──────────────────
          ...chapterHeading("EX", "Executive One-Page Summary"),
          paraStyle(
            `${execSummary.client}  ·  ${execSummary.project ?? "—"}  ·  ${execSummary.blueprintVersion}`,
            { color: MUTED_COLOR, spacing: { after: 80 } },
          ),
          paraStyle(
            `Assessed: ${execSummary.assessmentDate}  |  Prepared: ${execSummary.preparedDate}`,
            { color: MUTED_COLOR, spacing: { after: 200 } },
          ),
          ...(execSummary.healthScore !== null
            ? [paraStyle(
                `Health Score: ${execSummary.healthScore.toFixed(0)} / 100  —  ${(execSummary.healthRating ?? "").replace(/_/g, " ")}`,
                { bold: true, color: HEADING_COLOR, size: 24, spacing: { after: 200 } },
              )]
            : []),
          ...sectionBodyParagraphs(
            execSummary.topRevenueRisks.map((r) => `• ${r}`).join("\n") || "—",
            "Revenue Risks",
          ),
          ...sectionBodyParagraphs(
            execSummary.topGrowthOpportunities.map((o) => `• ${o}`).join("\n") || "—",
            "Growth Opportunities",
          ),
          ...sectionBodyParagraphs(
            execSummary.quickWins.map((w) => `⚡ ${w}`).join("\n") || "—",
            "30-Day Quick Wins",
          ),
          paraStyle("Roadmap Summary", {
            bold: true, color: HEADING_COLOR, size: 22, spacing: { before: 280, after: 120 },
          }),
          new Table({
            rows: [
              new TableRow({
                children: ["30 Days", "60 Days", "90 Days", "Long Term"].map((label) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Calibri", color: HEADING_COLOR })] })],
                    shading: { type: ShadingType.SOLID, color: "F8FAFC" },
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                ),
              }),
              new TableRow({
                children: [
                  execSummary.roadmapSummary["30_days"],
                  execSummary.roadmapSummary["60_days"],
                  execSummary.roadmapSummary["90_days"],
                  execSummary.roadmapSummary.longer_term,
                ].map((n) =>
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: String(n), bold: true, size: 28, font: "Calibri", color: HEADING_COLOR })] }),
                      new Paragraph({ children: [new TextRun({ text: "initiatives", size: 16, font: "Calibri", color: MUTED_COLOR })] }),
                    ],
                    shading: { type: ShadingType.SOLID, color: "FFFFFF" },
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                ),
              }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          ...sectionBodyParagraphs(
            execSummary.expectedBusinessImpact || "See Business Impact section for full details.",
            "Expected Business Impact",
          ),
          ...sectionBodyParagraphs(execSummary.executiveRecommendation, "Executive Recommendation"),
          ...sectionBodyParagraphs(
            execSummary.recommendedNextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") || "—",
            "Recommended Next Steps",
          ),

          // ── Section 01: Executive Summary ───────────────────
          ...chapterHeading("01", "Executive Summary"),
          ...sec(SECTION_GROUPS.executive).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 02: Business Health ─────────────────────
          ...chapterHeading("02", "Business Health Snapshot"),
          ...sec(SECTION_GROUPS.health).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 03: Strategic Priorities ────────────────
          ...chapterHeading("03", "Strategic Priorities"),
          ...sec(SECTION_GROUPS.strategic).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 04: Roadmap ──────────────────────────────
          ...chapterHeading("04", "30 / 60 / 90 Day Roadmap"),
          ...sec(SECTION_GROUPS.roadmap).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),
          paraStyle("30-Day Initiatives", { bold: true, color: HEADING_COLOR, size: 22, spacing: { before: 280, after: 80 } }),
          roadmapTable(blueprint.byPeriod["30_days"]),
          paraStyle("60-Day Initiatives", { bold: true, color: HEADING_COLOR, size: 22, spacing: { before: 280, after: 80 } }),
          roadmapTable(blueprint.byPeriod["60_days"]),
          paraStyle("90-Day Initiatives", { bold: true, color: HEADING_COLOR, size: 22, spacing: { before: 280, after: 80 } }),
          roadmapTable(blueprint.byPeriod["90_days"]),
          paraStyle("Longer-Term Initiatives", { bold: true, color: HEADING_COLOR, size: 22, spacing: { before: 280, after: 80 } }),
          roadmapTable(blueprint.byPeriod.longer_term),

          // ── Section 05: Business Impact ──────────────────────
          ...chapterHeading("05", "Business Impact"),
          ...sec(SECTION_GROUPS.impact).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 06: KPIs ─────────────────────────────────
          ...chapterHeading("06", "KPIs & Success Metrics"),
          ...sec(SECTION_GROUPS.kpis).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 07: Dependencies ─────────────────────────
          ...chapterHeading("07", "Dependencies & Constraints"),
          ...sec(SECTION_GROUPS.dependencies).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Section 08: Consultant Guidance ──────────────────
          ...chapterHeading("08", "Consultant Guidance"),
          ...sec(SECTION_GROUPS.consultant).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),
          ...(blueprint.consultantNotes?.trim()
            ? sectionBodyParagraphs(blueprint.consultantNotes, "Blueprint-Level Notes")
            : []),

          // ── Section 09: Executive Decisions ──────────────────
          ...chapterHeading("09", "Executive Decisions Required"),
          ...sec(SECTION_GROUPS.decisions).flatMap((s) =>
            sectionBodyParagraphs(s.content, s.title),
          ),

          // ── Appendix ─────────────────────────────────────────
          ...chapterHeading("A", "Appendix — Reference Information"),
          new Table({
            rows: [
              ["Blueprint Version", blueprint.versionLabel],
              ["Status", blueprint.status.replace(/_/g, " ")],
              ["Client", blueprint.clientName],
              ["Project", blueprint.projectName ?? "—"],
              ["Assessment ID", blueprint.growthAssessmentId],
              ["Recommendation Plan ID", blueprint.solutionRecommendationPlanId],
              ["Generated Date", formatDate(blueprint.generatedAt)],
              ["Approved Date", formatDate(blueprint.approvedAt)],
              ["Prepared Date", preparedDate],
              ["Prepared By", branding.preparedBy],
            ].map(([label, value], i) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Calibri", color: HEADING_COLOR })] })],
                    shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
                    width: { size: 35, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: value, size: 18, font: "Calibri", color: BODY_COLOR })] })],
                    shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
                    width: { size: 65, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
            ),
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
