CREATE TYPE "public"."decision_validacion" AS ENUM('valida', 'rechaza');--> statement-breakpoint
CREATE TYPE "public"."estado_curacion" AS ENUM('pendiente', 'resuelto', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."estado_mascota" AS ENUM('activa', 'extraviada', 'fallecida', 'transferida');--> statement-breakpoint
CREATE TYPE "public"."estado_ocr" AS ENUM('pendiente', 'procesado', 'fallido', 'omitido');--> statement-breakpoint
CREATE TYPE "public"."estado_transferencia" AS ENUM('pendiente', 'completada', 'expirada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."estado_veterinario" AS ENUM('pendiente', 'aprobado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."nivel_confianza" AS ENUM('declarado', 'con_evidencia', 'verificado');--> statement-breakpoint
CREATE TYPE "public"."tipo_actor_auditoria" AS ENUM('dueno', 'veterinario', 'municipalidad', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('DNI', 'CE', 'PASAPORTE');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento_salud" AS ENUM('vacuna', 'chequeo', 'tratamiento');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"ocr_status" "estado_ocr" DEFAULT 'pendiente' NOT NULL,
	"ocr_payload" jsonb,
	"ocr_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "tipo_actor_auditoria" NOT NULL,
	"actor_id" uuid,
	"pet_id" uuid,
	"action" text NOT NULL,
	"ip_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"texto_original" text NOT NULL,
	"ocurrencias" integer DEFAULT 1 NOT NULL,
	"sugerencia_id" uuid,
	"status" "estado_curacion" DEFAULT 'pendiente' NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "health_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"tipo" "tipo_evento_salud" NOT NULL,
	"event_date" date NOT NULL,
	"texto_original" text NOT NULL,
	"vacuna_canonica_id" uuid,
	"professional_name" text,
	"confidence_level" "nivel_confianza" DEFAULT 'declarado' NOT NULL,
	"corrige_evento_id" uuid,
	"idempotency_key" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" "tipo_documento" NOT NULL,
	"doc_number_enc" text NOT NULL,
	"doc_hmac" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_enc" text,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"public_code" text NOT NULL,
	"qr_token" text NOT NULL,
	"species" text NOT NULL,
	"breed" text,
	"sex" text,
	"birth_date_approx" date,
	"microchip_iso" text,
	"photo_key" text,
	"status" "estado_mascota" DEFAULT 'activa' NOT NULL,
	"district_ubigeo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"from_owner_id" uuid NOT NULL,
	"to_owner_id" uuid,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "estado_transferencia" DEFAULT 'pendiente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaccine_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre_canonico" text NOT NULL,
	"especie" text NOT NULL,
	"meses_vigencia" integer NOT NULL,
	"intervalo_refuerzo_dias" integer,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"vet_id" uuid NOT NULL,
	"decision" "decision_validacion" NOT NULL,
	"reason" text,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_sub" text NOT NULL,
	"colegiatura" text NOT NULL,
	"ruc" text NOT NULL,
	"razon_social" text NOT NULL,
	"status" "estado_veterinario" DEFAULT 'pendiente' NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_event_id_health_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."health_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_queue" ADD CONSTRAINT "curation_queue_sugerencia_id_vaccine_catalog_id_fk" FOREIGN KEY ("sugerencia_id") REFERENCES "public"."vaccine_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_vacuna_canonica_id_vaccine_catalog_id_fk" FOREIGN KEY ("vacuna_canonica_id") REFERENCES "public"."vaccine_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_corrige_evento_id_health_events_id_fk" FOREIGN KEY ("corrige_evento_id") REFERENCES "public"."health_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_created_by_owners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_owner_id_owners_id_fk" FOREIGN KEY ("from_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_owner_id_owners_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_event_id_health_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."health_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_vet_id_vets_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."vets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "health_events_idempotency_key_idx" ON "health_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "health_events_pet_id_event_date_idx" ON "health_events" USING btree ("pet_id","event_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_events_pending_validation_idx" ON "health_events" USING btree ("pet_id") WHERE "health_events"."confidence_level" <> 'verificado';--> statement-breakpoint
CREATE UNIQUE INDEX "owners_doc_hmac_idx" ON "owners" USING btree ("doc_hmac");--> statement-breakpoint
CREATE UNIQUE INDEX "pets_public_code_idx" ON "pets" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "pets_qr_token_idx" ON "pets" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "pets_owner_id_idx" ON "pets" USING btree ("owner_id");