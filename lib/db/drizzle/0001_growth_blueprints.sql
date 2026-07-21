CREATE TABLE "growth_blueprints" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"growth_assessment_id" text NOT NULL,
	"solution_recommendation_plan_id" text NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"consultant_notes" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_growth_assessment_id_growth_assessments_id_fk" FOREIGN KEY ("growth_assessment_id") REFERENCES "public"."growth_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_solution_recommendation_plan_id_solution_recommendation_plans_id_fk" FOREIGN KEY ("solution_recommendation_plan_id") REFERENCES "public"."solution_recommendation_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
