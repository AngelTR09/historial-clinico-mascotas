-- Rollback de 0009: recrea la tabla, el enum y el índice parcial, pero VACÍOS. Las decisiones de
-- validación borradas no se recuperan: restaurar desde el respaldo si importan.
CREATE TYPE "public"."decision_validacion" AS ENUM('valida', 'rechaza');--> statement-breakpoint
CREATE TABLE "validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"vet_id" uuid NOT NULL,
	"decision" "decision_validacion" NOT NULL,
	"reason" text,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_event_id_health_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."health_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_vet_id_vets_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."vets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_events_pending_validation_idx" ON "health_events" USING btree ("pet_id") WHERE "health_events"."confidence_level" <> 'verificado';
