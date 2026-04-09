import { config } from "../config";

const bufferSeconds = 10;
const dstBlocks = 3;

const getBlockTimeSeconds = (asset: string): number | undefined =>
    config.assets?.[asset]?.network?.blockTimeSeconds;

const getLzConfirmations = (asset: string): number | undefined =>
    config.assets?.[asset]?.network?.lzConfirmations;

export const computeOftEtaSeconds = (
    sourceAsset: string,
    destinationAsset: string,
): number | undefined => {
    const srcBlockTime = getBlockTimeSeconds(sourceAsset);
    const dstBlockTime = getBlockTimeSeconds(destinationAsset);
    const confirmations = getLzConfirmations(sourceAsset);

    if (
        srcBlockTime === undefined ||
        dstBlockTime === undefined ||
        confirmations === undefined
    ) {
        return undefined;
    }

    return (
        (confirmations + 1) * srcBlockTime +
        dstBlocks * dstBlockTime +
        bufferSeconds
    );
};
