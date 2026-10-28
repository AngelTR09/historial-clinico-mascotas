ALTER TABLE "pets" ADD COLUMN "markings" text;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "is_neutered" boolean;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "medical_alerts" text;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "medical_alerts_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "temperament" text;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "owner_note" text;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "lost_since" date;