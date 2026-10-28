ALTER TABLE "vets" ALTER COLUMN "country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "issuing_authority" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "license_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "colegiatura";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "ruc";