ALTER TABLE "collectes" ADD COLUMN "refresh" text DEFAULT 'aucune' NOT NULL;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "next_refresh_at" timestamp;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "last_refresh_at" timestamp;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "refreshing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "last_changes" jsonb;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "change" text;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "previous" jsonb;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "edited" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "collectes_refresh_idx" ON "collectes" USING btree ("next_refresh_at");