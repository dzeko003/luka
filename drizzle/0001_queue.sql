ALTER TABLE "collectes" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "heartbeat_at" timestamp;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "collectes_queue_idx" ON "collectes" USING btree ("status","created_at");