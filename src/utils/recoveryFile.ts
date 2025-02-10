import { HDKey } from "@scure/bip32";

export type RecoveryFile = {
    xpriv: string;
};

const getPath = (index: number) => `m/44/0/0/0/${index}`;

export const getXpub = (recoveryFile: RecoveryFile) => {
    const key = HDKey.fromExtendedKey(recoveryFile.xpriv);
    return key.publicExtendedKey;
};

export const generateRecoveryFile = (): RecoveryFile => {
    const entropy = new Uint8Array(32);
    crypto.getRandomValues(entropy);
    const key = HDKey.fromMasterSeed(entropy);

    return {
        xpriv: key.privateExtendedKey,
    };
};

export const deriveKey = (recoveryFile: RecoveryFile, index: number) => {
    const key = HDKey.fromExtendedKey(recoveryFile.xpriv);
    return key.derive(getPath(index));
};
