/**
 * Server-side diagnostic calculation engine.
 * All calculations happen here — never trust client-only values.
 */

export type Severity = "healthy" | "monitor" | "moderate" | "high" | "critical";
export type HealthRating = "strong" | "stable" | "vulnerable" | "at_risk" | "critical";

export function calcPerformanceGap(currentPerformance: number): number {
  return Math.round((10 - currentPerformance) * 10) / 10;
}

export function calcPriorityScore(
  currentPerformance: number,
  businessImpact: number,
  urgency: number,
): number {
  const gap = calcPerformanceGap(currentPerformance);
  return Math.round(gap * businessImpact * urgency * 100) / 100;
}

export function calcSeverity(priorityScore: number): Severity {
  if (priorityScore < 40) return "healthy";
  if (priorityScore < 80) return "monitor";
  if (priorityScore < 130) return "moderate";
  if (priorityScore < 190) return "high";
  return "critical";
}

export interface CategoryInput {
  currentPerformance: number; // 0–10
  businessImpact: number; // 1–5
  urgency: number; // 1–5
}

export interface CategoryCalculated extends CategoryInput {
  performanceGap: number;
  priorityScore: number;
  severity: Severity;
}

export function calcCategory(input: CategoryInput): CategoryCalculated {
  const performanceGap = calcPerformanceGap(input.currentPerformance);
  const priorityScore = calcPriorityScore(
    input.currentPerformance,
    input.businessImpact,
    input.urgency,
  );
  const severity = calcSeverity(priorityScore);
  return { ...input, performanceGap, priorityScore, severity };
}

/**
 * Business Health Score (0–100).
 * Weighted by businessImpact so high-impact categories matter more.
 */
export function calcHealthScore(categories: CategoryInput[]): number {
  if (categories.length === 0) return 0;
  let weightedSum = 0;
  let impactSum = 0;
  for (const c of categories) {
    const healthPct = (c.currentPerformance / 10) * 100;
    weightedSum += healthPct * c.businessImpact;
    impactSum += c.businessImpact;
  }
  if (impactSum === 0) return 0;
  return Math.round(weightedSum / impactSum);
}

export function getHealthRating(score: number): HealthRating {
  if (score >= 85) return "strong";
  if (score >= 70) return "stable";
  if (score >= 55) return "vulnerable";
  if (score >= 40) return "at_risk";
  return "critical";
}

export function calcAveragePriorityScore(priorityScores: number[]): number {
  if (priorityScores.length === 0) return 0;
  const sum = priorityScores.reduce((a, b) => a + b, 0);
  return Math.round((sum / priorityScores.length) * 100) / 100;
}

export function validateScoreInputs(
  currentPerformance: unknown,
  businessImpact: unknown,
  urgency: unknown,
): { valid: boolean; error?: string } {
  const cp = Number(currentPerformance);
  const bi = Number(businessImpact);
  const ur = Number(urgency);
  if (isNaN(cp) || cp < 0 || cp > 10) {
    return { valid: false, error: "Current performance must be between 0 and 10." };
  }
  if (isNaN(bi) || bi < 1 || bi > 5) {
    return { valid: false, error: "Business impact must be between 1 and 5." };
  }
  if (isNaN(ur) || ur < 1 || ur > 5) {
    return { valid: false, error: "Urgency must be between 1 and 5." };
  }
  return { valid: true };
}
