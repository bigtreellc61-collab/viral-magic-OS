export const CLIENT_STATUSES = [
  { value: "prospect",      label: "Prospect" },
  { value: "discovery",     label: "Discovery" },
  { value: "qualified",     label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "active",        label: "Active" },
  { value: "paused",        label: "Paused" },
  { value: "completed",     label: "Completed" },
  { value: "archived",      label: "Archived" },
] as const;

export const RESTORE_STATUSES = CLIENT_STATUSES.filter((s) => s.value !== "archived");

export const BUSINESS_TYPES = [
  { value: "local_service",       label: "Local Service Business" },
  { value: "professional_service", label: "Professional Service" },
  { value: "industrial",          label: "Industrial Business" },
  { value: "medical_healthcare",  label: "Medical or Healthcare" },
  { value: "real_estate",         label: "Real Estate" },
  { value: "ecommerce",           label: "E-commerce" },
  { value: "saas_technology",     label: "SaaS or Technology" },
  { value: "agency_consultant",   label: "Agency or Consultant" },
  { value: "content_creator",     label: "Content Creator" },
  { value: "affiliate",           label: "Affiliate Business" },
  { value: "other",               label: "Other" },
] as const;

export const CUSTOMER_MARKETS = [
  { value: "b2b",  label: "B2B" },
  { value: "b2c",  label: "B2C" },
  { value: "both", label: "Both" },
] as const;

export const COMPANY_SIZES = [
  { value: "solo_owner", label: "Solo Owner" },
  { value: "2_5",        label: "2–5 Employees" },
  { value: "6_10",       label: "6–10 Employees" },
  { value: "11_25",      label: "11–25 Employees" },
  { value: "26_50",      label: "26–50 Employees" },
  { value: "51_100",     label: "51–100 Employees" },
  { value: "101_250",    label: "101–250 Employees" },
  { value: "251_plus",   label: "251+ Employees" },
] as const;

export const ANNUAL_REVENUE_RANGES = [
  { value: "pre_revenue",  label: "Pre-Revenue" },
  { value: "under_100k",   label: "Under $100,000" },
  { value: "100k_249k",    label: "$100,000–$249,999" },
  { value: "250k_499k",    label: "$250,000–$499,999" },
  { value: "500k_999k",    label: "$500,000–$999,999" },
  { value: "1m_2_49m",     label: "$1 Million–$2.49 Million" },
  { value: "2_5m_4_99m",   label: "$2.5 Million–$4.99 Million" },
  { value: "5m_9_99m",     label: "$5 Million–$9.99 Million" },
  { value: "10m_plus",     label: "$10 Million+" },
  { value: "unknown",      label: "Unknown" },
] as const;

export const BUDGET_RANGES = [
  { value: "under_1k",     label: "Under $1,000" },
  { value: "1k_2_499",     label: "$1,000–$2,499" },
  { value: "2_5k_4_999",   label: "$2,500–$4,999" },
  { value: "5k_9_999",     label: "$5,000–$9,999" },
  { value: "10k_24_999",   label: "$10,000–$24,999" },
  { value: "25k_plus",     label: "$25,000+" },
  { value: "not_determined", label: "Not Yet Determined" },
] as const;

export const NOTE_TYPES = [
  { value: "general",   label: "General" },
  { value: "discovery", label: "Discovery" },
  { value: "sales",     label: "Sales" },
  { value: "technical", label: "Technical" },
  { value: "strategy",  label: "Strategy" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "support",   label: "Support" },
  { value: "important", label: "Important" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest",           label: "Newest First" },
  { value: "oldest",           label: "Oldest First" },
  { value: "company_az",       label: "Company A–Z" },
  { value: "company_za",       label: "Company Z–A" },
  { value: "contact_az",       label: "Contact A–Z" },
  { value: "recently_updated", label: "Recently Updated" },
] as const;

export function getStatusLabel(value: string | null | undefined) {
  return CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getBusinessTypeLabel(value: string | null | undefined) {
  return BUSINESS_TYPES.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getCustomerMarketLabel(value: string | null | undefined) {
  return CUSTOMER_MARKETS.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getCompanySizeLabel(value: string | null | undefined) {
  return COMPANY_SIZES.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getRevenueLabel(value: string | null | undefined) {
  return ANNUAL_REVENUE_RANGES.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getBudgetLabel(value: string | null | undefined) {
  return BUDGET_RANGES.find((s) => s.value === value)?.label ?? value ?? "—";
}
export function getNoteTypeLabel(value: string | null | undefined) {
  return NOTE_TYPES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function getClientDisplayName(client: { companyName?: string | null; contactFirstName?: string | null; contactLastName?: string | null }) {
  return client.companyName?.trim() ||
    [client.contactFirstName, client.contactLastName].filter(Boolean).join(" ").trim() ||
    "Unnamed Client";
}

export function getStatusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":        return "default";
    case "prospect":      return "secondary";
    case "archived":      return "outline";
    default:              return "secondary";
  }
}
