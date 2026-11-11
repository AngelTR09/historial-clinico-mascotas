CREATE TABLE "reminder_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"due_date" date NOT NULL,
	"stage" text NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_dispatches_etapa_chk" CHECK ("reminder_dispatches"."stage" IN ('por_vencer', 'vencido'))
);
--> statement-breakpoint
ALTER TABLE "health_events" ADD COLUMN "normalized_at" timestamp with time zone;--> statement-breakpoint
-- Las vacunas anteriores a esta migración ya pasaron por el normalizador: se marcan para que el primer barrido no las vuelva a encolar (duplicaría sus ocurrencias en la curaduría).
UPDATE "health_events" SET "normalized_at" = "created_at" WHERE "tipo" = 'vacuna';--> statement-breakpoint
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_dispatches_unico_idx" ON "reminder_dispatches" USING btree ("pet_id","concept","due_date","stage");