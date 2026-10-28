-- Rollback de 0004. Requiere haber revertido 0005 antes (el runner lo respeta: revierte en orden inverso).
ALTER TABLE "vets" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "issuing_authority";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "license_number";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "tax_id";
