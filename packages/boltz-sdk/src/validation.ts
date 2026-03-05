import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import { equalBytes } from "@scure/btc-signer/utils.js";
import { BigNumber } from "bignumber.js";
import type { Types } from "boltz-core";
import { Scripts } from "boltz-core";

import { LBTC } from "./assets";
import { decodeAddress } from "./compat";
import { formatAmountDenomination } from "./denomination";
import type { ECKeys } from "./ecpair";
import { Denomination } from "./enums";
import { createMusig, tweakMusig } from "./musig";

export const invalidSendAmountMsg = (expected: number, got: number) =>
    `invalid send amount. Expected ${expected}, got ${got}`;

export const invalidReceiveAmountMsg = (expected: number, got: number) =>
    `invalid receive amount. Expected ${expected} to be bigger than ${got}`;

export const validateSwapAddress = (
    chain: string,
    tree: Types.SwapTree,
    ourKeys: ECKeys,
    theirPublicKey: Uint8Array,
    address: string,
    blindingKey: string | undefined,
): void => {
    const keyAgg = createMusig(ourKeys, theirPublicKey);
    const tweaked = tweakMusig(chain, keyAgg, tree.tree);

    const compareScript = Scripts.p2trOutput(tweaked.aggPubkey);
    const decodedAddress = decodeAddress(chain, address);

    if (!equalBytes(decodedAddress.script, compareScript)) {
        throw new Error("decoded address script mismatch");
    }

    if (chain === LBTC) {
        if (!blindingKey) {
            throw new Error("missing blindingKey for LBTC address validation");
        }
        const blindingPrivateKey = hex.decode(blindingKey);
        const blindingPublicKey = secp256k1.getPublicKey(blindingPrivateKey);

        if (
            !decodedAddress.blindingKey ||
            !equalBytes(decodedAddress.blindingKey, blindingPublicKey)
        ) {
            throw new Error("blinding public key mismatch");
        }
    }
};

export const validateBip21 = (
    bip21: string,
    address: string,
    expectedAmount: number,
): void => {
    const bip21Split = bip21.split("?");
    if (bip21Split[0].split(":")[1] !== address) {
        throw new Error("invalid BIP21 format");
    }

    const params = new URLSearchParams(bip21Split[1]);

    if (expectedAmount === 0) {
        const hasAmount = params.has("amount");
        if (hasAmount) {
            throw new Error(
                `unexpected amount in BIP21. Expected 0, got ${params.get("amount")}`,
            );
        }
        return;
    }

    if (
        params.get("amount") !==
        formatAmountDenomination(
            BigNumber(expectedAmount),
            Denomination.Btc,
            ".",
        )
    ) {
        throw new Error(
            `invalid BIP21 amount. Expected ${expectedAmount}, got ${params.get("amount")}`,
        );
    }
};
