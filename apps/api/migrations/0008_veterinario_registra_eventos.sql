ALTER TYPE "public"."tipo_evento_salud" ADD VALUE 'desparasitacion';--> statement-breakpoint
ALTER TABLE "health_events" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "health_events" ADD COLUMN "created_by_vet" uuid;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_created_by_vet_vets_id_fk" FOREIGN KEY ("created_by_vet") REFERENCES "public"."vets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_autor_chk" CHECK (("health_events"."created_by" IS NOT NULL)::int + ("health_events"."created_by_vet" IS NOT NULL)::int = 1);