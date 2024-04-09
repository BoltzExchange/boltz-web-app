import { BigNumber } from "bignumber.js";

import { SwapType } from "../consts/Enums";

const bigCeil = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

const bigFloor = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_FLOOR);
};

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
