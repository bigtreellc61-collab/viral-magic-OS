/**
 * Rule-based diagnostic recommendation engine.
 * No external AI — deterministic, category-keyed, severity-tiered.
 */

import type { Severity } from "./diagnostics-calc";

interface RecommendationInput {
  categoryKey: string;
  categoryLabel: string;
  currentPerformance: number;
  businessImpact: number;
  urgency: number;
  severity: Severity;
  evidence?: string | null;
  observations?: string | null;
}

type SeverityTier = "critical_high" | "moderate" | "monitor_healthy";

function tier(severity: Severity): SeverityTier {
  if (severity === "critical" || severity === "high") return "critical_high";
  if (severity === "moderate") return "moderate";
  return "monitor_healthy";
}

const RULES: Record<string, Record<SeverityTier, string>> = {
  lead_generation: {
    critical_high:
      "Establish a measurable lead-generation system immediately. Clarify your core offer and ideal customer profile. Test both outbound (cold outreach, referral campaigns) and inbound (SEO, content, paid ads) channels in parallel. Define a cost-per-qualified-lead target and track it weekly. Without a consistent pipeline, revenue growth is unpredictable.",
    moderate:
      "Strengthen lead generation by adding at least one new acquisition channel this quarter. Document current sources, measure cost per lead, and identify the highest-ROI channel to double down on.",
    monitor_healthy:
      "Lead generation is performing well. Continue monitoring channel mix and cost per lead. Test incremental improvements and protect top-performing sources from budget cuts.",
  },
  traffic_visibility: {
    critical_high:
      "Audit online visibility immediately. Verify Google Business Profile, fix technical SEO issues, ensure NAP consistency across directories, and launch a targeted content or paid-traffic campaign. Identify where your best customers are searching and ensure your brand appears there.",
    moderate:
      "Improve visibility with consistent content publishing, local SEO optimization, and social media presence. Review Google Search Console data to find quick-win keyword opportunities.",
    monitor_healthy:
      "Traffic and visibility are healthy. Monitor ranking stability and watch for algorithm changes. Maintain content cadence and keep directory listings current.",
  },
  lead_capture: {
    critical_high:
      "Redesign lead-capture touchpoints across all channels. Add clear value-exchange offers (guides, assessments, consultations), improve form placement, reduce friction, and implement exit-intent capture. Every visitor who leaves without contact information is a lost opportunity.",
    moderate:
      "Test new lead magnets, simplify opt-in forms, and add capture points to high-traffic pages. A/B test CTAs and measure conversion rate by page.",
    monitor_healthy:
      "Lead capture is working. Periodically test new offers and maintain form hygiene. Ensure captured leads flow cleanly into your CRM.",
  },
  speed_to_lead: {
    critical_high:
      "Implement immediate lead-response protocols. Set up real-time notifications for new inquiries, configure automated acknowledgment within 5 minutes, establish a 30-minute human follow-up target, assign CRM routing rules, and hold team members accountable to response-time SLAs. Studies show response within 5 minutes increases conversion by 400%.",
    moderate:
      "Reduce response time by automating first-touch acknowledgment and reviewing routing rules. Track response time by channel and rep. Set team targets.",
    monitor_healthy:
      "Speed to lead is acceptable. Maintain response-time tracking and consider further automation to reach sub-5-minute response consistently.",
  },
  follow_up: {
    critical_high:
      "Build a structured multi-touch follow-up sequence immediately. Define a minimum 5–7 touchpoint cadence using email, phone, and SMS where appropriate. Create task reminders in your CRM, assign pipeline-stage ownership, and define when a lead moves from 'open' to 'closed lost'. Most sales happen after the 5th contact.",
    moderate:
      "Document and standardize your follow-up process. Ensure all reps follow the same sequence. Automate email reminders and review drop-off points in the pipeline.",
    monitor_healthy:
      "Follow-up process is solid. Review sequence performance quarterly and update messaging based on conversion data.",
  },
  sales_conversion: {
    critical_high:
      "Conduct a full sales-process audit. Review lead qualification criteria, sales scripts, discovery questions, proposal process, objection-handling playbook, and closing techniques. Identify where prospects are dropping out and address the top two friction points first. Track conversion rate at every stage.",
    moderate:
      "Strengthen qualification and proposal quality. Record and review sales calls. Test alternative offer structures and reduce time from first call to proposal.",
    monitor_healthy:
      "Conversion is healthy. Keep sales materials current, document winning patterns, and use them to onboard new team members.",
  },
  customer_retention: {
    critical_high:
      "Address churn immediately. Survey recently churned customers, identify the top two reasons, and create a 30-day retention intervention for at-risk accounts. Build a proactive check-in cadence, add onboarding improvements, and create a renewal or upsell pathway.",
    moderate:
      "Improve retention by adding a structured onboarding process, scheduling periodic value-delivery check-ins, and identifying expansion opportunities in existing accounts.",
    monitor_healthy:
      "Retention is strong. Continue NPS or satisfaction tracking and document what drives renewals so you can replicate it.",
  },
  reputation_reviews: {
    critical_high:
      "Implement an active review-generation program immediately. Ask every satisfied customer for a review, respond to all existing reviews (positive and negative), fix the top complaint pattern showing up in negative reviews, and monitor brand mentions weekly. Reputation directly affects lead quality and close rates.",
    moderate:
      "Systematize review requests at key delivery milestones. Respond to all reviews within 48 hours. Set a monthly review count target.",
    monitor_healthy:
      "Reputation is healthy. Maintain consistent review generation and continue responding promptly to all feedback.",
  },
  content_marketing: {
    critical_high:
      "Develop a minimum viable content strategy. Define three core questions your ideal customer asks before buying, create one high-quality piece addressing each, publish consistently on one primary channel, and repurpose to secondary channels. Without relevant content, competitors capture organic search and social trust.",
    moderate:
      "Increase publishing consistency and improve content quality. Use customer questions from sales calls as content topics. Track which content drives traffic and leads.",
    monitor_healthy:
      "Content marketing is working. Maintain publishing cadence and test new formats (video, podcast, case studies) to expand reach.",
  },
  website_performance: {
    critical_high:
      "Conduct a full website audit immediately. Fix mobile page speed (target under 3 seconds), rewrite the above-the-fold headline to match customer language, add social proof and trust signals, ensure every page has a clear call to action, verify analytics is tracking correctly, and fix broken forms or lead-capture paths.",
    moderate:
      "Improve page speed, clarity of the value proposition, and mobile usability. Add case studies or testimonials to key landing pages. Review conversion paths.",
    monitor_healthy:
      "Website is performing well. Monitor Core Web Vitals, keep trust signals current, and periodically test CTA copy and placement.",
  },
  automation: {
    critical_high:
      "Map all repetitive manual processes immediately. Identify the top three highest-time-cost tasks, document each workflow, and select automation tools to replace them. Start with lead follow-up, appointment reminders, or data entry. Add monitoring and human-fallback procedures to every automation. Manual work at scale kills margins.",
    moderate:
      "Automate two to three medium-frequency tasks this quarter. Document triggers, actions, and exceptions for each. Review and optimize existing automations.",
    monitor_healthy:
      "Automation coverage is good. Audit existing workflows quarterly for reliability and look for new automation opportunities as the business grows.",
  },
  technology_integration: {
    critical_high:
      "Conduct a full technology-stack audit. Map every tool in use, identify duplicate functions, find disconnected data flows, and prioritize the two or three integrations that would eliminate the most manual data transfer. Create a single source of truth for customer data. Disconnected systems cause errors, slow decisions, and invisible revenue loss.",
    moderate:
      "Connect your CRM with marketing and communication tools. Eliminate manual data entry between key systems. Document the intended data flow for your stack.",
    monitor_healthy:
      "Technology integration is healthy. Review the stack annually to remove unused tools and upgrade integrations as platforms evolve.",
  },
  reporting_analytics: {
    critical_high:
      "Define your core operating metrics immediately — for each major function (sales, marketing, operations, finance), identify one to three numbers that indicate health. Assign ownership, create a simple dashboard, establish a weekly review cadence, and eliminate vanity metrics. You cannot improve what you do not measure.",
    moderate:
      "Centralize reporting and increase review frequency. Ensure data is trusted by all stakeholders. Add leading indicators alongside lagging metrics.",
    monitor_healthy:
      "Reporting is solid. Maintain data quality standards and evolve KPIs as business strategy changes.",
  },
  operational_efficiency: {
    critical_high:
      "Document and audit core workflows immediately. Identify the three biggest sources of delay, rework, or waste. Assign ownership to each process, create standard operating procedures, and automate or eliminate repetitive steps. Operational inefficiency silently consumes profit and owner time.",
    moderate:
      "Standardize two or three high-frequency processes. Create SOPs, assign process owners, and measure time-per-task before and after improvement.",
    monitor_healthy:
      "Operations are efficient. Schedule quarterly workflow reviews and document improvements to build an operational knowledge base.",
  },
  scalability: {
    critical_high:
      "Address owner-dependency immediately. Document every process that requires the owner's personal involvement, create SOPs and delegation guides, build a training system for critical roles, improve reporting so leadership can manage by data rather than gut feel, and identify the top three capacity constraints limiting growth.",
    moderate:
      "Reduce key-person dependency in two or three critical areas. Create role-based SOPs, implement cross-training, and improve dashboard visibility for leadership.",
    monitor_healthy:
      "Scalability foundations are strong. Continue systematizing new areas as the business grows and review delegation effectiveness quarterly.",
  },
};

const GENERIC_RULES: Record<SeverityTier, string> = {
  critical_high:
    "This area requires immediate attention. Assess root causes, assign an owner, set a 30-day improvement target, and establish a weekly check-in until performance improves.",
  moderate:
    "This area needs focused improvement. Document current state, identify the top two friction points, and build a plan to address them within 60 days.",
  monitor_healthy:
    "This area is performing well. Maintain current practices, monitor for changes, and look for incremental optimization opportunities.",
};

export function generateDraftRecommendation(input: RecommendationInput): string {
  const t = tier(input.severity);
  const categoryRules = RULES[input.categoryKey];
  const baseText = categoryRules ? categoryRules[t] : GENERIC_RULES[t];

  const scoreSummary = `[Score: ${input.currentPerformance}/10 performance, ${input.businessImpact}/5 impact, ${input.urgency}/5 urgency — ${input.severity.toUpperCase()} severity]`;

  let contextAddendum = "";
  if (input.evidence?.trim()) {
    contextAddendum += ` Key evidence: ${input.evidence.trim()}.`;
  }
  if (input.observations?.trim()) {
    contextAddendum += ` Observations: ${input.observations.trim()}.`;
  }

  return `${scoreSummary}\n\n${baseText}${contextAddendum}`;
}
