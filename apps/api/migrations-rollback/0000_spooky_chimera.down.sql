-- Rollback de 0000: borra TODO el esquema de dominio. Solo para entornos desechables.
DROP TABLE IF EXISTS "validations", "attachments", "audit_log", "curation_queue", "transfers", "health_events", "vaccine_catalog", "pets", "owners", "vets" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."decision_validacion", "public"."estado_curacion", "public"."estado_mascota", "public"."estado_ocr", "public"."estado_transferencia", "public"."estado_veterinario", "public"."nivel_confianza", "public"."tipo_actor_auditoria", "public"."tipo_documento", "public"."tipo_evento_salud";
