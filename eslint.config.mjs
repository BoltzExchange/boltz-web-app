import pluginJs from "@eslint/js";
import solid from "eslint-plugin-solid";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ["**/*.{js,mjs,cjs,ts,tsx}"] },
    { languageOptions: { globals: globals.browser } },
    {
        ignores: [
            "dist",
            "coverage",
            "node_modules",
            "dnssec-prover",
            "jest.config.js",
            "babel.config.js",
            "vite.config.mjs",
            "src/utils/dnssec/dnssec_prover*",
        ],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    solid.configs["flat/typescript"],
    {
        rules: {
            "no-async-promise-executor": "off",
        },
    },
];
