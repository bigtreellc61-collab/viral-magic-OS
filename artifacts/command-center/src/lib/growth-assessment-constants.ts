// ─── Status types and labels ─────────────────────────────────

export type AssessmentStatus = "draft" | "awaiting_review" | "approved" | "superseded" | "archived";

export const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_review: "Awaiting Review",
  approved: "Approved",
  superseded: "Superseded",
  archived: "Archived",
};

export const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-400 bg-slate-700/50 border-slate-600/50",
  awaiting_review: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  approved: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  superseded: "text-slate-400 bg-slate-700/50 border-slate-600/50",
  archived: "text-slate-500 bg-slate-800/50 border-slate-700/30",
};

// ─── Health rating display ────────────────────────────────────

export const HEALTH_RATING_LABELS: Record<string, string> = {
  strong: "Strong",
  stable: "Stable",
  vulnerable: "Vulnerable",
  at_risk: "At Risk",
  critical: "Critical",
};

export const HEALTH_RATING_COLORS: Record<string, string> = {
  strong: "text-emerald-400",
  stable: "text-green-400",
  vulnerable: "text-yellow-400",
  at_risk: "text-orange-400",
  critical: "text-red-400",
};

export const HEALTH_RATING_BG: Record<string, string> = {
  strong: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
  stable: "bg-green-500/20 border-green-500/30 text-green-300",
  vulnerable: "bg-yellow-500/20 border-yellow-500/30 text-yellow-300",
  at_risk: "bg-orange-500/20 border-orange-500/30 text-orange-300",
  critical: "bg-red-500/20 border-red-500/30 text-red-300",
};

// ─── Strategic classification labels ─────────────────────────

export const STRATEGIC_CLASSIFICATION_LABELS: Record<string, string> = {
  immediate_attention: "Immediate Attention",
  near_term_improvement: "Near-Term Improvement",
  strategic_development: "Strategic Development",
  monitor_maintain: "Monitor & Maintain",
};

export const STRATEGIC_CLASSIFICATION_COLORS: Record<string, string> = {
  immediate_attention: "text-red-300 bg-red-500/20 border-red-500/30",
  near_term_improvement: "text-orange-300 bg-orange-500/20 border-orange-500/30",
  strategic_development: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  monitor_maintain: "text-slate-300 bg-slate-700/50 border-slate-600/50",
};

// ─── Growth opportunity group labels ─────────────────────────

export const OPPORTUNITY_GROUP_LABELS: Record<string, string> = {
  revenue_lead_growth: "Revenue & Lead Growth",
  sales_conversion: "Sales & Conversion",
  customer_experience_retention: "Customer Experience & Retention",
  operations_efficiency: "Operations & Efficiency",
  technology_automation: "Technology & Automation",
  reporting_scalability: "Reporting & Scalability",
};

// ─── Time horizon labels ──────────────────────────────────────

export const TIME_HORIZON_LABELS: Record<string, string> = {
  immediate: "Immediate",
  "7_days": "Within 7 Days",
  "30_days": "Within 30 Days",
};

export const TIME_HORIZON_COLORS: Record<string, string> = {
  immediate: "text-red-300 bg-red-500/20 border-red-500/30",
  "7_days": "text-orange-300 bg-orange-500/20 border-orange-500/30",
  "30_days": "text-blue-300 bg-blue-500/20 border-blue-500/30",
};

// ─── Severity display ─────────────────────────────────────────

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-300 bg-red-500/20 border-red-500/30",
  high: "text-orange-300 bg-orange-500/20 border-orange-500/30",
  moderate: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  monitor: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  healthy: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
};

export const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  monitor: "Monitor",
  healthy: "Healthy",
};
