import pluginJs from "@eslint/js";
import importX from "eslint-plugin-import-x";
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
            "docs",
            "regtest",
            "coverage",
            "build/dist",
            "node_modules",
            "dnssec-prover",
            "vite.config.mjs",
            "src/utils/dnssec/dnssec_prover*",
            "packages/*/src/generated/**",
            "packages/*/dist/**",
            "packages/*/tests/**",
            "packages/*/vitest.config.mjs",
            "playwright-report",
        ],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    solid.configs["flat/typescript"],
    {
        plugins: { "import-x": importX },
        rules: {
            "import-x/no-duplicates": ["error", { "prefer-inline": true }],
        },
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    defaultProject: "tsconfig.json",
                    allowDefaultProject: [
                        "public/*.js",
                        "*.mjs",
                        "*.js",
                        "packages/*/scripts/*.ts",
                        "packages/*/scripts/*.mjs",
                    ],
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 10,
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            "no-async-promise-executor": "off",
            "no-console": 1,
            "no-restricted-imports": "off",
            "@typescript-eslint/no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            message: "It is a heavy dependency",
                            group: [
                                "@reown/appkit",
                                "@trezor/connect",
                                "@trezor/connect-web",
                                "@solana/web3.js",
                                "@solana/spl-token",
                                "@ledgerhq/hw-app-eth",
                                "@ledgerhq/hw-transport",
                                "@reown/appkit-adapter-wagmi",
                                "@reown/appkit-adapter-solana",
                                "@reown/appkit-adapter-tron",
                                "@tronweb3/tronwallet-adapter-metamask-tron",
                                "@tronweb3/tronwallet-adapter-tronlink",
                                "tronweb",
                                "@ledgerhq/hw-transport-webhid",
                                "@vulpemventures/secp256k1-zkp",
                                "@layerzerolabs/lz-solana-sdk-v2/umi",
                                "@metaplex-foundation/mpl-toolbox",
                                "@metaplex-foundation/umi",
                                "@metaplex-foundation/umi-bundle-defaults",
                                "@metaplex-foundation/umi-signer-wallet-adapters",
                                "@solana/kit",
                                "**/generated/solana-oft/src/generated",
                                "**/generated/solana-oft/src/generated/**",
                                "**/generated/solana-cctp-token-messenger-minter/src/generated",
                                "**/generated/solana-cctp-token-messenger-minter/src/generated/**",
                            ],
                            allowTypeImports: true,
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ["**/lazy/**", "**/lazy.{ts,mjs}"],
        rules: {
            "no-restricted-imports": "off",
            "@typescript-eslint/no-restricted-imports": "off",
        },
    },
    {
        rules: {
            "require-await": "error",
            "no-unassigned-vars": "off",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/consistent-type-imports": "warn",
            "@typescript-eslint/no-import-type-side-effects": "error",

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
            "no-restricted-imports": "off",
            "@typescript-eslint/no-restricted-imports": "off",
        },
    },
    {
        files: ["packages/*/scripts/**/*.{mjs,ts}"],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            "no-console": "off",
        },
    },
    {
        files: ["packages/boltz-swaps/src/**/*.ts"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "ExportNamedDeclaration > TSEnumDeclaration[const=true]",
                    message:
                        "Exporting `const enum` is not allowed in boltz-swaps; consumers compiled with isolatedModules/verbatimModuleSyntax cannot use them. Use a regular `enum` or a union of string literals instead.",
                },
            ],
            "import-x/no-nodejs-modules": "error",
        },
    },
];
