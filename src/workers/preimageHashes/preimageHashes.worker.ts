import { crypto } from "bitcoinjs-lib";

import { evmPath, mnemonicToHDKey } from "../../utils/rescueFile";
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
        const preimage = crypto.sha256(
            Buffer.from(parentKey.deriveChild(i).privateKey),
        );
        const preimageHex = preimage.toString("hex");
        const preimageHash = crypto.sha256(preimage).toString("hex");

        entries.push([preimageHash, { preimage: preimageHex, index: i }]);

        if (entries.length >= batchSize) {
            self.postMessage({ entries, done: false });
            entries = [];
        }
    }

    self.postMessage({ entries, done: true });
};
