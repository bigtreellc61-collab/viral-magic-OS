CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text,
	"owner_name" text,
	"business_email" text,
	"business_phone" text,
	"website" text,
	"address" text,
	"app_name" text DEFAULT 'Viral Magic OS' NOT NULL,
	"app_subtitle" text,
	"logo_url" text,
	"primary_accent_color" text DEFAULT '#7C3AED' NOT NULL,
	"secondary_accent_color" text DEFAULT '#3B82F6' NOT NULL,
	"default_currency" text DEFAULT 'USD' NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"default_project_status" text DEFAULT 'planning' NOT NULL,
	"default_task_priority" text DEFAULT 'medium' NOT NULL,
	"default_estimated_timeline_days" integer DEFAULT 30 NOT NULL,
	"default_project_owner_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_records" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_type" text NOT NULL,
	"actor_user_id" text,
	"description" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_first_name" text,
	"contact_last_name" text,
	"company_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"industry" text,
	"business_type" text,
	"customer_market" text,
	"company_size" text,
	"annual_revenue_range" text,
	"primary_location" text,
	"current_technology_stack" text,
	"primary_business_concern" text,
	"desired_outcome" text,
	"budget_range" text,
	"lead_source" text,
	"status" text DEFAULT 'prospect' NOT NULL,
	"internal_notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"note_type" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"project_name" text NOT NULL,
	"project_type" text NOT NULL,
	"project_description" text,
	"business_problem" text,
	"desired_business_outcome" text,
	"recommended_solution" text,
	"selected_platform" text,
	"project_status" text DEFAULT 'discovery' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"estimated_project_value" numeric,
	"estimated_monthly_recurring_revenue" numeric,
	"start_date" text,
	"target_completion_date" text,
	"actual_completion_date" text,
	"project_owner" text,
	"internal_notes" text,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"assigned_user_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"start_date" text,
	"due_date" text,
	"completion_date" text,
	"estimated_effort" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bottleneck_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"diagnostic_score_id" text NOT NULL,
	"system_generated_draft" text,
	"administrator_final_recommendation" text,
	"recommendation_status" text DEFAULT 'draft' NOT NULL,
	"priority_order" integer DEFAULT 0 NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"diagnostic_version_id" text NOT NULL,
	"category_key" text NOT NULL,
	"category_label" text NOT NULL,
	"category_description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"current_performance" numeric(4, 1),
	"business_impact" numeric(3, 1),
	"urgency" numeric(3, 1),
	"performance_gap" numeric(4, 1),
	"priority_score" numeric(8, 2),
	"severity" text,
	"evidence" text,
	"observations" text,
	"notes" text,
	"recommended_action" text,
	"resolution_status" text DEFAULT 'unresolved' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_template_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"category_key" text NOT NULL,
	"category_label" text NOT NULL,
	"category_description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"template_key" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "diagnostic_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"diagnostic_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"overall_health_score" numeric(6, 2),
	"overall_priority_score" numeric(8, 2),
	"executive_summary" text,
	"recommended_first_action" text,
	"recommended_software_opportunity" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" text
);
--> statement-breakpoint
CREATE TABLE "diagnostics" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"diagnostic_name" text NOT NULL,
	"diagnostic_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version_number" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"summary_notes" text,
	"overall_health_score" numeric(6, 2),
	"overall_priority_score" numeric(8, 2),
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"diagnostic_id" text NOT NULL,
	"diagnostic_version_id" text NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"health_score" numeric(6, 2),
	"health_rating" text,
	"system_strength_summary" text,
	"system_vulnerability_summary" text,
	"system_risk_summary" text,
	"system_growth_opportunity_summary" text,
	"system_quick_win_summary" text,
	"system_strategic_focus_summary" text,
	"strength_summary" text,
	"vulnerability_summary" text,
	"risk_summary" text,
	"growth_opportunity_summary" text,
	"quick_win_summary" text,
	"strategic_focus_summary" text,
	"consultant_notes" text,
	"generated_sections" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solution_recommendation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"recommendation_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"time_horizon" text NOT NULL,
	"suggested_owner" text,
	"expected_outcome" text,
	"success_metric" text,
	"completion_status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solution_recommendation_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"recommendation_id" text NOT NULL,
	"depends_on_recommendation_id" text NOT NULL,
	"dependency_type" text DEFAULT 'recommended' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solution_recommendation_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"growth_assessment_id" text NOT NULL,
	"diagnostic_id" text NOT NULL,
	"diagnostic_version_id" text NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"overall_priority_score" numeric(6, 2),
	"system_executive_recommendation" text,
	"system_business_impact_summary" text,
	"system_dependency_summary" text,
	"executive_recommendation" text,
	"business_impact_summary" text,
	"dependency_summary" text,
	"consultant_notes" text,
	"generated_metadata" jsonb,
	"recommendation_engine_version" text DEFAULT '1.0' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"reopened_by" text,
	"reopened_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solution_recommendation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_key" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"domain" text NOT NULL,
	"category_match" text,
	"trigger_conditions" jsonb,
	"templates" jsonb,
	"default_actions" jsonb,
	"default_effort" text,
	"default_timeframe" text,
	"default_owner" text,
	"default_metrics" jsonb,
	"dependency_rules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solution_recommendation_rules_rule_key_unique" UNIQUE("rule_key")
);
--> statement-breakpoint
CREATE TABLE "solution_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"source_category_key" text,
	"source_assessment_data" jsonb,
	"rank" integer NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"problem_statement" text,
	"why_it_matters" text,
	"recommended_outcome" text,
	"priority_score" numeric(6, 2) NOT NULL,
	"priority_classification" text NOT NULL,
	"severity_score" numeric(6, 2),
	"business_impact_score" numeric(6, 2),
	"urgency_score" numeric(6, 2),
	"performance_gap_score" numeric(6, 2),
	"quick_win_bonus" numeric(6, 2) DEFAULT '0',
	"dependency_bonus" numeric(6, 2) DEFAULT '0',
	"effort_penalty" numeric(6, 2) DEFAULT '0',
	"quick_win_flag" boolean DEFAULT false NOT NULL,
	"effort" text,
	"confidence" numeric(4, 2),
	"timeframe" text,
	"suggested_owner" text,
	"success_metric" text,
	"dependency_notes" text,
	"scoring_explanation" jsonb,
	"admin_notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bottleneck_recommendations" ADD CONSTRAINT "bottleneck_recommendations_diagnostic_score_id_diagnostic_scores_id_fk" FOREIGN KEY ("diagnostic_score_id") REFERENCES "public"."diagnostic_scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bottleneck_recommendations" ADD CONSTRAINT "bottleneck_recommendations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_scores" ADD CONSTRAINT "diagnostic_scores_diagnostic_version_id_diagnostic_versions_id_fk" FOREIGN KEY ("diagnostic_version_id") REFERENCES "public"."diagnostic_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_scores" ADD CONSTRAINT "diagnostic_scores_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_template_categories" ADD CONSTRAINT "diagnostic_template_categories_template_id_diagnostic_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."diagnostic_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_versions" ADD CONSTRAINT "diagnostic_versions_diagnostic_id_diagnostics_id_fk" FOREIGN KEY ("diagnostic_id") REFERENCES "public"."diagnostics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_versions" ADD CONSTRAINT "diagnostic_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_versions" ADD CONSTRAINT "diagnostic_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_diagnostic_id_diagnostics_id_fk" FOREIGN KEY ("diagnostic_id") REFERENCES "public"."diagnostics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_diagnostic_version_id_diagnostic_versions_id_fk" FOREIGN KEY ("diagnostic_version_id") REFERENCES "public"."diagnostic_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_assessments" ADD CONSTRAINT "growth_assessments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_actions" ADD CONSTRAINT "solution_recommendation_actions_recommendation_id_solution_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."solution_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_dependencies" ADD CONSTRAINT "solution_recommendation_dependencies_plan_id_solution_recommendation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."solution_recommendation_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_dependencies" ADD CONSTRAINT "solution_recommendation_dependencies_recommendation_id_solution_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."solution_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_dependencies" ADD CONSTRAINT "solution_recommendation_dependencies_depends_on_recommendation_id_solution_recommendations_id_fk" FOREIGN KEY ("depends_on_recommendation_id") REFERENCES "public"."solution_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_growth_assessment_id_growth_assessments_id_fk" FOREIGN KEY ("growth_assessment_id") REFERENCES "public"."growth_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_diagnostic_id_diagnostics_id_fk" FOREIGN KEY ("diagnostic_id") REFERENCES "public"."diagnostics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_diagnostic_version_id_diagnostic_versions_id_fk" FOREIGN KEY ("diagnostic_version_id") REFERENCES "public"."diagnostic_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendation_plans" ADD CONSTRAINT "solution_recommendation_plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_recommendations" ADD CONSTRAINT "solution_recommendations_plan_id_solution_recommendation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."solution_recommendation_plans"("id") ON DELETE cascade ON UPDATE no action;