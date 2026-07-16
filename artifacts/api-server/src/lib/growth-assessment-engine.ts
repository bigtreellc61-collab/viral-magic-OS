/**
 * Phase 1E — Business Growth Assessment Engine
 * Rule-based, deterministic. No external AI.
 * All logic is modular and adjustable without database changes.
 */

import type { Severity } from "./diagnostics-calc";

// ─── Input types ────────────────────────────────────────────

export interface ScoreInput {
  categoryKey: string;
  categoryLabel: string;
  categoryDescription: string | null;
  currentPerformance: number;
  businessImpact: number;
  urgency: number;
  priorityScore: number;
  severity: Severity;
  evidence: string | null;
  observations: string | null;
  recommendedAction: string | null;
  resolutionStatus: string;
}

// ─── Output types ───────────────────────────────────────────

export interface AssessmentStrength {
  categoryKey: string;
  categoryLabel: string;
  currentPerformance: number;
  severity: string;
  whyStrength: string;
  howToProtect: string;
}

export interface AssessmentVulnerability {
  categoryKey: string;
  categoryLabel: string;
  currentPerformance: number;
  priorityScore: number;
  severity: string;
  whatItMeans: string;
}

export interface AssessmentRisk {
  categoryKey: string;
  categoryLabel: string;
  severity: string;
  priorityScore: number;
  whyItMatters: string;
  consequence: string;
  evidence: string | null;
}

export interface AssessmentQuickWin {
  categoryKey: string;
  categoryLabel: string;
  action: string;
  reason: string;
  suggestedOwner: string;
  timeHorizon: "immediate" | "7_days" | "30_days";
  expectedImprovement: string;
}

export type StrategicClassification =
  | "immediate_attention"
  | "near_term_improvement"
  | "strategic_development"
  | "monitor_maintain";

export interface AssessmentStrategicPriority {
  categoryKey: string;
  categoryLabel: string;
  classification: StrategicClassification;
  why: string;
  currentPerformance: number;
  businessImpact: number;
  urgency: number;
  priorityScore: number;
  recommendedAction: string | null;
}

export type GrowthOpportunityGroup =
  | "revenue_lead_growth"
  | "sales_conversion"
  | "customer_experience_retention"
  | "operations_efficiency"
  | "technology_automation"
  | "reporting_scalability";

export interface AssessmentGrowthOpportunity {
  opportunityTitle: string;
  categoryKey: string;
  categoryLabel: string;
  businessReason: string;
  suggestedDirection: string;
  priorityClassification: string;
  group: GrowthOpportunityGroup;
}

export interface GeneratedSections {
  strengths: AssessmentStrength[];
  vulnerabilities: AssessmentVulnerability[];
  risks: AssessmentRisk[];
  quickWins: AssessmentQuickWin[];
  strategicPriorities: AssessmentStrategicPriority[];
  growthOpportunities: AssessmentGrowthOpportunity[];
  healthExplanation: string;
}

// ─── Category → Growth Opportunity Group mapping ─────────────

const CATEGORY_GROUP_MAP: Record<string, GrowthOpportunityGroup> = {
  lead_generation: "revenue_lead_growth",
  traffic_visibility: "revenue_lead_growth",
  lead_capture: "revenue_lead_growth",
  speed_to_lead: "sales_conversion",
  follow_up: "sales_conversion",
  sales_conversion: "sales_conversion",
  customer_retention: "customer_experience_retention",
  reputation_reviews: "customer_experience_retention",
  content_marketing: "revenue_lead_growth",
  website_performance: "revenue_lead_growth",
  automation: "technology_automation",
  technology_integration: "technology_automation",
  reporting_analytics: "reporting_scalability",
  operational_efficiency: "operations_efficiency",
  scalability: "reporting_scalability",
};

function getGroup(categoryKey: string): GrowthOpportunityGroup {
  return CATEGORY_GROUP_MAP[categoryKey] ?? "operations_efficiency";
}

// ─── Category-keyed quick win rules ─────────────────────────

const QUICK_WIN_ELIGIBLE: Set<string> = new Set([
  "speed_to_lead",
  "follow_up",
  "lead_capture",
  "reputation_reviews",
  "website_performance",
  "reporting_analytics",
  "automation",
  "content_marketing",
]);

const QUICK_WIN_TIME: Record<string, "immediate" | "7_days" | "30_days"> = {
  speed_to_lead: "immediate",
  follow_up: "7_days",
  lead_capture: "7_days",
  reputation_reviews: "7_days",
  website_performance: "30_days",
  reporting_analytics: "30_days",
  automation: "30_days",
  content_marketing: "30_days",
};

const QUICK_WIN_OWNER: Record<string, string> = {
  speed_to_lead: "Sales / Operations Lead",
  follow_up: "Sales Lead",
  lead_capture: "Marketing / Web Lead",
  reputation_reviews: "Operations / Client Success",
  website_performance: "Marketing / Web Lead",
  reporting_analytics: "Operations / Leadership",
  automation: "Operations / Technology Lead",
  content_marketing: "Marketing Lead",
};

// ─── Health explanation generator ───────────────────────────

function buildHealthExplanation(score: number, rating: string): string {
  if (rating === "strong") {
    return `With a Business Health Score of ${score}/100, this business is operating from a position of strength. Core systems are performing well, risks are limited, and there is a solid foundation for continued growth. The focus should shift from fixing problems to optimising and scaling what is working.`;
  }
  if (rating === "stable") {
    return `With a Business Health Score of ${score}/100, this business is fundamentally stable with good systems in place, but there are clear areas of improvement that — if addressed — could meaningfully accelerate growth. The priority is strengthening the weaker areas before they develop into higher-risk bottlenecks.`;
  }
  if (rating === "vulnerable") {
    return `With a Business Health Score of ${score}/100, this business has meaningful vulnerabilities that are limiting growth potential. Several key areas are underperforming relative to their business impact. Without focused attention, these weaknesses are likely to become more costly over time. Prioritised action is recommended.`;
  }
  if (rating === "at_risk") {
    return `With a Business Health Score of ${score}/100, this business faces significant operational and growth risks. Multiple high-impact areas are performing below acceptable levels. Immediate attention is required on the most critical bottlenecks to prevent further performance deterioration. A structured improvement plan should begin within 30 days.`;
  }
  return `With a Business Health Score of ${score}/100, this business is in a critical state. Core systems are failing to support sustainable operations or growth. Immediate intervention is essential. The highest-severity bottlenecks must be addressed first to stabilise operations before any growth strategy can be executed.`;
}

// ─── Strength rules ─────────────────────────────────────────

const STRENGTH_WHY: Record<string, string> = {
  lead_generation: "Lead generation is producing a consistent pipeline, giving the business predictable growth potential.",
  traffic_visibility: "Strong online visibility means qualified prospects can find the business across key channels.",
  lead_capture: "Effective lead capture is converting traffic into actionable contacts, reducing wasted visibility spend.",
  speed_to_lead: "Fast lead response is a competitive differentiator that directly improves conversion rates.",
  follow_up: "A structured follow-up process ensures fewer leads fall through the cracks.",
  sales_conversion: "Strong sales conversion means the business is efficiently turning qualified prospects into clients.",
  customer_retention: "High retention creates a compounding revenue base and reduces the cost of growth.",
  reputation_reviews: "A strong reputation creates social proof that lowers buyer resistance.",
  content_marketing: "Consistent content marketing builds authority and drives organic, long-term lead flow.",
  website_performance: "A high-performing website acts as a 24/7 sales asset that converts visitors into leads.",
  automation: "Automation frees team capacity and creates scalable, consistent delivery systems.",
  technology_integration: "Well-integrated technology reduces manual effort and creates reliable data flow.",
  reporting_analytics: "Strong reporting enables data-driven decisions and early identification of problems.",
  operational_efficiency: "Efficient operations protect margins and enable the team to deliver consistently.",
  scalability: "Scalable systems mean growth does not require proportional increases in owner time or headcount.",
};

const STRENGTH_PROTECT: Record<string, string> = {
  lead_generation: "Continue tracking cost per lead and channel mix. Protect budget for top-performing sources.",
  traffic_visibility: "Maintain publishing cadence and directory listings. Monitor ranking stability quarterly.",
  lead_capture: "Periodically test new offers and forms. Ensure leads flow cleanly into the CRM.",
  speed_to_lead: "Maintain response-time tracking and automate further to sustain performance as volume grows.",
  follow_up: "Review sequence performance quarterly and update messaging based on conversion data.",
  sales_conversion: "Keep sales materials current and document winning patterns for onboarding new team members.",
  customer_retention: "Continue NPS or satisfaction tracking and document what drives renewals.",
  reputation_reviews: "Maintain consistent review generation and continue responding promptly to all feedback.",
  content_marketing: "Maintain publishing cadence and test new formats to expand reach.",
  website_performance: "Monitor Core Web Vitals, keep trust signals current, and test CTA copy periodically.",
  automation: "Audit existing workflows quarterly for reliability and identify new automation opportunities.",
  technology_integration: "Review the stack annually to remove unused tools and upgrade integrations.",
  reporting_analytics: "Maintain data quality standards and evolve KPIs as strategy changes.",
  operational_efficiency: "Schedule quarterly workflow reviews and document improvements.",
  scalability: "Continue systematising new areas and review delegation effectiveness quarterly.",
};

// ─── Risk consequence rules ──────────────────────────────────

const RISK_WHY: Record<string, string> = {
  lead_generation: "Without consistent lead generation, revenue growth is unpredictable and the business is entirely dependent on existing clients and referrals.",
  traffic_visibility: "Poor visibility means qualified prospects cannot find the business, limiting lead volume at the top of the funnel.",
  lead_capture: "Even strong traffic is wasted if visitors do not convert into contactable leads.",
  speed_to_lead: "Slow response rates allow competitors to engage prospects first. Speed to lead is one of the highest-impact conversion variables.",
  follow_up: "Without structured follow-up, the majority of leads are abandoned before a purchase decision is made.",
  sales_conversion: "A broken sales process means marketing and lead generation spend cannot deliver a return.",
  customer_retention: "High churn erodes the client base faster than new business can replace it, creating a growth ceiling.",
  reputation_reviews: "A weak reputation increases buyer scepticism, raises acquisition costs, and directly affects close rates.",
  content_marketing: "Without relevant content, competitors capture organic search and build authority the business cannot easily recover.",
  website_performance: "A poor website loses leads daily through missed conversions, broken forms, and slow load times.",
  automation: "Manual processes at scale consume owner time, introduce errors, and destroy margins.",
  technology_integration: "Disconnected systems cause data errors, slow decisions, and create invisible revenue loss.",
  reporting_analytics: "Without measurement, improvement is guesswork and problems grow undetected.",
  operational_efficiency: "Inefficiency silently consumes profit margins and limits the owner's ability to focus on growth.",
  scalability: "Owner-dependency creates a hard ceiling on revenue and makes the business impossible to scale or exit.",
};

const RISK_CONSEQUENCE: Record<string, string> = {
  lead_generation: "Revenue growth stalls. The business becomes vulnerable to any disruption in existing client relationships.",
  traffic_visibility: "The top of the sales funnel runs dry, making all downstream conversion efforts increasingly less effective.",
  lead_capture: "Paid traffic and organic visibility investments deliver poor ROI. Growth slows despite marketing spend.",
  speed_to_lead: "Close rates on new inquiries decline. Competitors with faster response systems win a disproportionate share.",
  follow_up: "Up to 80% of potential sales are left untouched. Pipeline velocity slows and revenue per lead drops.",
  sales_conversion: "Client acquisition costs rise while revenue stagnates. Growth requires ever-larger marketing budgets.",
  customer_retention: "The business must work harder and spend more just to maintain current revenue levels.",
  reputation_reviews: "New clients are harder and more expensive to convert, particularly in competitive local markets.",
  content_marketing: "Organic lead flow stagnates. The business remains heavily dependent on paid acquisition.",
  website_performance: "Conversion rates stay below potential. Marketing investment is partially wasted.",
  automation: "Team bandwidth limits growth. Delivery quality becomes inconsistent as volume increases.",
  technology_integration: "Teams rely on manual data entry, creating errors and reducing time available for high-value work.",
  reporting_analytics: "Leadership cannot identify underperformance quickly, allowing small problems to become large ones.",
  operational_efficiency: "Owner and team time is consumed by preventable tasks, limiting strategic focus and growth capacity.",
  scalability: "Growth plateaus at the owner's personal capacity ceiling. The business cannot safely expand.",
};

// ─── Vulnerability meaning ───────────────────────────────────

const VULNERABILITY_MEANING: Record<string, string> = {
  lead_generation: "Lead flow is inconsistent or insufficient to support reliable growth targets.",
  traffic_visibility: "The business is not visible enough to the audiences most likely to buy.",
  lead_capture: "A significant proportion of web traffic and marketing activity is not converting into captured leads.",
  speed_to_lead: "New inquiries are not being responded to quickly enough to maximise conversion potential.",
  follow_up: "Leads are being lost through gaps in the follow-up process after initial contact.",
  sales_conversion: "The sales process is not efficiently converting qualified prospects into clients.",
  customer_retention: "Client retention is below the level needed for compounding, sustainable growth.",
  reputation_reviews: "The online reputation is not strong enough to provide a meaningful competitive advantage.",
  content_marketing: "Content is not driving sufficient organic traffic, authority, or lead generation.",
  website_performance: "The website is underperforming as a lead-generation and conversion asset.",
  automation: "Repetitive manual processes are consuming team time and creating inconsistency.",
  technology_integration: "Technology systems are not well connected, creating data silos and manual handoffs.",
  reporting_analytics: "Performance data is not consistently tracked or used for decision-making.",
  operational_efficiency: "Workflows contain bottlenecks, duplication, or inefficiencies that limit output and margin.",
  scalability: "Key business processes are too owner-dependent to scale beyond current capacity.",
};

// ─── Growth opportunity rules ────────────────────────────────

const OPPORTUNITY_TITLE: Record<string, string> = {
  lead_generation: "Build a Reliable Lead Generation System",
  traffic_visibility: "Increase Qualified Online Visibility",
  lead_capture: "Improve Lead Capture Conversion Rate",
  speed_to_lead: "Reduce Lead Response Time",
  follow_up: "Implement Structured Follow-Up Sequences",
  sales_conversion: "Strengthen Sales Process and Conversion Rate",
  customer_retention: "Develop a Client Retention Programme",
  reputation_reviews: "Build an Active Review Generation System",
  content_marketing: "Launch a Consistent Content Marketing Strategy",
  website_performance: "Optimise Website for Speed and Conversion",
  automation: "Implement Business Process Automation",
  technology_integration: "Connect and Integrate Business Technology Systems",
  reporting_analytics: "Build Core Business Performance Dashboards",
  operational_efficiency: "Systematise and Streamline Core Operations",
  scalability: "Reduce Owner-Dependency and Build a Scalable Operating Model",
};

const OPPORTUNITY_REASON: Record<string, string> = {
  lead_generation: "Improved lead generation directly increases pipeline volume and gives the business more control over revenue growth.",
  traffic_visibility: "Greater visibility in search and social channels expands the total addressable lead pool without proportional cost increases.",
  lead_capture: "Even a small improvement in capture rate multiplies the return on existing traffic and marketing spend.",
  speed_to_lead: "Faster response to new inquiries is one of the highest-ROI improvements available in most service businesses.",
  follow_up: "A structured follow-up system recovers revenue from leads that would otherwise be lost without additional marketing spend.",
  sales_conversion: "Improving conversion rate reduces the number of leads required to hit revenue targets, lowering overall acquisition costs.",
  customer_retention: "Increasing client lifetime value is typically more cost-effective than acquiring new clients.",
  reputation_reviews: "A stronger review profile improves both organic discovery and buyer confidence, reducing friction in the sales process.",
  content_marketing: "Consistent content creates long-term compounding value through organic traffic, authority, and lead nurturing.",
  website_performance: "A higher-converting website delivers more leads from the same amount of traffic.",
  automation: "Automation creates capacity for growth without proportional increases in staffing cost.",
  technology_integration: "Better-connected systems reduce errors, save time, and make business data more useful for decision-making.",
  reporting_analytics: "Better reporting enables faster identification of problems and opportunities, improving the quality of strategic decisions.",
  operational_efficiency: "Improving operational efficiency protects margins and creates the capacity needed to take on more clients.",
  scalability: "Building scalable systems creates the infrastructure for sustainable growth beyond the owner's personal capacity.",
};

const OPPORTUNITY_DIRECTION: Record<string, string> = {
  lead_generation: "Define a 90-day lead generation plan covering both outbound (referrals, outreach) and inbound (content, SEO, ads) channels. Assign ownership and set weekly pipeline targets.",
  traffic_visibility: "Audit current visibility, optimise Google Business Profile, and establish a content or SEO calendar to drive incremental organic traffic.",
  lead_capture: "Audit all existing lead-capture touchpoints, add a lead magnet, simplify forms, and install exit-intent capture on high-traffic pages.",
  speed_to_lead: "Configure automated acknowledgment for all inquiry types. Set a 30-minute human follow-up target and assign CRM routing rules.",
  follow_up: "Build a 5–7 touchpoint follow-up sequence for every lead source. Automate reminders and track drop-off points by stage.",
  sales_conversion: "Review and document the full sales process. Identify the top two drop-off points and build improvement plans for each.",
  customer_retention: "Implement a structured onboarding sequence, schedule periodic check-ins, and identify early warning signals for at-risk accounts.",
  reputation_reviews: "Systematise review requests at delivery milestones. Respond to all reviews within 48 hours. Set a monthly target.",
  content_marketing: "Define 3 core customer questions, create one high-quality answer for each, and publish consistently on one primary channel.",
  website_performance: "Fix mobile page speed, rewrite the headline to match customer language, add trust signals, and verify all forms work correctly.",
  automation: "Map manual processes, identify the top three highest-time-cost tasks, and select automation tools for each.",
  technology_integration: "Audit the current technology stack and connect the two or three most important data flows to eliminate manual transfer.",
  reporting_analytics: "Identify the 3–5 metrics that matter most for each business function and create a simple weekly reporting dashboard.",
  operational_efficiency: "Document and map core workflows, identify the top three bottlenecks, and build SOPs to eliminate them.",
  scalability: "Document all owner-dependent processes, create delegation guides, and build a training system for each critical role.",
};

// ─── Main engine function ─────────────────────────────────────

export function generateAssessmentSections(
  scores: ScoreInput[],
  healthScore: number,
  healthRating: string,
): GeneratedSections {
  // ── Strengths (top 3: high performance, low severity) ─────
  const strengths: AssessmentStrength[] = scores
    .filter((s) => s.currentPerformance >= 7 && (s.severity === "healthy" || s.severity === "monitor"))
    .sort((a, b) => b.currentPerformance - a.currentPerformance || b.businessImpact - a.businessImpact)
    .slice(0, 3)
    .map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      currentPerformance: s.currentPerformance,
      severity: s.severity,
      whyStrength: STRENGTH_WHY[s.categoryKey] ?? `${s.categoryLabel} is performing well and contributing positively to overall business health.`,
      howToProtect: STRENGTH_PROTECT[s.categoryKey] ?? `Maintain current practices and monitor for changes. Look for incremental optimisation opportunities.`,
    }));

  // ── Vulnerabilities (up to 5: moderate severity or weak performance, not already a high/critical risk) ─────
  const vulnerabilities: AssessmentVulnerability[] = scores
    .filter((s) => (s.severity === "moderate" || (s.currentPerformance < 7 && s.currentPerformance >= 4)) && s.severity !== "high" && s.severity !== "critical")
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      currentPerformance: s.currentPerformance,
      priorityScore: s.priorityScore,
      severity: s.severity,
      whatItMeans: VULNERABILITY_MEANING[s.categoryKey] ?? `${s.categoryLabel} is below the level needed to fully support the business's growth objectives.`,
    }));

  // ── Primary Risks (high + critical, all of them) ──────────
  const risks: AssessmentRisk[] = scores
    .filter((s) => s.severity === "high" || s.severity === "critical")
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      severity: s.severity,
      priorityScore: s.priorityScore,
      whyItMatters: RISK_WHY[s.categoryKey] ?? `${s.categoryLabel} is performing significantly below the level required for reliable business operations and growth.`,
      consequence: RISK_CONSEQUENCE[s.categoryKey] ?? "Continued underperformance in this area will increasingly constrain operational capacity and growth potential.",
      evidence: s.evidence,
    }));

  // ── Quick Wins (up to 3: eligible category, moderate priority, clear action) ──
  const quickWins: AssessmentQuickWin[] = scores
    .filter((s) =>
      QUICK_WIN_ELIGIBLE.has(s.categoryKey) &&
      s.priorityScore >= 80 &&
      s.severity !== "critical" &&
      s.currentPerformance < 8
    )
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map((s) => {
      const action = s.recommendedAction
        ? s.recommendedAction.replace(/^\[Score:.*?\]\n\n/, "").split(".")[0] + "."
        : `Prioritise improvement in ${s.categoryLabel} this quarter.`;
      return {
        categoryKey: s.categoryKey,
        categoryLabel: s.categoryLabel,
        action,
        reason: `${s.categoryLabel} has a Priority Score of ${s.priorityScore.toFixed(0)} with clear room for improvement. Addressing this promptly can produce measurable results within a short timeframe.`,
        suggestedOwner: QUICK_WIN_OWNER[s.categoryKey] ?? "Leadership / Operations",
        timeHorizon: QUICK_WIN_TIME[s.categoryKey] ?? "30_days",
        expectedImprovement: `Improvement in this area is likely to contribute positively to lead conversion, operational output, or client experience — though specific results will depend on implementation quality and market conditions.`,
      };
    });

  // ── Strategic Priorities (top 3–5 by priority score, classified) ──
  const classified = scores
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map((s): AssessmentStrategicPriority => {
      let classification: StrategicClassification;
      let why: string;

      if (s.severity === "critical" || s.severity === "high") {
        classification = "immediate_attention";
        why = `This area has ${s.severity.toUpperCase()} severity with a Priority Score of ${s.priorityScore.toFixed(0)}. Immediate action is required to prevent further operational or growth impact.`;
      } else if (s.severity === "moderate") {
        classification = "near_term_improvement";
        why = `This area has MODERATE severity with a Priority Score of ${s.priorityScore.toFixed(0)}. Structured improvement within the next 60–90 days will reduce risk and unlock growth potential.`;
      } else if (s.businessImpact >= 3 && s.currentPerformance < 8) {
        classification = "strategic_development";
        why = `This area has meaningful business impact (${s.businessImpact}/5) and room for improvement. Strategic investment here will compound over time.`;
      } else {
        classification = "monitor_maintain";
        why = `This area is performing acceptably. Continue current practices and monitor for any performance changes.`;
      }

      return {
        categoryKey: s.categoryKey,
        categoryLabel: s.categoryLabel,
        classification,
        why,
        currentPerformance: s.currentPerformance,
        businessImpact: s.businessImpact,
        urgency: s.urgency,
        priorityScore: s.priorityScore,
        recommendedAction: s.recommendedAction,
      };
    });
  const strategicPriorities = classified;

  // ── Growth Opportunities (high impact, weak performance) ──
  const opportunityScores = scores
    .filter((s) => s.businessImpact >= 4 && s.currentPerformance <= 6)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const growthOpportunities: AssessmentGrowthOpportunity[] = opportunityScores.map((s) => {
    const ps = s.priorityScore;
    const priorityClassification =
      ps >= 190 ? "Critical Priority" :
      ps >= 130 ? "High Priority" :
      ps >= 80 ? "Moderate Priority" :
      "Low Priority";

    return {
      opportunityTitle: OPPORTUNITY_TITLE[s.categoryKey] ?? `Improve ${s.categoryLabel}`,
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      businessReason: OPPORTUNITY_REASON[s.categoryKey] ?? `Improving ${s.categoryLabel} will positively impact revenue, efficiency, or client experience.`,
      suggestedDirection: OPPORTUNITY_DIRECTION[s.categoryKey] ?? `Assess current performance, identify the top two improvement actions, assign an owner, and set a 90-day target.`,
      priorityClassification,
      group: getGroup(s.categoryKey),
    };
  });

  // ── Summary text generators ───────────────────────────────

  const healthExplanation = buildHealthExplanation(healthScore, healthRating);

  return {
    strengths,
    vulnerabilities,
    risks,
    quickWins,
    strategicPriorities,
    growthOpportunities,
    healthExplanation,
  };
}

// ─── Summary text builders (for stored text fields) ──────────

export function buildStrengthSummary(strengths: AssessmentStrength[]): string {
  if (strengths.length === 0) return "No clear strength areas were identified in this assessment. Focus on stabilising the highest-risk areas first.";
  const labels = strengths.map((s) => s.categoryLabel).join(", ");
  return `The business demonstrates meaningful strength in: ${labels}. These areas represent a foundation to protect and build from as improvement work progresses in weaker areas.`;
}

export function buildVulnerabilitySummary(vulnerabilities: AssessmentVulnerability[]): string {
  if (vulnerabilities.length === 0) return "No significant vulnerabilities were identified at this time.";
  const labels = vulnerabilities.map((s) => s.categoryLabel).join(", ");
  return `Key vulnerability areas include: ${labels}. These are underperforming relative to their business importance and should be addressed in the near term before they escalate into higher-risk bottlenecks.`;
}

export function buildRiskSummary(risks: AssessmentRisk[]): string {
  if (risks.length === 0) return "No high or critical risk areas were identified in this assessment. The business is operating without major bottlenecks at this time.";
  const labels = risks.map((s) => `${s.categoryLabel} (${s.severity.toUpperCase()})`).join(", ");
  return `The following areas present significant risk and require immediate attention: ${labels}. These bottlenecks are actively limiting operational performance and growth potential.`;
}

export function buildGrowthOpportunitySummary(ops: AssessmentGrowthOpportunity[]): string {
  if (ops.length === 0) return "No high-impact growth opportunities were identified at this time. Focus on protecting and optimising existing strengths.";
  const labels = ops.slice(0, 4).map((o) => o.opportunityTitle).join("; ");
  return `Key growth opportunities identified: ${labels}. Each represents an area where targeted investment is likely to produce measurable improvement in revenue, efficiency, or client experience.`;
}

export function buildQuickWinSummary(qw: AssessmentQuickWin[]): string {
  if (qw.length === 0) return "No clear quick-win opportunities were identified. Available capacity should be focused on the highest-priority bottlenecks.";
  const items = qw.map((w, i) => `${i + 1}. ${w.categoryLabel} — ${w.action} (${w.timeHorizon.replace("_", " ")})`).join(" ");
  return `Recommended Quick Wins: ${items}. These actions are achievable within 30 days and can produce early visible progress.`;
}

export function buildStrategicFocusSummary(sp: AssessmentStrategicPriority[], healthRating: string): string {
  const immediate = sp.filter((p) => p.classification === "immediate_attention").map((p) => p.categoryLabel);
  const nearTerm = sp.filter((p) => p.classification === "near_term_improvement").map((p) => p.categoryLabel);

  let summary = "";
  if (immediate.length > 0) {
    summary += `Immediate focus areas: ${immediate.join(", ")}. `;
  }
  if (nearTerm.length > 0) {
    summary += `Near-term improvement targets: ${nearTerm.join(", ")}. `;
  }
  if (!summary) {
    summary = "The business is in a stable position. Focus on incremental improvements in moderate-priority areas. ";
  }
  if (healthRating === "critical" || healthRating === "at_risk") {
    summary += "Given the overall health rating, stabilisation must take precedence over expansion until the most critical areas are resolved.";
  } else if (healthRating === "stable" || healthRating === "strong") {
    summary += "With a solid foundation, this is an appropriate time to invest in growth-oriented strategic development.";
  }
  return summary.trim();
}
