-- Phase 2B — Growth Blueprint Assembly Engine
-- Adds versioning columns to growth_blueprints and creates
-- the sections and initiatives tables.

--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "revision_number" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "previous_version_id" text;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "is_current" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "generation_status" text;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "generation_error" text;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "generated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "superseded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "source_assessment_status" text;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD COLUMN "source_plan_status" text;
--> statement-breakpoint
ALTER TABLE "growth_blueprints" ADD CONSTRAINT "growth_blueprints_previous_version_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "growth_blueprints"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE "growth_blueprint_sections" (
  "id" text PRIMARY KEY NOT NULL,
  "blueprint_id" text NOT NULL,
  "section_key" text NOT NULL,
  "title" text NOT NULL,
  "section_order" integer NOT NULL DEFAULT 0,
  "generated_content" text,
  "consultant_content" text,
  "source_references" jsonb,
  "generation_status" text NOT NULL DEFAULT 'pending',
  "is_locked" boolean NOT NULL DEFAULT false,
  "generated_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_blueprint_sections_blueprint_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "growth_blueprints"("id") ON DELETE CASCADE,
  CONSTRAINT "growth_blueprint_sections_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "growth_blueprint_sections_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE "growth_blueprint_initiatives" (
  "id" text PRIMARY KEY NOT NULL,
  "blueprint_id" text NOT NULL,
  "source_recommendation_id" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "domain" text NOT NULL,
  "priority_classification" text NOT NULL,
  "effort_level" text,
  "roadmap_period" text NOT NULL,
  "roadmap_reason" text,
  "override_roadmap_period" boolean NOT NULL DEFAULT false,
  "sequence_order" integer NOT NULL DEFAULT 0,
  "owner_placeholder" text,
  "target_period_label" text,
  "expected_business_impact" text,
  "consultant_guidance" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_blueprint_initiatives_blueprint_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "growth_blueprints"("id") ON DELETE CASCADE,
  CONSTRAINT "growth_blueprint_initiatives_source_recommendation_id_fk" FOREIGN KEY ("source_recommendation_id") REFERENCES "solution_recommendations"("id") ON DELETE RESTRICT
);
