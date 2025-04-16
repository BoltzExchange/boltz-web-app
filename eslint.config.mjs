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
            "build/dist",
            "node_modules",
            "dnssec-prover",
            "vite.config.mjs",
            "src/utils/dnssec/dnssec_prover*",
            "playwright-report/*",
        ],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    solid.configs["flat/typescript"],
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    defaultProject: "tsconfig.json",
                    allowDefaultProject: ["public/*.js", "*.mjs"],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            "no-async-promise-executor": "off",
            "no-console": 1,
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            message: "It is a heavy dependency",
                            group: [
                                "boltz-bolt12",
                                "@reown/appkit",
                                "@trezor/connect",
                                "@trezor/connect-web",
                                "@ledgerhq/hw-app-eth",
                                "@ledgerhq/hw-transport",
                                "@reown/appkit-adapter-ethers",
                                "@ledgerhq/hw-transport-webhid",
                                "@vulpemventures/secp256k1-zkp",
                            ],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ["*/lazy/**"],
        rules: {
            "no-restricted-imports": "off",
        },
    },
    {
        rules: {
            "require-await": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/consistent-type-imports": "warn",

            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-enum-comparison": "off",
            "@typescript-eslint/prefer-promise-reject-errors": "off",
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
        },
    },
    {
        files: ["tests/**/*.ts", "e2e/**/*.ts"],
        rules: {
            "no-console": "off",
        },
    },
];
