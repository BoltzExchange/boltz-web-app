import { crypto } from "bitcoinjs-lib";

import { RBTC } from "../../consts/Assets";
import { derivePreimageFromRescueKey } from "../../utils/claim";
import { mnemonicToHDKey } from "../../utils/rescueFile";

const GAP_LIMIT = 50;

self.onmessage = ({
    data,
}: MessageEvent<{ mnemonic: string; preimageHashes: string[] }>) => {
    const hdKey = mnemonicToHDKey(data.mnemonic);
    const preimageHashSet = new Set(data.preimageHashes);

    let highestIndex = 0;
    let consecutiveMisses = 0;

    for (let i = 0; consecutiveMisses < GAP_LIMIT; i++) {
        const preimage = derivePreimageFromRescueKey(
            { mnemonic: data.mnemonic },
            i,
            RBTC,
            hdKey,
        );
        const preimageHash = crypto.sha256(preimage).toString("hex");

        if (preimageHashSet.has(preimageHash)) {
            highestIndex = i;
            consecutiveMisses = 0;
        } else {
            consecutiveMisses++;
        }
    }

    self.postMessage(highestIndex);
};
