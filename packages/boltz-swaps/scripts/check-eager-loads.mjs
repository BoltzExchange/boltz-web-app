import { readFileSync } from "node:fs";
import { register } from "node:module";
import { MessageChannel } from "node:worker_threads";

const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const optionalPeerDeps = Object.entries(packageJson.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta.optional === true)
    .map(([name]) => name)
    .sort();

// Modules the package must NOT pull in (eagerly OR transitively) when
// imported. These are Node built-ins or polyfills that would break
// browser consumers. Kept separate from `optionalPeerDeps` because the
// detection paths differ.
const bannedModules = ["buffer", "node:buffer"];

const { port1, port2 } = new MessageChannel();
/** @typedef {{ kind: "peer-dep" | "banned", dep: string, via: string }} Leak */
/** @type {Map<string, Leak>} */
const leaks = new Map();
port1.on(
    "message",
    /** @param {Leak} leak */ ({ kind, dep, via }) => {
        const key = `${kind}:${dep}`;
        if (!leaks.has(key)) {
            leaks.set(key, { kind, dep, via });
        }
    },
);

const loaderSource = `
const optionalPeerDeps = ${JSON.stringify(optionalPeerDeps)};
const bannedModules = ${JSON.stringify(bannedModules)};
let port;
export const initialize = (data) => { port = data.port; };
export const resolve = async (specifier, context, nextResolve) => {
    const result = await nextResolve(specifier, context);
    for (const dep of optionalPeerDeps) {
        if (result.url.includes('/node_modules/' + dep + '/')) {
            port.postMessage({ kind: 'peer-dep', dep, via: context.parentURL ?? '<entry>' });
            break;
        }
    }
    for (const dep of bannedModules) {
        if (
            result.url === dep ||
            result.url.startsWith(dep + '/') ||
            result.url.includes('/node_modules/' + dep + '/')
        ) {
            port.postMessage({ kind: 'banned', dep, via: context.parentURL ?? '<entry>' });
            break;
        }
    }
    return result;
};
`;

register(
    `data:text/javascript,${encodeURIComponent(loaderSource)}`,
    import.meta.url,
    { data: { port: port2 }, transferList: [port2] },
);

await import("boltz-swaps");
await new Promise((resolve) => setTimeout(resolve, 1_000));
port1.close();

if (leaks.size > 0) {
    /** @param {string} via */
    const formatVia = (via) =>
        via
            .replace(/^file:\/\/.*\/node_modules\//, "")
            .replace(/^file:\/\/.*\/packages\//, "packages/");

    const all = [...leaks.values()].sort((a, b) => a.dep.localeCompare(b.dep));
    const peerDepLeaks = all.filter((leak) => leak.kind === "peer-dep");
    const bannedLeaks = all.filter((leak) => leak.kind === "banned");

    if (peerDepLeaks.length > 0) {
        console.error(
            `FAIL: optional peer-deps eagerly loaded by import "boltz-swaps":`,
        );
        for (const { dep, via } of peerDepLeaks) {
            console.error(`  - ${dep}  <-  ${formatVia(via)}`);
        }
    }
    if (bannedLeaks.length > 0) {
        console.error(
            `FAIL: banned modules pulled in by import "boltz-swaps" (browser-incompatible):`,
        );
        for (const { dep, via } of bannedLeaks) {
            console.error(`  - ${dep}  <-  ${formatVia(via)}`);
        }
    }
    process.exit(1);
}

console.log(
    `ok: no optional peer-deps or banned modules pulled in by import "boltz-swaps"`,
);
