import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";

import {
    derivePreimage,
    evmPath,
    mnemonicToHDKey,
} from "../../utils/rescueDerivation";
import { maxIterations } from "./constants";

const batchSize = 1_000;

export type PreimageHashEntry = [string, { preimage: string; index: number }];

export type PreimageHashMessage = {
    entries: PreimageHashEntry[];
    done: boolean;
};

self.onmessage = ({
    data,
}: MessageEvent<{ mnemonic: string; chainId: number }>) => {
    const parentKey = mnemonicToHDKey(data.mnemonic).derive(
        evmPath(data.chainId),
    );
    let entries: PreimageHashEntry[] = [];

    for (let i = 0; i < maxIterations; i++) {
        const preimage = derivePreimage(parentKey.deriveChild(i).privateKey);
        const preimageHex = hex.encode(preimage);
        const preimageHash = hex.encode(sha256(preimage));

        entries.push([preimageHash, { preimage: preimageHex, index: i }]);

        if (entries.length >= batchSize) {
            self.postMessage({ entries, done: false });
            entries = [];
        }
    }

    self.postMessage({ entries, done: true });
};
