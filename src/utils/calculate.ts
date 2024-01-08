import { BigNumber } from "bignumber.js";

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
    reverse: boolean,
): BigNumber => {
    const receiveAmount = reverse
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
    reverse: boolean,
): BigNumber => {
    if (sendAmount.isNaN()) {
        return BigNumber(0);
    }

    let fee: BigNumber;

    if (reverse) {
        fee = bigCeil(sendAmount.times(boltzFee).div(100));
    } else {
        fee = sendAmount
            .minus(
                calculateReceiveAmount(sendAmount, boltzFee, minerFee, reverse),
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
    reverse: boolean,
): BigNumber => {
    return reverse
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
