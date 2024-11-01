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
            "regtest",
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
    {
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            message: "It is supposed to be lazy loaded",
                            group: ["*/lazy/**"],
                        },
                        {
                            message: "It is a heavy dependency",
                            group: [
                                "@trezor/connect-web",
                                "@ledgerhq/hw-app-eth",
                                "@ledgerhq/hw-transport",
                                "@ledgerhq/hw-transport-webhid",
                            ],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ["*/lazy/**", "*/utils/hardware/*"],
        rules: {
            "no-restricted-imports": "off",
        },
    },
];
