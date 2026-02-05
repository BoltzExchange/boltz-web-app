import { crypto } from "bitcoinjs-lib";

import { mnemonicToHDKey, rskDerivationPath } from "../../utils/rescueFile";

const maxIterations = 100_000;
const batchSize = 1_000;

export type PreimageHashEntry = [string, { preimage: string; index: number }];

export type PreimageHashMessage = {
    entries: PreimageHashEntry[];
    done: boolean;
};

self.onmessage = ({ data }: MessageEvent<{ mnemonic: string }>) => {
    const parentKey = mnemonicToHDKey(data.mnemonic).derive(rskDerivationPath);
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
