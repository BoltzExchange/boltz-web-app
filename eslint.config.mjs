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
    ...tseslint.configs.recommendedTypeChecked,
    solid.configs["flat/typescript"],
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["public/*.js", "*.mjs"],
                    defaultProject: "tsconfig.json",
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
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
                            message: "It is a heavy dependency",
                            group: [
                                "boltz-bolt12",
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
    {
        rules: {
            "require-await": "error",
            "@typescript-eslint/no-floating-promises": "error",

            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-enum-comparison": "off",
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
        },
    },
];
