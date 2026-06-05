import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        conditions: ["source", "node", "import", "default"],
    },
    ssr: {
        resolve: {
            conditions: ["source", "node", "import", "default"],
            externalConditions: ["source", "node", "import", "default"],
        },
    },
    test: {
        globals: true,
        environment: "node",
        pool: "forks",
        include: ["integration/**/*.spec.ts"],
        testTimeout: 120_000,
        hookTimeout: 120_000,
        fileParallelism: false,
        server: {
            deps: {
                inline: [/^boltz-swaps/],
            },
        },
    },
});
