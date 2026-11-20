ALTER TABLE "collectes" ADD COLUMN "kind" text DEFAULT 'collecte' NOT NULL;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "input" jsonb;