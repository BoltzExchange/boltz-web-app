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
        include: ["tests/**/*.spec.ts"],
        server: {
            deps: {
                inline: [/^boltz-swaps/],
            },
        },
    },
});
