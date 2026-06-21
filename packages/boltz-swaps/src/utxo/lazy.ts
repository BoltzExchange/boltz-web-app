import type { confidential as LiquidConfidential } from "liquidjs-lib";

import Loader from "../lazy.ts";

type ConfidentialClass = (typeof LiquidConfidential)["Confidential"];

export type UtxoSecpModules = {
    secpZkp: unknown;
    confidential: InstanceType<ConfidentialClass>;
};

/**
 * Lazily initializes the secp256k1-zkp WASM instance used for Liquid
 * confidential transactions and wires it into `boltz-core/liquid`.
 *
 * `liquidjs-lib`, `boltz-core/liquid` and `@vulpemventures/secp256k1-zkp` are
 * optional peer dependencies and pull in `buffer`/WASM, so they are loaded only
 * through dynamic `import()` here — never from the package's eager graph.
 * The single `init(secp)` call mutates `boltz-core/liquid`'s module-global secp,
 * so all Liquid taproot/claim helpers see the initialized instance afterwards.
 */
export const utxoSecp = new Loader<UtxoSecpModules>(
    "Secp256k1ZKP",
    async () => {
        const [zkpModule, { init }, { confidential }] = await Promise.all([
            import("@vulpemventures/secp256k1-zkp"),
            import("boltz-core/liquid"),
            import("liquidjs-lib"),
        ]);

        const zkp = (zkpModule.default ??
            zkpModule) as unknown as () => Promise<unknown>;
        const secp = await zkp();

        init(secp as never);

        return {
            secpZkp: secp,
            confidential: new confidential.Confidential(secp as never),
        };
    },
);
