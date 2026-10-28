-- Rollback de 0008. Revertir DESCARTA lo que registraron los veterinarios y todos los eventos de
-- desparasitación (con sus adjuntos y validaciones): solo para bases locales, donde db:rollback corre.
UPDATE "health_events" SET "corrige_evento_id" = NULL WHERE "corrige_evento_id" IN (SELECT "id" FROM "health_events" WHERE "created_by_vet" IS NOT NULL OR "tipo" = 'desparasitacion');--> statement-breakpoint
DELETE FROM "attachments" WHERE "event_id" IN (SELECT "id" FROM "health_events" WHERE "created_by_vet" IS NOT NULL OR "tipo" = 'desparasitacion');--> statement-breakpoint
DELETE FROM "validations" WHERE "event_id" IN (SELECT "id" FROM "health_events" WHERE "created_by_vet" IS NOT NULL OR "tipo" = 'desparasitacion');--> statement-breakpoint
DELETE FROM "health_events" WHERE "created_by_vet" IS NOT NULL OR "tipo" = 'desparasitacion';--> statement-breakpoint
ALTER TABLE "health_events" DROP CONSTRAINT "health_events_autor_chk";--> statement-breakpoint
ALTER TABLE "health_events" DROP CONSTRAINT "health_events_created_by_vet_vets_id_fk";--> statement-breakpoint
ALTER TABLE "health_events" DROP COLUMN "created_by_vet";--> statement-breakpoint
ALTER TABLE "health_events" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TYPE "public"."tipo_evento_salud" RENAME TO "tipo_evento_salud_old";--> statement-breakpoint
CREATE TYPE "public"."tipo_evento_salud" AS ENUM('vacuna', 'chequeo', 'tratamiento');--> statement-breakpoint
ALTER TABLE "health_events" ALTER COLUMN "tipo" TYPE "public"."tipo_evento_salud" USING "tipo"::text::"public"."tipo_evento_salud";--> statement-breakpoint
DROP TYPE "public"."tipo_evento_salud_old";
