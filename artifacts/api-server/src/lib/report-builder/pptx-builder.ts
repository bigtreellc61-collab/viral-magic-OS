/**
 * PowerPoint (PPTX) builder using pptxgenjs.
 *
 * Generates a 12-slide professional presentation with editable text.
 * No screenshots or embedded images — all content is native PowerPoint text.
 */

import PptxGenJS from "pptxgenjs";
import type { BrandingConfig } from "../branding";
import type { BlueprintExportModel, BlueprintInitiative } from "./blueprint-model";
import { getSectionsByKeys, formatDate, SECTION_GROUPS } from "./blueprint-model";
import { buildExecutiveSummary, type ExecutiveSummary } from "./executive-summary-model";

// ─── Slide design constants ───────────────────────────────────────

const DARK_BG = "0F172A";
const LIGHT_BG = "F8FAFC";
const ACCENT = "4C1D95";
const WHITE = "FFFFFF";
const INK = "0F172A";
const BODY = "334155";
const MUTED = "94A3B8";
const BORDER = "CBD5E1";

type Inches = number;

const W: Inches = 10;
const H: Inches = 5.625;

// ─── Helpers ─────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  if (!text) return "No content generated for this section.";
  const cleaned = text.replace(/\n+/g, " ").trim();
  return cleaned.length <= maxChars
    ? cleaned
    : cleaned.slice(0, maxChars - 1) + "…";
}

function addCoverSlide(
  pptx: PptxGenJS,
  blueprint: BlueprintExportModel,
  branding: BrandingConfig,
): void {
  const slide = pptx.addSlide();
  slide.background = { color: DARK_BG };

  // Accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: H, fill: { color: ACCENT }, line: { color: ACCENT },
  });

  // Logo placeholder
  slide.addText(branding.logoPlaceholder, {
    x: 0.3, y: 0.3, w: 4, h: 0.4,
    fontSize: 9, color: MUTED, fontFace: "Calibri",
  });

  // Title
  slide.addText(blueprint.title, {
    x: 0.3, y: 1.1, w: 7, h: 1.2,
    fontSize: 32, bold: true, color: WHITE, fontFace: "Calibri",
    wrap: true,
  });
  slide.addText("Growth Blueprint", {
    x: 0.3, y: 2.4, w: 5, h: 0.4,
    fontSize: 14, color: MUTED, fontFace: "Calibri",
  });

  // Meta
  const meta = [
    `Client: ${blueprint.clientName}`,
    `Project: ${blueprint.projectName ?? "—"}`,
    `${blueprint.versionLabel}  ·  ${blueprint.status.replace(/_/g, " ")}`,
    `Prepared by ${branding.preparedBy}`,
  ].join("\n");
  slide.addText(meta, {
    x: 0.3, y: 3.1, w: 5, h: 1.4,
    fontSize: 11, color: MUTED, fontFace: "Calibri",
    lineSpacingMultiple: 1.4,
  });

  // Health score badge (right)
  if (blueprint.assessmentHealthScore !== null) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.8, y: 1.6, w: 1.9, h: 2,
      fill: { color: "1E293B" }, line: { color: "334155" },
    });
    slide.addText(`${blueprint.assessmentHealthScore.toFixed(0)}`, {
      x: 7.8, y: 1.8, w: 1.9, h: 0.8,
      fontSize: 36, bold: true, color: WHITE, fontFace: "Calibri", align: "center",
    });
    slide.addText("/100", {
      x: 7.8, y: 2.6, w: 1.9, h: 0.3,
      fontSize: 10, color: MUTED, fontFace: "Calibri", align: "center",
    });
    slide.addText("Health Score", {
      x: 7.8, y: 2.9, w: 1.9, h: 0.3,
      fontSize: 8, color: MUTED, fontFace: "Calibri", align: "center",
    });
    slide.addText((blueprint.assessmentHealthRating ?? "").replace(/_/g, " "), {
      x: 7.8, y: 3.2, w: 1.9, h: 0.3,
      fontSize: 8, color: MUTED, fontFace: "Calibri", align: "center",
    });
  }

  // Footer
  slide.addText(`${branding.reportFooter}  ·  ${new Date().getFullYear()}`, {
    x: 0.3, y: H - 0.35, w: W - 0.6, h: 0.3,
    fontSize: 8, color: MUTED, fontFace: "Calibri",
  });
}

function addContentSlide(
  pptx: PptxGenJS,
  num: string,
  title: string,
  body: string,
  branding: BrandingConfig,
  opts: { dark?: boolean; rightText?: string } = {},
): void {
  const slide = pptx.addSlide();
  slide.background = { color: opts.dark ? DARK_BG : LIGHT_BG };
  const textColor = opts.dark ? WHITE : INK;
  const bodyColor = opts.dark ? MUTED : BODY;

  // Accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: H,
    fill: { color: ACCENT }, line: { color: ACCENT },
  });

  // Slide number
  slide.addText(num, {
    x: 0.25, y: 0.2, w: 0.6, h: 0.3,
    fontSize: 9, color: MUTED, fontFace: "Calibri",
  });

  // Title
  slide.addText(title, {
    x: 0.25, y: 0.5, w: opts.rightText ? 5.5 : W - 0.6, h: 0.7,
    fontSize: 20, bold: true, color: textColor, fontFace: "Calibri",
  });

  // Divider
  slide.addShape(pptx.ShapeType.line, {
    x: 0.25, y: 1.25, w: W - 0.5, h: 0,
    line: { color: BORDER, width: 0.5 },
  });

  // Body text
  slide.addText(truncate(body, 900), {
    x: 0.25, y: 1.4, w: opts.rightText ? 5.2 : W - 0.6, h: H - 1.9,
    fontSize: 11, color: bodyColor, fontFace: "Calibri",
    wrap: true, valign: "top", lineSpacingMultiple: 1.4,
  });

  // Optional right panel
  if (opts.rightText) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 5.7, y: 1.35, w: 4.05, h: H - 1.75,
      fill: { color: opts.dark ? "1E293B" : "E2E8F0" }, line: { color: BORDER },
    });
    slide.addText(truncate(opts.rightText, 400), {
      x: 5.85, y: 1.5, w: 3.75, h: H - 2,
      fontSize: 10, color: bodyColor, fontFace: "Calibri",
      wrap: true, valign: "top", lineSpacingMultiple: 1.4,
    });
  }

  // Footer
  slide.addText(branding.reportFooter, {
    x: 0.25, y: H - 0.25, w: W - 0.5, h: 0.25,
    fontSize: 7, color: MUTED, fontFace: "Calibri",
  });
}

function addRoadmapSlide(
  pptx: PptxGenJS,
  num: string,
  title: string,
  period: string,
  initiatives: BlueprintInitiative[],
  narrativeContent: string,
  branding: BrandingConfig,
): void {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT_BG };

  // Accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: H,
    fill: { color: ACCENT }, line: { color: ACCENT },
  });

  slide.addText(num, {
    x: 0.25, y: 0.2, w: 0.6, h: 0.3,
    fontSize: 9, color: MUTED, fontFace: "Calibri",
  });

  slide.addText(title, {
    x: 0.25, y: 0.5, w: 6, h: 0.7,
    fontSize: 20, bold: true, color: INK, fontFace: "Calibri",
  });

  // Count badge
  slide.addShape(pptx.ShapeType.rect, {
    x: 8.3, y: 0.45, w: 1.4, h: 0.75,
    fill: { color: DARK_BG }, line: { color: DARK_BG },
  });
  slide.addText(`${initiatives.length}\ninitiatives`, {
    x: 8.3, y: 0.45, w: 1.4, h: 0.75,
    fontSize: 10, bold: true, color: WHITE, fontFace: "Calibri",
    align: "center", valign: "middle", lineSpacingMultiple: 1.2,
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.25, y: 1.25, w: W - 0.5, h: 0,
    line: { color: BORDER, width: 0.5 },
  });

  // Narrative context
  if (narrativeContent) {
    slide.addText(truncate(narrativeContent, 200), {
      x: 0.25, y: 1.35, w: W - 0.5, h: 0.5,
      fontSize: 9.5, color: MUTED, fontFace: "Calibri", italics: true, wrap: true,
    });
  }

  // Initiative list as rows
  const rowH = 0.52;
  const startY = narrativeContent ? 1.95 : 1.4;
  const maxRows = Math.floor((H - startY - 0.4) / rowH);
  const shown = initiatives.slice(0, maxRows);

  shown.forEach((ini, idx) => {
    const y = startY + idx * rowH;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.25, y, w: W - 0.5, h: rowH - 0.04,
      fill: { color: idx % 2 === 0 ? "EFF6FF" : WHITE },
      line: { color: BORDER, width: 0.3 },
    });
    // Priority color strip
    const pColor =
      ini.priorityClassification === "Critical Priority"
        ? "EF4444"
        : ini.priorityClassification === "High Priority"
        ? "F97316"
        : ini.priorityClassification === "Important"
        ? "F59E0B"
        : "6366F1";
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.25, y, w: 0.04, h: rowH - 0.04,
      fill: { color: pColor }, line: { color: pColor },
    });
    slide.addText(ini.title + (ini.isQuickWin ? "  ⚡" : ""), {
      x: 0.38, y: y + 0.04, w: 5.2, h: 0.28,
      fontSize: 9.5, bold: true, color: INK, fontFace: "Calibri",
    });
    slide.addText(`${ini.domain}  ·  ${ini.priorityClassification}  ·  ${ini.effortLevel?.replace(/_/g, " ") ?? ""}`, {
      x: 0.38, y: y + 0.26, w: 5.2, h: 0.2,
      fontSize: 7.5, color: MUTED, fontFace: "Calibri",
    });
    slide.addText(ini.ownerPlaceholder ?? "—", {
      x: 5.7, y: y + 0.1, w: 4.05, h: 0.3,
      fontSize: 8.5, color: BODY, fontFace: "Calibri", align: "right",
    });
  });

  if (initiatives.length > maxRows) {
    slide.addText(`+ ${initiatives.length - maxRows} more initiative(s) — see full report`, {
      x: 0.25, y: H - 0.45, w: W - 0.5, h: 0.25,
      fontSize: 8, color: MUTED, fontFace: "Calibri", italics: true,
    });
  }

  slide.addText(branding.reportFooter, {
    x: 0.25, y: H - 0.25, w: W - 0.5, h: 0.25,
    fontSize: 7, color: MUTED, fontFace: "Calibri",
  });
}

function addClosingSlide(
  pptx: PptxGenJS,
  blueprint: BlueprintExportModel,
  branding: BrandingConfig,
): void {
  const slide = pptx.addSlide();
  slide.background = { color: DARK_BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: H,
    fill: { color: ACCENT }, line: { color: ACCENT },
  });

  slide.addText("Thank you", {
    x: 0.3, y: 1.4, w: 8, h: 0.9,
    fontSize: 36, bold: true, color: WHITE, fontFace: "Calibri",
  });
  slide.addText(`${blueprint.clientName}  —  ${blueprint.title}`, {
    x: 0.3, y: 2.35, w: 9.2, h: 0.4,
    fontSize: 13, color: MUTED, fontFace: "Calibri",
  });

  const contact = [
    branding.preparedBy,
    branding.website,
    branding.contactInformation,
  ].filter(Boolean).join("  ·  ");
  slide.addText(contact, {
    x: 0.3, y: 3.3, w: 9.2, h: 0.4,
    fontSize: 11, color: MUTED, fontFace: "Calibri",
  });

  slide.addText([
    blueprint.versionLabel,
    `Approved: ${formatDate(blueprint.approvedAt)}`,
  ].filter(Boolean).join("  ·  "), {
    x: 0.3, y: H - 0.5, w: 9.2, h: 0.3,
    fontSize: 8, color: MUTED, fontFace: "Calibri",
  });
}

// ─── Executive Snapshot slide ─────────────────────────────────────

function addExecSnapshotSlide(
  pptx: PptxGenJS,
  summary: ExecutiveSummary,
  branding: BrandingConfig,
): void {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT_BG };

  // Accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: H, fill: { color: ACCENT }, line: { color: ACCENT } });

  // Slide number + title
  slide.addText("02", { x: 0.25, y: 0.2, w: 0.6, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Calibri" });
  slide.addText("CEO Snapshot", { x: 0.25, y: 0.48, w: 6, h: 0.55, fontSize: 22, bold: true, color: INK, fontFace: "Calibri" });
  slide.addText("Executive One-Page Summary", { x: 0.25, y: 1.02, w: 6, h: 0.28, fontSize: 10, color: MUTED, fontFace: "Calibri", italics: true });

  // Meta strip (right side of header)
  const metaText = [
    `Client: ${summary.client}`,
    `Project: ${summary.project ?? "—"}`,
    `${summary.blueprintVersion}`,
    `Assessed: ${summary.assessmentDate}`,
    `Prepared: ${summary.preparedDate}`,
  ].join("  ·  ");
  slide.addText(metaText, { x: 0.25, y: 1.32, w: W - 0.5, h: 0.22, fontSize: 7.5, color: MUTED, fontFace: "Calibri", wrap: true });

  // Divider
  slide.addShape(pptx.ShapeType.line, { x: 0.25, y: 1.56, w: W - 0.5, h: 0, line: { color: BORDER, width: 0.5 } });

  // ── Left panel: Health Score ─────────────────────────────────
  const indicatorColor =
    summary.healthIndicator === "green" ? "10B981"
    : summary.healthIndicator === "yellow" ? "F59E0B"
    : summary.healthIndicator === "red" ? "EF4444"
    : MUTED;

  slide.addShape(pptx.ShapeType.rect, { x: 0.25, y: 1.65, w: 2.15, h: 2.5, fill: { color: DARK_BG }, line: { color: DARK_BG } });
  slide.addText("HEALTH SCORE", { x: 0.35, y: 1.75, w: 1.95, h: 0.22, fontSize: 7, color: MUTED, fontFace: "Calibri", align: "center", bold: true });
  slide.addText(summary.healthScore !== null ? `${summary.healthScore.toFixed(0)}` : "—", {
    x: 0.35, y: 1.95, w: 1.95, h: 0.75,
    fontSize: 40, bold: true, color: indicatorColor, fontFace: "Calibri", align: "center",
  });
  slide.addText("/100", { x: 0.35, y: 2.68, w: 1.95, h: 0.22, fontSize: 9, color: MUTED, fontFace: "Calibri", align: "center" });
  slide.addText((summary.healthRating ?? "").replace(/_/g, " "), { x: 0.35, y: 2.92, w: 1.95, h: 0.22, fontSize: 9, color: indicatorColor, fontFace: "Calibri", align: "center" });

  // Roadmap counts inside left panel
  slide.addShape(pptx.ShapeType.line, { x: 0.35, y: 3.25, w: 1.85, h: 0, line: { color: BORDER, width: 0.3 } });
  slide.addText("ROADMAP", { x: 0.35, y: 3.32, w: 1.95, h: 0.2, fontSize: 7, color: MUTED, fontFace: "Calibri", align: "center", bold: true });
  const roadmapText = `30d: ${summary.roadmapSummary["30_days"]}   60d: ${summary.roadmapSummary["60_days"]}\n90d: ${summary.roadmapSummary["90_days"]}   LT: ${summary.roadmapSummary.longer_term}`;
  slide.addText(roadmapText, { x: 0.35, y: 3.54, w: 1.95, h: 0.56, fontSize: 11, bold: true, color: WHITE, fontFace: "Calibri", align: "center", lineSpacingMultiple: 1.4 });

  // ── Middle panel: Risks + Opportunities ─────────────────────
  const midX = 2.55;
  const midW = 3.55;

  slide.addText("REVENUE RISKS", { x: midX, y: 1.65, w: midW, h: 0.22, fontSize: 7, color: MUTED, fontFace: "Calibri", bold: true });
  const risksText = summary.topRevenueRisks.length > 0
    ? summary.topRevenueRisks.map((r) => `•  ${r}`).join("\n")
    : "—";
  slide.addText(risksText, { x: midX, y: 1.9, w: midW, h: 1.0, fontSize: 9, color: BODY, fontFace: "Calibri", wrap: true, valign: "top", lineSpacingMultiple: 1.4 });

  slide.addShape(pptx.ShapeType.line, { x: midX, y: 3.0, w: midW, h: 0, line: { color: BORDER, width: 0.3 } });
  slide.addText("GROWTH OPPORTUNITIES", { x: midX, y: 3.06, w: midW, h: 0.22, fontSize: 7, color: MUTED, fontFace: "Calibri", bold: true });
  const oppsText = summary.topGrowthOpportunities.length > 0
    ? summary.topGrowthOpportunities.map((o) => `•  ${o}`).join("\n")
    : "—";
  slide.addText(oppsText, { x: midX, y: 3.3, w: midW, h: 0.85, fontSize: 9, color: BODY, fontFace: "Calibri", wrap: true, valign: "top", lineSpacingMultiple: 1.4 });

  // ── Right panel: Quick Wins + Recommendation ─────────────────
  const rtX = 6.35;
  const rtW = 3.4;

  slide.addText("30-DAY QUICK WINS", { x: rtX, y: 1.65, w: rtW, h: 0.22, fontSize: 7, color: MUTED, fontFace: "Calibri", bold: true });
  const qwText = summary.quickWins.length > 0
    ? summary.quickWins.map((w) => `⚡  ${w}`).join("\n")
    : "—";
  slide.addText(qwText, { x: rtX, y: 1.9, w: rtW, h: 1.0, fontSize: 9, color: BODY, fontFace: "Calibri", wrap: true, valign: "top", lineSpacingMultiple: 1.4 });

  slide.addShape(pptx.ShapeType.line, { x: rtX, y: 3.0, w: rtW, h: 0, line: { color: BORDER, width: 0.3 } });
  slide.addText("EXECUTIVE RECOMMENDATION", { x: rtX, y: 3.06, w: rtW, h: 0.22, fontSize: 7, color: MUTED, fontFace: "Calibri", bold: true });
  slide.addText(truncate(summary.executiveRecommendation, 280), { x: rtX, y: 3.3, w: rtW, h: 0.85, fontSize: 8.5, color: BODY, fontFace: "Calibri", wrap: true, valign: "top", lineSpacingMultiple: 1.4, italics: true });

  // ── Bottom strip: Next Steps ──────────────────────────────────
  if (summary.recommendedNextSteps.length > 0) {
    slide.addShape(pptx.ShapeType.rect, { x: 0.25, y: 4.28, w: W - 0.5, h: 0.75, fill: { color: "1E293B" }, line: { color: "334155" } });
    slide.addText("NEXT STEPS", { x: 0.4, y: 4.32, w: 1.2, h: 0.2, fontSize: 7, color: MUTED, fontFace: "Calibri", bold: true });
    const stepsText = summary.recommendedNextSteps.map((s, i) => `${i + 1}.  ${s}`).join("     ");
    slide.addText(stepsText, { x: 0.4, y: 4.52, w: W - 0.9, h: 0.42, fontSize: 9, color: WHITE, fontFace: "Calibri", wrap: true, valign: "top", lineSpacingMultiple: 1.3 });
  }

  // Footer
  slide.addText(branding.reportFooter, { x: 0.25, y: H - 0.25, w: W - 0.5, h: 0.25, fontSize: 7, color: MUTED, fontFace: "Calibri" });
}

// ─── Main export ─────────────────────────────────────────────────

export async function buildPptx(
  blueprint: BlueprintExportModel,
  branding: BrandingConfig,
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 16:9
  pptx.title = blueprint.title;
  pptx.subject = "Growth Blueprint";
  pptx.author = branding.preparedBy;
  pptx.company = branding.companyName;

  const sec = (keys: readonly string[]) =>
    getSectionsByKeys(blueprint.sections, keys);
  const firstContent = (keys: readonly string[]) =>
    sec(keys).map((s) => s.content).join("\n\n") || "";

  const execSummary = buildExecutiveSummary(
    blueprint,
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  );

  // ── Slide 1: Cover ────────────────────────────────────────────
  addCoverSlide(pptx, blueprint, branding);

  // ── Slide 2: CEO Snapshot ─────────────────────────────────────
  addExecSnapshotSlide(pptx, execSummary, branding);

  // ── Slide 3: Executive Summary ────────────────────────────────
  addContentSlide(
    pptx, "03", "Executive Summary",
    firstContent(SECTION_GROUPS.executive),
    branding, { dark: true },
  );

  // ── Slide 4: Business Health ──────────────────────────────────
  const healthSecs = sec(SECTION_GROUPS.health);
  const healthBody = healthSecs.slice(0, 2).map((s) => s.content).join("\n\n");
  const healthRight = healthSecs.slice(2).map((s) => `${s.title.toUpperCase()}\n${s.content}`).join("\n\n");
  addContentSlide(pptx, "04", "Business Health Snapshot", healthBody, branding, {
    rightText: [
      blueprint.assessmentHealthScore !== null
        ? `Health Score: ${blueprint.assessmentHealthScore.toFixed(0)} / 100  (${(blueprint.assessmentHealthRating ?? "").replace(/_/g, " ")})`
        : "",
      healthRight,
    ].filter(Boolean).join("\n\n"),
  });

  // ── Slide 5: Strategic Priorities ────────────────────────────
  addContentSlide(
    pptx, "05", "Strategic Priorities",
    firstContent(SECTION_GROUPS.strategic),
    branding,
  );

  // ── Slides 6–9: Roadmap periods ──────────────────────────────
  const roadmapNarr = sec(SECTION_GROUPS.roadmap);
  const getNarr = (key: string) =>
    roadmapNarr.find((s) => s.sectionKey === key)?.content ?? "";

  addRoadmapSlide(pptx, "06", "30-Day Plan", "30_days", blueprint.byPeriod["30_days"], getNarr("action_plan_30_days"), branding);
  addRoadmapSlide(pptx, "07", "60-Day Plan", "60_days", blueprint.byPeriod["60_days"], getNarr("action_plan_60_days"), branding);
  addRoadmapSlide(pptx, "08", "90-Day Plan", "90_days", blueprint.byPeriod["90_days"], getNarr("action_plan_90_days"), branding);
  addRoadmapSlide(pptx, "09", "Long-Term Roadmap", "longer_term", blueprint.byPeriod.longer_term, getNarr("longer_term_roadmap"), branding);

  // ── Slide 10: KPIs ────────────────────────────────────────────
  addContentSlide(
    pptx, "10", "KPIs & Success Metrics",
    firstContent(SECTION_GROUPS.kpis),
    branding,
  );

  // ── Slide 11: Business Impact ─────────────────────────────────
  addContentSlide(
    pptx, "11", "Business Impact",
    firstContent(SECTION_GROUPS.impact),
    branding,
  );

  // ── Slide 12: Executive Decisions ─────────────────────────────
  addContentSlide(
    pptx, "12", "Executive Decisions Required",
    firstContent(SECTION_GROUPS.decisions),
    branding,
    { dark: true },
  );

  // ── Slide 13: Closing ─────────────────────────────────────────
  addClosingSlide(pptx, blueprint, branding);

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
