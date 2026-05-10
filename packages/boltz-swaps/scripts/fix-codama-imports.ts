import {
    existsSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// Codama's @codama/renderers-js emits ESM TypeScript with extensionless
// relative imports (`from "./foo"`, `from "."`, `from "../types"` where
// `types/` is a directory). Under `moduleResolution: NodeNext` (the lib's
// tsconfig), TypeScript rejects these. This post-processor rewrites every
// relative import in the codama output to use explicit `.js` extensions
// (or `/index.js` for directory imports), which TS resolves to the
// neighboring `.ts` source while emitting Node-compatible output.

const targets = [
    "src/generated/solana-oft/src/generated",
    "src/generated/solana-cctp-token-messenger-minter/src/generated",
];

const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(path));
        } else if (entry.isFile() && path.endsWith(".ts")) {
            out.push(path);
        }
    }
    return out;
};

const resolveSpec = (fromFile: string, spec: string): string => {
    if (/\.(?:js|json|css|svg|wasm)$/.test(spec)) {
        return spec;
    }
    if (spec === "." || spec === "..") {
        return `${spec}/index.js`;
    }
    const baseDir = dirname(fromFile);
    const absolute = resolve(baseDir, spec);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
        return `${spec}/index.js`;
    }
    return `${spec}.js`;
};

const fix = (file: string, source: string): string => {
    return source.replace(
        /(from\s+['"])(\.\.?(?:\/[^'"]+)?)(['"])/g,
        (_match, prefix: string, spec: string, suffix: string) => {
            return `${prefix}${resolveSpec(file, spec)}${suffix}`;
        },
    );
};

for (const target of targets) {
    for (const file of walk(target)) {
        const original = readFileSync(file, "utf8");
        const fixed = fix(file, original);
        if (fixed !== original) {
            writeFileSync(file, fixed);
        }
    }
}
