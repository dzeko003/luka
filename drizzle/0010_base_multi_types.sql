CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"to_id" uuid NOT NULL,
	"src" text NOT NULL,
	"confirmations" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_entities" DROP CONSTRAINT "kb_entities_key_unique";--> statement-breakpoint
DROP INDEX "kb_city_idx";--> statement-breakpoint
ALTER TABLE "kb_entities" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kb_entities" ADD COLUMN "type" text DEFAULT 'lieu' NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_from_id_kb_entities_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."kb_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_to_id_kb_entities_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."kb_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_links_unique_idx" ON "entity_links" USING btree ("from_id","relation","to_id");--> statement-breakpoint
CREATE INDEX "entity_links_to_idx" ON "entity_links" USING btree ("to_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_type_key_idx" ON "kb_entities" USING btree ("type","key");--> statement-breakpoint
CREATE INDEX "kb_type_city_idx" ON "kb_entities" USING btree ("type","city");