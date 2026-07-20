/**
 * Phase 1F-A — Solution Recommendation Engine™
 * Deterministic, rule-based. No external AI.
 * Converts an approved Growth Assessment into a prioritized, explainable plan.
 */

import type { GeneratedSections } from "./growth-assessment-engine";
import type { DiagnosticScore } from "@workspace/db";

// ─── Named weight constants ───────────────────────────────────────
const WEIGHT_SEVERITY = 25;          // max contribution from severity
const WEIGHT_BUSINESS_IMPACT = 25;   // max contribution from business impact
const WEIGHT_URGENCY = 20;           // max contribution from urgency
const WEIGHT_PERFORMANCE_GAP = 20;   // max contribution from performance gap
const WEIGHT_QUICK_WIN_BONUS = 8;    // bonus for quick-win eligible
const WEIGHT_DEPENDENCY_BONUS = 6;   // bonus if others depend on this
const WEIGHT_EFFORT_PENALTY = -10;   // max penalty for high effort

const ENGINE_VERSION = "1.0";

// ─── Priority Classification bands ───────────────────────────────
export type PriorityClassification =
  | "Critical Priority"
  | "High Priority"
  | "Important"
  | "Planned Improvement"
  | "Monitor";

export function classifyPriority(score: number): PriorityClassification {
  if (score >= 90) return "Critical Priority";
  if (score >= 80) return "High Priority";
  if (score >= 65) return "Important";
  if (score >= 50) return "Planned Improvement";
  return "Monitor";
}

// ─── Effort values ────────────────────────────────────────────────
export type EffortLevel = "low" | "moderate" | "high" | "major_initiative";
export type TimeframeValue =
  | "immediate"
  | "7_days"
  | "30_days"
  | "60_90_days"
  | "strategic_90_plus_days";

// ─── Domain mapping ───────────────────────────────────────────────
export type RecommendationDomain =
  | "Revenue and Lead Growth"
  | "Sales and Conversion"
  | "Customer Experience and Retention"
  | "Operations and Efficiency"
  | "Technology and Automation"
  | "Reporting and Scalability"
  | "Strategy and Offer Clarity"
  | "Team and Accountability";

const CATEGORY_DOMAIN_MAP: Record<string, RecommendationDomain> = {
  lead_generation: "Revenue and Lead Growth",
  traffic_visibility: "Revenue and Lead Growth",
  lead_capture: "Revenue and Lead Growth",
  content_marketing: "Revenue and Lead Growth",
  website_performance: "Revenue and Lead Growth",
  speed_to_lead: "Sales and Conversion",
  follow_up: "Sales and Conversion",
  sales_conversion: "Sales and Conversion",
  customer_retention: "Customer Experience and Retention",
  reputation_reviews: "Customer Experience and Retention",
  automation: "Technology and Automation",
  technology_integration: "Technology and Automation",
  reporting_analytics: "Reporting and Scalability",
  operational_efficiency: "Operations and Efficiency",
  scalability: "Reporting and Scalability",
  offer_clarity: "Strategy and Offer Clarity",
  differentiation: "Strategy and Offer Clarity",
  accountability: "Team and Accountability",
};

function getDomain(categoryKey: string): RecommendationDomain {
  return CATEGORY_DOMAIN_MAP[categoryKey] ?? "Operations and Efficiency";
}

// ─── Rule library ─────────────────────────────────────────────────

export interface RuleTemplate {
  ruleKey: string;
  version: string;
  domain: RecommendationDomain;
  categoryMatch: string;
  title: string;
  problemStatement: string;
  whyItMatters: string;
  recommendedOutcome: string;
  defaultEffort: EffortLevel;
  defaultTimeframe: TimeframeValue;
  defaultOwner: string;
  successMetric: string;
  dependencyNotes: string;
  defaultActions: ActionTemplate[];
  dependencyRules: string[]; // category keys this rule depends on
  triggerConditions: {
    minPriorityScore?: number;
    severities?: string[];
    maxCurrentPerformance?: number;
  };
}

export interface ActionTemplate {
  title: string;
  description: string;
  timeHorizon: "immediate" | "7_days" | "30_days" | "60_90_days";
  suggestedOwner: string;
  expectedOutcome: string;
  successMetric: string;
  sortOrder: number;
}

export const RULE_LIBRARY: RuleTemplate[] = [
  {
    ruleKey: "inconsistent_lead_generation",
    version: "1.0",
    domain: "Revenue and Lead Growth",
    categoryMatch: "lead_generation",
    title: "Establish a Consistent Lead Generation System",
    problemStatement:
      "The business lacks a reliable, measurable system for generating a consistent flow of qualified leads. Lead volume is unpredictable and revenue growth depends on ad-hoc activity.",
    whyItMatters:
      "Without a consistent pipeline, revenue growth is entirely reactive. Predictable lead flow is the foundation of every growth strategy.",
    recommendedOutcome:
      "A documented, multi-channel lead generation system with assigned ownership, weekly pipeline targets, and a tracked cost-per-lead.",
    defaultEffort: "high",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Marketing / Business Owner",
    successMetric: "Consistent weekly lead volume hitting a defined target for 8+ consecutive weeks",
    dependencyNotes: "Offer clarity and a functional lead capture system should be in place before scaling lead generation activity.",
    dependencyRules: ["offer_clarity", "lead_capture"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Define ideal customer profile and core offer",
        description: "Document who you are targeting, what problem you solve, and why they should choose you over alternatives.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner",
        expectedOutcome: "Clear ICP and offer definition to guide all lead generation activity",
        successMetric: "ICP document completed and shared with team",
        sortOrder: 1,
      },
      {
        title: "Audit and rank current lead sources",
        description: "List every active lead source, measure volume and conversion rate from each, and rank by ROI.",
        timeHorizon: "7_days",
        suggestedOwner: "Marketing Lead",
        expectedOutcome: "Clear picture of which channels work and which to cut or double down on",
        successMetric: "Lead source audit completed with ROI ranking",
        sortOrder: 2,
      },
      {
        title: "Launch at least one new lead generation channel",
        description: "Select the highest-potential untested channel (referral programme, outbound outreach, or content/SEO) and run a 30-day test.",
        timeHorizon: "30_days",
        suggestedOwner: "Marketing / Business Owner",
        expectedOutcome: "New leads from a new source within 30 days",
        successMetric: "Minimum 10 qualified leads from the new channel in month one",
        sortOrder: 3,
      },
      {
        title: "Set weekly pipeline targets and assign ownership",
        description: "Define a weekly qualified-lead target based on revenue goals. Assign a named owner accountable for hitting it.",
        timeHorizon: "60_90_days",
        suggestedOwner: "Business Owner / Sales Lead",
        expectedOutcome: "Predictable pipeline with clear accountability",
        successMetric: "Weekly lead targets met for 4+ consecutive weeks",
        sortOrder: 4,
      },
    ],
  },
  {
    ruleKey: "poor_lead_capture",
    version: "1.0",
    domain: "Revenue and Lead Growth",
    categoryMatch: "lead_capture",
    title: "Improve Lead Capture Conversion Rate",
    problemStatement:
      "A significant proportion of website traffic and marketing activity is failing to convert into captured, contactable leads. The business is paying for visibility it cannot monetise.",
    whyItMatters:
      "Every visitor who leaves without sharing their contact information is a lost opportunity. A small improvement in capture rate multiplies ROI across all marketing spend.",
    recommendedOutcome:
      "A clear, friction-reduced lead capture system across all major touchpoints with a measurable improvement in conversion rate.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Marketing / Web Lead",
    successMetric: "Lead capture rate improved by at least 20% within 60 days",
    dependencyNotes: "Improving lead capture amplifies the value of all upstream lead generation and traffic activity.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Audit all current lead capture touchpoints",
        description: "List every page, form, and call-to-action in the business. Test each one for functionality, clarity, and friction.",
        timeHorizon: "immediate",
        suggestedOwner: "Marketing / Web Lead",
        expectedOutcome: "Full inventory of capture points with identified gaps",
        successMetric: "Audit completed with documented findings",
        sortOrder: 1,
      },
      {
        title: "Add or improve lead magnet offer",
        description: "Create a valuable free offer (guide, checklist, assessment, consultation) that incentivises visitors to share their contact details.",
        timeHorizon: "7_days",
        suggestedOwner: "Marketing Lead",
        expectedOutcome: "A compelling reason for visitors to opt in",
        successMetric: "Lead magnet live and generating opt-ins within 7 days",
        sortOrder: 2,
      },
      {
        title: "Simplify all opt-in forms to minimum required fields",
        description: "Remove unnecessary form fields. Name and email or phone is usually sufficient for initial capture.",
        timeHorizon: "7_days",
        suggestedOwner: "Web Lead",
        expectedOutcome: "Reduced friction leading to higher submission rates",
        successMetric: "Form completion rate increases by at least 15%",
        sortOrder: 3,
      },
    ],
  },
  {
    ruleKey: "slow_speed_to_lead",
    version: "1.0",
    domain: "Sales and Conversion",
    categoryMatch: "speed_to_lead",
    title: "Reduce Lead Response Time to Under 5 Minutes",
    problemStatement:
      "New inquiries are not being responded to quickly enough. Slow response rates allow competitors to engage prospects first and significantly reduce conversion probability.",
    whyItMatters:
      "Research consistently shows that responding to a new inquiry within 5 minutes increases conversion rates by up to 400% compared to responding within 30 minutes.",
    recommendedOutcome:
      "An automated first-touch response within 5 minutes of inquiry submission, with a defined human follow-up target and CRM routing rules in place.",
    defaultEffort: "low",
    defaultTimeframe: "7_days",
    defaultOwner: "Sales / Operations Lead",
    successMetric: "Average first response time under 5 minutes for 90% of new inquiries",
    dependencyNotes: "A CRM or contact management system should be in place to support routing and tracking.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Configure automated inquiry acknowledgment",
        description: "Set up an automatic email or SMS response for every new form submission or inquiry channel. Response must arrive within 5 minutes.",
        timeHorizon: "immediate",
        suggestedOwner: "Operations / Technology Lead",
        expectedOutcome: "Every new lead receives an immediate acknowledgment confirming receipt",
        successMetric: "Automated response live for all inquiry channels",
        sortOrder: 1,
      },
      {
        title: "Assign CRM routing rules for new inquiries",
        description: "Define who receives new inquiries by source or type. Configure automatic assignment and notification.",
        timeHorizon: "7_days",
        suggestedOwner: "Sales / Operations Lead",
        expectedOutcome: "New inquiries immediately assigned to the right person with no manual intervention",
        successMetric: "100% of new leads assigned within 5 minutes of submission",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "weak_follow_up",
    version: "1.0",
    domain: "Sales and Conversion",
    categoryMatch: "follow_up",
    title: "Build a Structured Multi-Touch Follow-Up System",
    problemStatement:
      "Leads are being lost through gaps in the follow-up process after initial contact. There is no defined, consistent sequence for nurturing prospects through to a decision.",
    whyItMatters:
      "Most purchases happen after 5 or more touchpoints. Without a structured follow-up process, the majority of leads are abandoned before a purchase decision is made.",
    recommendedOutcome:
      "A documented, automated 5–7 touchpoint follow-up sequence for every lead source, with clear pipeline stage definitions and team accountability.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Sales Lead",
    successMetric: "Lead-to-opportunity conversion rate increases by 20%+ within 60 days of implementation",
    dependencyNotes: "Effective follow-up requires a CRM or pipeline management tool to track and automate touchpoints.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Map current follow-up process and identify drop-off points",
        description: "Document every touchpoint that currently happens after a lead is captured. Identify at which stage leads go cold.",
        timeHorizon: "immediate",
        suggestedOwner: "Sales Lead",
        expectedOutcome: "Clear picture of where follow-up breaks down",
        successMetric: "Process map completed with drop-off points identified",
        sortOrder: 1,
      },
      {
        title: "Design a 5–7 touchpoint follow-up sequence",
        description: "Create a sequence covering email, phone, and SMS as appropriate. Define timing, messaging, and the trigger for each step.",
        timeHorizon: "7_days",
        suggestedOwner: "Sales / Marketing Lead",
        expectedOutcome: "A written sequence with templated messages for each touchpoint",
        successMetric: "Follow-up sequence documented and approved",
        sortOrder: 2,
      },
      {
        title: "Automate reminders and define pipeline stage rules",
        description: "Configure CRM reminders for each follow-up step. Define what constitutes a stage change and when a lead is closed lost.",
        timeHorizon: "30_days",
        suggestedOwner: "Operations / Sales Lead",
        expectedOutcome: "No lead falls through the cracks without a deliberate close-lost decision",
        successMetric: "100% of active leads in CRM with a next-action date assigned",
        sortOrder: 3,
      },
    ],
  },
  {
    ruleKey: "low_sales_conversion",
    version: "1.0",
    domain: "Sales and Conversion",
    categoryMatch: "sales_conversion",
    title: "Strengthen the Sales Process and Improve Conversion Rate",
    problemStatement:
      "The business is not efficiently converting qualified prospects into clients. The sales process has gaps in qualification, discovery, proposal quality, or closing technique that are causing unnecessary drop-off.",
    whyItMatters:
      "A broken sales process means every pound spent on marketing and lead generation delivers a lower return. Improving conversion rate reduces the cost of acquiring each new client.",
    recommendedOutcome:
      "A documented, stage-by-stage sales process with defined qualification criteria, discovery frameworks, proposal templates, and objection-handling playbooks.",
    defaultEffort: "moderate",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Sales Lead / Business Owner",
    successMetric: "Sales conversion rate from qualified lead to new client increases by at least 15%",
    dependencyNotes: "Clear offer positioning and an effective follow-up system should be in place before optimising the sales process.",
    dependencyRules: ["offer_clarity", "follow_up"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Conduct a full sales process audit",
        description: "Review qualification criteria, discovery questions, proposal format, objection-handling approach, and closing steps. Identify the two biggest drop-off points.",
        timeHorizon: "7_days",
        suggestedOwner: "Sales Lead / Business Owner",
        expectedOutcome: "Clear identification of the top two conversion barriers",
        successMetric: "Audit completed with prioritised improvement actions",
        sortOrder: 1,
      },
      {
        title: "Build or update the sales playbook",
        description: "Document the full sales process including scripts, discovery questions, objection responses, and proposal structure. Make it trainable.",
        timeHorizon: "30_days",
        suggestedOwner: "Sales Lead",
        expectedOutcome: "A repeatable, teachable sales process that any team member can follow",
        successMetric: "Playbook created and reviewed with the team",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "unclear_offer",
    version: "1.0",
    domain: "Strategy and Offer Clarity",
    categoryMatch: "offer_clarity",
    title: "Clarify and Sharpen the Core Business Offer",
    problemStatement:
      "The business's core offer is not clearly defined, differentiated, or communicated in a way that prospects immediately understand its value.",
    whyItMatters:
      "An unclear offer creates friction at every stage of the customer journey — it makes marketing harder, sales slower, and referrals less frequent.",
    recommendedOutcome:
      "A clearly defined core offer with a compelling value proposition, articulated in the customer's language, consistently communicated across all channels.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Business Owner",
    successMetric: "Offer positioned consistently across website, sales materials, and team communications",
    dependencyNotes: "Offer clarity should precede scaling of lead generation or paid advertising.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Define the core offer and ideal outcome for the customer",
        description: "Articulate what you deliver, who it is for, what problem it solves, and what the customer's life looks like after working with you.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner",
        expectedOutcome: "A one-paragraph offer statement in the customer's language",
        successMetric: "Offer statement drafted and tested with 3 target customers",
        sortOrder: 1,
      },
      {
        title: "Update all customer-facing materials to reflect the refined offer",
        description: "Revise website headline, proposal templates, sales scripts, and any marketing collateral to consistently reflect the new offer positioning.",
        timeHorizon: "30_days",
        suggestedOwner: "Marketing / Business Owner",
        expectedOutcome: "Consistent offer communication across all touchpoints",
        successMetric: "All materials updated and reviewed",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "weak_differentiation",
    version: "1.0",
    domain: "Strategy and Offer Clarity",
    categoryMatch: "differentiation",
    title: "Develop a Clear Differentiation and Competitive Positioning",
    problemStatement:
      "The business does not have a compelling, articulated reason why prospects should choose it over competitors. Without clear differentiation, price becomes the default decision factor.",
    whyItMatters:
      "Strong differentiation reduces price sensitivity, improves close rates, and makes marketing more effective. Without it, the business competes on price alone.",
    recommendedOutcome:
      "A clearly articulated differentiation statement and competitive positioning that is embedded in all sales and marketing activity.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Business Owner",
    successMetric: "Differentiation clearly embedded in website, sales conversations, and proposals",
    dependencyNotes: "Differentiation should be defined before scaling paid advertising or content marketing.",
    dependencyRules: ["offer_clarity"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Conduct competitive analysis and identify whitespace",
        description: "Map the top 3–5 competitors. Identify what they do well, what they do poorly, and where the business has a genuine advantage.",
        timeHorizon: "7_days",
        suggestedOwner: "Business Owner / Marketing Lead",
        expectedOutcome: "Clear picture of competitive landscape and differentiation opportunities",
        successMetric: "Analysis completed and top 3 differentiators identified",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "poor_customer_retention",
    version: "1.0",
    domain: "Customer Experience and Retention",
    categoryMatch: "customer_retention",
    title: "Develop a Client Retention and Loyalty Programme",
    problemStatement:
      "The business is losing clients faster than it should. Retention is below the level required for compounding, sustainable revenue growth.",
    whyItMatters:
      "High churn erodes the client base faster than new business can replace it. Retaining clients is typically 5–7x cheaper than acquiring new ones.",
    recommendedOutcome:
      "A structured client retention system including proactive check-ins, onboarding improvements, early churn detection, and a renewal or upsell pathway.",
    defaultEffort: "moderate",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Operations / Client Success",
    successMetric: "Client retention rate improves by at least 10% within 90 days",
    dependencyNotes: "Solid onboarding and delivery experience must be in place before launching retention programmes.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Survey recently churned clients to identify root causes",
        description: "Contact all clients who have left in the past 6 months. Ask structured questions to identify the top 2–3 reasons for churn.",
        timeHorizon: "7_days",
        suggestedOwner: "Operations / Business Owner",
        expectedOutcome: "Clear understanding of why clients leave",
        successMetric: "At least 50% of churned clients surveyed or contacted",
        sortOrder: 1,
      },
      {
        title: "Build a proactive client check-in cadence",
        description: "Schedule regular check-ins (monthly or quarterly) for all active clients. Use a structured agenda to surface problems early.",
        timeHorizon: "30_days",
        suggestedOwner: "Client Success / Operations Lead",
        expectedOutcome: "No client goes more than 90 days without a proactive touchpoint",
        successMetric: "Check-in cadence documented and active for all current clients",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "inconsistent_customer_experience",
    version: "1.0",
    domain: "Customer Experience and Retention",
    categoryMatch: "reputation_reviews",
    title: "Systematise Customer Experience and Review Generation",
    problemStatement:
      "Customer experience is inconsistent across the client lifecycle. The business does not actively collect reviews or manage its online reputation.",
    whyItMatters:
      "A weak reputation increases buyer scepticism, raises acquisition costs, and directly affects close rates. Consistent experience drives repeat business and referrals.",
    recommendedOutcome:
      "A structured review generation system, a defined client experience journey, and a weekly process for responding to and monitoring online reviews.",
    defaultEffort: "low",
    defaultTimeframe: "7_days",
    defaultOwner: "Operations / Client Success",
    successMetric: "Review volume increases by 50% within 60 days; average response time under 48 hours",
    dependencyNotes: "Consistent client experience requires documented delivery processes.",
    dependencyRules: ["operational_efficiency"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Implement review request at each delivery milestone",
        description: "Add an automatic or templated review request at 2–3 key points in the client journey (e.g., after onboarding, after first result, after project completion).",
        timeHorizon: "7_days",
        suggestedOwner: "Operations Lead",
        expectedOutcome: "Consistent inflow of new reviews from satisfied clients",
        successMetric: "Review request process active and generating at least 4 new reviews per month",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "manual_repetitive_processes",
    version: "1.0",
    domain: "Operations and Efficiency",
    categoryMatch: "operational_efficiency",
    title: "Systematise and Automate Core Operational Processes",
    problemStatement:
      "Key business operations rely on manual, repetitive tasks that consume team time, introduce errors, and create a ceiling on delivery capacity.",
    whyItMatters:
      "Operational inefficiency silently consumes profit margins and limits the owner's ability to focus on growth. Manual processes become exponentially more costly as volume increases.",
    recommendedOutcome:
      "Documented SOPs for all core processes, with the top three highest-time-cost tasks automated or systematised within 90 days.",
    defaultEffort: "high",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Operations Lead",
    successMetric: "Top 3 manual process time-cost reduced by at least 50% each",
    dependencyNotes: "Documentation and automation should precede delegation or team expansion.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Map and document all core operational workflows",
        description: "List every recurring process. Document the steps, time required, errors found, and the person performing it.",
        timeHorizon: "immediate",
        suggestedOwner: "Operations Lead",
        expectedOutcome: "Full inventory of operational processes with time-cost data",
        successMetric: "All core processes documented in SOP format",
        sortOrder: 1,
      },
      {
        title: "Identify and address the top three operational bottlenecks",
        description: "Select the three processes with the highest combined time cost and error rate. Build improvement or automation plans for each.",
        timeHorizon: "30_days",
        suggestedOwner: "Operations Lead / Business Owner",
        expectedOutcome: "Three clearly identified bottlenecks with assigned improvement owners",
        successMetric: "Improvement plans in place and time savings measurable within 60 days",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "disconnected_systems",
    version: "1.0",
    domain: "Technology and Automation",
    categoryMatch: "technology_integration",
    title: "Integrate and Connect Core Business Technology Systems",
    problemStatement:
      "The business operates with disconnected technology systems, requiring manual data transfer between tools. This creates errors, slows decisions, and causes invisible revenue loss.",
    whyItMatters:
      "Disconnected systems mean teams spend time on data entry instead of value-creating work. Poor data flow leads to missed follow-ups, billing errors, and unreliable reporting.",
    recommendedOutcome:
      "A mapped technology stack with the two or three most critical data flows connected, eliminating the highest-cost manual transfers.",
    defaultEffort: "moderate",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Operations / Technology Lead",
    successMetric: "Top 3 manual data-transfer tasks eliminated through integration",
    dependencyNotes: "A CRM or central customer database should exist before building integrations around it.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Audit the full technology stack",
        description: "List every tool in use. Identify duplicate functions, disconnected data flows, and the highest-cost manual transfers between systems.",
        timeHorizon: "7_days",
        suggestedOwner: "Operations / Technology Lead",
        expectedOutcome: "Clear picture of the technology landscape and integration gaps",
        successMetric: "Stack audit completed with integration priorities ranked",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "missing_crm_process",
    version: "1.0",
    domain: "Sales and Conversion",
    categoryMatch: "follow_up",
    title: "Implement a CRM-Supported Contact and Pipeline Management Process",
    problemStatement:
      "The business lacks a consistent, tool-supported system for managing leads, contacts, and pipeline stages. Activity relies on memory, spreadsheets, or ad-hoc tools.",
    whyItMatters:
      "Without a structured contact management process, leads fall through the cracks, follow-up is inconsistent, and it is impossible to accurately forecast revenue.",
    recommendedOutcome:
      "A CRM or equivalent system in use by the full team, with defined pipeline stages, clean data entry standards, and a weekly pipeline review process.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Sales / Operations Lead",
    successMetric: "100% of active leads tracked in CRM with a defined next action and follow-up date",
    dependencyNotes: "CRM adoption must precede advanced automation or reporting initiatives.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high"], maxCurrentPerformance: 6 },
    defaultActions: [
      {
        title: "Select and configure a CRM or pipeline management system",
        description: "Choose a CRM that fits current team size and process complexity. Configure pipeline stages, fields, and user access.",
        timeHorizon: "7_days",
        suggestedOwner: "Operations / Technology Lead",
        expectedOutcome: "CRM configured and ready for team use",
        successMetric: "CRM set up with all active leads migrated",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "weak_reporting",
    version: "1.0",
    domain: "Reporting and Scalability",
    categoryMatch: "reporting_analytics",
    title: "Build Core Business Performance Reporting",
    problemStatement:
      "The business does not have consistent, trusted reporting on key performance indicators. Decision-making relies on gut feel rather than data, and problems grow undetected.",
    whyItMatters:
      "Without measurement, improvement is guesswork. Weak reporting means leadership cannot identify underperformance early or validate whether improvements are working.",
    recommendedOutcome:
      "A simple weekly reporting dashboard covering the 3–5 most critical metrics for each business function, reviewed consistently by leadership.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Operations / Leadership",
    successMetric: "Weekly reporting in place and reviewed consistently for 4+ weeks",
    dependencyNotes: "Reporting is most valuable when operational processes and CRM data are reliable enough to measure.",
    dependencyRules: [],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Define the 3–5 metrics that matter most for each function",
        description: "For sales, marketing, operations, and finance — identify one to three numbers that indicate whether each function is healthy.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner / Operations Lead",
        expectedOutcome: "Agreed KPI list, with an owner assigned to each metric",
        successMetric: "KPI list finalised and signed off by leadership",
        sortOrder: 1,
      },
      {
        title: "Build a simple weekly reporting dashboard",
        description: "Create a single view (spreadsheet or reporting tool) that shows all key metrics in one place. Set a weekly update schedule.",
        timeHorizon: "30_days",
        suggestedOwner: "Operations Lead",
        expectedOutcome: "One consistent view of business performance reviewed every week",
        successMetric: "Dashboard live and reviewed weekly for 4+ consecutive weeks",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "missing_kpi_tracking",
    version: "1.0",
    domain: "Reporting and Scalability",
    categoryMatch: "reporting_analytics",
    title: "Implement KPI Tracking and Performance Accountability",
    problemStatement:
      "The business does not systematically track the key performance indicators that drive results. Without tracked KPIs, accountability is informal and improvement is unmeasurable.",
    whyItMatters:
      "KPI tracking creates visibility, accountability, and a shared language for performance. Without it, the team cannot align on priorities or prove that improvements are working.",
    recommendedOutcome:
      "A set of 5–10 agreed KPIs tracked weekly, with clear ownership and a structured review process that drives accountability.",
    defaultEffort: "low",
    defaultTimeframe: "30_days",
    defaultOwner: "Operations / Leadership",
    successMetric: "KPI scorecard reviewed weekly for 8+ consecutive weeks with consistent data",
    dependencyNotes: "KPI tracking is only reliable when underlying data sources (CRM, sales tools, financials) are consistent.",
    dependencyRules: ["reporting_analytics"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Agree on a set of 5–10 core KPIs with the leadership team",
        description: "Facilitate a brief leadership session to agree on which numbers matter most. Limit to 5–10 to keep focus.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner",
        expectedOutcome: "Agreed, limited KPI set with ownership assigned",
        successMetric: "KPI list agreed and shared with the team",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "lack_of_documentation",
    version: "1.0",
    domain: "Operations and Efficiency",
    categoryMatch: "operational_efficiency",
    title: "Create Operational Documentation and Standard Operating Procedures",
    problemStatement:
      "The business lacks documented processes. Key knowledge lives in the owner's or key employees' heads, creating fragility and blocking delegation.",
    whyItMatters:
      "Without documentation, every process depends on the same people doing it the same way. Errors multiply, training is slow, and the business cannot safely grow or delegate.",
    recommendedOutcome:
      "SOPs for all critical processes, stored in a shared system, reviewed annually, and actively used for onboarding and delegation.",
    defaultEffort: "high",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Operations Lead / Business Owner",
    successMetric: "All critical processes documented and used by at least one other team member",
    dependencyNotes: "Documentation should be created before hiring, delegation, or automation.",
    dependencyRules: [],
    triggerConditions: { severities: ["high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Identify the top 10 processes most at risk without documentation",
        description: "List the processes where only one person knows how to do it and where an error would cause the most damage.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner / Operations Lead",
        expectedOutcome: "Prioritised list of critical processes to document first",
        successMetric: "List completed and shared with the team",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "unclear_accountability",
    version: "1.0",
    domain: "Team and Accountability",
    categoryMatch: "accountability",
    title: "Define Roles, Responsibilities, and Accountability Structures",
    problemStatement:
      "The business lacks clear role definitions and accountability structures. Important tasks fall through the cracks because ownership is ambiguous.",
    whyItMatters:
      "Without clear accountability, team performance is inconsistent, problems go unaddressed, and the owner is pulled into tasks that should be delegated.",
    recommendedOutcome:
      "Defined roles with clear responsibilities, a regular accountability cadence, and a framework for measuring individual and team performance.",
    defaultEffort: "moderate",
    defaultTimeframe: "30_days",
    defaultOwner: "Business Owner",
    successMetric: "All team members have defined roles with documented responsibilities reviewed in a regular cadence",
    dependencyNotes: "Clear accountability requires operational documentation to be in place first.",
    dependencyRules: ["operational_efficiency"],
    triggerConditions: { severities: ["high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Create a roles and responsibilities matrix",
        description: "Document every core function of the business and assign a named owner. Identify gaps where no one has clear ownership.",
        timeHorizon: "7_days",
        suggestedOwner: "Business Owner",
        expectedOutcome: "Clear ownership for every important business function",
        successMetric: "Responsibility matrix created and shared with the team",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "limited_scalability",
    version: "1.0",
    domain: "Reporting and Scalability",
    categoryMatch: "scalability",
    title: "Reduce Owner-Dependency and Build Scalable Operating Systems",
    problemStatement:
      "Core business operations depend too heavily on the owner's personal involvement. This creates a hard ceiling on revenue, limits growth, and makes the business impossible to scale or exit.",
    whyItMatters:
      "Owner-dependency limits the business to what one person can personally manage. Every hour the owner spends on operational tasks is an hour not spent on growth.",
    recommendedOutcome:
      "Documented, delegated operating systems that allow the business to function and grow without requiring the owner's direct involvement in day-to-day tasks.",
    defaultEffort: "major_initiative",
    defaultTimeframe: "strategic_90_plus_days",
    defaultOwner: "Business Owner",
    successMetric: "Owner working in the business fewer than 20 hours per week within 90 days of full implementation",
    dependencyNotes: "Scalability initiatives require documentation and team accountability structures to be in place first.",
    dependencyRules: ["operational_efficiency", "accountability"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Document all owner-dependent processes",
        description: "List every task that only the owner can do. Categorise by how frequently it occurs and what would break if it were not done.",
        timeHorizon: "immediate",
        suggestedOwner: "Business Owner",
        expectedOutcome: "Clear inventory of owner-dependency risks",
        successMetric: "Owner-dependency list completed with priority order for delegation",
        sortOrder: 1,
      },
      {
        title: "Build delegation guides for the top 3 owner-dependent processes",
        description: "Create step-by-step guides, decision trees, and quality standards for the three highest-priority processes to delegate first.",
        timeHorizon: "30_days",
        suggestedOwner: "Business Owner / Operations Lead",
        expectedOutcome: "Three critical processes ready to hand over",
        successMetric: "Delegation guides tested and in use by a team member within 60 days",
        sortOrder: 2,
      },
    ],
  },
  {
    ruleKey: "premature_advertising",
    version: "1.0",
    domain: "Revenue and Lead Growth",
    categoryMatch: "lead_generation",
    title: "Strengthen Business Foundations Before Scaling Paid Advertising",
    problemStatement:
      "The business is investing or planning to invest in paid advertising before the foundational systems needed to convert and retain leads are in place. This leads to wasted spend.",
    whyItMatters:
      "Paid advertising accelerates whatever is already happening in the business. Without strong lead capture, follow-up, and sales processes, paid traffic leads to expensive, low-conversion campaigns.",
    recommendedOutcome:
      "Core conversion and follow-up systems in place and tested before paid advertising budget is committed or scaled.",
    defaultEffort: "high",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Business Owner / Marketing Lead",
    successMetric: "Lead capture, follow-up, and sales process proven to convert before paid ads are scaled",
    dependencyNotes: "Paid advertising should only be scaled after lead capture, follow-up, and offer clarity are proven to work.",
    dependencyRules: ["lead_capture", "follow_up", "offer_clarity"],
    triggerConditions: { severities: ["critical", "high"], maxCurrentPerformance: 6 },
    defaultActions: [
      {
        title: "Audit conversion systems before committing to paid ad budget",
        description: "Test lead capture, follow-up, and sales process with organic or low-cost traffic first. Confirm the system converts before scaling spend.",
        timeHorizon: "30_days",
        suggestedOwner: "Marketing / Business Owner",
        expectedOutcome: "Proven conversion systems ready to support paid traffic scaling",
        successMetric: "Conversion rate from lead to client proven at baseline before paid scale-up",
        sortOrder: 1,
      },
    ],
  },
  {
    ruleKey: "business_automation",
    version: "1.0",
    domain: "Technology and Automation",
    categoryMatch: "automation",
    title: "Implement Business Process Automation to Free Team Capacity",
    problemStatement:
      "Repetitive manual tasks are consuming team time and creating inconsistency in delivery. The business has automation opportunities that have not been captured.",
    whyItMatters:
      "Automation creates capacity for growth without proportional increases in staffing cost. It also reduces errors and creates more consistent client experiences.",
    recommendedOutcome:
      "The top three highest-time-cost repetitive tasks automated, with monitoring and human-fallback procedures in place.",
    defaultEffort: "moderate",
    defaultTimeframe: "60_90_days",
    defaultOwner: "Operations / Technology Lead",
    successMetric: "At least 3 recurring manual tasks automated, saving a minimum of 5 hours per week total",
    dependencyNotes: "Automation is most effective once core processes are documented. Automating a broken process creates a faster, more consistent problem.",
    dependencyRules: ["operational_efficiency"],
    triggerConditions: { severities: ["critical", "high", "moderate"], maxCurrentPerformance: 7 },
    defaultActions: [
      {
        title: "Map all recurring manual tasks and estimate time cost",
        description: "List every task done more than once per week. Estimate time spent per week and error rate for each.",
        timeHorizon: "immediate",
        suggestedOwner: "Operations Lead",
        expectedOutcome: "Ranked list of automation opportunities by time-cost and feasibility",
        successMetric: "Task inventory completed with time estimates",
        sortOrder: 1,
      },
      {
        title: "Select and implement automation for the top 3 tasks",
        description: "Choose the three highest-ROI automation opportunities. Build and test each with monitoring and fallback procedures.",
        timeHorizon: "60_90_days",
        suggestedOwner: "Operations / Technology Lead",
        expectedOutcome: "Three manual tasks eliminated or reduced by automation",
        successMetric: "Each automation live, tested, and verified to be saving time reliably",
        sortOrder: 2,
      },
    ],
  },
];

// ─── Input types ──────────────────────────────────────────────────

export interface AssessmentScoreInput {
  categoryKey: string;
  categoryLabel: string;
  currentPerformance: number;  // 0–10
  businessImpact: number;      // 1–5
  urgency: number;             // 1–5
  performanceGap: number;      // 0–10
  priorityScore: number;       // raw diagnostic score
  severity: string;
  evidence: string | null;
  observations: string | null;
  recommendedAction: string | null;
}

export interface GenerationInput {
  growthAssessmentId: string;
  diagnosticId: string;
  diagnosticVersionId: string;
  clientId: string;
  projectId: string | null;
  healthScore: number;
  healthRating: string;
  generatedSections: GeneratedSections | null;
  scores: AssessmentScoreInput[];
  createdByUserId: string | null;
}

// ─── Output types ─────────────────────────────────────────────────

export interface ScoringExplanation {
  severity: number;
  businessImpact: number;
  urgency: number;
  performanceGap: number;
  quickWinBonus: number;
  dependencyBonus: number;
  effortPenalty: number;
  finalScore: number;
}

export interface GeneratedRecommendation {
  sourceCategoryKey: string;
  sourceAssessmentData: Record<string, unknown>;
  rank: number;
  title: string;
  domain: RecommendationDomain;
  problemStatement: string;
  whyItMatters: string;
  recommendedOutcome: string;
  priorityScore: number;
  priorityClassification: PriorityClassification;
  severityScore: number;
  businessImpactScore: number;
  urgencyScore: number;
  performanceGapScore: number;
  quickWinBonus: number;
  dependencyBonus: number;
  effortPenalty: number;
  quickWinFlag: boolean;
  effort: EffortLevel;
  confidence: number;
  timeframe: TimeframeValue;
  suggestedOwner: string;
  successMetric: string;
  dependencyNotes: string;
  scoringExplanation: ScoringExplanation;
  actions: ActionTemplate[];
  dependencyRules: string[]; // category keys this depends on
}

export interface BusinessImpactSummary {
  revenueGrowth: number;      // 1–5
  leadGeneration: number;
  salesConversion: number;
  customerRetention: number;
  customerExperience: number;
  operationalEfficiency: number;
  technologyAutomation: number;
  reportingVisibility: number;
  scalability: number;
}

export interface GenerationResult {
  recommendations: GeneratedRecommendation[];
  executiveRecommendation: string;
  businessImpactSummary: BusinessImpactSummary;
  dependencySummary: string;
  overallPriorityScore: number;
  engineVersion: string;
}

// ─── Scoring engine ───────────────────────────────────────────────

function severityToScore(severity: string): number {
  switch (severity) {
    case "critical": return 25;
    case "high": return 20;
    case "moderate": return 13;
    case "monitor": return 7;
    case "healthy": return 2;
    default: return 10;
  }
}

function effortToTimeframe(effort: EffortLevel, ruleTimeframe: TimeframeValue): TimeframeValue {
  return ruleTimeframe; // rules already encode the right timeframe
}

function isQuickWin(
  effort: EffortLevel,
  score: number,
  dependencyKeys: string[],
  criticalCategories: Set<string>,
): boolean {
  if (effort === "high" || effort === "major_initiative") return false;
  if (score < 55) return false;
  // If any of its dependencies are in the critical categories, not a quick win
  for (const dep of dependencyKeys) {
    if (criticalCategories.has(dep)) return false;
  }
  return true;
}

function scoreRecommendation(
  scoreInput: AssessmentScoreInput,
  rule: RuleTemplate,
  criticalCategories: Set<string>,
  isDependedUpon: boolean,
): { score: number; explanation: ScoringExplanation } {
  // Normalise each component to its max weight
  const severityComponent = Math.round((severityToScore(scoreInput.severity) / 25) * WEIGHT_SEVERITY);

  const businessImpactComponent = Math.round(
    ((scoreInput.businessImpact - 1) / 4) * WEIGHT_BUSINESS_IMPACT,
  );

  const urgencyComponent = Math.round(
    ((scoreInput.urgency - 1) / 4) * WEIGHT_URGENCY,
  );

  const performanceGapComponent = Math.round(
    (scoreInput.performanceGap / 10) * WEIGHT_PERFORMANCE_GAP,
  );

  const isQW = isQuickWin(
    rule.defaultEffort,
    severityComponent + businessImpactComponent + urgencyComponent + performanceGapComponent,
    rule.dependencyRules,
    criticalCategories,
  );
  const quickWinBonusValue = isQW ? WEIGHT_QUICK_WIN_BONUS : 0;
  const dependencyBonusValue = isDependedUpon ? WEIGHT_DEPENDENCY_BONUS : 0;

  const effortPenaltyValue = (() => {
    if (rule.defaultEffort === "major_initiative") return WEIGHT_EFFORT_PENALTY;
    if (rule.defaultEffort === "high") return Math.round(WEIGHT_EFFORT_PENALTY * 0.7);
    if (rule.defaultEffort === "moderate") return Math.round(WEIGHT_EFFORT_PENALTY * 0.3);
    return 0;
  })();

  const rawScore =
    severityComponent +
    businessImpactComponent +
    urgencyComponent +
    performanceGapComponent +
    quickWinBonusValue +
    dependencyBonusValue +
    effortPenaltyValue;

  const finalScore = Math.min(100, Math.max(0, rawScore));

  return {
    score: finalScore,
    explanation: {
      severity: severityComponent,
      businessImpact: businessImpactComponent,
      urgency: urgencyComponent,
      performanceGap: performanceGapComponent,
      quickWinBonus: quickWinBonusValue,
      dependencyBonus: dependencyBonusValue,
      effortPenalty: effortPenaltyValue,
      finalScore,
    },
  };
}

// ─── Dependency utilities ─────────────────────────────────────────

function hasCycle(graph: Map<string, string[]>, start: string, visited = new Set<string>(), path = new Set<string>()): boolean {
  if (path.has(start)) return true;
  if (visited.has(start)) return false;
  visited.add(start);
  path.add(start);
  for (const neighbor of (graph.get(start) ?? [])) {
    if (hasCycle(graph, neighbor, visited, path)) return true;
  }
  path.delete(start);
  return false;
}

function buildDependencyGraph(recs: GeneratedRecommendation[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const r of recs) {
    const deps = r.dependencyRules.filter((d) =>
      recs.some((other) => other.sourceCategoryKey === d),
    );
    graph.set(r.sourceCategoryKey, deps);
  }
  return graph;
}

// ─── Business impact summary ──────────────────────────────────────

function buildBusinessImpactSummary(
  recs: GeneratedRecommendation[],
  scores: AssessmentScoreInput[],
): BusinessImpactSummary {
  const scoreByCategory = new Map(scores.map((s) => [s.categoryKey, s]));

  function avgImpact(keys: string[]): number {
    const vals = keys
      .map((k) => scoreByCategory.get(k))
      .filter(Boolean)
      .map((s) => s!.businessImpact);
    if (!vals.length) return 3;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(Math.max(1, Math.min(5, avg)));
  }

  return {
    revenueGrowth: avgImpact(["lead_generation", "traffic_visibility", "content_marketing"]),
    leadGeneration: avgImpact(["lead_generation", "lead_capture"]),
    salesConversion: avgImpact(["sales_conversion", "speed_to_lead", "follow_up"]),
    customerRetention: avgImpact(["customer_retention", "reputation_reviews"]),
    customerExperience: avgImpact(["customer_retention", "reputation_reviews", "website_performance"]),
    operationalEfficiency: avgImpact(["operational_efficiency", "automation"]),
    technologyAutomation: avgImpact(["automation", "technology_integration"]),
    reportingVisibility: avgImpact(["reporting_analytics"]),
    scalability: avgImpact(["scalability", "operational_efficiency"]),
  };
}

// ─── Executive recommendation builder ────────────────────────────

function buildExecutiveRecommendation(
  recs: GeneratedRecommendation[],
  healthScore: number,
  healthRating: string,
): string {
  const overallCondition = (() => {
    if (healthRating === "strong") return "strong";
    if (healthRating === "stable") return "stable with clear improvement opportunities";
    if (healthRating === "vulnerable") return "vulnerable with several important gaps to address";
    if (healthRating === "at_risk") return "at significant risk and requiring structured intervention";
    return "critical and requiring immediate action across multiple areas";
  })();

  const topRec = recs[0];
  const growthRec = [...recs]
    .filter((r) =>
      r.domain === "Revenue and Lead Growth" || r.domain === "Sales and Conversion",
    )
    .sort((a, b) => b.priorityScore - a.priorityScore)[0];

  const topFocus = recs.slice(0, 3).map((r) => r.title).join("; ");

  return [
    `With a Business Health Score of ${healthScore}/100, this business is in a ${overallCondition} position.`,
    topRec
      ? `The highest-priority risk requiring immediate attention is: ${topRec.title} — ${topRec.problemStatement}`
      : "",
    growthRec
      ? `The strongest near-term growth opportunity is in ${growthRec.domain}: ${growthRec.title}.`
      : "",
    `The recommended 90-day focus is on: ${topFocus}.`,
    `Addressing these in sequence matters because foundational issues — such as lead capture, offer clarity, and process consistency — amplify the return on all downstream growth activity. Scaling marketing before these foundations are solid leads to wasted spend and inconsistent results.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Dependency summary builder ───────────────────────────────────

function buildDependencySummaryText(recs: GeneratedRecommendation[]): string {
  const deps: string[] = [];
  for (const r of recs) {
    const depNames = r.dependencyRules
      .map((d) => recs.find((other) => other.sourceCategoryKey === d)?.title)
      .filter(Boolean);
    if (depNames.length) {
      deps.push(`${r.title} should follow: ${depNames.join(", ")}`);
    }
  }
  if (!deps.length) {
    return "These recommendations can be pursued in priority score order. No critical sequencing dependencies were identified between the top recommendations.";
  }
  return (
    "Recommended implementation sequence based on dependencies: " +
    deps.join(". ") +
    ". Addressing foundational items first maximises the return on downstream investment."
  );
}

// ─── Main generation function ─────────────────────────────────────

export function generateRecommendationPlan(input: GenerationInput): GenerationResult {
  const { scores, healthScore, healthRating } = input;

  // Build set of critical categories for quick-win checks
  const criticalCategories = new Set(
    scores
      .filter((s) => s.severity === "critical" || s.severity === "high")
      .map((s) => s.categoryKey),
  );

  // Match scores to rules
  const matched: Array<{
    score: AssessmentScoreInput;
    rule: RuleTemplate;
  }> = [];

  for (const rule of RULE_LIBRARY) {
    const scoreInput = scores.find((s) => s.categoryKey === rule.categoryMatch);
    if (!scoreInput) continue;

    // Check trigger conditions
    const { triggerConditions } = rule;
    if (triggerConditions.severities && !triggerConditions.severities.includes(scoreInput.severity)) continue;
    if (triggerConditions.maxCurrentPerformance != null && scoreInput.currentPerformance > triggerConditions.maxCurrentPerformance) continue;
    if (triggerConditions.minPriorityScore != null && scoreInput.priorityScore < triggerConditions.minPriorityScore) continue;

    // Avoid duplicate category matches (keep one rule per category key for now)
    const alreadyMatched = matched.find((m) => m.score.categoryKey === scoreInput.categoryKey);
    if (alreadyMatched) continue;

    matched.push({ score: scoreInput, rule });
  }

  // Determine which categories are depended upon by others
  const dependedUponCategories = new Set<string>();
  for (const { rule } of matched) {
    for (const dep of rule.dependencyRules) {
      dependedUponCategories.add(dep);
    }
  }

  // Score each match
  const scoredMatches = matched.map(({ score, rule }) => {
    const isDependedUpon = dependedUponCategories.has(score.categoryKey);
    const { score: finalScore, explanation } = scoreRecommendation(
      score, rule, criticalCategories, isDependedUpon,
    );

    const isQW = isQuickWin(
      rule.defaultEffort,
      finalScore,
      rule.dependencyRules,
      criticalCategories,
    );

    const recommendation: GeneratedRecommendation = {
      sourceCategoryKey: score.categoryKey,
      sourceAssessmentData: {
        categoryLabel: score.categoryLabel,
        currentPerformance: score.currentPerformance,
        businessImpact: score.businessImpact,
        urgency: score.urgency,
        performanceGap: score.performanceGap,
        rawPriorityScore: score.priorityScore,
        severity: score.severity,
      },
      rank: 0, // assigned below
      title: rule.title,
      domain: rule.domain,
      problemStatement: rule.problemStatement,
      whyItMatters: rule.whyItMatters,
      recommendedOutcome: rule.recommendedOutcome,
      priorityScore: finalScore,
      priorityClassification: classifyPriority(finalScore),
      severityScore: explanation.severity,
      businessImpactScore: explanation.businessImpact,
      urgencyScore: explanation.urgency,
      performanceGapScore: explanation.performanceGap,
      quickWinBonus: explanation.quickWinBonus,
      dependencyBonus: explanation.dependencyBonus,
      effortPenalty: explanation.effortPenalty,
      quickWinFlag: isQW,
      effort: rule.defaultEffort,
      confidence: finalScore / 100,
      timeframe: rule.defaultTimeframe,
      suggestedOwner: rule.defaultOwner,
      successMetric: rule.successMetric,
      dependencyNotes: rule.dependencyNotes,
      scoringExplanation: explanation,
      actions: rule.defaultActions,
      dependencyRules: rule.dependencyRules,
    };

    return recommendation;
  });

  // Sort by score descending, take top 3–5
  scoredMatches.sort((a, b) => b.priorityScore - a.priorityScore);
  const topRecs = scoredMatches.slice(0, Math.min(5, Math.max(3, scoredMatches.length)));

  // Assign ranks
  topRecs.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Check for circular dependencies
  const graph = buildDependencyGraph(topRecs);
  for (const key of graph.keys()) {
    if (hasCycle(graph, key)) {
      // Remove the dependency edge that creates the cycle
      const deps = graph.get(key) ?? [];
      graph.set(key, []); // break the cycle by clearing this node's deps
      const rec = topRecs.find((r) => r.sourceCategoryKey === key);
      if (rec) rec.dependencyRules = [];
    }
  }

  // Build outputs
  const executiveRecommendation = buildExecutiveRecommendation(topRecs, healthScore, healthRating);
  const businessImpactSummary = buildBusinessImpactSummary(topRecs, scores);
  const dependencySummary = buildDependencySummaryText(topRecs);

  const overallPriorityScore =
    topRecs.length > 0
      ? Math.round((topRecs.reduce((acc, r) => acc + r.priorityScore, 0) / topRecs.length) * 100) / 100
      : 0;

  return {
    recommendations: topRecs,
    executiveRecommendation,
    businessImpactSummary,
    dependencySummary,
    overallPriorityScore,
    engineVersion: ENGINE_VERSION,
  };
}

export { ENGINE_VERSION };
