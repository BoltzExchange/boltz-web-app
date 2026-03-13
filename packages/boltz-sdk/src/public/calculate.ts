import { BigNumber } from "bignumber.js";

import { SwapType } from "./enums";

/**
 * Round a BigNumber up to the nearest integer (ceiling).
 *
 * @param big - The value to round.
 * @returns The rounded-up integer value.
 */
const bigCeil = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

/**
 * Round a BigNumber down to the nearest integer (floor).
 *
 * @param big - The value to round.
 * @returns The rounded-down integer value.
 */
const bigFloor = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_FLOOR);
};

/**
 * Calculate the amount the user will receive for a given send amount.
 *
 * For **Reverse** and **Chain** swaps the Boltz fee is deducted from the send
 * amount before subtracting the miner fee.  For **Submarine** swaps the fee
 * is factored out differently because the fee is included in the on-chain
 * payment.
 *
 * @param sendAmount - Amount the user sends (satoshis).
 * @param boltzFee - Boltz service fee as a percentage (e.g. `0.1` for 0.1 %).
 * @param minerFee - Miner / network fee in satoshis.
 * @param swapType - The swap direction.
 * @returns The expected receive amount (≥ 0).
 */
export const calculateReceiveAmount = (
    sendAmount: BigNumber,
    boltzFee: number,
    minerFee: number,
    swapType: SwapType,
): BigNumber => {
    const receiveAmount =
        swapType !== SwapType.Submarine
            ? sendAmount
                  .minus(bigCeil(sendAmount.times(boltzFee).div(100)))
                  .minus(minerFee)
            : sendAmount
                  .minus(minerFee)
                  .div(BigNumber(1).plus(BigNumber(boltzFee).div(100)));
    return BigNumber.maximum(bigFloor(receiveAmount), 0);
};

/**
 * Calculate the Boltz service fee portion of a send amount.
 *
 * @param sendAmount - Amount the user sends (satoshis).
 * @param boltzFee - Boltz service fee as a percentage.
 * @param minerFee - Miner / network fee in satoshis.
 * @param swapType - The swap direction.
 * @returns The Boltz fee in satoshis (rounded up).
 */
export const calculateBoltzFeeOnSend = (
    sendAmount: BigNumber,
    boltzFee: number,
    minerFee: number,
    swapType: SwapType,
): BigNumber => {
    if (sendAmount.isNaN()) {
        return BigNumber(0);
    }

    let fee: BigNumber;

    if (swapType !== SwapType.Submarine) {
        fee = bigCeil(sendAmount.times(boltzFee).div(100));
    } else {
        fee = sendAmount
            .minus(
                calculateReceiveAmount(
                    sendAmount,
                    boltzFee,
                    minerFee,
                    swapType,
                ),
            )
            .minus(minerFee);

        if (sendAmount.toNumber() < minerFee) {
            fee = BigNumber(0);
        }
    }

    return bigCeil(fee);
};

/**
 * Calculate the send amount required for the user to receive a desired amount.
 *
 * This is the inverse of {@link calculateReceiveAmount}.
 *
 * @param receiveAmount - Desired receive amount (satoshis).
 * @param boltzFee - Boltz service fee as a percentage.
 * @param minerFee - Miner / network fee in satoshis.
 * @param swapType - The swap direction.
 * @returns The required send amount in satoshis.
 */
export const calculateSendAmount = (
    receiveAmount: BigNumber,
    boltzFee: number,
    minerFee: number,
    swapType: SwapType,
): BigNumber => {
    return swapType !== SwapType.Submarine
        ? bigCeil(
              receiveAmount
                  .plus(minerFee)
                  .div(BigNumber(1).minus(BigNumber(boltzFee).div(100))),
          )
        : bigFloor(
              receiveAmount
                  .plus(
                      bigCeil(
                          receiveAmount.times(BigNumber(boltzFee).div(100)),
                      ),
                  )
                  .plus(minerFee),
          );
};
