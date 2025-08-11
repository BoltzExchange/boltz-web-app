import type { Accessor } from "solid-js";

import { LBTC } from "../consts/Assets";
import { isConfidentialAddress } from "./compat";

export const isToUnconfidentialLiquid = ({
    assetReceive,
    addressValid,
    onchainAddress,
}: {
    assetReceive: Accessor<string>;
    addressValid: Accessor<boolean>;
    onchainAddress: Accessor<string>;
}) =>
    assetReceive() === LBTC &&
    addressValid() &&
    !isConfidentialAddress(onchainAddress());

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
export const unconfidentialExtra = 5;
