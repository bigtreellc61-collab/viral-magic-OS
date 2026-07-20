// ─── Status labels and colors ─────────────────────────────────

export const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_review: "Awaiting Review",
  approved: "Approved",
  reopened: "Reopened",
  superseded: "Superseded",
  archived: "Archived",
};

export const PLAN_STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-300 bg-slate-700/50 border-slate-600/50",
  awaiting_review: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  approved: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  reopened: "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
  superseded: "text-slate-400 bg-slate-700/50 border-slate-600/50",
  archived: "text-slate-500 bg-slate-800/50 border-slate-700/30",
};

// ─── Priority classification labels and colors ─────────────────

export const PRIORITY_CLASSIFICATION_LABELS: Record<string, string> = {
  critical_priority: "Critical Priority",
  high_priority: "High Priority",
  important: "Important",
  planned_improvement: "Planned Improvement",
  monitor: "Monitor",
};

export const PRIORITY_CLASSIFICATION_COLORS: Record<string, string> = {
  critical_priority: "text-red-300 bg-red-500/20 border-red-500/30",
  high_priority: "text-orange-300 bg-orange-500/20 border-orange-500/30",
  important: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  planned_improvement: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  monitor: "text-slate-300 bg-slate-700/50 border-slate-600/50",
};

// ─── Effort labels and colors ──────────────────────────────────

export const EFFORT_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  major_initiative: "Major Initiative",
};

export const EFFORT_COLORS: Record<string, string> = {
  low: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  moderate: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  high: "text-orange-300 bg-orange-500/20 border-orange-500/30",
  major_initiative: "text-red-300 bg-red-500/20 border-red-500/30",
};

// ─── Timeframe labels ─────────────────────────────────────────

export const TIMEFRAME_LABELS: Record<string, string> = {
  immediate: "Immediate",
  "7_days": "Within 7 Days",
  "30_days": "Within 30 Days",
  "60_90_days": "Within 60–90 Days",
  strategic: "Strategic / 90+ Days",
};

export const TIMEFRAME_COLORS: Record<string, string> = {
  immediate: "text-red-300 bg-red-500/20 border-red-500/30",
  "7_days": "text-orange-300 bg-orange-500/20 border-orange-500/30",
  "30_days": "text-blue-300 bg-blue-500/20 border-blue-500/30",
  "60_90_days": "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
  strategic: "text-slate-300 bg-slate-700/50 border-slate-600/50",
};

// ─── Action time horizon labels ───────────────────────────────

export const ACTION_HORIZON_LABELS: Record<string, string> = {
  immediate: "Immediate",
  "7_days": "Within 7 Days",
  "30_days": "Within 30 Days",
  "60_90_days": "Within 60–90 Days",
};

export const ACTION_HORIZON_COLORS: Record<string, string> = {
  immediate: "text-red-300 bg-red-500/20 border-red-500/30",
  "7_days": "text-orange-300 bg-orange-500/20 border-orange-500/30",
  "30_days": "text-blue-300 bg-blue-500/20 border-blue-500/30",
  "60_90_days": "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
};

// ─── Completion status labels ─────────────────────────────────

export const COMPLETION_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

// ─── Domain labels ────────────────────────────────────────────

export const DOMAIN_LABELS: Record<string, string> = {
  revenue_lead_growth: "Revenue & Lead Growth",
  sales_conversion: "Sales & Conversion",
  customer_experience_retention: "Customer Experience & Retention",
  operations_efficiency: "Operations & Efficiency",
  technology_automation: "Technology & Automation",
  reporting_scalability: "Reporting & Scalability",
  strategy_offer_clarity: "Strategy & Offer Clarity",
  team_accountability: "Team & Accountability",
};
