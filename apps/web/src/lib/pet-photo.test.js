// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepararFotoMascota, subirFotoMascota } from "./pet-photo";

afterEach(() => vi.unstubAllGlobals());

describe("subirFotoMascota", () => {
    it("pide la URL firmada, sube el binario directo y confirma la clave", async () => {
        const llamadas = [];
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url, opciones) => {
                llamadas.push({ url: String(url), metodo: opciones.method });
                if (String(url).endsWith("/photo/upload-url")) {
                    return new Response(JSON.stringify({ clave: "pets/m1/f.jpg", url: "http://almacen.test/subir", method: "PUT" }), { status: 200 });
                }
                if (String(url) === "http://almacen.test/subir") return new Response(null, { status: 204 });
                return new Response(JSON.stringify({ id: "m1", claveFoto: "pets/m1/f.jpg" }), { status: 200 });
            }),
        );
        const resultado = await subirFotoMascota("m1", new Blob(["x"], { type: "image/jpeg" }));
        expect(resultado.claveFoto).toBe("pets/m1/f.jpg");
        expect(llamadas.map((l) => `${l.metodo} ${l.url.replace(/^.*\/\/[^/]+/, "")}`)).toEqual([
            "POST /pets/m1/photo/upload-url",
            "PUT /subir",
            "PUT /pets/m1/photo",
        ]);
    });
});

describe("prepararFotoMascota", () => {
    it("rechaza un archivo que no es imagen", async () => {
        await expect(prepararFotoMascota(new File(["x"], "a.pdf", { type: "application/pdf" }))).rejects.toThrow(/no es una imagen/);
    });

    it("avisa con un mensaje legible si el navegador no puede decodificarla", async () => {
        vi.stubGlobal("createImageBitmap", async () => {
            throw new Error("boom");
        });
        await expect(prepararFotoMascota(new File(["x"], "a.jpg", { type: "image/jpeg" }))).rejects.toThrow(/No se pudo leer la imagen/);
    });

    it("recorta al centro y limita el lado a 800 px", async () => {
        vi.stubGlobal("createImageBitmap", async () => ({ width: 3000, height: 2000, close() {} }));
        const dibujos = [];
        const lienzo = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => dibujos.push(args) }), toBlob: (cb, tipo) => cb(new Blob(["j"], { type: tipo })) };
        vi.spyOn(document, "createElement").mockReturnValue(lienzo);
        const blob = await prepararFotoMascota(new File(["x"], "a.jpg", { type: "image/jpeg" }));
        expect(blob.type).toBe("image/jpeg");
        expect(lienzo.width).toBe(800);
        expect(lienzo.height).toBe(800);
        // Recorte cuadrado del lado menor (2000), centrado horizontalmente.
        expect(dibujos[0].slice(1, 5)).toEqual([500, 0, 2000, 2000]);
    });
});
