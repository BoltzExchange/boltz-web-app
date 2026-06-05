import { hex } from "@scure/base";
import type { LiquidTransactionOutputWithKey } from "boltz-swaps/utxo";
import log from "loglevel";

import { LBTC } from "../consts/Assets";
import secp from "../lazy/secp";

// Per blinded output, the Blockstream explorer expects a comma separated tuple
// in its "#blinded=" URL fragment:
//   <value_in_satoshis>,<asset>,<value_blinder>,<asset_blinder>
// The asset id and both blinders are hex encoded in *reverse* byte order, as
// the explorer reverses each value again before handing it to libwally.
// See Blockstream/esplora: client/src/lib/libwally.js (parseHex) and
// client/src/driver/blinding.js (parseBlinders).
const reverseHex = (bytes: Uint8Array): string =>
    hex.encode(Uint8Array.from(bytes).reverse());

export type BlindingData = {
    value: string;
    asset: Uint8Array;
    valueBlindingFactor: Uint8Array;
    assetBlindingFactor: Uint8Array;
};

export const formatBlindingData = (unblinded: BlindingData): string =>
    [
        unblinded.value,
        reverseHex(unblinded.asset),
        reverseHex(unblinded.valueBlindingFactor),
        reverseHex(unblinded.assetBlindingFactor),
    ].join(",");

// Builds the "#blinded=" fragment for the lockup output spent by a claim
// transaction. Providing the input blinders is enough: the explorer deduces
// the (single) blinded claim output from the known input and explicit fee.
export const getClaimBlindingData = async (
    asset: string,
    output: LiquidTransactionOutputWithKey,
): Promise<string | undefined> => {
    if (
        asset !== LBTC ||
        output.blindingPrivateKey === undefined ||
        output.rangeProof === undefined ||
        output.rangeProof.length === 0
    ) {
        return undefined;
    }

    try {
        const { confidential } = await secp.get();
        const unblinded = confidential.unblindOutputWithKey(
            output,
            output.blindingPrivateKey,
        );
        return formatBlindingData(unblinded);
    } catch (e) {
        log.warn("Could not build claim unblinding data", e);
        return undefined;
    }
};
