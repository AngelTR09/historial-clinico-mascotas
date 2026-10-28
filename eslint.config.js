import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Configuración única para los tres paquetes (cada uno corre `eslint src`
// desde su propio cwd y ESLint sube hasta encontrar este archivo).
export default [
    { ignores: ["**/node_modules/**", "**/dist/**", "**/storage/**", "**/migrations/**"] },
    js.configs.recommended,
    {
        languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            // Estilo común para que cualquiera del equipo lea igual cualquier archivo. Son las
            // reglas que CI usa para rechazar código mal escrito (ver Pendiente_Integrar/github-actions/Test-GHAct/GUIA-CI-ERRORES.md).
            eqeqeq: ["error", "always"],
            "no-var": "error",
            "prefer-const": "error",
            curly: ["error", "multi-line"],
            semi: ["error", "always"],
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
        },
    },
    {
        // documentación del proyecto §13: el SDK de AWS solo se importa dentro de los adaptadores AWS. Los casos de
        // uso, las rutas y la web nunca conocen al proveedor.
        files: ["**/*.{js,jsx}"],
        rules: {
            "no-restricted-imports": ["error", { patterns: [{ group: ["@aws-sdk/*"], message: "Importar @aws-sdk solo desde apps/api/src/adapters/aws/ (documentación del proyecto §13)." }] }],
        },
    },
    { files: ["apps/api/src/adapters/aws/**/*.js"], rules: { "no-restricted-imports": "off" } },
    {
        // Frontera de capas del API: los casos de uso dependen de los puertos, nunca de las
        // rutas ni de los adaptadores concretos (se inyectan en container.js).
        files: ["apps/api/src/use-cases/**/*.js"],
        ignores: ["**/*.test.js"],
        rules: {
            "no-restricted-imports": ["error", { patterns: [
                { group: ["@aws-sdk/*"], message: "Importar @aws-sdk solo desde apps/api/src/adapters/aws/ (documentación del proyecto §13)." },
                { group: ["**/adapters/**", "**/routes/**", "**/plugins/**"], message: "Un caso de uso depende de los puertos (src/ports), no de adaptadores, rutas ni plugins." },
            ] }],
        },
    },
    {
        files: ["apps/web/src/**/*.{js,jsx}"],
        plugins: { react, "react-hooks": reactHooks },
        languageOptions: {
            globals: { ...globals.browser },
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        settings: { react: { version: "18.3" } },
        rules: {
            ...react.configs.recommended.rules,
            ...react.configs["jsx-runtime"].rules,
            ...reactHooks.configs.recommended.rules,
            "react/prop-types": "off",
        },
    },
    {
        // Frontera de capas de la web: componentes y lib nunca importan páginas (las páginas componen).
        files: ["apps/web/src/components/**/*.{js,jsx}", "apps/web/src/lib/**/*.js", "apps/web/src/hooks/**/*.js"],
        rules: {
            "no-restricted-imports": ["error", { patterns: [
                { group: ["@aws-sdk/*"], message: "La web nunca conoce al proveedor (documentación del proyecto §13)." },
                { group: ["**/pages/**"], message: "Las páginas componen componentes; un componente no importa páginas." },
            ] }],
        },
    },
];
