import { crypto } from "bitcoinjs-lib";

import { RBTC } from "../../consts/Assets";
import { derivePreimageFromRescueKey } from "../../utils/claim";
import { mnemonicToHDKey } from "../../utils/rescueFile";

const maxIterations = 5_000;

// Returns array of [preimageHash, preimage] pairs (Maps can't be serialized via postMessage)
export type PreimageHashPair = [string, string];

self.onmessage = ({ data }: MessageEvent<{ mnemonic: string }>) => {
    const hdKey = mnemonicToHDKey(data.mnemonic);
    const pairs: PreimageHashPair[] = [];

    for (let i = 0; i < maxIterations; i++) {
        const preimage = derivePreimageFromRescueKey(
            { mnemonic: data.mnemonic },
            i,
            RBTC,
            hdKey,
        );
        const preimageHex = preimage.toString("hex");
        const preimageHash = crypto.sha256(preimage).toString("hex");
        pairs.push([preimageHash, preimageHex]);
    }

    self.postMessage(pairs);
};
