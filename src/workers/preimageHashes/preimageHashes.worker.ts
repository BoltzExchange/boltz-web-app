import { crypto } from "bitcoinjs-lib";

import { RBTC } from "../../consts/Assets";
import {
    derivePreimageFromRescueKey,
    mnemonicToHDKey,
} from "../../utils/rescueFile";

const maxIterations = 5_000;

export type PreimageHashEntry = [string, { preimage: string; index: number }];

// Flat structure that survives postMessage serialization (Maps don't)
export type PreimageHashResult = {
    entries: PreimageHashEntry[];
    match: boolean;
};

self.onmessage = ({
    data,
}: MessageEvent<{ mnemonic: string; target: string }>) => {
    const hdKey = mnemonicToHDKey(data.mnemonic);
    const entries: PreimageHashEntry[] = [];
    let match = false;

    for (let i = 0; i < maxIterations; i++) {
        const preimage = derivePreimageFromRescueKey(
            { mnemonic: data.mnemonic },
            i,
            RBTC,
            hdKey,
        );
        const preimageHex = preimage.toString("hex");
        const preimageHash = crypto.sha256(preimage).toString("hex");

        // The index is needed because not all lockups necessarily share
        // the same rescue key, we cache the index to avoid re-deriving preimage hashes.
        entries.push([preimageHash, { preimage: preimageHex, index: i }]);

        if (preimageHash === data.target) {
            match = true;
            break;
        }
    }

    self.postMessage({ entries, match });
};
