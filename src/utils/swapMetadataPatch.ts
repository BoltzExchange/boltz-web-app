import { patchSwapMetadata } from "boltz-swaps/client";
import log from "loglevel";

import type { RescueFile } from "./rescueFile";
import type { SomeSwap } from "./swapCreator";
import {
    buildSwapMetadataPayloadFromSwap,
    encryptSwapMetadata,
} from "./swapMetadata";

export const patchEncryptedSwapMetadata = async (
    swap: SomeSwap,
    rescueFile: RescueFile | null | undefined,
) => {
    const payload = buildSwapMetadataPayloadFromSwap(swap);
    if (
        payload === undefined ||
        (payload.lockupTx === undefined &&
            payload.commitmentLockupTxHash === undefined)
    ) {
        return;
    }

    const mnemonic = rescueFile?.mnemonic;
    if (mnemonic === undefined || mnemonic === "") {
        log.warn("Cannot patch swap metadata without rescue file", {
            swapId: swap.id,
        });
        return;
    }

    try {
        await patchSwapMetadata(
            swap.type,
            swap.id,
            await encryptSwapMetadata(mnemonic, payload),
        );
    } catch (error) {
        log.warn("Failed to patch swap metadata", {
            swapId: swap.id,
            error,
        });
    }
};
