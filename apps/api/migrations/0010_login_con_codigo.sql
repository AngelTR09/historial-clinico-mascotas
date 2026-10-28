CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"vet_id" uuid,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verifications_titular_chk" CHECK (("email_verifications"."owner_id" IS NOT NULL)::int + ("email_verifications"."vet_id" IS NOT NULL)::int = 1)
);
--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "failed_logins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "failed_logins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_vet_id_vets_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."vets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verifications_owner_idx" ON "email_verifications" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_verifications_vet_idx" ON "email_verifications" USING btree ("vet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_email_login_idx" ON "owners" USING btree (lower("email")) WHERE "owners"."password_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vets_email_login_idx" ON "vets" USING btree (lower("email")) WHERE "vets"."password_hash" IS NOT NULL;