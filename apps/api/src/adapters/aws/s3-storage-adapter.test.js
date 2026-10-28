import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { AdaptadorAlmacenamientoS3 } from "./s3-storage-adapter.js";

// Firmar una URL es cálculo local: no hace falta red ni una cuenta de AWS.
const cliente = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "AKIAPRUEBA", secretAccessKey: "secreto-de-prueba" } });
const adaptador = new AdaptadorAlmacenamientoS3({ bucket: "hcm-evidencias-123", cliente });

describe("AdaptadorAlmacenamientoS3 (presigned URLs, el backend nunca recibe el binario)", () => {
    it("getUploadUrl devuelve un PUT firmado al bucket, con el mime firmado y 15 min de vigencia", async () => {
        const { url, method } = await adaptador.getUploadUrl("evidencias/abc/foto.jpg", "image/jpeg");
        const analizada = new URL(url);
        expect(method).toBe("PUT");
        expect(analizada.hostname).toContain("hcm-evidencias-123");
        expect(analizada.pathname).toBe("/evidencias/abc/foto.jpg");
        expect(analizada.searchParams.get("X-Amz-Expires")).toBe("900");
        expect(analizada.searchParams.get("X-Amz-Signature")).toBeTruthy();
        expect(analizada.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    });

    it("getDownloadUrl devuelve un GET firmado y expiraEn coherente con la firma", async () => {
        const antes = Date.now();
        const { url, expiraEn } = await adaptador.getDownloadUrl("evidencias/abc/foto.jpg");
        expect(new URL(url).searchParams.get("X-Amz-Signature")).toBeTruthy();
        const vence = new Date(expiraEn).getTime();
        expect(vence - antes).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
        expect(vence - antes).toBeLessThanOrEqual(15 * 60 * 1000 + 5000);
    });

    it("la vigencia es configurable", async () => {
        const corto = new AdaptadorAlmacenamientoS3({ bucket: "b", cliente, segundosVigencia: 60 });
        const { url } = await corto.getUploadUrl("k", "image/png");
        expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("60");
    });
});
