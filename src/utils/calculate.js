import { BigNumber } from "bignumber.js";
import { boltzFee, minerFee } from "../signals";

export const calculateReceiveAmount = (sendAmount) => {
    const preMinerFee = BigNumber(sendAmount).minus(minerFee());
    const receiveAmount = preMinerFee.minus(
        preMinerFee.times(boltzFee()).div(100)
    );
    return Math.floor(receiveAmount.toNumber());
};

export const calculateSendAmount = (receiveAmount) => {
    return Math.floor(
        BigNumber(receiveAmount)
            .plus(minerFee())
            .plus(BigNumber(receiveAmount).times(boltzFee()).div(100))
            .toNumber()
    );
};
