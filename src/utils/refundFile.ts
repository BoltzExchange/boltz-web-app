import { LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { migrateSwapToChainSwapFormat } from "./migration";
import { RecoveryFile, getXpub } from "./recoveryFile";

const getRequiredKeys = (
    isLegacy: boolean,
    asset: string,
    type: SwapType,
): string[] => {
    if (isLegacy) {
        const legacyKeys = ["id", "asset", "privateKey"];

        if (asset === LBTC) {
            return legacyKeys.concat("blindingKey");
        }

        return legacyKeys;
    }

    const taprootKeys = [
        "id",
        "type",
        "assetSend",
        "assetReceive",
        "refundPrivateKey",
    ];

    if (type === SwapType.Chain) {
        return taprootKeys.concat(["claimDetails", "lockupDetails"]);
    }

    if (asset === LBTC) {
        return taprootKeys.concat("blindingKey");
    }

    return taprootKeys;
};

export const validateRefundFile = (
    data: Record<string, string | object | number | boolean>,
): { id: string } & Record<string, string | object | number | boolean> => {
    // Compatibility with ancient refund files
    if (data.asset === undefined && data.currency !== undefined) {
        data.asset = data.currency;
    }

    const isLegacy = "asset" in data;
    const requiredKeys = getRequiredKeys(
        isLegacy,
        (data.asset || data.assetSend) as string,
        data.type as SwapType,
    );

    if (!requiredKeys.every((key) => key in data)) {
        throw "invalid refund file";
    }

    if (isLegacy) {
        return migrateSwapToChainSwapFormat({
            ...data,
            reverse: false,
        });
    }

    return data as { id: string } & Record<string, string | object | number>;
};

export const validateRecoveryFile = (
    data: Record<string, string | object | number | boolean>,
): RecoveryFile => {
    if (!("xpriv" in data)) {
        throw "invalid recovery file";
    }

    getXpub(data as RecoveryFile);

    return data as RecoveryFile;
};
