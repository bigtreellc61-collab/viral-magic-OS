// ─── Project types ──────────────────────────────────────────
export const PROJECT_TYPES: { value: string; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "landing_page", label: "Landing Page" },
  { value: "lead_generation", label: "Lead Generation System" },
  { value: "dashboard", label: "Dashboard" },
  { value: "calculator", label: "Calculator" },
  { value: "assessment_tool", label: "Assessment Tool" },
  { value: "client_portal", label: "Client Portal" },
  { value: "crm_workflow", label: "CRM Workflow" },
  { value: "automation", label: "Automation" },
  { value: "internal_tool", label: "Internal Business Tool" },
  { value: "ai_application", label: "AI Application" },
  { value: "content_system", label: "Content System" },
  { value: "custom_saas", label: "Custom SaaS" },
  { value: "other", label: "Other" },
];

// ─── Project statuses ────────────────────────────────────────
export const PROJECT_STATUSES: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "planning", label: "Planning" },
  { value: "approved", label: "Approved" },
  { value: "building", label: "Building" },
  { value: "testing", label: "Testing" },
  { value: "client_review", label: "Client Review" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

export const PROJECT_RESTORE_STATUSES = PROJECT_STATUSES.filter(
  (s) => s.value !== "archived",
);

// ─── Priorities ──────────────────────────────────────────────
export const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ─── Platforms ───────────────────────────────────────────────
export const PLATFORMS: { value: string; label: string }[] = [
  { value: "replit", label: "Replit" },
  { value: "lovable", label: "Lovable" },
  { value: "dcs_ai_studio", label: "DCS AI Studio" },
  { value: "wordpress", label: "WordPress" },
  { value: "airtable", label: "Airtable" },
  { value: "custom_development", label: "Custom Development" },
  { value: "not_yet_determined", label: "Not Yet Determined" },
  { value: "other", label: "Other" },
];

// ─── Task categories ─────────────────────────────────────────
export const TASK_CATEGORIES: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "research", label: "Research" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "planning", label: "Planning" },
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "integration", label: "Integration" },
  { value: "content", label: "Content" },
  { value: "testing", label: "Testing" },
  { value: "client_review", label: "Client Review" },
  { value: "revision", label: "Revision" },
  { value: "deployment", label: "Deployment" },
  { value: "training", label: "Training" },
  { value: "support", label: "Support" },
  { value: "other", label: "Other" },
];

// ─── Task statuses ───────────────────────────────────────────
export const TASK_STATUSES: { value: string; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

export const TASK_RESTORE_STATUSES = TASK_STATUSES.filter(
  (s) => s.value !== "archived",
);

// ─── Estimated effort ────────────────────────────────────────
export const EFFORT_OPTIONS: { value: string; label: string }[] = [
  { value: "under_1h", label: "Under 1 Hour" },
  { value: "1_2h", label: "1–2 Hours" },
  { value: "half_day", label: "Half Day" },
  { value: "full_day", label: "Full Day" },
  { value: "2_3_days", label: "2–3 Days" },
  { value: "1_week", label: "1 Week" },
  { value: "over_1_week", label: "More Than 1 Week" },
  { value: "not_estimated", label: "Not Estimated" },
];

// ─── Sort options ────────────────────────────────────────────
export const PROJECT_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "recently_updated", label: "Recently Updated" },
  { value: "target_date", label: "Target Date Soonest" },
  { value: "highest_value", label: "Highest Value" },
  { value: "highest_priority", label: "Highest Priority" },
];

export const TASK_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "due_date_asc", label: "Due Date Soonest" },
  { value: "due_date_desc", label: "Due Date Latest" },
  { value: "highest_priority", label: "Highest Priority" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "recently_updated", label: "Recently Updated" },
];

export const TASK_DUE_DATE_OPTIONS: { value: string; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "this_week", label: "Due This Week" },
  { value: "this_month", label: "Due This Month" },
  { value: "no_due_date", label: "No Due Date" },
];

// ─── Kanban columns ──────────────────────────────────────────
export const PROJECT_KANBAN_COLUMNS = [
  "discovery", "diagnostic", "planning", "approved", "building",
  "testing", "client_review", "completed", "on_hold",
];

export const TASK_KANBAN_COLUMNS = [
  "not_started", "in_progress", "waiting", "blocked", "completed",
];

// ─── Lookup helpers ───────────────────────────────────────────
export function getLabel(list: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—";
  return list.find((i) => i.value === value)?.label ?? value;
}

export function getProjectTypeLabel(v: string | null | undefined) { return getLabel(PROJECT_TYPES, v); }
export function getProjectStatusLabel(v: string | null | undefined) { return getLabel(PROJECT_STATUSES, v); }
export function getPriorityLabel(v: string | null | undefined) { return getLabel(PRIORITIES, v); }
export function getPlatformLabel(v: string | null | undefined) { return getLabel(PLATFORMS, v); }
export function getTaskCategoryLabel(v: string | null | undefined) { return getLabel(TASK_CATEGORIES, v); }
export function getTaskStatusLabel(v: string | null | undefined) { return getLabel(TASK_STATUSES, v); }
export function getEffortLabel(v: string | null | undefined) { return getLabel(EFFORT_OPTIONS, v); }

// ─── Status color maps ───────────────────────────────────────
export const PROJECT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  discovery:     { bg: "bg-sky-500/15",     text: "text-sky-400",     dot: "bg-sky-400" },
  diagnostic:    { bg: "bg-blue-500/15",    text: "text-blue-400",    dot: "bg-blue-400" },
  planning:      { bg: "bg-violet-500/15",  text: "text-violet-400",  dot: "bg-violet-400" },
  approved:      { bg: "bg-indigo-500/15",  text: "text-indigo-400",  dot: "bg-indigo-400" },
  building:      { bg: "bg-amber-500/15",   text: "text-amber-400",   dot: "bg-amber-400" },
  testing:       { bg: "bg-orange-500/15",  text: "text-orange-400",  dot: "bg-orange-400" },
  client_review: { bg: "bg-yellow-500/15",  text: "text-yellow-400",  dot: "bg-yellow-400" },
  completed:     { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  on_hold:       { bg: "bg-slate-500/15",   text: "text-slate-400",   dot: "bg-slate-400" },
  cancelled:     { bg: "bg-red-500/15",     text: "text-red-400",     dot: "bg-red-400" },
  archived:      { bg: "bg-muted/50",       text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  urgent: { bg: "bg-red-500/15",    text: "text-red-400",    dot: "bg-red-400" },
  high:   { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  normal: { bg: "bg-blue-500/15",   text: "text-blue-400",   dot: "bg-blue-400" },
  low:    { bg: "bg-slate-500/15",  text: "text-slate-400",  dot: "bg-slate-400" },
};

export const TASK_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  not_started: { bg: "bg-slate-500/15",   text: "text-slate-400",   dot: "bg-slate-400" },
  in_progress: { bg: "bg-blue-500/15",    text: "text-blue-400",    dot: "bg-blue-400" },
  waiting:     { bg: "bg-yellow-500/15",  text: "text-yellow-400",  dot: "bg-yellow-400" },
  blocked:     { bg: "bg-red-500/15",     text: "text-red-400",     dot: "bg-red-400" },
  completed:   { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  cancelled:   { bg: "bg-muted/50",       text: "text-muted-foreground", dot: "bg-muted-foreground" },
  archived:    { bg: "bg-muted/50",       text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

// ─── Overdue check ───────────────────────────────────────────
export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === "completed" || status === "cancelled" || status === "archived") return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// ─── Progress color ───────────────────────────────────────────
export function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-orange-500";
  return "bg-slate-500";
}
