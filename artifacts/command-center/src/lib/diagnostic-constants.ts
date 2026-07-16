// ─── Diagnostic Types ────────────────────────────────────────
export const DIAGNOSTIC_TYPES: { value: string; label: string }[] = [
  { value: "business_growth_assessment", label: "Business Growth Assessment" },
  { value: "business_bottleneck_assessment", label: "Business Bottleneck Assessment" },
  { value: "technology_assessment", label: "Technology Assessment" },
  { value: "marketing_assessment", label: "Marketing Assessment" },
  { value: "operations_assessment", label: "Operations Assessment" },
  { value: "custom", label: "Custom" },
];

// ─── Diagnostic Statuses ─────────────────────────────────────
export const DIAGNOSTIC_STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "awaiting_review", label: "Awaiting Review" },
  { value: "approved", label: "Approved" },
  { value: "superseded", label: "Superseded" },
  { value: "archived", label: "Archived" },
];

export const DIAGNOSTIC_RESTORE_STATUSES = DIAGNOSTIC_STATUSES.filter(
  (s) => s.value !== "archived" && s.value !== "superseded",
);

// ─── Severity ────────────────────────────────────────────────
export const SEVERITIES: { value: string; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "monitor", label: "Monitor" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

// ─── Resolution statuses ─────────────────────────────────────
export const RESOLUTION_STATUSES: { value: string; label: string }[] = [
  { value: "unresolved", label: "Unresolved" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "accepted_risk", label: "Accepted Risk" },
  { value: "deferred", label: "Deferred" },
];

// ─── Recommendation statuses ─────────────────────────────────
export const RECOMMENDATION_STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "edited", label: "Edited" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "implemented", label: "Implemented" },
];

// ─── Sort options ────────────────────────────────────────────
export const DIAGNOSTIC_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "recently_updated", label: "Recently Updated" },
  { value: "lowest_health", label: "Lowest Health Score" },
  { value: "highest_health", label: "Highest Health Score" },
  { value: "highest_priority", label: "Highest Priority" },
  { value: "client_az", label: "Client A–Z" },
];

// ─── Color maps ──────────────────────────────────────────────
export const DIAGNOSTIC_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  awaiting_review: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  superseded: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  archived: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export const SEVERITY_COLORS: Record<string, string> = {
  healthy: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  monitor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  moderate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

export const SEVERITY_BAR_COLORS: Record<string, string> = {
  healthy: "bg-emerald-500",
  monitor: "bg-blue-500",
  moderate: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export const RESOLUTION_STATUS_COLORS: Record<string, string> = {
  unresolved: "bg-red-500/20 text-red-300 border-red-500/30",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  resolved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  accepted_risk: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  deferred: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

export const HEALTH_RATING_COLORS: Record<string, string> = {
  strong: "text-emerald-400",
  stable: "text-blue-400",
  vulnerable: "text-yellow-400",
  at_risk: "text-orange-400",
  critical: "text-red-400",
};

export const HEALTH_RATING_BG: Record<string, string> = {
  strong: "bg-emerald-500/20 border-emerald-500/30",
  stable: "bg-blue-500/20 border-blue-500/30",
  vulnerable: "bg-yellow-500/20 border-yellow-500/30",
  at_risk: "bg-orange-500/20 border-orange-500/30",
  critical: "bg-red-500/20 border-red-500/30",
};

// ─── Helpers ─────────────────────────────────────────────────
export function getDiagnosticTypeLabel(type: string): string {
  return DIAGNOSTIC_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function getDiagnosticStatusLabel(status: string): string {
  return DIAGNOSTIC_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getSeverityLabel(severity: string): string {
  return SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
}

export function getResolutionStatusLabel(status: string): string {
  return RESOLUTION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

// ─── Live-preview calculation helpers (mirrors server) ───────
export function liveCalcPerformanceGap(cp: number): number {
  return Math.round((10 - cp) * 10) / 10;
}

export function liveCalcPriorityScore(cp: number, bi: number, ur: number): number {
  return Math.round(liveCalcPerformanceGap(cp) * bi * ur * 100) / 100;
}

export function liveCalcSeverity(ps: number): string {
  if (ps < 40) return "healthy";
  if (ps < 80) return "monitor";
  if (ps < 130) return "moderate";
  if (ps < 190) return "high";
  return "critical";
}

export function liveCalcHealthScore(categories: { cp: number; bi: number }[]): number {
  if (categories.length === 0) return 0;
  let ws = 0; let is = 0;
  for (const c of categories) {
    ws += (c.cp / 10) * 100 * c.bi;
    is += c.bi;
  }
  return is === 0 ? 0 : Math.round(ws / is);
}

export function getHealthRating(score: number): string {
  if (score >= 85) return "strong";
  if (score >= 70) return "stable";
  if (score >= 55) return "vulnerable";
  if (score >= 40) return "at_risk";
  return "critical";
}

export function getHealthRatingLabel(rating: string): string {
  const map: Record<string, string> = {
    strong: "Strong",
    stable: "Stable",
    vulnerable: "Vulnerable",
    at_risk: "At Risk",
    critical: "Critical",
  };
  return map[rating] ?? rating;
}
