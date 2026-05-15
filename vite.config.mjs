import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as child from "child_process";
import fs from "fs";
import MagicString from "magic-string";
import path from "path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import solidPlugin from "vite-plugin-solid";
import wasm from "vite-plugin-wasm";

const traverse = _traverse.default ?? _traverse;

const commitHash = (() => {
    try {
        return child.execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
        return "";
    }
})();

const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
);

const logMethods = new Set(["trace", "debug", "info", "warn", "error", "log"]);

const logPersistenceTransformPlugin = () => ({
    name: "boltz-log-persistence-transform",
    enforce: "pre",
    transform(code, id) {
        const normalizedId = id.replaceAll("\\", "/").split("?")[0];

        if (
            !normalizedId.includes("/src/") ||
            normalizedId.endsWith("/src/utils/logs.ts") ||
            normalizedId.endsWith(".d.ts") ||
            !/\.[cm]?[tj]sx?$/.test(normalizedId) ||
            !code.includes("loglevel")
        ) {
            return null;
        }

        const ast = parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx", "importMeta"],
        });
        const loglevelImportNames = new Set();

        ast.program.body.forEach((node) => {
            if (
                node.type !== "ImportDeclaration" ||
                node.source.value !== "loglevel" ||
                node.importKind === "type"
            ) {
                return;
            }

            node.specifiers.forEach((specifier) => {
                if (
                    specifier.type === "ImportDefaultSpecifier" ||
                    specifier.type === "ImportNamespaceSpecifier"
                ) {
                    loglevelImportNames.add(specifier.local.name);
                }
            });
        });

        if (loglevelImportNames.size === 0) {
            return null;
        }

        const calls = [];

        traverse(ast, {
            CallExpression(callPath) {
                const { node } = callPath;
                const { callee } = node;

                if (
                    callee.type !== "MemberExpression" ||
                    callee.computed ||
                    callee.property.type !== "Identifier" ||
                    !logMethods.has(callee.property.name) ||
                    callee.object.type !== "Identifier" ||
                    !loglevelImportNames.has(callee.object.name)
                ) {
                    return;
                }

                const binding = callPath.scope.getBinding(callee.object.name);
                if (
                    binding === undefined ||
                    binding.kind !== "module" ||
                    binding.path.parent?.type !== "ImportDeclaration" ||
                    binding.path.parent.source.value !== "loglevel"
                ) {
                    return;
                }

                calls.push({
                    start: node.start,
                    end: node.end,
                    calleeStart: callee.start,
                    calleeEnd: callee.end,
                    methodName: callee.property.name,
                });
            },
        });

        if (calls.length === 0) {
            return null;
        }

        const magicString = new MagicString(code);
        const lastImportEnd = ast.program.body.reduce((end, node) => {
            return node.type === "ImportDeclaration" ? node.end : end;
        }, 0);

        magicString.appendLeft(
            lastImportEnd,
            '\nimport { persistLogLine as __persistLogLine } from "src/utils/logs";',
        );

        calls.reverse().forEach((call) => {
            const callee = code.slice(call.calleeStart, call.calleeEnd);
            const openParen = code.indexOf("(", call.calleeEnd);
            const args = code.slice(openParen + 1, call.end - 1);

            magicString.overwrite(
                call.start,
                call.end,
                `${callee}(...__persistLogLine("${call.methodName}", [${args}]))`,
            );
        });

        return {
            code: magicString.toString(),
            map: magicString.generateMap({
                source: id,
                includeContent: true,
                hires: true,
            }),
        };
    },
});

const configFile = path.resolve(__dirname, "src/config.ts");

if (!fs.existsSync(configFile)) {
    console.error(`
❌ Missing configuration file: src/config.ts

Please run one of the following commands to generate a config file:
    - \x1b[36mnpm run mainnet\x1b[0m
    - \x1b[36mnpm run regtest\x1b[0m
    - \x1b[36mnpm run beta\x1b[0m
    - \x1b[36mnpm run pro\x1b[0m
  
Then start the dev server again.
  `);
    process.exit(1);
}

try {
    child.execSync("node index-template-vars.mjs", {
        stdio: "inherit",
    });
} catch (err) {
    console.error("❌ Failed to generate index.html", err);
    process.exit(1);
}

export default defineConfig({
    plugins: [
        logPersistenceTransformPlugin(),
        solidPlugin(),
        wasm(),
        nodePolyfills(),
    ],
    resolve: {
        alias: {
            src: path.resolve(__dirname, "src"),
        },
    },
    server: {
        cors: { origin: "*" },
    },
    build: {
        sourcemap: true,
        cssCodeSplit: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("/node_modules/viem/")) {
                        return "viem";
                    }
                    if (id.includes("/@solana/web3.js/")) {
                        return "solana-web3";
                    }
                },
            },
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: "modern-compiler",
            },
        },
    },
    define: {
        __APP_VERSION__: `"${packageJson.version}"`,
        __GIT_COMMIT__: `"${commitHash}"`,
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
        pool: "forks",
        server: {
            deps: {
                inline: [/@solidjs\/router/],
            },
        },
    },
});
