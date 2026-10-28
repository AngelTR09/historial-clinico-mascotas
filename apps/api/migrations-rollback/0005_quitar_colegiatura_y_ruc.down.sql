-- Rollback de 0005: restaura colegiatura/ruc desde license_number/tax_id (que 0004 había poblado).
ALTER TABLE "vets" ADD COLUMN "colegiatura" text;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "ruc" text;--> statement-breakpoint
UPDATE "vets" SET "colegiatura" = "license_number", "ruc" = COALESCE("tax_id", '');--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "colegiatura" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "ruc" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "issuing_authority" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "license_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "country" SET DEFAULT 'PE';
