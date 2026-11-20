CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"city" text NOT NULL,
	"category" text,
	"file_name" text NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"category" text,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmations" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kb_entities_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "share_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collectes" ADD COLUMN "zone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "share_data" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_status_idx" ON "contributions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "contributions_user_idx" ON "contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kb_city_idx" ON "kb_entities" USING btree ("city");