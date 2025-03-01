import { HDKey } from "@scure/bip32";

export type RescueFile = {
    xpriv: string;
};

const getPath = (index: number) => `m/44/0/0/0/${index}`;

export const getXpub = (rescueFile: RescueFile) => {
    const key = HDKey.fromExtendedKey(rescueFile.xpriv);
    return key.publicExtendedKey;
};

export const generateRescueFile = (): RescueFile => {
    const entropy = new Uint8Array(32);
    crypto.getRandomValues(entropy);
    const key = HDKey.fromMasterSeed(entropy);

    return {
        xpriv: key.privateExtendedKey,
    };
};

export const deriveKey = (rescueFile: RescueFile, index: number) => {
    const key = HDKey.fromExtendedKey(rescueFile.xpriv);
    return key.derive(getPath(index));
};

export const validateRescueFile = (
    data: Record<string, string | object | number | boolean>,
): RescueFile => {
    if (!("xpriv" in data)) {
        throw "invalid rescue file";
    }

    getXpub(data as RescueFile);

    return data as RescueFile;
};
