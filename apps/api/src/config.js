import { z } from "zod";
/**
 * Único módulo que lee `process.env`. En la nube, esta misma forma se
 * completa desde Secrets Manager en el arranque del contenedor sin que
 * el resto del código se entere de dónde vino el valor.
 */
const AWS_OBLIGATORIAS = ["BUCKET_EVIDENCIAS", "TABLA_PERFIL_PUBLICO", "URL_COLA_NORMALIZACION", "URL_COLA_PROYECCION", "CORREO_REMITENTE"];
// Secretos que solo necesita la API: las Lambdas (`PROCESO=trabajador`) no firman sesiones ni cifran
// documentos, así que no reciben esos secretos (mínimo privilegio).
const SOLO_API = ["JWT_SECRET", "DOC_ENCRYPTION_KEY", "DOC_HMAC_PEPPER"];
const codificar = encodeURIComponent;
export const esquemaEntorno = z
    .object({
    // Local: una URL completa. En AWS la base se describe con DB_*: RDS genera la contraseña
    // y ECS la inyecta desde Secrets Manager, así que la URL se arma aquí.
    DATABASE_URL: z.string().url().optional(),
    DB_HOST: z.string().min(1).optional(),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1).default("hcm"),
    DB_USER: z.string().min(1).optional(),
    DB_PASSWORD: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres").optional(),
    // Falla al arrancar, no en el primer registro de dueño: AES-256 necesita exactamente 32 bytes.
    DOC_ENCRYPTION_KEY: z.string().refine((valor) => Buffer.from(valor, "base64").length === 32, "DOC_ENCRYPTION_KEY debe ser base64 de 32 bytes (openssl rand -base64 32)").optional(),
    DOC_HMAC_PEPPER: z.string().min(16, "DOC_HMAC_PEPPER debe tener al menos 16 caracteres").optional(),
    // "api" (la API HTTP) o "trabajador" (una Lambda de workers/): el segundo no exige los secretos de SOLO_API.
    PROCESO: z.enum(["api", "trabajador"]).default("api"),
    STORAGE_LOCAL_PATH: z.string().min(1).default("./storage"),
    OCR_ENABLED: z
        .string()
        .default("false")
        .transform((v) => v === "true"),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PUBLIC_URL: z.string().url().optional(),
    // "local" (cola en memoria, carpeta ./storage, Postgres) o "aws" (SQS, S3, SNS, DynamoDB).
    PROVEEDOR: z.enum(["local", "aws"]).default("local"),
    BUCKET_EVIDENCIAS: z.string().min(1).optional(),
    TABLA_PERFIL_PUBLICO: z.string().min(1).optional(),
    ARN_TEMA_RECORDATORIOS: z.string().min(1).optional(),
    URL_COLA_NORMALIZACION: z.string().url().optional(),
    URL_COLA_PROYECCION: z.string().url().optional(),
    URL_COLA_RECORDATORIOS: z.string().url().optional(),
    // Remitente de los correos (SES). Con la cuenta en sandbox debe estar verificado.
    CORREO_REMITENTE: z.string().email().optional(),
    // Tope de solicitudes por minuto y por IP para el inicio de sesión y el alta de cuentas.
    LIMITE_AUTENTICACION_POR_MINUTO: z.coerce.number().int().positive().default(30),
    // Solo pruebas y demostraciones locales: el código de verificación del correo siempre vale esto.
    CODIGO_VERIFICACION_FIJO: z.string().regex(/^\d{6}$/, "CODIGO_VERIFICACION_FIJO debe tener 6 dígitos").optional(),
})
    .superRefine((datos, contexto) => {
    if (!datos.DATABASE_URL) {
        for (const clave of ["DB_HOST", "DB_USER", "DB_PASSWORD"]) {
            if (!datos[clave]) {
                contexto.addIssue({ code: "custom", path: [clave], message: `Falta DATABASE_URL o ${clave}` });
            }
        }
    }
    if (datos.PROCESO === "api") {
        for (const clave of SOLO_API) {
            if (!datos[clave]) {
                contexto.addIssue({ code: "custom", path: [clave], message: `${clave} es obligatoria en la API` });
            }
        }
    }
    if (datos.PROVEEDOR === "aws" && datos.CODIGO_VERIFICACION_FIJO) {
        contexto.addIssue({ code: "custom", path: ["CODIGO_VERIFICACION_FIJO"], message: "CODIGO_VERIFICACION_FIJO está prohibido con PROVEEDOR=aws: dejaría las cuentas sin verificación real" });
    }
    if (datos.PROVEEDOR === "aws" && datos.PROCESO === "api") {
        for (const clave of AWS_OBLIGATORIAS) {
            if (!datos[clave]) {
                contexto.addIssue({ code: "custom", path: [clave], message: `${clave} es obligatoria con PROVEEDOR=aws` });
            }
        }
    }
})
    .transform((datos) => ({
    ...datos,
    // sslmode=require: RDS exige TLS (rds.force_ssl=1 en Terraform). Las credenciales se codifican
    // porque la contraseña que genera RDS puede traer caracteres que rompen una URL.
    DATABASE_URL: datos.DATABASE_URL ??
        `postgresql://${codificar(datos.DB_USER)}:${codificar(datos.DB_PASSWORD)}@${datos.DB_HOST}:${datos.DB_PORT}/${datos.DB_NAME}?sslmode=require`,
}));
const analizado = esquemaEntorno.safeParse(process.env);
if (!analizado.success) {
    throw new Error(`Configuración de entorno inválida: ${analizado.error.message}`);
}
export const config = analizado.data;
