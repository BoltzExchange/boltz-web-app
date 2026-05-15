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

const { port1, port2 } = new MessageChannel();
const leaks = new Map();
port1.on("message", ({ dep, via }) => {
    if (!leaks.has(dep)) {
        leaks.set(dep, via);
    }
});

const loaderSource = `
const optionalPeerDeps = ${JSON.stringify(optionalPeerDeps)};
let port;
export const initialize = (data) => { port = data.port; };
export const resolve = async (specifier, context, nextResolve) => {
    const result = await nextResolve(specifier, context);
    for (const dep of optionalPeerDeps) {
        if (result.url.includes('/node_modules/' + dep + '/')) {
            port.postMessage({ dep, via: context.parentURL ?? '<entry>' });
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
    console.error(
        `FAIL: optional peer-deps eagerly loaded by import "boltz-swaps":`,
    );
    for (const [dep, via] of [...leaks.entries()].sort()) {
        const viaShort = via
            .replace(/^file:\/\/.*\/node_modules\//, "")
            .replace(/^file:\/\/.*\/packages\//, "packages/");
        console.error(`  - ${dep}  <-  ${viaShort}`);
    }
    process.exit(1);
}

console.log(`ok: no optional peer-deps eagerly loaded by import "boltz-swaps"`);
