// Empaqueta las cuatro Lambdas de `src/lambdas/` en `<raíz>/workers/dist/<nombre>.zip`, que es lo que
// espera el módulo de Terraform `trabajadores` (`directorio_paquetes`). Cada zip lleva un único
// `index.mjs` con todo el código y sus dependencias adentro (la Lambda no instala nada).
//   pnpm --filter @hcm/api trabajadores:empaquetar [carpeta-de-salida]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const FUNCIONES = ["proyector", "normalizador", "recordatorios", "notificador"];
const raizApi = path.resolve(import.meta.dirname, "..");
const salida = path.resolve(process.argv[2] ?? path.join(raizApi, "../../workers/dist"));

// Algunas dependencias CommonJS usan `require` dinámico, que un bundle ESM no trae de serie.
const BANNER_REQUIRE = "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);";

rmSync(salida, { recursive: true, force: true });
for (const nombre of FUNCIONES) {
    const carpeta = path.join(salida, nombre);
    mkdirSync(carpeta, { recursive: true });
    await build({
        entryPoints: [path.join(raizApi, "src/lambdas", `${nombre}.js`)],
        outfile: path.join(carpeta, "index.mjs"),
        bundle: true,
        platform: "node",
        target: "node20",
        format: "esm",
        banner: { js: BANNER_REQUIRE },
        legalComments: "none",
        logLevel: "warning",
    });
    execFileSync("zip", ["-q", "-j", path.join(salida, `${nombre}.zip`), path.join(carpeta, "index.mjs")]);
    rmSync(carpeta, { recursive: true, force: true });
    console.log(`empaquetado: ${path.join(salida, `${nombre}.zip`)}`);
}
