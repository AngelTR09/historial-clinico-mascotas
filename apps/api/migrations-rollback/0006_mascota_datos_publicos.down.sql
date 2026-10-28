-- Rollback de 0006. Pierde lo que los dueños escribieron en estos campos de la ficha pública.
ALTER TABLE "pets" DROP COLUMN "markings";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "is_neutered";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "medical_alerts";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "medical_alerts_public";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "temperament";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "owner_note";--> statement-breakpoint
ALTER TABLE "pets" DROP COLUMN "lost_since";
