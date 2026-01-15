import { crypto } from "bitcoinjs-lib";

import { RBTC } from "../../consts/Assets";
import { derivePreimageFromRescueKey } from "../../utils/claim";
import { mnemonicToHDKey } from "../../utils/rescueFile";

const maxIterations = 5_000;

self.onmessage = ({
    data,
}: MessageEvent<{ mnemonic: string; preimageHash: string }>) => {
    const hdKey = mnemonicToHDKey(data.mnemonic);

    for (let i = 0; i < maxIterations; i++) {
        const p = derivePreimageFromRescueKey(
            { mnemonic: data.mnemonic },
            i,
            RBTC,
            hdKey,
        );
        if (crypto.sha256(p).toString("hex") === data.preimageHash) {
            self.postMessage(p.toString("hex"));
            return;
        }
    }

    self.postMessage(null);
};
