-- Rollback de 0013. Se pierde el registro de qué recordatorios ya se despacharon: el siguiente barrido
-- vuelve a avisar todo lo que siga vencido o por vencer. También se pierde la marca de normalización.
DROP TABLE "reminder_dispatches";
ALTER TABLE "health_events" DROP COLUMN "normalized_at";
