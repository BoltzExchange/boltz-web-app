module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    overrides: [
        {
            env: {
                node: true,
            },
            files: [".eslintrc.{js,cjs}"],
            parserOptions: {
                sourceType: "script",
            },
        },
        {
            files: ["**/lazy/**/*", "test/**/*"],
            rules: {
                "no-restricted-imports": "off",
            },
        },
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "no-empty": "off",
        "no-useless-escape": "off",
        "no-case-declarations": "off",
        "no-restricted-imports": [
            "error",
            {
                patterns: [
                    {
                        group: ["**/lazy/**"],
                        message:
                            "These modules have to be imported lazily due to big dependencies",
                    },
                    {
                        group: [
                            "boltz-core",
                            "bitcoinjs-lib",
                            "liquidjs-lib",
                            "bolt11",
                            "@vulpemventures/secp256k1-zkp",
                            "@bitcoinerlab/secp256k1",
                        ],
                        message:
                            "These modules are only allowed to be imported within /lazy directories",
                    },
                ],
            },
        ],
        "prefer-const": "off",
    },
};
