#!/usr/bin/env node
// Genera una imagen con la API de Gemini (plan gratuito) y la guarda en disco.
//   node scripts/generar-imagen.mjs <salida.png> "<prompt>" [modelo] [relacion]
// La clave se lee de GEMINI_API_KEY o de ~/.config/hcm/gemini.env (fuera del repo).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function leerClave() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
        const texto = await readFile(path.join(os.homedir(), ".config/hcm/gemini.env"), "utf8");
        return texto.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
    }
    catch {
        return undefined;
    }
}

const [salida, prompt, modelo = "gemini-2.5-flash-image", relacion] = process.argv.slice(2);
if (!salida || !prompt) {
    console.error('Uso: node scripts/generar-imagen.mjs <salida.png> "<prompt>" [modelo] [relacion]');
    process.exit(1);
}
const clave = await leerClave();
if (!clave) {
    console.error("Falta GEMINI_API_KEY (variable de entorno o ~/.config/hcm/gemini.env).");
    process.exit(1);
}

const cuerpo = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], ...(relacion ? { imageConfig: { aspectRatio: relacion } } : {}) } };
const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify(cuerpo),
});
const datos = await respuesta.json();
if (!respuesta.ok) {
    console.error(`Error ${respuesta.status} (${modelo}): ${datos.error?.message?.slice(0, 300)}`);
    process.exit(2);
}
const parte = datos.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
if (!parte) {
    console.error("La respuesta no trajo imagen:", JSON.stringify(datos).slice(0, 300));
    process.exit(3);
}
await mkdir(path.dirname(salida), { recursive: true });
await writeFile(salida, Buffer.from(parte.inlineData.data, "base64"));
console.log(`OK ${salida} (${parte.inlineData.mimeType})`);
